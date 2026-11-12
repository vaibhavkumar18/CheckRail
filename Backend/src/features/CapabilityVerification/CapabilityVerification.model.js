import DB from "../../config/DB.js";

import {
  INSERT_VERIFICATION_RUN,
  INSERT_VERIFICATION_CHECK,
  INSERT_VERIFICATION_EVIDENCE,
  UPDATE_VERIFICATION_CHECK,
  UPDATE_VERIFICATION_RUN_STATUS,
  GET_CAPABILITY_RUN_FOR_RESUME,
  GET_VERIFICATION_RUN_FOR_USER,
  GET_VERIFICATION_RUNS_FOR_INTEGRATION,
  GET_LATEST_VERIFICATION_RUNS,
  GET_VERIFICATION_RUNS_FOR_PROJECT,
  GET_LATEST_VERIFICATION_RUNS_FOR_PROJECT,
  GET_VERIFICATION_RUN_DETAILS,
  GET_VERIFICATION_CHECKS_BY_RUN,
  GET_VERIFICATION_EVIDENCE_BY_RUN,
  CLAIM_CAPABILITY_RUN_FOR_RESUME,
  GET_LATEST_VERIFIED_HYPERWALLET_RECIPIENT,
  GET_VERIFICATION_RUNS_FOR_USER,
} from "./CapabilityVerification.queries.js";

// --------------------------------------------------
// Transaction Helper
// --------------------------------------------------

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

// --------------------------------------------------
// Final Capability Status
// --------------------------------------------------

const getFinalCapabilityStatus = (checks) => {
  if (!checks.length) {
    return "UNVERIFIED";
  }

  if (
    checks.some(
      (check) => check.status === "FAILED" || check.status === "UNKNOWN",
    )
  ) {
    return "FAILED";
  }

  if (checks.every((check) => check.status === "PASSED")) {
    return "VERIFIED";
  }

  return "UNVERIFIED";
};

// --------------------------------------------------
// Check Status Helpers
// --------------------------------------------------

const terminalCheckStatuses = new Set([
  "PASSED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
  "UNSUPPORTED",
  "UNKNOWN",
  "NOT_RUN",
]);

// --------------------------------------------------
// Insert One Evidence Record
// --------------------------------------------------

const insertEvidenceRecord = async (client, runId, evidence) => {
  const {
    type,
    operation,
    method,
    endpoint,
    httpStatus,
    resourceId,
    observedAt,
    checkId,
    ...metadata
  } = evidence;

  const result = await client.query(INSERT_VERIFICATION_EVIDENCE, [
    runId,
    checkId || null,
    type || "API_RESPONSE",
    operation,
    method || null,
    endpoint || null,
    httpStatus ?? null,
    resourceId || null,
    JSON.stringify(metadata),
    observedAt || new Date().toISOString(),
  ]);

  return result.rows[0];
};

// --------------------------------------------------
// Create Capability Run Before Execution
//
// Operations are registered as PENDING.
// The encrypted credential snapshot is stored
// before any provider operation is executed.
// --------------------------------------------------

export const createCapabilityVerificationRun = async ({
  integrationId,
  provider,
  environment,
  capabilityCode,
  userId,
  operations,
  startedAt,
  verificationRunId = null,
  credentialId = null,
  credentialVersion = null,
  snapshot = null,
  workflowRunId = null,
  executionContext = null,
}) => {
  if (!startedAt) {
    throw new Error("Capability verification start timestamp is required.");
  }

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("At least one capability operation is required.");
  }

  return withTransaction(async (client) => {
    const runResult = await client.query(INSERT_VERIFICATION_RUN, [
      integrationId,
      provider,
      environment,
      capabilityCode,
      "UNVERIFIED",
      startedAt,
      null,
      userId,
      verificationRunId,
      workflowRunId,
      credentialId,
      credentialVersion,
      snapshot?.encrypted || null,
      snapshot?.iv || null,
      snapshot?.authTag || null,
      executionContext ? JSON.stringify(executionContext) : null,
    ]);

    const run = runResult.rows[0];

    for (let index = 0; index < operations.length; index++) {
      const operation = operations[index];

      const operationName =
        typeof operation === "string" ? operation : operation.operation;

      if (!operationName) {
        throw new Error(`Invalid operation at execution index ${index}.`);
      }

      await client.query(INSERT_VERIFICATION_CHECK, [
        run.id,
        operationName,
        "PENDING",
        null,
        null,
        null,
        index + 1,
        null,
        null,
        0,
        null,
        null,
      ]);
    }

    return run;
  });
};

// --------------------------------------------------
// Update Individual Operation Check
// --------------------------------------------------

export const updateCapabilityVerificationCheck = async ({
  runId,
  operation,
  status,
  message = null,
  providerStatus = null,
  resourceId = null,
  startedAt = null,
  completedAt = null,
  attemptCount = null,
  errorCode = null,
  errorMessage = null,
}) => {
  if (!runId || !operation || !status) {
    throw new Error("Run ID, operation and status are required.");
  }

  const resolvedStartedAt =
    startedAt || (status === "RUNNING" ? new Date().toISOString() : null);

  const resolvedCompletedAt =
    completedAt ||
    (terminalCheckStatuses.has(status) ? new Date().toISOString() : null);

  const result = await DB.query(UPDATE_VERIFICATION_CHECK, [
    runId,
    operation,
    status,
    message,
    providerStatus,
    resourceId,
    resolvedStartedAt,
    resolvedCompletedAt,
    attemptCount,
    errorCode,
    errorMessage,
  ]);

  if (!result.rows[0]) {
    throw new Error(`Verification check not found: ${operation}`);
  }

  return result.rows[0];
};

// --------------------------------------------------
// Persist Operation Evidence
// --------------------------------------------------

export const saveCapabilityVerificationEvidence = async ({
  runId,
  evidence,
}) => {
  if (!runId) {
    throw new Error("Capability run ID is required.");
  }

  if (!Array.isArray(evidence)) {
    throw new Error("Evidence must be an array.");
  }

  return withTransaction(async (client) => {
    const savedEvidence = [];

    for (const item of evidence) {
      if (!item.operation) {
        throw new Error("Evidence operation is required.");
      }

      const record = await insertEvidenceRecord(client, runId, item);

      savedEvidence.push(record);
    }

    return savedEvidence;
  });
};

// --------------------------------------------------
// Update Capability Execution State
//
// AWAITING_APPROVAL keeps completed_at NULL.
// The overall status remains UNVERIFIED until
// all operations have a terminal outcome.
// --------------------------------------------------

export const updateCapabilityVerificationExecution = async ({
  runId,
  executionStatus,
  overallStatus = "UNVERIFIED",
  executionContext,
  completedAt = null,
}) => {
  if (!runId || !executionStatus) {
    throw new Error("Run ID and execution status are required.");
  }

  const validExecutionStatuses = new Set([
    "QUEUED",
    "RUNNING",
    "AWAITING_APPROVAL",
    "COMPLETED",
    "FAILED",
    "SKIPPED",
  ]);

  if (!validExecutionStatuses.has(executionStatus)) {
    throw new Error(`Invalid capability execution status: ${executionStatus}`);
  }

  const validOverallStatuses = new Set(["VERIFIED", "FAILED", "UNVERIFIED"]);

  if (!validOverallStatuses.has(overallStatus)) {
    throw new Error(`Invalid capability overall status: ${overallStatus}`);
  }

  const resolvedCompletedAt =
    executionStatus === "COMPLETED" ||
    executionStatus === "FAILED" ||
    executionStatus === "SKIPPED"
      ? completedAt || new Date().toISOString()
      : null;

  const result = await DB.query(UPDATE_VERIFICATION_RUN_STATUS, [
    runId,
    overallStatus,
    executionStatus,
    resolvedCompletedAt,
    executionContext === undefined || executionContext === null
      ? null
      : JSON.stringify(executionContext),
  ]);

  if (!result.rows[0]) {
    throw new Error("Capability verification run was not found.");
  }

  return result.rows[0];
};

// --------------------------------------------------
// Retrieve Internal Run For Resume
//
// Do not expose this response directly to frontend.
// It includes encrypted credentials and execution data.
// --------------------------------------------------

export const getCapabilityVerificationRunForResume = async (runId, userId) => {
  const result = await DB.query(GET_CAPABILITY_RUN_FOR_RESUME, [runId, userId]);

  return result.rows[0] || null;
};

// --------------------------------------------------
// Persist Complete Verification Result
//
// Backward-compatible implementation.
// Used by existing persistSandboxScenarioResult()
// and other completed-scenario workflows.
// --------------------------------------------------

export const saveCapabilityVerificationRun = async ({
  integrationId,
  provider,
  environment,
  capabilityCode,
  userId,
  result,
  startedAt,
  verificationRunId = null,
  credentialId = null,
  credentialVersion = null,
  snapshot = null,
  workflowRunId = null,
}) => {
  if (!startedAt) {
    throw new Error("Capability verification start timestamp is required.");
  }

  return withTransaction(async (client) => {
    const completedAt = result.completedAt || new Date().toISOString();

    const checks = result.checks || [];

    const runResult = await client.query(INSERT_VERIFICATION_RUN, [
      integrationId,
      provider,
      environment,
      capabilityCode,
      "UNVERIFIED",
      startedAt,
      null,
      userId,
      verificationRunId,
      workflowRunId,
      credentialId,
      credentialVersion,
      snapshot?.encrypted || null,
      snapshot?.iv || null,
      snapshot?.authTag || null,
      null,
    ]);

    const run = runResult.rows[0];

    const checkIds = new Map();

    // Persist individual checks.
    for (let index = 0; index < checks.length; index++) {
      const check = checks[index];

      const checkResult = await client.query(INSERT_VERIFICATION_CHECK, [
        run.id,
        check.name,
        check.status,
        check.message || null,
        check.providerStatus || null,
        check.orderId || check.resourceId || null,
        check.executionOrder ?? index + 1,
        check.startedAt || null,
        check.completedAt || completedAt,
        check.attemptCount ?? 0,
        check.errorCode || null,
        check.errorMessage || null,
      ]);

      checkIds.set(check.name, checkResult.rows[0].id);
    }

    // Persist execution evidence.
    for (const evidence of result.evidence || []) {
      await insertEvidenceRecord(client, run.id, {
        ...evidence,
        checkId: checkIds.get(evidence.operation) || null,
      });
    }

    const finalStatus = getFinalCapabilityStatus(checks);

    const updatedRun = await client.query(UPDATE_VERIFICATION_RUN_STATUS, [
      run.id,
      finalStatus,
      "COMPLETED",
      completedAt,
      null,
    ]);

    const finalizedRun = updatedRun.rows[0];

    if (!finalizedRun || finalizedRun.execution_status !== "COMPLETED") {
      throw new Error(
        "Capability verification did not reach a completed execution state.",
      );
    }

    return finalizedRun;
  });
};

// --------------------------------------------------
// Retrieve Verification Run For Authorized User
// --------------------------------------------------

export const getCapabilityVerificationRunForUser = async (runId, userId) => {
  const result = await DB.query(GET_VERIFICATION_RUN_FOR_USER, [runId, userId]);

  return result.rows[0] || null;
};

// --------------------------------------------------
// Get All Verification Runs For Integration
// --------------------------------------------------

export const getVerificationRunsForIntegration = async (
  integrationId,
  userId,
) => {
  const result = await DB.query(GET_VERIFICATION_RUNS_FOR_INTEGRATION, [
    integrationId,
    userId,
  ]);

  return result.rows;
};

// --------------------------------------------------
// Get Latest Verification Run For Each Capability
// --------------------------------------------------

export const getLatestVerificationRuns = async (integrationId, userId) => {
  const result = await DB.query(GET_LATEST_VERIFICATION_RUNS, [
    integrationId,
    userId,
  ]);

  return result.rows;
};


// --------------------------------------------------
// Project-scoped Capability Verification History
// --------------------------------------------------

export const getVerificationRunsForProject = async (projectId, userId) => {
  const result = await DB.query(GET_VERIFICATION_RUNS_FOR_PROJECT, [
    projectId,
    userId,
  ]);

  return result.rows;
};

export const getLatestVerificationRunsForProject = async (projectId, userId) => {
  const result = await DB.query(GET_LATEST_VERIFICATION_RUNS_FOR_PROJECT, [
    projectId,
    userId,
  ]);

  return result.rows;
};

// --------------------------------------------------
// Get One Verification Run With Checks And Evidence
// --------------------------------------------------

export const getVerificationRunDetails = async (runId, userId) => {
  const runResult = await DB.query(GET_VERIFICATION_RUN_DETAILS, [
    runId,
    userId,
  ]);

  const run = runResult.rows[0];

  if (!run) {
    return null;
  }

  const [checksResult, evidenceResult] = await Promise.all([
    DB.query(GET_VERIFICATION_CHECKS_BY_RUN, [runId]),
    DB.query(GET_VERIFICATION_EVIDENCE_BY_RUN, [runId]),
  ]);

  return {
    ...run,
    checks: checksResult.rows,
    evidence: evidenceResult.rows,
  };
};

export const claimCapabilityVerificationRunForResume = async ({
  runId,
  userId,
}) => {
  const result = await DB.query(CLAIM_CAPABILITY_RUN_FOR_RESUME, [
    runId,
    userId,
  ]);

  return result.rows[0] || null;
};

export const getLatestVerifiedHyperwalletRecipient = async ({
  integrationId,
  userId,
}) => {
  if (!integrationId || !userId) {
    throw new Error("Integration ID and user ID are required.");
  }

  const result = await DB.query(GET_LATEST_VERIFIED_HYPERWALLET_RECIPIENT, [
    integrationId,
    userId,
  ]);

  return result.rows[0] || null;
};
// --------------------------------------------------
// Global Verification History
// --------------------------------------------------

export const getVerificationRunsForUser = async (userId) => {
    const result = await DB.query(
        GET_VERIFICATION_RUNS_FOR_USER,
        [userId]
    );

    return result.rows;
};