import express from "express";

import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as CredentialsValidation from "./Credentials.validation.js";
import * as CredentialsController from "./Credentials.controllers.js";

const router = express.Router();

// --------------------------------------------------
// Create PayPal Credentials
// POST /integrations/:integrationId/credentials
// --------------------------------------------------

router.post(
  "/integrations/:integrationId/credentials",
  authMiddleware.authenticateUser,
  CredentialsValidation.validateIntegrationId,
  CredentialsValidation.validateCreateCredentials,
  CredentialsController.createCredentials,
);

// --------------------------------------------------
// Get PayPal Credentials (Safe Metadata)
// GET /integrations/:integrationId/credentials
// --------------------------------------------------

router.get(
  "/integrations/:integrationId/credentials",
  authMiddleware.authenticateUser,
  CredentialsValidation.validateIntegrationId,
  CredentialsController.getCredentials,
);

// --------------------------------------------------
// Update PayPal Credentials
// PATCH /integrations/:integrationId/credentials/:credentialId
// --------------------------------------------------

router.patch(
  "/integrations/:integrationId/credentials/:credentialId",
  authMiddleware.authenticateUser,
  CredentialsValidation.validateCredentialParams,
  CredentialsValidation.validateUpdateCredentials,
  CredentialsController.updateCredentials,
);

// --------------------------------------------------
// Delete PayPal Credentials
// DELETE /integrations/:integrationId/credentials/:credentialId
// --------------------------------------------------

router.delete(
  "/integrations/:integrationId/credentials/:credentialId",
  authMiddleware.authenticateUser,
  CredentialsValidation.validateCredentialParams,
  CredentialsController.deleteCredentials,
);

export default router;
