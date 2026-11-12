import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./features/auth/auth.routes.js";
import organizationRoutes from "./features/organization/organization.routes.js";
import projectRoutes from "./features/projects/project.routes.js";
import integrationRoutes from "./features/Integration/Integration.routes.js";
import credentialsRoutes from "./features/Credentials/Credentials.routes.js";
import verificationRoutes from "./features/Verification/Verification.routes.js";
import capabilityVerificationRoutes from "./features/CapabilityVerification/CapabilityVerification.routes.js";
import countryIntelligenceRoutes from "./features/CountryIntelligence/CountryIntelligence.routes.js";
import AIAnalysisRoutes from "./features/AIGapAnalysis/AIGapAnalysis.routes.js";
import dashboardRoutes from "./features/Dashboard/dashboard.routes.js";

const app = express();

const allowedOrigin =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "CorridorGate API is running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/integration", integrationRoutes);
app.use("/api/credentials", credentialsRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/capability-verification", capabilityVerificationRoutes);
app.use("/api/country-intelligence", countryIntelligenceRoutes);
app.use("/api/ai-analysis", AIAnalysisRoutes);

export default app;