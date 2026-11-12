import {
  runProjectGapAnalysis,
  getProjectGapAnalysisRun,
} from "./AIGapAnalysis.services.js";

export const createProjectGapAnalysis = async (req, res) => {
  try {
    const result = await runProjectGapAnalysis({
      projectId: req.validatedParams.projectId,
      capabilityId: req.validatedBody.capabilityId,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "AI Gap Analysis completed successfully.",
      data: result,
    });
  } catch (error) {
    console.error("AI Gap Analysis failed:", {
      code: error.code || "AI_GAP_ANALYSIS_FAILED",
      message: error.message,
      statusCode: error.statusCode || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "AI_GAP_ANALYSIS_FAILED",
      message: error.statusCode
        ? error.message
        : "Unable to complete AI Gap Analysis.",
    });
  }
};

export const getProjectGapAnalysis = async (req, res) => {
  try {
    const result = await getProjectGapAnalysisRun({
      projectId: req.validatedParams.projectId,
      runId: req.validatedParams.runId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "GAP_ANALYSIS_RETRIEVAL_FAILED",
      message: error.statusCode
        ? error.message
        : "Unable to retrieve the AI Gap Analysis report.",
    });
  }
};