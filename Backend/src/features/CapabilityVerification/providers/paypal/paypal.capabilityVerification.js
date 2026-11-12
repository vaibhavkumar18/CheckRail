
import {
    createPayPalOrder,
    getPayPalOrder,
    capturePayPalOrder,
} from "./paypal.client.js";

import {
    normalizeCapabilityResult,
} from "../../utils/normalizeCapabilityResult.js";

const getFailureStatus = (error) =>
    error.outcomeUnknown ? "UNKNOWN" : "FAILED";

export const verifyPayPalCapability = async ({
    credentials,
    environment,
    capabilityCode,
    options = {},
}) => {
    if (capabilityCode !== "PAYMENT_PROCESSING") {
        throw new Error(
            `PayPal capability '${capabilityCode}' is not implemented.`
        );
    }

    const checks = [];
    const evidence = [];

    if (options.action === "CREATE_ORDER") {
        if (!options.amount || !options.currency) {
            throw new Error(
                "Amount and currency are required."
            );
        }

        try {
            const result = await createPayPalOrder({
                credentials,
                amount: options.amount,
                currency: options.currency,
                requestId: options.requestId,
            });

            const order = result.data;

            const approvalLink = order.links?.find(
                (link) =>
                    link.rel === "approve" ||
                    link.rel === "payer-action"
            );

            checks.push({
                name: "CREATE_ORDER",
                status: order.id ? "PASSED" : "FAILED",
                message: order.id
                    ? "PayPal Sandbox order created."
                    : "PayPal did not return an order ID.",
                orderId: order.id || null,
                resourceId: order.id || null,
                approvalUrl: approvalLink?.href || null,
                providerStatus: result.httpStatus,
            });

            evidence.push({
                type: "API_REQUEST",
                operation: "CREATE_ORDER",
                method: "POST",
                endpoint: "/v2/checkout/orders",
                httpStatus: result.httpStatus,
                resourceId: order.id || null,
                observedAt: new Date().toISOString(),
            });

            checks.push({
                name: "CAPTURE_ORDER",
                status: "NOT_RUN",
                message: "Buyer approval is required before capture.",
            });
        } catch (error) {
            checks.push({
                name: "CREATE_ORDER",
                status: getFailureStatus(error),
                message: error.message,
                providerStatus: error.providerStatus || null,
                providerErrorCode: error.providerErrorCode || null,
                debugId: error.debugId || null,
            });

            checks.push({
                name: "CAPTURE_ORDER",
                status: "NOT_RUN",
                message: "Order creation was not confirmed.",
            });
        }
    } else if (options.action === "CAPTURE_ORDER") {
        if (!options.orderId) {
            throw new Error("PayPal order ID is required.");
        }

        const orderId = options.orderId;

        try {
            const orderResult = await getPayPalOrder({
                credentials,
                orderId,
            });

            const order = orderResult.data;

            evidence.push({
                type: "API_REQUEST",
                operation: "GET_ORDER",
                method: "GET",
                endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
                httpStatus: orderResult.httpStatus,
                resourceId: orderId,
                observedAt: new Date().toISOString(),
            });

            checks.push({
                name: "GET_ORDER",
                status: "PASSED",
                message: `Order retrieved. Current status: ${order.status}.`,
                providerStatus: orderResult.httpStatus,
                resourceId: orderId,
            });

            if (order.status !== "APPROVED") {
                checks.push({
                    name: "CAPTURE_ORDER",
                    status: "NOT_RUN",
                    message: `Buyer approval required. Current status: ${order.status}.`,
                    resourceId: orderId,
                });
            } else {
                try {
                    const captureResult = await capturePayPalOrder({
                        credentials,
                        orderId,
                    });

                    const capture = captureResult.data;

                    checks.push({
                        name: "CAPTURE_ORDER",
                        status: capture.status === "COMPLETED"
                            ? "PASSED"
                            : "FAILED",
                        message: `Capture status: ${capture.status || "UNKNOWN"}.`,
                        providerStatus: captureResult.httpStatus,
                        resourceId: orderId,
                    });

                    evidence.push({
                        type: "API_REQUEST",
                        operation: "CAPTURE_ORDER",
                        method: "POST",
                        endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
                        httpStatus: captureResult.httpStatus,
                        resourceId: orderId,
                        observedAt: new Date().toISOString(),
                    });
                } catch (error) {
                    checks.push({
                        name: "CAPTURE_ORDER",
                        status: getFailureStatus(error),
                        message: error.message,
                        providerStatus: error.providerStatus || null,
                        providerErrorCode: error.providerErrorCode || null,
                        resourceId: orderId,
                    });
                }
            }
        } catch (error) {
            checks.push({
                name: "GET_ORDER",
                status: getFailureStatus(error),
                message: error.message,
                providerStatus: error.providerStatus || null,
                resourceId: orderId,
            });

            checks.push({
                name: "CAPTURE_ORDER",
                status: "NOT_RUN",
                message: "Order retrieval failed.",
                resourceId: orderId,
            });
        }
    } else {
        throw new Error("Unsupported PayPal payment action.");
    }

    return normalizeCapabilityResult({
        provider: "PAYPAL",
        environment,
        capabilityCode,
        checks,
        evidence,
    });
};
