import User from "../users/user.model.js";
import * as passwordUtils from "../../utils/passwordHash.js";

export const signUp = async (name, email, password) => {
  const existingUser = await User.findByEmail(email);

  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await passwordUtils.hashPassword(password);

  const newUser = await User.create({
    name,
    email,
    passwordHash,
    role: "ADMIN",
  });

  return newUser;
};

export const login = async (email, password) => {
  const user = await User.findByEmail(email);

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const isMatchPassword = await passwordUtils.comparePassword(
    password,
    user.password_hash
  );

  if (!isMatchPassword) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  if (!user.is_active) {
    const error = new Error("Your account has been deactivated.");
    error.statusCode = 403;
    throw error;
  }

  const {
    password_hash,
    ...safeUser
  } = user;

  return safeUser;
};