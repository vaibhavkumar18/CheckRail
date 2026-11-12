import express from "express";

import * as organizationController from "./organization.controllers.js";
import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as roleMiddleware from "../../middleware/role.middleware.js";
import * as organizationValidator from "./organization.validation.js";

const router = express.Router();

const authenticate = authMiddleware.authenticateUser;
const adminOnly = roleMiddleware.authorizeRoles("ADMIN");

router.get(
  "/getOrganization",
  authenticate,
  roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
  organizationController.getOrganizations
);

router.get(
  "/:organizationId",
  authenticate,
  roleMiddleware.authorizeRoles("ADMIN", "DEVELOPER", "REVIEWER"),
  organizationValidator.validateOrganizationId,
  organizationController.getOrganizationById
);

router.post(
  "/createOrganization",
  authenticate,
  adminOnly,
  organizationValidator.validateCreateOrganization,
  organizationController.createOrganization
);

router.put(
  "/:organizationId/updateOrganization",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationValidator.validateUpdateOrganization,
  organizationController.updateOrganization
);

router.delete(
  "/:organizationId/deleteOrganization",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationController.deleteOrganization
);

router.get(
  "/:organizationId/members",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationController.getMembers
);

router.get(
  "/:organizationId/members/search",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationValidator.validateSearchExistingMember,
  organizationController.searchExistingMember
);

router.post(
  "/:organizationId/addMember",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationValidator.validateAddMember,
  organizationController.addMember
);

router.post(
  "/:organizationId/members/existing",
  authenticate,
  adminOnly,
  organizationValidator.validateOrganizationId,
  organizationValidator.validateAddExistingMember,
  organizationController.addExistingMember
);

router.put(
  "/:organizationId/:membershipId/updateMember",
  authenticate,
  adminOnly,
  organizationValidator.validateMemberParams,
  organizationValidator.validateUpdateMember,
  organizationController.updateMember
);

router.delete(
  "/:organizationId/:membershipId/removeMember",
  authenticate,
  adminOnly,
  organizationValidator.validateMemberParams,
  organizationController.removeMember
);

export default router;