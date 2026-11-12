import path from "node:path";

export const validateArchivePath = (fileName) => {
  if (typeof fileName !== "string" || fileName.length === 0) {
    throw new Error("ZIP contains an empty or invalid entry path.");
  }

  if (fileName.includes("\0")) {
    throw new Error("ZIP contains a path with a null byte.");
  }

  // Reject Windows-style separators rather than silently normalizing them.
  if (fileName.includes("\\")) {
    throw new Error("ZIP contains an unsafe path separator.");
  }

  // Reject absolute paths and Windows drive paths.
  if (fileName.startsWith("/") || /^[a-zA-Z]:/.test(fileName)) {
    throw new Error("ZIP contains an absolute path.");
  }

  const isDirectory = fileName.endsWith("/");
  const pathToCheck = isDirectory
    ? fileName.slice(0, -1)
    : fileName;

  const segments = pathToCheck.split("/");

  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new Error("ZIP contains an unsafe or traversing path.");
  }

  const normalizedPath = path.posix.normalize(pathToCheck);

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    path.posix.isAbsolute(normalizedPath)
  ) {
    throw new Error("ZIP entry escapes the permitted directory.");
  }

  return {
    relativePath: normalizedPath,
    isDirectory,
  };
};