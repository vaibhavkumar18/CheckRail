import { decryptSecret } from "../Credentials/encryption.service.js";

import {
  createCredentialVerificationRun,
  completeCredentialVerificationRun,
  reconcileCredentialVerificationRun,
  finalizeVerificationRun,
  updateVerificationRunStage,
} from "./Verification.model.js";

import { verifyPayPalIntegration } from "./providers/paypal/paypal.verification.js";

import { verifyHyperwalletIntegration } from "./providers/hyperwallet/hyperwallet.verification.js";

import { VerificationError } from "./utils/verificationErrors.js";

// --------------------------------------------------
// Provider Verifier Registry
// --------------------------------------------------

const providerVerifiers = {
  PAYPAL: verifyPayPalIntegration,
  HYPERWALLET: verifyHyperwalletIntegration,
};

// --------------------------------------------------
// Validate Provider
// --------------------------------------------------

const getProviderVerifier = (provider) => {
  const verifier = providerVerifiers[provider];

  if (!verifier) {
    throw new VerificationError(
      "This provider verification is not supported.",
      {
        statusCode: 400,
        code: "PROVIDER_NOT_SUPPORTED",
      },
    );
  }

  return verifier;
};

// --------------------------------------------------
// Decrypt Locked Credentials
// --------------------------------------------------

const decryptLockedCredential = (credential) => {
  if (credential.credentials_encrypted) {
    const credentials = JSON.parse(
      decryptSecret({
        encrypted: credential.credentials_encrypted,
        iv: credential.encryption_iv,
        authTag: credential.encryption_auth_tag,
      }),
    );

    if (
      !credentials ||
      typeof credentials !== "object" ||
      Array.isArray(credentials)
    ) {
      throw new Error("Invalid decrypted credential payload.");
    }

    return credentials;
  }

  if (credential.provider === "PAYPAL" && credential.client_secret_encrypted) {
    return {
      clientId: credential.client_id,
      clientSecret: decryptSecret({
        encrypted: credential.client_secret_encrypted,
        iv: credential.encryption_iv,
        authTag: credential.encryption_auth_tag,
      }),
      webhookId: credential.webhook_id,
    };
  }

  throw new Error("Credential payload is unavailable.");
};

// --------------------------------------------------
// Failed Verification Result
// --------------------------------------------------

const failedVerificationResult = ({ provider, environment, error }) => ({
  provider,
  environment,
  status: "FAILED",
  summary: {
    total: 1,
    passed: 0,
    failed: 1,
    notRun: 0,
  },
  checks: [
    {
      name: "VERIFICATION_EXECUTION",
      status: "FAILED",
      message: error.message || "Credential verification failed.",
      providerStatus: error.providerStatus || null,
    },
  ],
  evidence: [],
  completedAt: new Date().toISOString(),
});

// --------------------------------------------------
// Determine Credential Verification Status
// --------------------------------------------------

const getVerificationStatus = (result) =>
  result.status === "SUCCESS"
    ? "VERIFIED"
    : result.status === "PARTIAL_SUCCESS"
      ? "UNVERIFIED"
      : "FAILED";

// --------------------------------------------------
// Persist Credential Verification Result
// --------------------------------------------------

const persistVerificationResult = async ({
  verification,
  result,
  errorCode = null,
  finalizeParent = true,
}) => {
  const authenticationCheck = result.checks?.find(
    (check) => check.name === "AUTHENTICATION",
  );

  const status = getVerificationStatus(result);

  return completeCredentialVerificationRun({
    runId: verification.run.id,
    resultId: verification.result.id,
    credentialId: verification.credential.id,
    credentialVersion: verification.credential.credential_version,
    result,
    status,
    authenticationStatus: authenticationCheck?.status || "NOT_RUN",
    providerStatus:
      authenticationCheck?.providerStatus ||
      result.checks?.find((check) => check.providerStatus)?.providerStatus ||
      null,
    message:
      result.checks?.find((check) => check.status === "FAILED")?.message ||
      `Credential verification ${status.toLowerCase()}.`,
    errorCode,
    finalizeParent,
  });
};

// --------------------------------------------------
// Execute Persisted Credential Verification
// --------------------------------------------------

const executePersistedCredentialVerification = async ({
  verification,
  credentials,
  credentialSnapshot,
  onVerified,
}) => {
  const { credential } = verification;
  let continuationResult = null;
  let result;
  let executionError = null;
  let resolvedCredentials;

  try {
    resolvedCredentials =
      credentials ||
      (credentialSnapshot
        ? decryptLockedCredential({
            ...credential,
            credentials_encrypted: credentialSnapshot.encrypted,
            encryption_iv: credentialSnapshot.iv,
            encryption_auth_tag: credentialSnapshot.authTag,
          })
        : decryptLockedCredential(credential));

    if (
      !resolvedCredentials ||
      typeof resolvedCredentials !== "object" ||
      Array.isArray(resolvedCredentials)
    ) {
      throw new VerificationError("Verification credentials are invalid.", {
        statusCode: 400,
        code: "INVALID_CREDENTIAL_SNAPSHOT",
      });
    }

    const verifier = getProviderVerifier(credential.provider);

    result = await verifier({
      credentials: resolvedCredentials,
      environment: credential.environment,
    });
  } catch (error) {
    executionError = error;

    result = failedVerificationResult({
      provider: credential.provider,
      environment: credential.environment,
      error,
    });
  }

  let persistedVerification;

  // --------------------------------------------------
  // Persist Credential Verification Result
  // --------------------------------------------------

  try {
    persistedVerification = await persistVerificationResult({
      verification,
      result,
      errorCode: executionError?.code || null,
      finalizeParent:
        !onVerified ||
        Boolean(executionError) ||
        getVerificationStatus(result) !== "VERIFIED",
    });
    if (persistedVerification.credentialVersionChanged) {
      if (!persistedVerification.run) {
        await finalizeVerificationRun({
          runId: verification.run.id,
          status: "FAILED",
          errorCode: "CREDENTIAL_VERSION_CHANGED_DURING_VERIFICATION",
          message: "Credential changed during verification.",
        });
      }

      throw new VerificationError(
        "Credential changed during verification. Please run verification again.",
        {
          statusCode: 409,
          code: "CREDENTIAL_VERSION_CHANGED_DURING_VERIFICATION",
        },
      );
    }
  } catch (finalizationError) {
    console.error("Credential verification finalization failed:", {
      runId: verification.run.id,
      resultId: verification.result.id,
      credentialId: verification.credential.id,
      credentialVersion: verification.credential.credential_version,
      message: finalizationError.message,
      code: finalizationError.code || "VERIFICATION_FINALIZATION_FAILED",
    });

    try {
      await reconcileCredentialVerificationRun({
        runId: verification.run.id,
        resultId: verification.result.id,
        credentialId: verification.credential.id,
        credentialVersion: verification.credential.credential_version,
        result: failedVerificationResult({
          provider: credential.provider,
          environment: credential.environment,
          error: finalizationError,
        }),
        message:
          "Verification result persistence failed and requires reconciliation.",
      });
    } catch (reconciliationError) {
      console.error("Credential verification reconciliation failed:", {
        runId: verification.run.id,
        resultId: verification.result.id,
        credentialId: verification.credential.id,
        message: reconciliationError.message,
        code: reconciliationError.code || "VERIFICATION_RECONCILIATION_FAILED",
      });
    }

    throw new VerificationError(
      "Unable to persist provider verification result.",
      {
        statusCode: 503,
        code: "VERIFICATION_PERSISTENCE_FAILED",
        debugId: verification.run.id,
      },
    );
  }

  // --------------------------------------------------
  // Execute Capability Verification
  // --------------------------------------------------
  if (persistedVerification.result.status === "VERIFIED" && onVerified) {
    const stageUpdate = await updateVerificationRunStage({
      runId: verification.run.id,
      stage: "CAPABILITY_VERIFICATION",
    });

    if (!stageUpdate) {
      throw new VerificationError(
        "Unable to transition verification to capability execution.",
        {
          statusCode: 500,
          code: "VERIFICATION_STAGE_UPDATE_FAILED",
        },
      );
    }
  }
  if (persistedVerification.result.status === "VERIFIED" && onVerified) {
    try {
      continuationResult = await onVerified({
        verification,
        credentials: credentials || resolvedCredentials,
        result,
      });

      if (!continuationResult?.awaitingApproval) {
        const parentStatus = continuationResult?.parentStatus || "COMPLETED";

        const finalizedRun = await finalizeVerificationRun({
          runId: verification.run.id,
          status: parentStatus,
          errorCode: continuationResult?.errorCode || null,
          message: continuationResult?.message || null,
        });

        if (!finalizedRun || finalizedRun.status !== parentStatus) {
          throw new Error(
            "Verification parent run did not reach its expected state.",
          );
        }
      }
    } catch (error) {
      await finalizeVerificationRun({
        runId: verification.run.id,
        status: "FAILED",
        errorCode: error.code || "CAPABILITY_VERIFICATION_FAILED",
        message: error.message,
      });

      throw error;
    }
  }

  // --------------------------------------------------
  // Return Verification Result
  // --------------------------------------------------

  return {
    ...result,
    verificationRunId: verification.run.id,
    credentialVerificationResultId: verification.result.id,
    credentialVersion: verification.credential.credential_version,
    credentialStatus: persistedVerification.result.status,
    ...continuationResult,
  };
};

// --------------------------------------------------
// Run Verification By Credential ID
// --------------------------------------------------

export const runVerificationByCredentialId = async ({
  credentialId,
  userId,
  onVerified,
}) => {
  const verification = await createCredentialVerificationRun({
    credentialId,
    userId,
    sandboxOnly: true,
  });

  if (!verification) {
    throw new VerificationError(
      "Provider credentials not found or access denied.",
      {
        statusCode: 404,
        code: "CREDENTIAL_NOT_FOUND",
      },
    );
  }

  return executePersistedCredentialVerification({
    verification,
    onVerified,
  });
};

// --------------------------------------------------
// Run Verification With Credentials
// --------------------------------------------------

export const runVerificationWithCredentials = async ({
  credentials,
  credentialSnapshot,
  provider,
  environment,
  integrationId,
  credentialId,
  credentialVersion,
  userId,
}) => {
  const verification = await createCredentialVerificationRun({
    integrationId,
    provider,
    environment,
    userId,
    credentialId,
    credentialVersion,
  });

  if (!verification) {
    throw new VerificationError(
      "Provider credentials not found or access denied.",
      {
        statusCode: 404,
        code: "CREDENTIALS_NOT_FOUND",
      },
    );
  }

  return executePersistedCredentialVerification({
    verification,
    credentials,
    credentialSnapshot,
  });
};

// --------------------------------------------------
// Existing Manual Verification API
// Preserved for backward compatibility.
// --------------------------------------------------

export const runVerification = async ({
  integrationId,
  provider,
  environment,
  userId,
}) => {
  const verification = await createCredentialVerificationRun({
    integrationId,
    provider,
    environment,
    userId,
  });

  if (!verification) {
    throw new VerificationError(
      "Provider credentials not found or access denied.",
      {
        statusCode: 404,
        code: "CREDENTIALS_NOT_FOUND",
      },
    );
  }

  return executePersistedCredentialVerification({
    verification,
  });
};
