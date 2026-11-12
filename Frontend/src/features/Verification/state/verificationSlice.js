
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    result: null,
    runs: [],
    runDetails: null,
    loading: false,
    error: null,
};

const verificationSlice = createSlice({
    name: "verification",
    initialState,

    reducers: {
        setVerificationLoading: (state, action) => {
            state.loading = action.payload;
        },

        setVerificationError: (state, action) => {
            state.error = action.payload;
        },

        setVerificationResult: (state, action) => {
            state.result = action.payload;
        },

        setVerificationRuns: (state, action) => {
            state.runs = action.payload;
        },

        setVerificationRunDetails: (state, action) => {
            state.runDetails = action.payload;
        },

        clearVerificationError: (state) => {
            state.error = null;
        },

        clearVerificationDetails: (state) => {
            state.runDetails = null;
        },

        resetVerificationState: () => initialState,
    },
});

export const {
    setVerificationLoading,
    setVerificationError,
    setVerificationResult,
    setVerificationRuns,
    setVerificationRunDetails,
    clearVerificationError,
    clearVerificationDetails,
    resetVerificationState,
} = verificationSlice.actions;

export default verificationSlice.reducer;
