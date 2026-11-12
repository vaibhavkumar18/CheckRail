
import config from "../config/config.js";
import jwt from "jsonwebtoken";

export const COOKIE_NAME = "token";

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
  return jwt.verify(token, config.JWT_SECRET, {
    algorithms: ["HS256"],
  });
};

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export const clearCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};
