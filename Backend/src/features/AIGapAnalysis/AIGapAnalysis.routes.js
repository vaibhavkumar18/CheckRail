import express from "express";
import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";
import * as validation from "./AIGapAnalysis.validation.js";
import * as controller from "./AIGapAnalysis.controllers.js";

const router = express.Router();

router.post(
  "/projects/:projectId",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
  validation.validateProjectParams,
  validation.validateCreateAnalysisBody,
  controller.createProjectGapAnalysis,
);

router.get(
  "/projects/:projectId/runs/:runId",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
  validation.validateRunParams,
  controller.getProjectGapAnalysis,
);

export default router;
