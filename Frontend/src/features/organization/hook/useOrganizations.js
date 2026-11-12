import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setOrganizations, setCurrentOrganization, setOrganizationMembers,
  setOrganizationLoading, setOrganizationSubmitting, setOrganizationError,
  clearOrganizationDetails,
} from "../state/organizationSlice";
import * as organizationApi from "../api/organization.api";

const messageOf = (error) => error?.response?.data?.message || error?.message || "Something went wrong.";
const unwrapArray = (response, key) => Array.isArray(response?.[key]) ? response[key] : Array.isArray(response?.data) ? response.data : [];

export default function useOrganizations() {
  const dispatch = useDispatch();
  const state = useSelector((store) => store.organization);

  const loadOrganizations = useCallback(async () => {
    dispatch(setOrganizationLoading(true));
    dispatch(setOrganizationError(null));
    try {
      const response = await organizationApi.getOrganizations();
      dispatch(setOrganizations(unwrapArray(response, "organizations")));
      return response;
    } catch (error) {
      if (error?.response?.status === 404) {
        dispatch(setOrganizations([]));
        return { organizations: [] };
      }
      dispatch(setOrganizationError(messageOf(error)));
      throw error;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  }, [dispatch]);

  const loadOrganization = useCallback(async (organizationId) => {
    dispatch(setOrganizationLoading(true));
    dispatch(setOrganizationError(null));
    try {
      const [organizationResponse, membersResponse] = await Promise.all([
        organizationApi.getOrganization(organizationId),
        organizationApi.getOrganizationMembers(organizationId).catch((error) => {
          if (error?.response?.status === 404) return { members: [] };
          throw error;
        }),
      ]);
      dispatch(setCurrentOrganization(organizationResponse?.organization || organizationResponse));
      dispatch(setOrganizationMembers(unwrapArray(membersResponse, "members")));
      return organizationResponse;
    } catch (error) {
      dispatch(setOrganizationError(messageOf(error)));
      throw error;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  }, [dispatch]);

  const mutate = useCallback(async (operation, refreshId = null) => {
    dispatch(setOrganizationSubmitting(true));
    dispatch(setOrganizationError(null));
    try {
      const result = await operation();
      if (refreshId) await loadOrganization(refreshId);
      else await loadOrganizations();
      return result;
    } catch (error) {
      dispatch(setOrganizationError(messageOf(error)));
      throw error;
    } finally {
      dispatch(setOrganizationSubmitting(false));
    }
  }, [dispatch, loadOrganization, loadOrganizations]);

  const create = (payload) => mutate(() => organizationApi.createOrganization(payload));
  const update = (id, payload) => mutate(() => organizationApi.updateOrganization(id, payload), id);
  const remove = (id) => mutate(() => organizationApi.deleteOrganization(id));
  const addNewMember = (id, payload) => mutate(() => organizationApi.addNewOrganizationMember(id, payload), id);
  const addExistingMember = (id, payload) => mutate(() => organizationApi.addExistingOrganizationMember(id, payload), id);
  const editMember = (id, membershipId, payload) => mutate(() => organizationApi.updateOrganizationMember(id, membershipId, payload), id);
  const removeMember = (id, membershipId) => mutate(() => organizationApi.removeOrganizationMember(id, membershipId), id);
  const searchMember = (id, email) => organizationApi.searchOrganizationMember(id, email);

  const clearDetails = () => dispatch(clearOrganizationDetails());

  return {
    ...state, loadOrganizations, loadOrganization, create, update, remove,
    addNewMember, addExistingMember, editMember, removeMember, searchMember, clearDetails,
  };
}
