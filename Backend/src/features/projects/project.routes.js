
import express from "express";

import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";
import * as projectController from "./project.controllers.js";
import * as projectValidation from "./project.validation.js";
import * as projectOverviewController from "./project.overview.controllers.js";

const router = express.Router();

// Global project listing for authenticated user.
router.get(
    "/",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
    projectController.getProjectsForUser
);

// Project overview.
router.get(
    "/:projectId/overview",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
    projectValidation.validateProjectId,
    projectOverviewController.getProjectOverview
);

// Organization-specific project listing.
router.get(
    "/:organizationId/projects",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
    projectValidation.validateOrganizationId,
    projectController.getProjectsByOrganization
);

// Create project.
router.post(
    "/:organizationId/createProject",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    projectValidation.validateOrganizationId,
    projectValidation.validateCreateProject,
    projectController.createProject
);

// Get project by ID.
router.get(
    "/:projectId",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
    projectValidation.validateProjectId,
    projectController.getProjectById
);

// Update project.
router.patch(
    "/:projectId/updateProject",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    projectValidation.validateProjectId,
    projectValidation.validateUpdateProject,
    projectController.updateProject
);

// Delete project.
router.delete(
    "/:projectId/deleteProject",
    authMiddleware.authenticateUser,
    roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER"),
    projectValidation.validateProjectId,
    projectController.deleteProject
);

export default router;
