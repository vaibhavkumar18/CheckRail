import { createHash } from "node:crypto";

export const calculateSHA256 = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("Expected a file Buffer");
  }

  return createHash("sha256")
    .update(buffer)
    .digest("hex");
};