import Organization from "./organization.model.js";
import User from "../users/user.model.js";

const ensureOrganizationAccess = async (
  organizationId,
  userId,
  requireAdmin = false,
) => {
  // Pass userId because the model query checks ownership/membership.
  const organization = await Organization.getOrganizationById(
    organizationId,
    userId,
  );

  if (!organization) {
    const error = new Error("Organization not found.");
    error.statusCode = 404;
    throw error;
  }

  const isOwner = String(organization.owner_id) === String(userId);

  const membership = await Organization.getMembershipByUserId(
    organizationId,
    userId,
  );

  const isOrganizationAdmin = membership?.role === "ADMIN";

  if (!isOwner && !membership) {
    const error = new Error("You do not have access to this organization.");
    error.statusCode = 403;
    throw error;
  }

  if (requireAdmin && !isOwner && !isOrganizationAdmin) {
    const error = new Error("Organization admin permission required.");
    error.statusCode = 403;
    throw error;
  }

  return {
    ...organization,
    user_role: isOwner ? "ADMIN" : membership.role,
  };
};

export const getOrganizationsByUserId = async (userId) => {
  return Organization.getOrganizationsByUserId(userId);
};

export const getOrganizationById = async (organizationId, userId) => {
  // The access check already fetched the organization.
  // Return that result instead of querying again without userId.
  return ensureOrganizationAccess(organizationId, userId);
};

export const createOrganization = async (name, ownerId) => {
  return Organization.createOrganization(name, ownerId);
};

export const updateOrganization = async (organizationId, userId, name) => {
  await ensureOrganizationAccess(organizationId, userId, true);

  return Organization.updateOrganization(organizationId, name);
};

export const deleteOrganization = async (organizationId, userId) => {
  await ensureOrganizationAccess(organizationId, userId, true);

  return Organization.deleteOrganization(organizationId);
};

export const getMembers = async (organizationId, userId) => {
  await ensureOrganizationAccess(organizationId, userId);

  return Organization.getOrganizationMembers(organizationId);
};

export const AddMemberToOrganization = async (
  organizationId,
  userId,
  name,
  email,
  passwordHash,
  role,
) => {
  await ensureOrganizationAccess(organizationId, userId, true);

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.getUserByEmail(normalizedEmail);

  if (existingUser) {
    const error = new Error(
      "An account with this email already exists. Add the existing user instead.",
    );
    error.statusCode = 409;
    throw error;
  }

  const newMember = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
  });

  const membership = await Organization.createOrganizationMember(
    organizationId,
    newMember.id,
    role,
  );

  return {
    ...membership,
    name: newMember.name,
    email: newMember.email,
  };
};

export const searchExistingMember = async (organizationId, userId, email) => {
  await ensureOrganizationAccess(organizationId, userId, true);

  const user = await User.getUserByEmail(email.trim().toLowerCase());

  if (!user) {
    const error = new Error("No registered user found with this email.");
    error.statusCode = 404;
    throw error;
  }

  const existingMembership = await Organization.getMembershipByUserId(
    organizationId,
    user.id,
  );

  return {
    user,
    existingMembership,
  };
};

export const AddExistingMemberToOrganization = async (
  organizationId,
  actorId,
  memberUserId,
  role,
) => {
  await ensureOrganizationAccess(organizationId, actorId, true);

  const user = await User.findById(memberUserId);

  if (!user || !user.is_active) {
    const error = new Error("User not found or inactive.");
    error.statusCode = 404;
    throw error;
  }

  const existingMembership = await Organization.getMembershipByUserId(
    organizationId,
    user.id,
  );

  if (existingMembership) {
    const error = new Error("User is already a member of this organization.");
    error.statusCode = 409;
    throw error;
  }

  const membership = await Organization.createOrganizationMember(
    organizationId,
    user.id,
    role,
  );

  return {
    ...membership,
    name: user.name,
    email: user.email,
  };
};

export const updateMember = async (
  organizationId,
  actorId,
  membershipId,
  updates,
) => {
  await ensureOrganizationAccess(organizationId, actorId, true);

  const member = await Organization.getMembershipById(
    membershipId,
    organizationId,
  );

  if (!member) {
    const error = new Error("Member not found.");
    error.statusCode = 404;
    throw error;
  }

  if (member.user_id === actorId && updates.role !== "ADMIN") {
    const error = new Error(
      "You cannot remove your own organization admin role.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (member.user_id === actorId) {
    const error = new Error("You cannot modify your own membership.");
    error.statusCode = 400;
    throw error;
  }

  return Organization.updateOrganizationMember(
    organizationId,
    membershipId,
    updates,
  );
};

export const removeMember = async (organizationId, actorId, membershipId) => {
  const organization = await ensureOrganizationAccess(
    organizationId,
    actorId,
    true,
  );

  const member = await Organization.getMembershipById(
    membershipId,
    organizationId,
  );

  if (!member) {
    const error = new Error("Member not found.");
    error.statusCode = 404;
    throw error;
  }

  if (member.user_id === organization.owner_id) {
    const error = new Error("The organization owner cannot be removed.");
    error.statusCode = 400;
    throw error;
  }

  if (member.user_id === actorId) {
    const error = new Error(
      "You cannot remove yourself from this organization.",
    );
    error.statusCode = 400;
    throw error;
  }

  return Organization.deleteOrganizationMember(organizationId, membershipId);
};
