import { z } from "zod";

const uuidSchema = z.string().uuid("A valid UUID is required.");

export const validateProjectParams = (req, res, next) => {
  const parsed = z.object({
    projectId: uuidSchema,
  }).safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PROJECT_ID",
      message: "A valid project ID is required.",
      errors: parsed.error.flatten(),
    });
  }

  req.validatedParams = parsed.data;
  next();
};

export const validateCreateAnalysisBody = (req, res, next) => {
  const parsed = z.object({
    capabilityId: uuidSchema,
  }).strict().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_GAP_ANALYSIS_REQUEST",
      message:
        "Provide the Capability Verification record ID from data.capability.id.",
      errors: parsed.error.flatten(),
    });
  }

  req.validatedBody = parsed.data;
  next();
};

export const validateRunParams = (req, res, next) => {
  const parsed = z.object({
    projectId: uuidSchema,
    runId: uuidSchema,
  }).safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_GAP_ANALYSIS_RUN_ID",
      message: "Valid project and analysis run IDs are required.",
      errors: parsed.error.flatten(),
    });
  }

  req.validatedParams = parsed.data;
  next();
};