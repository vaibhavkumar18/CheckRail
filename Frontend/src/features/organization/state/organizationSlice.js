import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  organizations: [],
  current: null,
  members: [],
  loading: false,
  submitting: false,
  error: null,
};

const organizationSlice = createSlice({
  name: "organization",
  initialState,
  reducers: {
    setOrganizations: (state, action) => {
      state.organizations = action.payload;
    },
    setCurrentOrganization: (state, action) => {
      state.current = action.payload;
    },
    setOrganizationMembers: (state, action) => {
      state.members = action.payload;
    },
    setOrganizationLoading: (state, action) => {
      state.loading = action.payload;
    },
    setOrganizationSubmitting: (state, action) => {
      state.submitting = action.payload;
    },
    setOrganizationError: (state, action) => {
      state.error = action.payload;
    },
    clearOrganizationDetails: (state) => {
      state.current = null;
      state.members = [];
      state.error = null;
    },
    resetOrganizationState: () => initialState,
  },
});

export const {
  setOrganizations,
  setCurrentOrganization,
  setOrganizationMembers,
  setOrganizationLoading,
  setOrganizationSubmitting,
  setOrganizationError,
  clearOrganizationDetails,
  resetOrganizationState,
} = organizationSlice.actions;

export default organizationSlice.reducer;
