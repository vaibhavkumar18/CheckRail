import config from "../config/config.js";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "corridorGate_token";

const isProduction = config.NODE_ENV === "production";

export const generateToken = (id, role) => {
  if (!id || !role) {
    throw new Error("User ID and role are required.");
  }

  return jwt.sign(
    {
      id: String(id),
      role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256",
    }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(
    token,
    config.JWT_SECRET,
    {
      algorithms: ["HS256"],
    }
  );
};

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};