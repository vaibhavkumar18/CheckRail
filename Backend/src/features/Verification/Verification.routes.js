import express from "express";

import * as authMiddleware from "../../middleware/auth.middleware.js";

import * as VerificationValidation from "./Verification.validation.js";

import * as VerificationController from "./Verification.controllers.js";
import * as VerificationReadController from "./Verification.read.controllers.js";

const router = express.Router();

// Read capability verification history and safe run details.
router.get(
  "/integrations/:integrationId/capability-runs",
  authMiddleware.authenticateUser,
  VerificationReadController.getCapabilityRuns,
);

router.get(
  "/capability-runs/:runId",
  authMiddleware.authenticateUser,
  VerificationReadController.getCapabilityRunDetails,
);


// --------------------------------------------------
// Run PayPal Verification
// POST /api/verification/integrations/:integrationId/PAYPAL
// --------------------------------------------------

router.post(
  "/credentials/:credentialId/verify-integration",
  authMiddleware.authenticateUser,
  VerificationValidation.validateCredentialVerificationParams,
  VerificationValidation.validateCredentialVerificationBody,
  VerificationController.runCredentialVerification,
);

router.post(
  "/integrations/:integrationId/:provider",
  authMiddleware.authenticateUser,
  VerificationValidation.validateVerificationParams,
  VerificationValidation.validateVerificationBody,
  VerificationController.runVerification,
);

router.post(
  "/capability-runs/:runId/resume",
  authMiddleware.authenticateUser,
  VerificationValidation.validateCapabilityResumeParams,
  VerificationController.resumeCapabilityVerification,
);

export default router;
