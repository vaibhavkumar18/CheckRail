import DB from "../../config/DB.js";

import {
  LOCK_CREDENTIAL_FOR_VERIFICATION,
  LOCK_CREDENTIAL_BY_ID_FOR_VERIFICATION,
  INSERT_VERIFICATION_RUN,
  INSERT_CREDENTIAL_VERIFICATION_RESULT,
  GET_ACTIVE_CREDENTIAL_VERIFICATION,
  LOCK_CREDENTIAL_FOR_RESULT,
  UPDATE_CREDENTIAL_VERIFICATION_RESULT,
  UPDATE_VERIFICATION_RUN,
  GET_STALE_CREDENTIAL_VERIFICATION,
  UPDATE_STALE_CREDENTIAL_VERIFICATION_RESULT,
  UPDATE_STALE_VERIFICATION_RUN,
  UPDATE_VERIFICATION_RUN_STAGE,
} from "./Verification.queries.js";

const withTransaction = async (callback) => {
  const client = await DB.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const createCredentialVerificationRun = async ({
  integrationId,
  provider,
  environment,
  userId,
  credentialId = null,
  credentialVersion = null,
  sandboxOnly = false,
}) => {
  return withTransaction(async (client) => {
    const credentialResult = await client.query(
      credentialId
        ? LOCK_CREDENTIAL_BY_ID_FOR_VERIFICATION
        : LOCK_CREDENTIAL_FOR_VERIFICATION,
      credentialId
        ? [credentialId, userId]
        : [integrationId, provider, environment, userId],
    );

    const credential = credentialResult.rows[0];

    console.debug("Credential verification lookup:", {
      queryName: credentialId
        ? "LOCK_CREDENTIAL_BY_ID_FOR_VERIFICATION"
        : "LOCK_CREDENTIAL_FOR_VERIFICATION",
      credentialId: credentialId || null,
      userId,
      rowCount: credentialResult.rowCount,
    });

    if (!credential) {
      return null;
    }

    if (sandboxOnly && credential.environment !== "SANDBOX") {
      const error = new Error("Verification is only available in Sandbox.");
      error.code = "INVALID_VERIFICATION_ENVIRONMENT";
      error.statusCode = 400;
      throw error;
    }

    if (
      credentialId &&
      ((integrationId && credential.integration_id !== integrationId) ||
        (provider && credential.provider !== provider) ||
        (environment && credential.environment !== environment) ||
        (credentialVersion !== null &&
          Number(credential.credential_version) !== Number(credentialVersion)))
    ) {
      const error = new Error(
        "The credential changed before verification could start.",
      );
      error.code = "CREDENTIAL_VERSION_CHANGED_BEFORE_VERIFICATION";
      throw error;
    }

    // ---------------------------------------------
    // Recover abandoned credential verification
    // ---------------------------------------------

    const staleResult = await client.query(GET_STALE_CREDENTIAL_VERIFICATION, [
      credential.id,
      credential.credential_version,
    ]);

    for (const staleRun of staleResult.rows) {
      await client.query(UPDATE_STALE_CREDENTIAL_VERIFICATION_RESULT, [
        staleRun.result_id,
      ]);

      await client.query(UPDATE_STALE_VERIFICATION_RUN, [staleRun.run_id]);
    }

    // ---------------------------------------------
    // Reject genuinely active verification
    // ---------------------------------------------

    const activeResult = await client.query(
      GET_ACTIVE_CREDENTIAL_VERIFICATION,
      [credential.id, credential.credential_version],
    );

    if (activeResult.rows[0]) {
      const error = new Error(
        "Verification is already running for this credential.",
      );

      error.code = "VERIFICATION_ALREADY_RUNNING";
      error.statusCode = 409;

      throw error;
    }

    const startedAt = new Date().toISOString();
    const runResult = await client.query(INSERT_VERIFICATION_RUN, [
      credential.integration_id,
      credential.provider,
      credential.environment,
      startedAt,
      userId,
    ]);

    const run = runResult.rows[0];
    const resultRecord = await client.query(
      INSERT_CREDENTIAL_VERIFICATION_RESULT,
      [run.id, credential.id, credential.credential_version, startedAt],
    );

    return {
      credential,
      run,
      result: resultRecord.rows[0],
    };
  });
};

export const completeCredentialVerificationRun = async ({
  runId,
  resultId,
  credentialId,
  credentialVersion,
  result,
  status,
  authenticationStatus,
  providerStatus,
  message,
  errorCode,
  finalizeParent = true,
}) => {
  return withTransaction(async (client) => {
    const credentialResult = await client.query(LOCK_CREDENTIAL_FOR_RESULT, [
      credentialId,
    ]);

    const currentCredential = credentialResult.rows[0];

    if (!currentCredential) {
      throw new Error("Credential no longer exists.");
    }

    const credentialVersionChanged =
      Number(currentCredential.credential_version) !==
      Number(credentialVersion);

    const finalStatus = credentialVersionChanged ? "FAILED" : status;
    const finalErrorCode = credentialVersionChanged
      ? "CREDENTIAL_VERSION_CHANGED_DURING_VERIFICATION"
      : errorCode;

    const finalMessage = credentialVersionChanged
      ? "Credential changed during verification. Capability execution was stopped."
      : message;

    const completedAt = new Date().toISOString();

    const resultRecord = await client.query(
      UPDATE_CREDENTIAL_VERIFICATION_RESULT,
      [
        resultId,
        finalStatus,
        credentialVersionChanged ? "NOT_RUN" : authenticationStatus,
        providerStatus,
        finalMessage,
        finalErrorCode,
        JSON.stringify(result.evidence || []),
        completedAt,
      ],
    );

    const runStatus =
      finalStatus === "VERIFIED"
        ? "COMPLETED"
        : finalStatus === "UNVERIFIED"
          ? "PARTIALLY_COMPLETED"
          : "FAILED";

    const runRecord = finalizeParent
      ? await client.query(UPDATE_VERIFICATION_RUN, [
          runId,
          runStatus,
          completedAt,
          finalErrorCode,
          finalMessage,
        ])
      : { rows: [] };

    return {
      credentialVersionChanged,
      result: resultRecord.rows[0],
      run: runRecord.rows[0],
    };
  });
};

export const finalizeVerificationRun = async ({
  runId,
  status,
  errorCode = null,
  message = null,
}) => {
  return withTransaction(async (client) => {
    const result = await client.query(UPDATE_VERIFICATION_RUN, [
      runId,
      status,
      new Date().toISOString(),
      errorCode,
      message,
    ]);

    return result.rows[0] || null;
  });
};

export const reconcileCredentialVerificationRun = async ({
  runId,
  resultId,
  credentialId,
  credentialVersion,
  result,
  message,
}) => {
  return completeCredentialVerificationRun({
    runId,
    resultId,
    credentialId,
    credentialVersion,
    result,
    status: "FAILED",
    authenticationStatus: "NOT_RUN",
    providerStatus: null,
    message,
    errorCode: "VERIFICATION_PERSISTENCE_FAILURE",
  });
};
export const updateVerificationRunStage = async ({ runId, stage }) => {
  return withTransaction(async (client) => {
    const result = await client.query(UPDATE_VERIFICATION_RUN_STAGE, [
      runId,
      stage,
    ]);

    return result.rows[0] || null;
  });
};
