import * as organizationService from "./organization.services.js";
import * as passwordUtils from "../../utils/passwordHash.js";

export const getOrganizations = async (req, res) => {
  try {
    const organizations =
      await organizationService.getOrganizationsByUserId(req.user.id);

    return res.status(200).json({
      success: true,
      organizations: organizations || [],
    });
  } catch (error) {
    console.error("Get organizations:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch organizations.",
    });
  }
};

export const getOrganizationById = async (req, res) => {
  try {
    const organization =
      await organizationService.getOrganizationById(
        req.params.organizationId,
        req.user.id
      );

    return res.status(200).json({
      success: true,
      organization,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to fetch organization.",
    });
  }
};

export const createOrganization = async (req, res) => {
  try {
    const organization =
      await organizationService.createOrganization(
        req.body.name,
        req.user.id
      );

    return res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      organization,
    });
  } catch (error) {
    console.error("Create organization:", error);

    return res.status(error.code === "23505" ? 409 : 500).json({
      success: false,
      message:
        error.code === "23505"
          ? "This organization already exists or the owner already has an organization."
          : "Unable to create organization.",
    });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const organization =
      await organizationService.updateOrganization(
        req.params.organizationId,
        req.user.id,
        req.body.name
      );

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      organization,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update organization.",
    });
  }
};

export const deleteOrganization = async (req, res) => {
  try {
    await organizationService.deleteOrganization(
      req.params.organizationId,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully.",
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "Organization has linked projects and cannot be deleted.",
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to delete organization.",
    });
  }
};

export const getMembers = async (req, res) => {
  try {
    const members = await organizationService.getMembers(
      req.params.organizationId,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      members: members || [],
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to fetch organization members.",
    });
  }
};

export const addMember = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const passwordHash = await passwordUtils.hashPassword(password);

    const member = await organizationService.AddMemberToOrganization(
      req.params.organizationId,
      req.user.id,
      name,
      email,
      passwordHash,
      role
    );

    return res.status(201).json({
      success: true,
      message: "Member added successfully.",
      member,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : error.code === "23505"
          ? "An account with this email already exists."
          : "Unable to add member.",
    });
  }
};

export const searchExistingMember = async (req, res) => {
  try {
    const { user, existingMembership } =
      await organizationService.searchExistingMember(
        req.params.organizationId,
        req.user.id,
        req.validatedQuery.email
      );

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      already_member: Boolean(existingMembership),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to search for member.",
    });
  }
};

export const addExistingMember = async (req, res) => {
  try {
    const member =
      await organizationService.AddExistingMemberToOrganization(
        req.params.organizationId,
        req.user.id,
        req.body.userId,
        req.body.role
      );

    return res.status(201).json({
      success: true,
      message: "Existing member added successfully.",
      member,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to add existing member.",
    });
  }
};

export const updateMember = async (req, res) => {
  try {
    const member = await organizationService.updateMember(
      req.params.organizationId,
      req.user.id,
      req.params.membershipId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Member updated successfully.",
      member,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update member.",
    });
  }
};

export const removeMember = async (req, res) => {
  try {
    await organizationService.removeMember(
      req.params.organizationId,
      req.user.id,
      req.params.membershipId
    );

    return res.status(200).json({
      success: true,
      message: "Member removed successfully.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to remove member.",
    });
  }
};