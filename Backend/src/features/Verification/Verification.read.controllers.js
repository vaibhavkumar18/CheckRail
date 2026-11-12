import {
  getVerificationRunsForIntegration,
  getVerificationRunDetails,
} from "../CapabilityVerification/CapabilityVerification.model.js";

const toRunSummary = (run) => ({
  id: run.id,
  integrationId: run.integration_id,
  provider: run.provider,
  environment: run.environment,
  capabilityCode: run.capability_code,
  overallStatus: run.overall_status,
  executionStatus: run.execution_status,
  startedAt: run.started_at,
  completedAt: run.completed_at,
  createdAt: run.created_at,
});

export const getCapabilityRuns = async (req, res, next) => {
  try {
    const runs = await getVerificationRunsForIntegration(
      req.params.integrationId,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: "Capability verification runs retrieved successfully.",
      data: runs.map(toRunSummary),
    });
  } catch (error) {
    next(error);
  }
};

export const getCapabilityRunDetails = async (req, res, next) => {
  try {
    const run = await getVerificationRunDetails(
      req.params.runId,
      req.user.id,
    );

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Capability verification run not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Capability verification run retrieved successfully.",
      data: {
        ...toRunSummary(run),
        progress: {
          totalOperations: Number(run.total_operations ?? 0),
          completedOperations: Number(run.completed_operations ?? 0),
          percentage: Number(run.progress_percent ?? 0),
        },
        checks: (run.checks ?? []).map((check) => ({
          id: check.id,
          operation: check.operation,
          status: check.status,
          message: check.message,
          providerStatus: check.provider_status,
          resourceId: check.resource_id,
          executionOrder: check.execution_order,
          startedAt: check.started_at,
          completedAt: check.completed_at,
          attemptCount: check.attempt_count,
          errorCode: check.error_code,
          errorMessage: check.error_message,
        })),
        evidence: (run.evidence ?? []).map((item) => ({
          id: item.id,
          checkId: item.check_id,
          evidenceType: item.evidence_type,
          operation: item.operation,
          httpMethod: item.http_method,
          endpoint: item.endpoint,
          httpStatus: item.http_status,
          resourceId: item.resource_id,
          observedAt: item.observed_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
