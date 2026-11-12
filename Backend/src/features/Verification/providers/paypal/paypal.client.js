import { VerificationError } from "../../utils/verificationErrors.js";

const PAYPAL_SANDBOX_BASE_URL =
    "https://api-m.sandbox.paypal.com";

const REQUEST_TIMEOUT = 15000;

// --------------------------------------------------
// Parse Provider Response
// --------------------------------------------------

const parseResponse = async (response) => {
    const text = await response.text();

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
};

// --------------------------------------------------
// Obtain OAuth Access Token
// --------------------------------------------------

export const getPayPalAccessToken = async ({
    clientId,
    clientSecret,
}) => {
    const basicAuth = Buffer.from(
        `${clientId}:${clientSecret}`
    ).toString("base64");

    let response;

    try {
        response = await fetch(
            `${PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`,
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
                body: new URLSearchParams({
                    grant_type: "client_credentials",
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT),
            }
        );
    } catch {
        throw new VerificationError(
            "Unable to reach PayPal Sandbox authentication service.",
            {
                statusCode: 502,
                code: "PAYPAL_AUTH_NETWORK_ERROR",
            }
        );
    }

    const data = await parseResponse(response);

    if (!response.ok || !data.access_token) {
        throw new VerificationError(
            "PayPal authentication failed.",
            {
                statusCode: 502,
                code: "PAYPAL_AUTH_FAILED",
                providerStatus: response.status,
                debugId: data.debug_id || null,
            }
        );
    }

    // Never log or return this token through the API.
    return data.access_token;
};

// --------------------------------------------------
// Check Webhook Management API Access
// --------------------------------------------------

export const checkPayPalWebhookAccess = async (accessToken) => {
    let response;

    try {
        response = await fetch(
            `${PAYPAL_SANDBOX_BASE_URL}/v1/notifications/webhooks`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT),
            }
        );
    } catch {
        throw new VerificationError(
            "Unable to reach PayPal Webhooks API.",
            {
                statusCode: 502,
                code: "PAYPAL_API_NETWORK_ERROR",
            }
        );
    }

    const data = await parseResponse(response);

    return {
        httpStatus: response.status,
        accessible: response.ok,
        debugId: data.debug_id || null,
        errorCode: data.name || null,
    };
};