import express from "express";

import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";

import * as integrationController from "./Integration.controllers.js";
import * as integrationValidation from "./Integration.validation.js";

import * as uploadMiddleware from "../../middleware/upload.middleware.js";

const router = express.Router();

const authenticate = [
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
];

// --------------------------------------------------
// Upload + Automatic Analysis
// ADMIN, DEVELOPER
// --------------------------------------------------

router.post(
    "/:projectId/integration",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    integrationValidation.validateProjectId,
    uploadMiddleware.uploadIntegrationFile,
    integrationValidation.validateIntegrationFile,
    integrationController.createIntegration,
);

// --------------------------------------------------
// Global Integration Profiles
// ADMIN, DEVELOPER, REVIEWER
// --------------------------------------------------

router.get(
    "/",
    ...authenticate,
    integrationController.getAllIntegrations,
);

// --------------------------------------------------
// List Integration Profiles For Project
// --------------------------------------------------

router.get(
    "/projects/:projectId/integrations",
    ...authenticate,
    integrationValidation.validateProjectId,
    integrationController.getIntegrationsForProject,
);

// --------------------------------------------------
// Retrieve Integration Preview
// --------------------------------------------------

router.get(
    "/integrations/:integrationId/preview",
    ...authenticate,
    integrationController.getIntegrationPreview,
);

// --------------------------------------------------
// Update Integration Preview
// ADMIN, DEVELOPER
// --------------------------------------------------

router.patch(
    "/integrations/:integrationId/preview",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    integrationController.updateIntegrationPreview,
);

// --------------------------------------------------
// Confirm Integration
// ADMIN, DEVELOPER
// --------------------------------------------------

router.post(
    "/integrations/:integrationId/confirm",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    integrationController.confirmIntegration,
);

export default router;