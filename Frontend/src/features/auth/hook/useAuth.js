import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
    setAuthenticated,
    setAuthError,
    logoutUser as clearAuth,
} from "../state/authSlice";

import {
    loginUser as loginAPI,
    signupUser as signupAPI,
    logoutUser as logoutAPI,
} from "../api/auth.api";

const getErrorMessage = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again.";

const useAuth = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const auth = useSelector((state) => state.auth);

    const login = async (credentials) => {
        try {
            dispatch(setAuthError(null));

            const response = await loginAPI(credentials);

            if (!response?.user) {
                throw new Error("Invalid login response from server.");
            }

            dispatch(setAuthenticated(response.user));

            navigate("/dashboard", { replace: true });

            return { success: true };
        } catch (error) {
            const message = getErrorMessage(error);
            dispatch(setAuthError(message));

            return { success: false, message };
        }
    };

    const signup = async (userData) => {
        try {
            dispatch(setAuthError(null));

            const response = await signupAPI(userData);

            if (!response?.user) {
                throw new Error("Invalid signup response from server.");
            }

            dispatch(setAuthenticated(response.user));

            navigate("/dashboard", { replace: true });

            return { success: true };
        } catch (error) {
            const message = getErrorMessage(error);
            dispatch(setAuthError(message));

            return { success: false, message };
        }
    };

    const logout = async () => {
        try {
            await logoutAPI();
        } catch (error) {
            console.error(
                "Logout request failed:",
                getErrorMessage(error)
            );
        } finally {
            dispatch(clearAuth());

            navigate("/auth/login", { replace: true });
        }
    };

    return {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        status: auth.status,
        error: auth.error,
        login,
        signup,
        logout,
    };
};

export default useAuth;