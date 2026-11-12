import express from "express";

import * as authController from "./auth.controllers.js";
import * as authValidator from "./auth.validation.js";
import * as authMiddleware from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/signup",
  authValidator.validateSignUp,
  authController.SignUp
);

router.post(
  "/login",
  authValidator.validateLogin,
  authController.Login
);

router.get(
  "/me",
  authMiddleware.authenticateUser,
  authController.getCurrentUser
);

router.post(
  "/logout",
  authController.Logout
);

export default router;