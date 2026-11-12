import DB from "../../config/DB.js";
import * as Q from "./AIGapAnalysis.queries.js";

export const getProjectAndCapabilityContext = async ({
  projectId,
  capabilityId,
  userId,
}) => {
  const { rows } = await DB.query(
    Q.GET_PROJECT_AND_CAPABILITY_CONTEXT,
    [
      projectId,
      capabilityId,
      userId,
    ]
  );

  return rows[0] ?? null;
};

export const getCapabilityChecks = async (runId) => {
  const { rows } = await DB.query(
    Q.GET_CAPABILITY_CHECKS,
    [runId]
  );

  return rows;
};

export const getCapabilityEvidence = async (runId) => {
  const { rows } = await DB.query(
    Q.GET_CAPABILITY_EVIDENCE,
    [runId]
  );

  return rows;
};

export const getCompletedCountryProfile = async ({
  projectId,
  countryCode,
}) => {
  const { rows } = await DB.query(
    Q.GET_COMPLETED_COUNTRY_PROFILE,
    [
      projectId,
      countryCode,
    ]
  );

  return rows[0] ?? null;
};

export const getCountryRequirementsWithSources = async (profileId) => {
  const { rows } = await DB.query(
    Q.GET_COUNTRY_REQUIREMENTS_WITH_SOURCES,
    [profileId]
  );

  return rows;
};

export const getCountryProfileSources = async (profileId) => {
  const { rows } = await DB.query(
    Q.GET_COUNTRY_PROFILE_SOURCES,
    [profileId]
  );

  return rows;
};

export const createGapAnalysisRun = async ({
  projectId,
  integrationId,
  capabilityId,
  countryProfileIds,
  provider,
  environment,
  userId,
}) => {
  const { rows } = await DB.query(
    Q.INSERT_GAP_ANALYSIS_RUN,
    [
      projectId,
      integrationId,
      capabilityId,
      JSON.stringify(countryProfileIds),
      provider,
      environment,
      userId,
    ]
  );

  return rows[0];
};

export const completeGapAnalysisRun = async ({
  runId,
  model,
  requestId,
  usage,
  evidenceSnapshot,
  report,
}) => {
  const { rows } = await DB.query(
    Q.COMPLETE_GAP_ANALYSIS_RUN,
    [
      runId,
      model,
      requestId,
      JSON.stringify(usage ?? {}),
      JSON.stringify(evidenceSnapshot),
      JSON.stringify(report),
    ]
  );

  return rows[0] ?? null;
};

export const failGapAnalysisRun = async ({
  runId,
  code,
  message,
}) => {
  const { rows } = await DB.query(
    Q.FAIL_GAP_ANALYSIS_RUN,
    [
      runId,
      code || "AI_GAP_ANALYSIS_FAILED",
      String(message || "Gap Analysis failed.").slice(0, 2000),
    ]
  );

  return rows[0] ?? null;
};

export const getGapAnalysisRunForUser = async ({
  projectId,
  runId,
  userId,
}) => {
  const { rows } = await DB.query(
    Q.GET_GAP_ANALYSIS_RUN_FOR_USER,
    [
      projectId,
      runId,
      userId,
    ]
  );

  return rows[0] ?? null;
};