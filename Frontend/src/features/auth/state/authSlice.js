import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,

  isAuthenticated: false,

  status: "checking",

  error: null,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    setAuthChecking: (state) => {
      state.status = "checking";
      state.error = null;
    },

    setAuthenticated: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.status = "authenticated";
      state.error = null;
    },

    setUnauthenticated: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = "unauthenticated";
    },

    setAuthError: (state, action) => {
      state.error = action.payload;
    },

    logoutUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = "unauthenticated";
      state.error = null;
    },
  },
});

export const {
  setAuthChecking,
  setAuthenticated,
  setUnauthenticated,
  setAuthError,
  logoutUser,
} = authSlice.actions;

export default authSlice.reducer;