import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import router from "./app.routes";

import {
  setAuthenticated,
  setUnauthenticated,
} from "./features/auth/state/authSlice";

import { getCurrentUser } from "./features/auth/api/auth.api";

const AuthBootstrap = () => {
  const dispatch = useDispatch();

  const status = useSelector(
    (state) => state.auth.status
  );

  useEffect(() => {
    if (status !== "checking") return;

    let active = true;

    const restoreSession = async () => {
      try {
        const response = await getCurrentUser();

        if (!active) return;

        if (!response?.user) {
          dispatch(setUnauthenticated());
          return;
        }

        dispatch(setAuthenticated(response.user));
      } catch {
        if (active) {
          dispatch(setUnauthenticated());
        }
      }
    };

    restoreSession();

    const fallback = window.setTimeout(() => {
      if (active) {
        dispatch(setUnauthenticated());
      }
    }, 10000);

    return () => {
      active = false;
      window.clearTimeout(fallback);
    };
  }, [dispatch, status]);

  return <RouterProvider router={router} />;
};

const App = () => <AuthBootstrap />;

export default App;