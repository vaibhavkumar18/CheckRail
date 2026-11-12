
import {
  encryptSecret,
  decryptSecret,
} from "../Credentials/encryption.service.js";

import {
  createCapabilityVerificationRun,
  updateCapabilityVerificationCheck,
  saveCapabilityVerificationEvidence,
  updateCapabilityVerificationExecution,
  getCapabilityVerificationRunForResume,
  claimCapabilityVerificationRunForResume,
  getVerificationRunDetails,
} from "./CapabilityVerification.model.js";

import { finalizeVerificationRun } from "../Verification/Verification.model.js";

import { VerificationError } from "../Verification/utils/verificationErrors.js";

import {
  getProviderScenarioSuite,
  getProviderScenarioCodes,
} from "../VerificationWorkflow/sandboxTesting/engine/scenarioRegistry.js";

import { executeSandboxScenario } from "../VerificationWorkflow/sandboxTesting/engine/scenarioExecutor.js";
import { createHyperwalletSandboxFixture } from "../VerificationWorkflow/sandboxTesting/fixtures/hyperwallet.fixtures.js";

import { runVerificationByCredentialId } from "../Verification/Verification.services.js";

// --------------------------------------------------
// Provider Scenario Registry Helpers
// --------------------------------------------------

const getSandboxSuiteCode = (provider) => {
  return (
    getProviderScenarioCodes(provider).find((capabilityCode) =>
      getProviderScenarioSuite({
        provider,
        capabilityCode,
      }),
    ) || null
  );
};

// --------------------------------------------------
// Project Country Helpers
// --------------------------------------------------

const normalizeTargetCountries = (value) => {
  let countries = value;

  if (typeof countries === "string") {
    try {
      countries = JSON.parse(countries);
    } catch {
      throw new VerificationError(
        "Project target-country configuration is invalid.",
        {
          statusCode: 409,
          code: "INVALID_PROJECT_TARGET_COUNTRIES",
        },
      );
    }
  }

  if (!Array.isArray(countries)) {
    return [];
  }

  return [
    ...new Set(
      countries
        .filter((country) => typeof country === "string")
        .map((country) => country.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
};

const getProjectExecutionContext = (credential) => {
  const targetCountries = normalizeTargetCountries(
    credential.project_target_countries,
  );

  return {
    projectId: credential.project_id,
    sourceCountry: credential.project_source_country || null,
    targetCountries,

    // Only resolve a single target automatically.
    // Never silently select one when multiple targets exist.
    targetCountry:
      targetCountries.length === 1
        ? targetCountries[0]
        : null,

    assessmentObjective:
      credential.project_assessment_objective || null,
  };
};

const validateHyperwalletTargetCountry = (projectContext) => {
  if (projectContext.targetCountries.length === 0) {
    throw new VerificationError(
      "The project does not have a target country configured. Configure a target country before running Hyperwallet verification.",
      {
        statusCode: 409,
        code: "HYPERWALLET_TARGET_COUNTRY_REQUIRED",
      },
    );
  }

  if (projectContext.targetCountries.length !== 1) {
    throw new VerificationError(
      "Hyperwallet verification currently requires exactly one target country per project.",
      {
        statusCode: 409,
        code: "HYPERWALLET_SINGLE_TARGET_COUNTRY_REQUIRED",
      },
    );
  }
};

// --------------------------------------------------
// Result Status Helpers
// --------------------------------------------------

const getFinalExecutionStatus = (result) => {
  if (result.status === "VERIFIED") {
    return "VERIFIED";
  }

  if (result.status === "FAILED") {
    return "FAILED";
  }

  return "UNVERIFIED";
};

const getParentRunStatus = (result) => {
  if (result.status === "VERIFIED") {
    return "COMPLETED";
  }

  if (result.status === "FAILED") {
    return "FAILED";
  }

  return "PARTIALLY_COMPLETED";
};

// --------------------------------------------------
// Capability Operation Persistence Callbacks
// --------------------------------------------------

const persistCallbacks = (capabilityRunId) => ({
  onOperationStart: async ({ operation }) => {
    await updateCapabilityVerificationCheck({
      runId: capabilityRunId,
      operation,
      status: "RUNNING",
      attemptCount: 1,
      startedAt: new Date().toISOString(),
    });
  },

  onOperationComplete: async ({
    operation,
    status,
    message,
    providerStatus,
    resourceId,
    errorCode,
    errorMessage,
    evidence = [],
  }) => {
    await updateCapabilityVerificationCheck({
      runId: capabilityRunId,
      operation,
      status,
      message,
      providerStatus,
      resourceId,
      completedAt: new Date().toISOString(),
      errorCode,
      errorMessage,
    });

    if (evidence.length > 0) {
      await saveCapabilityVerificationEvidence({
        runId: capabilityRunId,
        evidence,
      });
    }
  },
});

// --------------------------------------------------
// Credential Snapshot Helpers
// --------------------------------------------------

const getCredentialSnapshot = (run) => ({
  encrypted: run.credential_payload_encrypted,
  iv: run.credential_encryption_iv,
  authTag: run.credential_encryption_auth_tag,
});

const decryptCapabilityCredentials = (run) => {
  const snapshot = getCredentialSnapshot(run);

  const plaintext = decryptSecret(snapshot);
  const credentials = JSON.parse(plaintext);

  if (
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  ) {
    throw new VerificationError("Saved credential snapshot is invalid.", {
      statusCode: 409,
      code: "INVALID_CREDENTIAL_SNAPSHOT",
    });
  }

  return credentials;
};

// --------------------------------------------------
// Execution Context Helpers
// --------------------------------------------------

const parseExecutionContext = (value) => {
  let context = value;

  if (typeof value === "string") {
    try {
      context = JSON.parse(value);
    } catch {
      throw new VerificationError("Saved execution context is invalid.", {
        statusCode: 409,
        code: "INVALID_EXECUTION_CONTEXT",
      });
    }
  }

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new VerificationError("Saved execution context is unavailable.", {
      statusCode: 409,
      code: "EXECUTION_CONTEXT_UNAVAILABLE",
    });
  }

  return context;
};

// --------------------------------------------------
// Persist Final Capability Result
//
// This function finalizes ONLY the capability run.
// The initial parent run is finalized by
// Verification.services.js after onVerified returns.
// The resume flow finalizes its parent explicitly.
// --------------------------------------------------

const persistFinalResult = async ({ capabilityRunId, result }) => {
  return updateCapabilityVerificationExecution({
    runId: capabilityRunId,
    executionStatus: "COMPLETED",
    overallStatus: getFinalExecutionStatus(result),
    executionContext: null,
    completedAt: new Date().toISOString(),
  });
};

// --------------------------------------------------
// Initial Unified Credential + Capability Verification
// --------------------------------------------------

export const runUnifiedCredentialVerification = async ({
  credentialId,
  userId,
  capabilityCode: requestedCapabilityCode,
}) => {
  let capabilityReport = null;

  const credentialReport = await runVerificationByCredentialId({
    credentialId,
    userId,

    onVerified: async ({ verification, credentials }) => {
      const provider = verification.credential.provider;
      const integrationId = verification.credential.integration_id;

      // Project context comes from the authorized credential query.
      // The frontend cannot override the target country.
      const projectContext = getProjectExecutionContext(
        verification.credential,
      );

      if (provider === "HYPERWALLET") {
        validateHyperwalletTargetCountry(projectContext);
      }

      // Select the explicitly requested capability, or retain
      // the existing default behavior when none is supplied.
      const capabilityCode =
        requestedCapabilityCode || getSandboxSuiteCode(provider);

      if (!capabilityCode) {
        throw new VerificationError(
          "No supported Sandbox capability suite is available for this provider.",
          {
            statusCode: 400,
            code: "CAPABILITY_SUITE_NOT_SUPPORTED",
          },
        );
      }

      const suite = getProviderScenarioSuite({
        provider,
        capabilityCode,
      });

      if (!suite?.scenario || !suite.policy?.enabled) {
        throw new VerificationError(
          `Capability ${capabilityCode} is not supported or enabled for ${provider}.`,
          {
            statusCode: 400,
            code: "SANDBOX_SCENARIO_NOT_CONFIGURED",
          },
        );
      }

      const scenario = suite.scenario;

      // Build a country-matched synthetic fixture from the authorized project.
      // The target country is read from the locked credential/project query;
      // it is never accepted from the frontend or environment variables.
      const hyperwalletFixture =
        provider === "HYPERWALLET" &&
        capabilityCode === "PAYMENT_DISBURSEMENT"
          ? createHyperwalletSandboxFixture({
              targetCountry: projectContext.targetCountry,
            })
          : null;

      // Encrypt the exact credential snapshot used for verification.
      const encryptedSnapshot = encryptSecret(
        JSON.stringify(credentials),
      );

      const startedAt = new Date().toISOString();

      const capabilityRun = await createCapabilityVerificationRun({
        integrationId,
        provider,
        environment: verification.credential.environment,
        capabilityCode,
        userId,

        operations: scenario.steps.map((step) => ({
          operation: step.operation,
        })),

        startedAt,
        verificationRunId: verification.run.id,
        credentialId: verification.credential.id,
        credentialVersion:
          verification.credential.credential_version,

        snapshot: {
          encrypted: encryptedSnapshot.encrypted,
          iv: encryptedSnapshot.iv,
          authTag: encryptedSnapshot.authTag,
        },
      });

      if (!capabilityRun?.id) {
        throw new Error(
          "Unable to create capability verification run.",
        );
      }

      const callbacks = persistCallbacks(capabilityRun.id);

      // The same project context is available to every scenario.
      // The recipient token remains additional scenario input.
      const initialExecutionContext = {
        runId: verification.run.id,
        provider,
        scenarioId: scenario.id,
        capabilityCode,

        project: projectContext,

        // FIX: Use the target country already resolved from project context.
        targetCountry: projectContext.targetCountry,
        targetCountries: projectContext.targetCountries,

        ...(hyperwalletFixture
          ? { hyperwalletFixture }
          : {}),

        completedSteps: {},
        checks: [],
        evidence: [],
      };

      let scenarioResult;

      try {
        scenarioResult = await executeSandboxScenario({
          run: {
            id: verification.run.id,
            integration_id: integrationId,
            provider,
            environment: verification.credential.environment,
            capability_code: capabilityCode,
          },

          credentials,
          scenario,
          executionContext: initialExecutionContext,
          ...callbacks,

          onPause: async ({ executionContext }) => {
            await updateCapabilityVerificationExecution({
              runId: capabilityRun.id,
              executionStatus: "AWAITING_APPROVAL",
              overallStatus: "UNVERIFIED",
              executionContext,
            });
          },
        });
      } catch (error) {
        await updateCapabilityVerificationExecution({
          runId: capabilityRun.id,
          executionStatus: "FAILED",
          overallStatus: "FAILED",
          completedAt: new Date().toISOString(),
        });

        throw error;
      }

      if (scenarioResult.awaitingApproval) {
        capabilityReport = await getVerificationRunDetails(
          capabilityRun.id,
          userId,
        );

        return {
          awaitingApproval: true,
          approvalUrl:
            scenarioResult.executionContext?.approvalUrl || null,
          capabilityRunId: capabilityRun.id,
        };
      }

      await persistFinalResult({
        capabilityRunId: capabilityRun.id,
        result: scenarioResult,
      });

      capabilityReport = await getVerificationRunDetails(
        capabilityRun.id,
        userId,
      );

      return {
        parentStatus: getParentRunStatus(scenarioResult),

        errorCode:
          scenarioResult.status === "FAILED"
            ? "CAPABILITY_VERIFICATION_FAILED"
            : null,

        message:
          scenarioResult.status === "FAILED"
            ? "One or more provider capability operations failed."
            : null,
      };
    },
  });

  return {
    verificationRunId: credentialReport.verificationRunId,
    credential: credentialReport,
    capability: capabilityReport,

    approvalRequired: Boolean(
      credentialReport.awaitingApproval,
    ),

    approvalUrl: credentialReport.approvalUrl || null,

    capabilityRunId:
      credentialReport.capabilityRunId || null,
  };
};

// --------------------------------------------------
// Resume Paused Capability Verification
// --------------------------------------------------

export const resumeCapabilityVerification = async ({ runId, userId }) => {
  // ----------------------------------------------
  // 1. Load and authorize the saved capability run.
  // ----------------------------------------------

  const savedRun = await getCapabilityVerificationRunForResume(runId, userId);

  if (!savedRun) {
    throw new VerificationError(
      "Capability verification run not found or access denied.",
      {
        statusCode: 404,
        code: "CAPABILITY_RUN_NOT_FOUND",
      },
    );
  }

  if (savedRun.execution_status !== "AWAITING_APPROVAL") {
    throw new VerificationError(
      "This capability run is not awaiting approval.",
      {
        statusCode: 409,
        code: "CAPABILITY_RUN_NOT_AWAITING_APPROVAL",
      },
    );
  }

  // ----------------------------------------------
  // 2. Check credential version before claiming.
  // ----------------------------------------------

  if (
    Number(savedRun.credential_version) !==
    Number(savedRun.current_credential_version)
  ) {
    throw new VerificationError(
      "Credentials changed after order creation. This run cannot be resumed.",
      {
        statusCode: 409,
        code: "CREDENTIAL_VERSION_CHANGED",
      },
    );
  }

  // ----------------------------------------------
  // 3. Validate all stored data before claiming.
  //    Invalid data must not leave the run RUNNING.
  // ----------------------------------------------

  const executionContext = parseExecutionContext(savedRun.execution_context);

  const credentials = decryptCapabilityCredentials(savedRun);

  const suite = getProviderScenarioSuite({
    provider: savedRun.provider,
    capabilityCode: savedRun.capability_code,
  });

  if (!suite?.scenario) {
    throw new VerificationError(
      "The saved capability scenario is no longer available.",
      {
        statusCode: 409,
        code: "CAPABILITY_SCENARIO_UNAVAILABLE",
      },
    );
  }

  // ----------------------------------------------
  // 4. Atomically claim the paused run.
  // ----------------------------------------------

  const claimedRun = await claimCapabilityVerificationRunForResume({
    runId,
    userId,
  });

  if (!claimedRun) {
    throw new VerificationError(
      "This run has already been resumed or is no longer available.",
      {
        statusCode: 409,
        code: "CAPABILITY_RUN_ALREADY_CLAIMED",
      },
    );
  }

  const callbacks = persistCallbacks(runId);

  let result;

  // ----------------------------------------------
  // 5. Resume the scenario using saved context.
  //    CREATE_ORDER must be skipped.
  // ----------------------------------------------

  try {
    result = await executeSandboxScenario({
      run: {
        id: savedRun.verification_run_id,
        integration_id: savedRun.integration_id,
        provider: savedRun.provider,
        environment: savedRun.environment,
        capability_code: savedRun.capability_code,
      },

      credentials,
      scenario: suite.scenario,
      executionContext,

      ...callbacks,
    });

    if (result.awaitingApproval) {
      throw new Error("Unexpected additional approval pause during resume.");
    }

    // --------------------------------------------
    // 6. Finalize capability run.
    // --------------------------------------------

    await persistFinalResult({
      capabilityRunId: runId,
      result,
    });

    // --------------------------------------------
    // 7. Finalize parent verification run.
    // --------------------------------------------

    const parentStatus = getParentRunStatus(result);

    const finalizedParent = await finalizeVerificationRun({
      runId: savedRun.verification_run_id,
      status: parentStatus,

      errorCode:
        result.status === "FAILED" ? "CAPABILITY_VERIFICATION_FAILED" : null,

      message:
        result.status === "FAILED"
          ? "One or more provider capability operations failed."
          : null,
    });

    if (!finalizedParent) {
      throw new Error("Parent verification run could not be finalized.");
    }
  } catch (error) {
    // Do not overwrite an already completed capability run.
    await updateCapabilityVerificationExecution({
      runId,
      executionStatus: "FAILED",
      overallStatus: "FAILED",
      completedAt: new Date().toISOString(),
    });

    await finalizeVerificationRun({
      runId: savedRun.verification_run_id,
      status: "FAILED",
      errorCode: error.code || "CAPABILITY_RESUME_FAILED",
      message: error.message,
    });

    throw error;
  }

  // ----------------------------------------------
  // 8. Return the completed capability report.
  // ----------------------------------------------

  return getVerificationRunDetails(runId, userId);
};
