import "./loadEnv.js";
const requiredEnvVars = [
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "NODE_ENV",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CREDENTIAL_ENCRYPTION_KEY",
  "AI_PROVIDER",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "AI_TIMEOUT_MS",
  "AI_ENABLED",
  "TAVILY_API_KEY",
];

if (!requiredEnvVars.every((env) => process.env[env])) {
  throw new Error(
    `Missing required environment variables: ${requiredEnvVars.filter((env) => !process.env[env]).join(", ")}`,
  );
}
const config = {
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
  AI_ENABLED: process.env.AI_ENABLED,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
};
export default config;
