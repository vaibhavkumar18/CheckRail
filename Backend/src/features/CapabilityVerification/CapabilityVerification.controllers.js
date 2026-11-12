import {
  getVerificationRunsForProject,
  getLatestVerificationRunsForProject,
  getVerificationRunDetails,
  getVerificationRunsForUser
} from "./CapabilityVerification.model.js";

const redactSensitiveMetadata = (value) => {
  if (Array.isArray(value)) return value.map(redactSensitiveMetadata);
  if (!value || typeof value !== "object") return value;

  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (/(secret|token|password|authorization|credential|api.?key|client.?key)/i.test(key)) {
      continue;
    }
    safe[key] = redactSensitiveMetadata(item);
  }
  return safe;
};

const toSafeRunDetails = (run) => ({
  ...run,
  evidence: (run.evidence || []).map((item) => ({
    ...item,
    metadata: redactSensitiveMetadata(item.metadata),
  })),
});

export const getCapabilityRuns = async (req, res, next) => {
  try {
    const runs = await getVerificationRunsForProject(
      req.params.projectId,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: "Capability verification runs retrieved successfully.",
      data: { runs },
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestCapabilityRuns = async (req, res, next) => {
  try {
    const runs = await getLatestVerificationRunsForProject(
      req.params.projectId,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: "Latest capability verification runs retrieved successfully.",
      data: { runs },
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
      data: { run: toSafeRunDetails(run) },
    });
  } catch (error) {
    next(error);
  }
};
// --------------------------------------------------
// Global Verification History
// --------------------------------------------------

export const getAllVerificationRuns = async (req, res, next) => {
    try {
        const runs = await getVerificationRunsForUser(req.user.id);

        return res.status(200).json({
            success: true,
            message: "Verification history retrieved successfully.",
            data: { runs },
        });
    } catch (error) {
        next(error);
    }
};