import { validateHyperwalletCredentials } from "./hyperwallet.validation.js";

import { checkHyperwalletApiAccess } from "./hyperwallet.client.js";

import { normalizeVerificationResult } from "../../utils/normalizeVerificationResult.js";

export const verifyHyperwalletIntegration = async ({
  credentials,
  environment,
}) => {
  const checks = [];
  const evidence = [];

  const hyperwalletCredentials = {
    username: credentials?.username,
    password: credentials?.password,
    programToken: credentials?.programToken,
  };

  // ---------------------------------------------
  // 1. Credential Validation
  // ---------------------------------------------

  const validation = validateHyperwalletCredentials(hyperwalletCredentials);

  if (!validation.success) {
    checks.push({
      name: "CREDENTIAL_VALIDATION",
      status: "FAILED",
      message: "Hyperwallet credentials are incomplete or invalid.",
    });

    return normalizeVerificationResult({
      provider: "HYPERWALLET",
      environment,
      checks,
      evidence,
    });
  }

  checks.push({
    name: "CREDENTIAL_VALIDATION",
    status: "PASSED",
    message: "Required Hyperwallet credentials are present.",
  });

  // ---------------------------------------------
  // 2. API Authentication and Program Access
  // ---------------------------------------------

  try {
    const result = await checkHyperwalletApiAccess(hyperwalletCredentials);

    evidence.push({
      type: "API_REQUEST",
      operation: "LIST_USERS",
      method: "GET",
      endpoint: "/rest/v4/users",
      httpStatus: result.httpStatus,
      observedAt: new Date().toISOString(),
    });

    // -----------------------------------------
    // API Connectivity
    // -----------------------------------------

    checks.push({
      name: "API_CONNECTIVITY",
      status: "PASSED",
      message: "Hyperwallet API endpoint responded.",
      httpStatus: result.httpStatus,
    });

    // -----------------------------------------
    // Authentication
    // -----------------------------------------

    if (result.httpStatus === 401) {
      checks.push({
        name: "AUTHENTICATION",
        status: "FAILED",
        message: "Hyperwallet API authentication failed.",
        providerStatus: result.httpStatus,
      });

      checks.push({
        name: "PROGRAM_ACCESS",
        status: "NOT_RUN",
        message: "Program access could not be verified.",
      });
    } else if (result.httpStatus >= 500) {
      checks.push({
        name: "AUTHENTICATION",
        status: "NOT_RUN",
        message: "Authentication could not be conclusively evaluated.",
        providerStatus: result.httpStatus,
      });

      checks.push({
        name: "PROGRAM_ACCESS",
        status: "NOT_RUN",
        message: "Program access could not be verified.",
      });
    } else {
      checks.push({
        name: "AUTHENTICATION",
        status: "PASSED",
        message: "Hyperwallet accepted the API authentication.",
        providerStatus: result.httpStatus,
      });

      checks.push({
        name: "PROGRAM_ACCESS",
        status: result.successful ? "PASSED" : "FAILED",
        message: result.successful
          ? "Hyperwallet program API access is available."
          : "Hyperwallet program access could not be verified.",
        providerStatus: result.httpStatus,
        providerErrorCode: result.providerErrorCode,
      });
    }
  } catch (error) {
    checks.push({
      name: "AUTHENTICATION",
      status: "NOT_RUN",
      message:
        "Authentication could not be evaluated because the API request failed.",
    });

    checks.push({
      name: "API_CONNECTIVITY",
      status: "FAILED",
      message: error.message || "Hyperwallet API connection failed.",
      errorCode: error.code || null,
    });

    checks.push({
      name: "PROGRAM_ACCESS",
      status: "NOT_RUN",
      message: "Program access was not evaluated.",
    });
  }

  return normalizeVerificationResult({
    provider: "HYPERWALLET",
    environment,
    checks,
    evidence,
  });
};
