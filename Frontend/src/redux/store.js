import { configureStore } from "@reduxjs/toolkit";

import authReducer from "../features/auth/state/authSlice";
import organizationReducer from "../features/organization/state/organizationSlice";
import projectReducer from "../features/project/state/projectSlice";
import verificationReducer from "../features/Verification/state/verificationSlice";
const store = configureStore({
  reducer: {
    auth: authReducer,
    organization: organizationReducer,
    project: projectReducer,
     verification: verificationReducer,
  },
});

export default store;