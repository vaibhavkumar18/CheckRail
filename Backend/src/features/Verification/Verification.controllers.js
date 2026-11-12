import * as VerificationService from "./Verification.services.js";
import { resumeCapabilityVerification as resumeCapabilityVerificationService } from "../CapabilityVerification/CapabilityVerification.services.js";
// --------------------------------------------------
// Run Verification
// POST /api/verification/integrations/:integrationId/:provider
// --------------------------------------------------
import { runUnifiedCredentialVerification } from "../CapabilityVerification/CapabilityVerification.services.js";
export const runVerification = async (req, res) => {
  try {
    const result = await VerificationService.runVerification({
      integrationId: req.params.integrationId,
      provider: req.params.provider,
      environment: req.body.environment,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Verification completed.",
      data: result,
    });
  } catch (error) {
    console.error("Provider verification failed:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to complete provider verification.",
      code: error.code || "INTERNAL_ERROR",
      providerStatus: error.providerStatus || null,
      debugId: error.debugId || null,
    });
  }
};

export const runCredentialVerification = async (req, res) => {
  try {
    const result = await runUnifiedCredentialVerification({
      credentialId: req.params.credentialId,
      userId: req.user.id,
      capabilityCode: req.body?.capabilityCode,
      sandboxInput: req.body?.sandboxInput || null,
    });

    return res.status(200).json({
      success: true,
      message: "Verification completed.",
      data: result,
    });
  } catch (error) {
    console.error("Credential verification failed:", {
      name: error.name,
      code: error.code,
      message: error.message,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to complete verification.",
      code: error.code || "INTERNAL_ERROR",
      debugId: error.debugId || null,
    });
  }
};

export const resumeCapabilityVerification = async (req, res) => {
  try {
    const result = await resumeCapabilityVerificationService({
      runId: req.params.runId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Capability verification resumed.",
      data: result,
    });
  } catch (error) {
    console.error("Capability verification resume failed:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to resume capability verification.",
      code: error.code || "INTERNAL_ERROR",
      debugId: error.debugId || null,
    });
  }
};
