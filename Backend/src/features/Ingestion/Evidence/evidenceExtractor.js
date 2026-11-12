import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  classifyFiles,
  TEXT_EXTENSIONS,
  CATEGORIES,
} from "../fileClassifier.js";

import { extractOpenApiEvidence } from "./extractors/openApiExtractor.js";

import { extractCodeEvidence } from "./extractors/codeExtractor.js";

import { extractConfigEvidence } from "./extractors/configExtractor.js";

import { extractDocumentationEvidence } from "./extractors/documentationExtractor.js";

import { normalizeEvidence } from "./evidenceNormalizer.js";

// --------------------------------------------------
// Limits
// --------------------------------------------------

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const MAX_FILES = 1000;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const createProcessingError = ({ file = null, type, message }) => ({
  file,
  type,
  message,
});

const isSafeRelativePath = (relativePath) => {
  if (
    typeof relativePath !== "string" ||
    !relativePath.trim() ||
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    return false;
  }

  const segments = relativePath.split("/");

  return segments.every(
    (segment) => segment && segment !== "." && segment !== "..",
  );
};

const resolveSafeFilePath = (extractionDir, relativePath) => {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe manifest path: ${relativePath}`);
  }

  const root = path.resolve(extractionDir);

  const destination = path.resolve(root, ...relativePath.split("/"));

  const relativeDestination = path.relative(root, destination);

  if (
    !relativeDestination ||
    relativeDestination === ".." ||
    relativeDestination.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeDestination)
  ) {
    throw new Error(
      `Manifest path escapes extraction directory: ${relativePath}`,
    );
  }

  return destination;
};

// --------------------------------------------------
// Read and verify manifest files
// --------------------------------------------------

const readVerifiedFiles = async (extractionDir, manifest) => {
  if (!Array.isArray(manifest)) {
    throw new Error("A valid extraction manifest is required.");
  }

  if (manifest.length > MAX_FILES) {
    throw new Error(
      `Manifest exceeds the processing limit of ${MAX_FILES} files.`,
    );
  }

  const files = [];
  const errors = [];

  let totalBytesRead = 0;

  const seenPaths = new Set();

  for (const entry of manifest) {
    const relativePath = entry?.relativePath;

    try {
      if (
        typeof relativePath !== "string" ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        typeof entry.sha256 !== "string"
      ) {
        throw new Error("Invalid manifest entry.");
      }

      const pathKey = relativePath.toLowerCase();

      if (seenPaths.has(pathKey)) {
        throw new Error(`Duplicate manifest path: ${relativePath}`);
      }

      seenPaths.add(pathKey);

      // Ignore unsupported binary file types.
      const extension = path.posix.extname(relativePath).toLowerCase();

      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) {
        errors.push(
          createProcessingError({
            file: relativePath,
            type: "FILE_SIZE_LIMIT",
            message: `File exceeds the ${MAX_FILE_SIZE} byte evidence processing limit.`,
          }),
        );

        continue;
      }

      if (totalBytesRead + entry.size > MAX_TOTAL_SIZE) {
        errors.push(
          createProcessingError({
            file: relativePath,
            type: "TOTAL_SIZE_LIMIT",
            message: "Evidence processing total size limit reached.",
          }),
        );

        break;
      }

      const filePath = resolveSafeFilePath(extractionDir, relativePath);

      const fileStats = await fs.lstat(filePath);

      if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
        throw new Error("Manifest entry is not a regular file.");
      }

      if (fileStats.size !== entry.size) {
        throw new Error("File size does not match the extraction manifest.");
      }

      const buffer = await fs.readFile(filePath);

      if (buffer.length !== entry.size) {
        throw new Error(
          "Read file size does not match the extraction manifest.",
        );
      }

      const actualHash = sha256(buffer);

      if (actualHash !== entry.sha256) {
        throw new Error("File SHA-256 does not match the extraction manifest.");
      }

      totalBytesRead += buffer.length;

      files.push({
        relativePath,
        content: buffer,
      });
    } catch (error) {
      errors.push(
        createProcessingError({
          file: relativePath ?? null,
          type: "FILE_VERIFICATION_ERROR",
          message: error.message,
        }),
      );
    }
  }

  return {
    files,
    errors,
    totalBytesRead,
  };
};

// --------------------------------------------------
// File classification and routing
// --------------------------------------------------

const getFileCategories = (classification) => [
  classification.category,
  ...(classification.additionalCategories ?? []),
];

const hasCategory = (classification, category) =>
  getFileCategories(classification).includes(category);

const routeFiles = (files, classifications) => {
  const filesByPath = new Map(files.map((file) => [file.relativePath, file]));

  const routed = {
    openApi: [],
    code: [],
    config: [],
    documentation: [],
  };

  for (const classification of classifications) {
    const file = filesByPath.get(classification.relativePath);

    if (!file) {
      continue;
    }

    if (hasCategory(classification, CATEGORIES.API_SPECIFICATION)) {
      routed.openApi.push(file);
    }

    if (hasCategory(classification, CATEGORIES.PAYMENT_CLIENT)) {
      routed.code.push(file);
    }

    if (
      hasCategory(classification, CATEGORIES.CONFIGURATION) ||
      hasCategory(classification, CATEGORIES.ENVIRONMENT_TEMPLATE)
    ) {
      routed.config.push(file);
    }

    if (hasCategory(classification, CATEGORIES.DOCUMENTATION)) {
      routed.documentation.push(file);
    }
  }

  return routed;
};

// --------------------------------------------------
// Extractor execution
// --------------------------------------------------

const runArrayExtractor = ({ extractor, files, extractorName }) => {
  if (files.length === 0) {
    return null;
  }

  try {
    return extractor(files);
  } catch (error) {
    return {
      evidence: [],
      errors: [
        {
          file: null,
          type: "EXTRACTOR_ERROR",
          message: error.message,
        },
      ],
      summary: {
        totalFiles: files.length,
        filesProcessed: 0,
        filesSkipped: files.length,
        evidenceCount: 0,
        errorCount: 1,
      },
      limitations: [`${extractorName} failed during processing.`],
    };
  }
};

// --------------------------------------------------
// OpenAPI extraction
// --------------------------------------------------

const runOpenApiExtractor = (files) => {
  const results = [];
  const errors = [];

  for (const file of files) {
    const extension = path.posix.extname(file.relativePath).toLowerCase();

    if (extension !== ".json") {
      errors.push(
        createProcessingError({
          file: file.relativePath,
          type: "UNSUPPORTED_OPENAPI_FORMAT",
          message:
            "Only JSON API specifications are currently supported. YAML support has not been implemented.",
        }),
      );

      continue;
    }

    try {
      const document = JSON.parse(file.content.toString("utf8"));

      const result = extractOpenApiEvidence(document, file.relativePath);

      results.push(result);
    } catch (error) {
      errors.push(
        createProcessingError({
          file: file.relativePath,
          type: "OPENAPI_EXTRACTION_ERROR",
          message: error.message,
        }),
      );
    }
  }

  return {
    results,
    errors,
  };
};

// --------------------------------------------------
// Normalized package merging
// --------------------------------------------------

const mergeNormalizedPackages = (packages, openApiCount) => {
  const evidence = [];
  const seenIds = new Set();

  const errors = [];

  for (const normalized of packages) {
    if (!normalized) {
      continue;
    }

    for (const item of normalized.evidence) {
      if (seenIds.has(item.evidenceId)) {
        continue;
      }

      seenIds.add(item.evidenceId);
      evidence.push(item);
    }

    errors.push(...normalized.errors);
  }

  const evidenceByType = {};
  const evidenceByCategory = {};
  const evidenceByExtractor = {};

  for (const item of evidence) {
    evidenceByType[item.evidenceType] =
      (evidenceByType[item.evidenceType] ?? 0) + 1;

    evidenceByCategory[item.sourceCategory] =
      (evidenceByCategory[item.sourceCategory] ?? 0) + 1;

    evidenceByExtractor[item.sourceExtractor] =
      (evidenceByExtractor[item.sourceExtractor] ?? 0) + 1;
  }

  return {
    schemaVersion: "1.0.0",

    evidence,

    summary: {
      normalizedEvidenceCount: evidence.length,
      evidenceByType,
      evidenceByCategory,
      evidenceByExtractor,
      errorCount: errors.length,
      openApiSpecificationsProcessed: openApiCount,
    },

    errors,
  };
};

// --------------------------------------------------
// Main coordinator
// --------------------------------------------------

export const extractEvidence = async ({ extractionDir, manifest }) => {
  if (typeof extractionDir !== "string" || !extractionDir.trim()) {
    throw new Error("A valid extractionDir is required.");
  }

  const directoryStats = await fs.stat(extractionDir);

  if (!directoryStats.isDirectory()) {
    throw new Error("extractionDir must point to a directory.");
  }

  // 1. Verify manifest files before reading their contents.
  const readResult = await readVerifiedFiles(extractionDir, manifest);

  // 2. Classify verified files.
  let classifications = [];

  const classificationErrors = [];

  if (readResult.files.length > 0) {
    try {
      classifications = classifyFiles(readResult.files);
    } catch (error) {
      classificationErrors.push(
        createProcessingError({
          type: "CLASSIFICATION_ERROR",
          message: error.message,
        }),
      );
    }
  }

  // 3. Route files to extractors.
  const routedFiles = routeFiles(readResult.files, classifications);
  console.log("\n========== EVIDENCE ROUTING DEBUG ==========");

  console.log("Classifications:", JSON.stringify(classifications, null, 2));

  console.log(
    "Routed code files:",
    routedFiles.code.map((file) => file.relativePath),
  );

  console.log("============================================\n");

  // 4. Run code, configuration and documentation extractors.
  const codeResult = runArrayExtractor({
    extractor: extractCodeEvidence,
    files: routedFiles.code,
    extractorName: "Code extractor",
  });
  console.log(
    "CODE EXTRACTOR RESULT:",
    JSON.stringify(
      {
        summary: codeResult?.summary,
        evidence: codeResult?.evidence,
        errors: codeResult?.errors,
      },
      null,
      2,
    ),
  );
  const configResult = runArrayExtractor({
    extractor: extractConfigEvidence,
    files: routedFiles.config,
    extractorName: "Config extractor",
  });

  const documentationResult = runArrayExtractor({
    extractor: extractDocumentationEvidence,
    files: routedFiles.documentation,
    extractorName: "Documentation extractor",
  });

  // 5. Extract each OpenAPI specification independently.
  const openApiResult = runOpenApiExtractor(routedFiles.openApi);

  // 6. Normalize non-OpenAPI evidence once.
  const normalizedPackages = [
    normalizeEvidence({
      code: codeResult,
      config: configResult,
      documentation: documentationResult,
    }),
  ];

  // 7. Normalize each API specification independently.
  // This preserves the original file provenance for every specification.
  for (const openApi of openApiResult.results) {
    normalizedPackages.push(
      normalizeEvidence({
        openApi,
      }),
    );
  }

  // 8. Merge all normalized packages.
  const normalizedEvidence = mergeNormalizedPackages(
    normalizedPackages,
    openApiResult.results.length,
  );

  // 9. Collect processing errors.
  const processingErrors = [
    ...readResult.errors,
    ...classificationErrors,
    ...openApiResult.errors,
  ];

  return {
    success: true,

    processingStatus:
      processingErrors.length === 0 && normalizedEvidence.errors.length === 0
        ? "COMPLETED"
        : "COMPLETED_WITH_ERRORS",

    files: {
      manifestFileCount: manifest.length,
      verifiedTextFileCount: readResult.files.length,
      classifiedFileCount: classifications.length,
      totalBytesRead: readResult.totalBytesRead,
    },

    classification: classifications,

    extraction: {
      openApiSpecifications: openApiResult.results.length,

      codeFiles: routedFiles.code.length,

      configurationFiles: routedFiles.config.length,

      documentationFiles: routedFiles.documentation.length,
    },

    normalizedEvidence,

    errors: [...processingErrors, ...normalizedEvidence.errors],

    limitations: [
      "Evidence is extracted through static analysis; uploaded code is never executed.",
      "Every processed file is checked against the extraction manifest.",
      "Files exceeding evidence processing limits are skipped.",
      "Only JSON OpenAPI and Swagger specifications are currently supported.",
      "API specification declarations do not prove implementation.",
      "Documentation statements do not prove implementation.",
      "Secret scanning must remain a separate prerequisite in the ingestion pipeline.",
    ],
  };
};
