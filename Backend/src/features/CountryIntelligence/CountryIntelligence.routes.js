
import express from "express";
import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";
import * as validation from "./CountryIntelligence.validation.js";
import * as controller from "./CountryIntelligence.controllers.js";

const router = express.Router();

const readableRoles = ["ADMIN", "DEVELOPER", "REVIEWER"];
const writableRoles = ["ADMIN", "DEVELOPER"];

// Start Country Intelligence research.
router.post(
  "/:projectId/country-intelligence/runs",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles(...writableRoles),
  validation.validateProjectParams,
  controller.startCountryIntelligence,
);

// Retrieve research execution progress.
router.get(
  "/:projectId/country-intelligence/runs/:runId",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles(...readableRoles),
  validation.validateRunParams,
  controller.getCountryIntelligenceRun,
);

// Retrieve the latest Country Intelligence profile for each target country.
router.get(
  "/:projectId/country-intelligence",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles(...readableRoles),
  validation.validateProjectParams,
  controller.getCountryIntelligenceProfiles,
);

// Retrieve a specific saved Country Intelligence profile by its UUID.
router.get(
  "/:projectId/country-intelligence/:intelligenceId",
  authMiddleware.authenticateUser,
  roleMiddleware.authorizeRoles(...readableRoles),
  validation.validateIntelligenceParams,
  controller.getCountryIntelligenceProfile,
);

export default router;
