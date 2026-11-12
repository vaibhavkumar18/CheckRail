import api from "../../../api/axios";

export const getOrganizations = async () =>
  (await api.get("/organization/getOrganization")).data;

export const getOrganization = async (organizationId) =>
  (await api.get(`/organization/${organizationId}`)).data;

export const createOrganization = async (payload) =>
  (await api.post("/organization/createOrganization", payload)).data;

export const updateOrganization = async (organizationId, payload) =>
  (await api.put(`/organization/${organizationId}/updateOrganization`, payload))
    .data;

export const deleteOrganization = async (organizationId) =>
  (await api.delete(`/organization/${organizationId}/deleteOrganization`)).data;

export const getOrganizationMembers = async (organizationId) =>
  (await api.get(`/organization/${organizationId}/members`)).data;

export const searchOrganizationMember = async (organizationId, email) =>
  (
    await api.get(`/organization/${organizationId}/members/search`, {
      params: { email },
    })
  ).data;

export const addNewOrganizationMember = async (organizationId, payload) =>
  (await api.post(`/organization/${organizationId}/addMember`, payload)).data;

export const addExistingOrganizationMember = async (organizationId, payload) =>
  (await api.post(`/organization/${organizationId}/members/existing`, payload))
    .data;

export const updateOrganizationMember = async (
  organizationId,
  membershipId,
  payload,
) =>
  (
    await api.put(
      `/organization/${organizationId}/${membershipId}/updateMember`,
      payload,
    )
  ).data;

export const removeOrganizationMember = async (organizationId, membershipId) =>
  (
    await api.delete(
      `/organization/${organizationId}/${membershipId}/removeMember`,
    )
  ).data;
