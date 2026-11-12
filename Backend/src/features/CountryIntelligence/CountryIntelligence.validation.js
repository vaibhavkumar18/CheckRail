
import { z } from "zod";

const projectParamsSchema = z.object({
  projectId: z.string().uuid(),
});

const runParamsSchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().uuid(),
});

const intelligenceParamsSchema = z.object({
  projectId: z.string().uuid(),
  intelligenceId: z.string().uuid(),
});

export const validateProjectParams = (req, res, next) => {
  const parsed = projectParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project ID.",
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  req.params = parsed.data;
  next();
};

export const validateRunParams = (req, res, next) => {
  const parsed = runParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project or research run ID.",
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  req.params = parsed.data;
  next();
};

export const validateIntelligenceParams = (req, res, next) => {
  const parsed = intelligenceParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project ID or Country Intelligence profile ID.",
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  req.params = parsed.data;
  next();
};
