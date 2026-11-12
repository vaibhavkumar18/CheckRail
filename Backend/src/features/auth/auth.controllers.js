import * as authService from "./auth.services.js";
import * as jwtUtils from "../../utils/jwt.js";

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error."
        : error.message,
  });
};

export const SignUp = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await authService.signUp(
      name,
      email,
      password
    );

    const token = jwtUtils.generateToken(
      user.id,
      user.role
    );

    res.cookie(
      jwtUtils.COOKIE_NAME,
      token,
      jwtUtils.cookieOptions
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user,
    });
  } catch (error) {
    return sendError(res, error, "Signup error:");
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await authService.login(
      email,
      password
    );

    const token = jwtUtils.generateToken(
      user.id,
      user.role
    );

    res.cookie(
      jwtUtils.COOKIE_NAME,
      token,
      jwtUtils.cookieOptions
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user,
    });
  } catch (error) {
    return sendError(res, error, "Login error:");
  }
};

export const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

export const Logout = async (req, res) => {
  res.clearCookie(
    jwtUtils.COOKIE_NAME,
    jwtUtils.clearCookieOptions
  );

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};