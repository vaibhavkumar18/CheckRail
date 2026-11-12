import path from "node:path";
import fs from "node:fs/promises";

import { calculateSHA256 } from "../../utils/fileHash.js";

import { extractEvidence } from "../Ingestion/Evidence/evidenceExtractor.js";
import { runPreliminaryAssessment } from "../Assessment/Assessment.services.js";
import {
  checkProjectAccess,
  createIntegrationSource,
  createIntegration as createIntegrationRecord,
  getIntegrationSourceForUser,
  getIntegrationSourceForProcessing,
  updateIntegrationSourceStatus,
  getIntegrationForUser,
  getIntegrationsForProject,
  updateIntegrationProfile as updateIntegrationProfileRecord,
  confirmIntegration as confirmIntegrationRecord,
  getAllIntegrationsForUser,
} from "./Integration.model.js";

import { IntegrationProfileSchema } from "../Interpretation/validators/interpretation.schema.js";

import interpretIntegration from "../Interpretation/services/interpretation.service.js";

import {
  uploadIntegrationSource,
  deleteIntegrationSource,
  downloadIntegrationSource,
} from "./Integration.storage.js";

import { scanExtractedDirectory } from "../Ingestion/secretScanner.js";
import { inspectZipBuffer } from "../Ingestion/zipInspector.js";
import { extractZipBuffer } from "../Ingestion/zipExtractor.js";

import { classifyFiles, TEXT_EXTENSIONS } from "../Ingestion/fileClassifier.js";

const MAX_CLASSIFIER_FILE_SIZE = 1_000_000;
const MAX_CLASSIFIER_TOTAL_SIZE = 10_000_000;

// --------------------------------------------------
// Source Type
// --------------------------------------------------

const getSourceType = (filename) => {
  const extension = filename.split(".").pop().toLowerCase();

  if (extension === "zip") {
    return "ZIP";
  }

  if (["json", "yaml", "yml"].includes(extension)) {
    return "OPENAPI";
  }

  throw new Error("Unsupported integration source type.");
};

// --------------------------------------------------
// Classify Extracted Files
// --------------------------------------------------

const classifyExtractedFiles = async (extraction) => {
  let totalContentBytes = 0;

  const files = [];

  for (const manifestEntry of extraction.manifest) {
    const { relativePath, size } = manifestEntry;

    const extension = path.posix.extname(relativePath).toLowerCase();

    let content = "";

    if (
      TEXT_EXTENSIONS.has(extension) &&
      size <= MAX_CLASSIFIER_FILE_SIZE &&
      totalContentBytes + size <= MAX_CLASSIFIER_TOTAL_SIZE
    ) {
      const absolutePath = path.resolve(
        extraction.extractionDir,
        ...relativePath.split("/"),
      );

      const extractionRoot = path.resolve(extraction.extractionDir);

      const relativeToRoot = path.relative(extractionRoot, absolutePath);

      if (
        relativeToRoot === ".." ||
        relativeToRoot.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeToRoot)
      ) {
        throw new Error(`Unsafe extracted file path: ${relativePath}`);
      }

      const buffer = await fs.readFile(absolutePath);

      if (buffer.length !== Number(size)) {
        const error = new Error(
          `Extracted file size changed before classification: ${relativePath}`,
        );

        error.statusCode = 422;
        throw error;
      }

      const actualSHA256 = calculateSHA256(buffer);

      if (actualSHA256 !== manifestEntry.sha256) {
        const error = new Error(
          `Extracted file integrity verification failed: ${relativePath}`,
        );

        error.statusCode = 422;
        throw error;
      }

      content = buffer.toString("utf8");

      totalContentBytes += buffer.length;
    }

    files.push({
      relativePath,
      content,
    });
  }

  return classifyFiles(files);
};

// --------------------------------------------------
// Create Integration
// --------------------------------------------------

export const createIntegration = async ({ file, projectId, userId }) => {
  // 1. Verify project access.

  const project = await checkProjectAccess(projectId, userId);

  if (!project) {
    const error = new Error(
      "Project not found or you do not have permission to access it.",
    );

    error.statusCode = 404;
    throw error;
  }

  // 2. Identify source type.

  const sourceType = getSourceType(file.originalname);

  if (sourceType !== "ZIP") {
    const error = new Error(
      "Currently, only ZIP integration uploads are supported.",
    );

    error.statusCode = 422;
    throw error;
  }

  // 3. Calculate source fingerprint.

  const sha256 = calculateSHA256(file.buffer);

  // 4. Upload original file to Cloudinary.

  const storedFile = await uploadIntegrationSource(file, projectId);

  let integrationSource;

  try {
    // 5. Persist source metadata.

    integrationSource = await createIntegrationSource({
      projectId,
      originalFilename: file.originalname,
      sourceType,
      mimeType: file.mimetype,
      fileSize: file.size,
      sha256,
      storageProvider: "CLOUDINARY",
      storageAssetId: storedFile.assetId,
      storagePublicId: storedFile.publicId,
      resourceType: storedFile.resourceType,
      deliveryType: storedFile.deliveryType,
      uploadedBy: userId,
    });
  } catch (databaseError) {
    // Clean up Cloudinary if database insertion fails.

    try {
      await deleteIntegrationSource(storedFile.publicId);
    } catch (cleanupError) {
      console.error(
        "Failed to clean up orphaned Cloudinary asset:",
        cleanupError.message,
      );
    }

    throw databaseError;
  }

  // 6. Automatically process uploaded source.
  // Preserve uploaded source if processing fails.

  const processingResult = await processIntegrationSource({
    projectId,
    sourceId: integrationSource.id,
    userId,
  });

  return {
    integrationSource: processingResult.integrationSource,
    integration: processingResult.integration,
    processing: processingResult.processing,
  };
};

// --------------------------------------------------
// Retrieve and Verify Source
// --------------------------------------------------

export const retrieveAndVerifyIntegrationSource = async ({
  sourceId,
  userId,
}) => {
  const source = await getIntegrationSourceForUser(sourceId, userId);

  if (!source) {
    const error = new Error("Integration source not found or access denied.");

    error.statusCode = 404;
    throw error;
  }

  const buffer = await downloadIntegrationSource(source);

  if (buffer.length !== Number(source.file_size)) {
    const error = new Error(
      "Integration source integrity verification failed: file size mismatch.",
    );

    error.statusCode = 422;
    throw error;
  }

  const actualSHA256 = calculateSHA256(buffer);

  const expectedSHA256 = source.sha256.trim().toLowerCase();

  if (actualSHA256 !== expectedSHA256) {
    const error = new Error(
      "Integration source integrity verification failed: SHA-256 mismatch.",
    );

    error.statusCode = 422;
    throw error;
  }

  return {
    sourceId: source.id,
    originalFilename: source.original_filename,
    sourceType: source.source_type,
    size: buffer.length,
    sha256: actualSHA256,
    integrityVerified: true,
    buffer,
  };
};

// --------------------------------------------------
// Process Integration Source
// --------------------------------------------------

export const processIntegrationSource = async ({
  projectId,
  sourceId,
  userId,
}) => {
  const source = await getIntegrationSourceForProcessing(
    sourceId,
    projectId,
    userId,
  );

  if (!source) {
    const error = new Error("Integration source not found or access denied.");

    error.statusCode = 404;
    throw error;
  }

  let extraction;

  try {
    // 1. Mark source as processing.

    await updateIntegrationSourceStatus(sourceId, "PROCESSING");

    // 2. Download original source.

    const buffer = await downloadIntegrationSource(source);

    // 3. Verify file size.

    if (buffer.length !== Number(source.file_size)) {
      throw Object.assign(
        new Error("Integration source size verification failed."),
        { statusCode: 422 },
      );
    }

    // 4. Verify SHA-256.

    const actualSHA256 = calculateSHA256(buffer);

    const expectedSHA256 = source.sha256.trim().toLowerCase();

    if (actualSHA256 !== expectedSHA256) {
      throw Object.assign(
        new Error("Integration source SHA-256 verification failed."),
        { statusCode: 422 },
      );
    }

    // 5. Only ZIP processing is currently supported.

    if (source.source_type !== "ZIP") {
      throw Object.assign(
        new Error("Only ZIP integration sources are supported."),
        { statusCode: 422 },
      );
    }

    // 6. Inspect ZIP.

    const inspection = await inspectZipBuffer(buffer);

    // 7. Safely extract ZIP.

    extraction = await extractZipBuffer(buffer);

    // 8. Scan extracted files for potential secrets.

    const secretScan = await scanExtractedDirectory(
      extraction.extractionDir,
      extraction.manifest,
    );

    // 9. Classify files.

    const classifications = await classifyExtractedFiles(extraction);

    // 10. Extract and normalize evidence.

    const evidenceResult = await extractEvidence({
      extractionDir: extraction.extractionDir,
      manifest: extraction.manifest,
    });

    if (
      !evidenceResult.success ||
      evidenceResult.processingStatus !== "COMPLETED"
    ) {
      console.error(
        "[ACTUAL EVIDENCE ERRORS]",
        JSON.stringify(
          evidenceResult?.errors ?? evidenceResult?.details?.errors ?? [],
          null,
          2,
        ),
      );

      console.error(
        "[FULL EVIDENCE RESULT]",
        JSON.stringify(evidenceResult, null, 2),
      );
      throw Object.assign(
        new Error("Evidence extraction did not complete successfully."),
        {
          statusCode: 422,
          details: {
            processingStatus: evidenceResult.processingStatus,
            errors: evidenceResult.errors,
          },
        },
      );
    }

    // 11. Interpret normalized evidence.

    const interpretationResult = await interpretIntegration({
      integrationId: source.id,
      normalizedEvidence: evidenceResult.normalizedEvidence,
      metadata: {
        name: source.original_filename,
        description: `Integration analysis for ${source.original_filename}`,
      },
    });
    console.log(
      "[HYPERWALLET EXTRACTION DIAGNOSTICS]",
      JSON.stringify(
        {
          processingStatus: evidenceResult.processingStatus,
          extraction: evidenceResult.extraction,
          errors: evidenceResult.errors,
          normalizedErrors: evidenceResult.normalizedEvidence?.errors,
          normalizedSummary: evidenceResult.normalizedEvidence?.summary,
        },
        null,
        2,
      ),
    );
    if (!interpretationResult.success || !interpretationResult.profile) {
      throw Object.assign(
        new Error("Integration profile verification failed."),
        {
          statusCode: 422,
          details: {
            verification: interpretationResult.verification,
            ai: interpretationResult.ai,
          },
        },
      );
    }

    // 12. Validate final profile before persistence.

    const validatedProfile = IntegrationProfileSchema.safeParse(
      interpretationResult.profile,
    );

    if (!validatedProfile.success) {
      throw Object.assign(
        new Error("Generated Integration Profile failed schema validation."),
        {
          statusCode: 422,
          details: validatedProfile.error.flatten(),
        },
      );
    }

    // 13. Persist generated Integration Profile.

    const integration = await createIntegrationRecord({
      sourceId: source.id,
      projectId,
      profile: validatedProfile.data,
    });

    // 14. Mark source ready only after profile persistence.

    const updatedSource = await updateIntegrationSourceStatus(
      sourceId,
      "READY",
    );

    return {
      integrationSource: updatedSource,

      integration: {
        id: integration.id,
        sourceId: integration.source_id,
        projectId: integration.project_id,
        reviewStatus: integration.review_status,
        profile: integration.integration_profile,
        createdAt: integration.created_at,
      },

      processing: {
        integrityVerified: true,
        sha256: actualSHA256,

        archiveInspection: {
          valid: inspection.valid,
          entryCount: inspection.entryCount,
          totalUncompressedSize: inspection.totalUncompressedSize,
        },

        extraction: {
          fileCount: extraction.fileCount,
          totalBytesWritten: extraction.totalBytesWritten,
        },

        secretScan: {
          filesScanned: secretScan.filesScanned,
          findingsCount: secretScan.findingsCount,
          findings: secretScan.findings,
        },

        classification: {
          filesClassified: classifications.length,
          categories: classifications,
        },

        evidenceExtraction: {
          status: evidenceResult.processingStatus,
          summary: evidenceResult.normalizedEvidence.summary,
          errors: evidenceResult.errors,
        },

        interpretation: {
          status: interpretationResult.status,
          summary: interpretationResult.analysisSummary,
          verification: interpretationResult.verification,

          // NEW: AI execution diagnostics.
          ai: interpretationResult.ai,
        },
      },
    };
  } catch (error) {
    // Preserve source record for diagnosis.

    try {
      await updateIntegrationSourceStatus(sourceId, "FAILED");
    } catch (statusError) {
      console.error(
        "Failed to update integration source status:",
        statusError.message,
      );
    }

    throw error;
  } finally {
    // Always clean up temporary extracted files.

    if (extraction?.extractionDir) {
      try {
        await fs.rm(extraction.extractionDir, {
          recursive: true,
          force: true,
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up extracted integration files:",
          cleanupError.message,
        );
      }
    }
  }
};

// --------------------------------------------------
// Retrieve Integration Preview
// --------------------------------------------------

export const getIntegrationPreview = async ({ integrationId, userId }) => {
  const integration = await getIntegrationForUser(integrationId, userId);

  if (!integration) {
    const error = new Error("Integration not found or access denied.");

    error.statusCode = 404;
    throw error;
  }

  return integration;
};

// --------------------------------------------------
// Update Integration Preview
// --------------------------------------------------

export const updateIntegrationPreview = async ({
  integrationId,
  userId,
  profile,
}) => {
  const validatedProfile = IntegrationProfileSchema.safeParse(profile);

  if (!validatedProfile.success) {
    const error = new Error("Invalid Integration Profile.");

    error.statusCode = 400;
    error.details = validatedProfile.error.flatten();

    throw error;
  }

  const updatedIntegration = await updateIntegrationProfileRecord({
    integrationId,
    userId,
    profile: validatedProfile.data,
  });

  if (!updatedIntegration) {
    const error = new Error(
      "Integration not found, access denied, or already confirmed.",
    );

    error.statusCode = 404;
    throw error;
  }

  return updatedIntegration;
};

// --------------------------------------------------
// Confirm Integration
// --------------------------------------------------

// --------------------------------------------------
// Confirm Integration + Automatic Assessment
// --------------------------------------------------

export const confirmIntegration = async ({ integrationId, userId }) => {
  let confirmedIntegration = await confirmIntegrationRecord({
    integrationId,
    userId,
  });

  // Handle retry when the integration was already confirmed.
  if (!confirmedIntegration) {
    const existingIntegration = await getIntegrationForUser(
      integrationId,
      userId,
    );

    if (
      !existingIntegration ||
      existingIntegration.review_status !== "CONFIRMED"
    ) {
      const error = new Error(
        "Integration not found or confirmation is not permitted.",
      );

      error.statusCode = 404;
      throw error;
    }

    confirmedIntegration = existingIntegration;
  }

  // Automatically execute the preliminary assessment.
  const assessment = await runPreliminaryAssessment({
    integrationId,
    userId,
  });

  return {
    integration: confirmedIntegration,
    assessment,
  };
};

// --------------------------------------------------
// List Integration Profiles For Project
// --------------------------------------------------

export const listIntegrationsForProject = async ({ projectId, userId }) => {
  return getIntegrationsForProject(projectId, userId);
};

// --------------------------------------------------
// List All Integration Profiles Across User Projects
// --------------------------------------------------

export const listIntegrationsForUser = async ({ userId }) => {
  return getAllIntegrationsForUser(userId);
};
