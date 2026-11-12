import { validatePayPalCredentials } from "./paypal.validation.js";

import {
  getPayPalAccessToken,
  checkPayPalWebhookAccess,
} from "./paypal.client.js";

import { normalizeVerificationResult } from "../../utils/normalizeVerificationResult.js";

// --------------------------------------------------
// PayPal Verification
// --------------------------------------------------

export const verifyPayPalIntegration = async ({ credentials, environment }) => {
  const checks = [];
  const evidence = [];

  // ----------------------------------------------
  // 1. Credential Validation
  // ----------------------------------------------
  console.log("PayPal credential structure:", {
    fields: Object.keys(credentials || {}),
    clientIdPresent: typeof credentials?.clientId === "string",
    clientSecretPresent: typeof credentials?.clientSecret === "string",
    webhookIdPresent: typeof credentials?.webhookId === "string",
});
  const paypalCredentials = {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    webhookId: credentials.webhookId,
  };

  const validation = validatePayPalCredentials(paypalCredentials);

  checks.push({
    name: "CREDENTIAL_VALIDATION",
    status: validation.success ? "PASSED" : "FAILED",
    message: validation.success
      ? "Required PayPal credentials are present."
      : "PayPal credentials are incomplete or invalid.",
  });

  if (!validation.success) {
    return normalizeVerificationResult({
      provider: "PAYPAL",
      environment,
      checks,
      evidence,
    });
  }

  // ----------------------------------------------
  // 2. OAuth Authentication
  // ----------------------------------------------

  let accessToken;

  try {
    accessToken = await getPayPalAccessToken({
      clientId: validation.data.clientId,
      clientSecret: validation.data.clientSecret,
    });

    checks.push({
      name: "AUTHENTICATION",
      status: "PASSED",
      message: "PayPal OAuth authentication succeeded.",
    });

    evidence.push({
      type: "API_REQUEST",
      operation: "OAUTH_TOKEN",
      method: "POST",
      endpoint: "/v1/oauth2/token",
      observedAt: new Date().toISOString(),
    });
  } catch (error) {
    checks.push({
      name: "AUTHENTICATION",
      status: "FAILED",
      message: error.message,
      providerStatus: error.providerStatus,
      debugId: error.debugId,
    });

    checks.push({
      name: "API_CONNECTIVITY",
      status: "NOT_RUN",
      message: "API resource check was not attempted.",
    });

    checks.push({
      name: "WEBHOOK_MANAGEMENT_ACCESS",
      status: "NOT_RUN",
      message: "Webhook access check was not attempted.",
    });

    return normalizeVerificationResult({
      provider: "PAYPAL",
      environment,
      checks,
      evidence,
    });
  }

  // ----------------------------------------------
  // 3. Webhook API Connectivity and Access
  // ----------------------------------------------

  try {
    const result = await checkPayPalWebhookAccess(accessToken);

    evidence.push({
      type: "API_REQUEST",
      operation: "LIST_WEBHOOKS",
      method: "GET",
      endpoint: "/v1/notifications/webhooks",
      httpStatus: result.httpStatus,
      observedAt: new Date().toISOString(),
    });

    // An HTTP response proves that the API endpoint
    // was reachable, even if access was denied.
    checks.push({
      name: "API_CONNECTIVITY",
      status: "PASSED",
      message: "PayPal API endpoint responded.",
      httpStatus: result.httpStatus,
    });

    checks.push({
      name: "WEBHOOK_MANAGEMENT_ACCESS",
      status: result.accessible ? "PASSED" : "FAILED",
      message: result.accessible
        ? "Webhook management API is accessible."
        : "Webhook management API access was denied or unsuccessful.",
      httpStatus: result.httpStatus,
      debugId: result.debugId,
      providerErrorCode: result.errorCode,
    });
  } catch (error) {
    checks.push({
      name: "API_CONNECTIVITY",
      status: "FAILED",
      message: error.message,
    });

    checks.push({
      name: "WEBHOOK_MANAGEMENT_ACCESS",
      status: "NOT_RUN",
      message: "Webhook access could not be checked.",
    });
  }

  return normalizeVerificationResult({
    provider: "PAYPAL",
    environment,
    checks,
    evidence,
  });
};
