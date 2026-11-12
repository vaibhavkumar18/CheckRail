import express from "express";
import { z } from "zod";
import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";
import * as CapabilityVerificationController from "./CapabilityVerification.controllers.js";

const router = express.Router();
const uuidSchema = z.string().uuid();

const validateParam = (paramName) => (req, res, next) => {
  const result = uuidSchema.safeParse(req.params[paramName]);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}.`,
    });
  }
  next();
};

const allowedRoles = roleMiddleware.authorizeRoles(
  "ADMIN",
  "DEVELOPER",
  "REVIEWER",
);
router.get(
    "/",
    authMiddleware.authenticateUser,
    allowedRoles,
    CapabilityVerificationController.getAllVerificationRuns,
);
router.get(
  "/projects/:projectId/runs",
  authMiddleware.authenticateUser,
  allowedRoles,
  validateParam("projectId"),
  CapabilityVerificationController.getCapabilityRuns,
);

router.get(
  "/projects/:projectId/latest",
  authMiddleware.authenticateUser,
  allowedRoles,
  validateParam("projectId"),
  CapabilityVerificationController.getLatestCapabilityRuns,
);

router.get(
  "/runs/:runId",
  authMiddleware.authenticateUser,
  allowedRoles,
  validateParam("runId"),
  CapabilityVerificationController.getCapabilityRunDetails,
);

export default router;
