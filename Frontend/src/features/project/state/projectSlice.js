
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  projects: [],
  selectedProject: null,
  loading: false,
  submitting: false,
  error: null,

  // Request state for Project Workflow API operations.
  workflowRequests: {},
  workflowError: null,
};

const projectSlice = createSlice({
  name: "project",
  initialState,

  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
    },

    setSelectedProject: (state, action) => {
      state.selectedProject = action.payload;
    },

    setProjectLoading: (state, action) => {
      state.loading = action.payload;
    },

    setProjectSubmitting: (state, action) => {
      state.submitting = action.payload;
    },

    setProjectError: (state, action) => {
      state.error = action.payload;
    },

    setWorkflowRequestState: (state, action) => {
      const { key, loading } = action.payload;

      state.workflowRequests[key] = {
        ...(state.workflowRequests[key] || {}),
        loading,
      };
    },

    setWorkflowRequestError: (state, action) => {
      const { key, error } = action.payload;

      state.workflowRequests[key] = {
        ...(state.workflowRequests[key] || {}),
        loading: false,
        error,
      };

      state.workflowError = error;
    },

    clearWorkflowRequestError: (state, action) => {
      const key = action.payload;

      if (state.workflowRequests[key]) {
        state.workflowRequests[key].error = null;
      }

      state.workflowError = null;
    },

    resetWorkflowRequestState: (state) => {
      state.workflowRequests = {};
      state.workflowError = null;
    },

    resetProjectState: () => initialState,
  },
});

export const {
  setProjects,
  setSelectedProject,
  setProjectLoading,
  setProjectSubmitting,
  setProjectError,
  setWorkflowRequestState,
  setWorkflowRequestError,
  clearWorkflowRequestError,
  resetWorkflowRequestState,
  resetProjectState,
} = projectSlice.actions;

export default projectSlice.reducer;
