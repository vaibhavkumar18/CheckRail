import { randomUUID } from "node:crypto";

import {
    getPayPalAccessToken,
} from "../../../Verification/providers/paypal/paypal.client.js";

const BASE_URL = "https://api-m.sandbox.paypal.com";

const parseResponse = async (response) => {
    const text = await response.text();

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
};

const paypalRequest = async ({
    credentials,
    method,
    path,
    body,
    requestId = randomUUID(),
}) => {
    const accessToken = await getPayPalAccessToken({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
    });

    let response;

    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method,

            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json",
                "PayPal-Request-Id": requestId,
            },

            body: body ? JSON.stringify(body) : undefined,

            signal: AbortSignal.timeout(15000),
        });
    } catch (error) {
        const networkError = new Error(
            "PayPal request outcome is unknown. Do not blindly retry.",
        );

        networkError.code =
            error.name === "TimeoutError" ||
            error.name === "AbortError"
                ? "PAYPAL_REQUEST_TIMEOUT"
                : "PAYPAL_NETWORK_ERROR";

        networkError.outcomeUnknown = true;

        throw networkError;
    }

    const data = await parseResponse(response);

    if (!response.ok) {
        const error = new Error(
            data.message || "PayPal API operation failed.",
        );

        error.providerStatus = response.status;
        error.providerErrorCode = data.name || null;
        error.debugId = data.debug_id || null;

        throw error;
    }

    return {
        httpStatus: response.status,
        requestId,
        data,
    };
};

export const createPayPalOrder = async ({
    credentials,
    amount,
    currency,
    requestId,
}) => {
    return paypalRequest({
        credentials,
        method: "POST",
        path: "/v2/checkout/orders",
        requestId,

        body: {
            intent: "CAPTURE",

            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amount,
                    },
                },
            ],
        },
    });
};

export const getPayPalOrder = async ({
    credentials,
    orderId,
}) => {
    return paypalRequest({
        credentials,
        method: "GET",
        path: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    });
};

export const capturePayPalOrder = async ({
    credentials,
    orderId,
}) => {
    return paypalRequest({
        credentials,
        method: "POST",
        path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        body: {},
    });
};