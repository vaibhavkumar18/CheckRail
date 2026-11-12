
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
} from "../../../CapabilityVerification/providers/paypal/paypal.client.js";

export const PAYPAL_SANDBOX_OPERATIONS = {
  CREATE_ORDER: async ({ credentials, fixture, idempotencyKey }) => {
    const response = await createPayPalOrder({
      credentials,
      amount: fixture.amount,
      currency: fixture.currency,
      requestId: idempotencyKey,
    });

    const data = response.data || {};

    return {
      output: data,
      message: "PayPal Sandbox order was created successfully.",
      httpStatus: response.httpStatus,
      resourceId: data.id || null,
      method: "POST",
      endpoint: "/v2/checkout/orders",
      metadata: {
        requestId: response.requestId || null,
        intent: data.intent || null,
        status: data.status || null,
      },
      evidence: {
        operation: "CREATE_ORDER",
        method: "POST",
        endpoint: "/v2/checkout/orders",
        httpStatus: response.httpStatus ?? null,
        resourceId: data.id ?? null,
      },
    };
  },

  CAPTURE_ORDER: async ({ credentials, resource }) => {
    const orderId = resource?.id;

    if (!orderId) {
      const error = new Error(
        "CAPTURE_ORDER requires the order created by CREATE_ORDER.",
      );
      error.code = "PAYPAL_ORDER_PREREQUISITE_MISSING";
      throw error;
    }

    const response = await capturePayPalOrder({
      credentials,
      orderId,
    });

    const data = response.data || {};

    return {
      output: data,
      message: "PayPal Sandbox order capture request completed.",
      httpStatus: response.httpStatus,
      resourceId: data.id || orderId,
      method: "POST",
      endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      metadata: {
        requestId: response.requestId || null,
        status: data.status || null,
        orderId,
      },
      evidence: {
        operation: "CAPTURE_ORDER",
        method: "POST",
        endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        httpStatus: response.httpStatus ?? null,
        resourceId: data.id || orderId,
      },
    };
  },

  GET_ORDER: async ({ credentials, resource }) => {
    const orderId = resource?.id;

    if (!orderId) {
      const error = new Error(
        "GET_ORDER requires the order created by CREATE_ORDER.",
      );
      error.code = "PAYPAL_ORDER_PREREQUISITE_MISSING";
      throw error;
    }

    const response = await getPayPalOrder({
      credentials,
      orderId,
    });

    const data = response.data || {};

    return {
      output: data,
      message: "PayPal Sandbox order was retrieved successfully.",
      httpStatus: response.httpStatus,
      resourceId: data.id || orderId,
      method: "GET",
      endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      metadata: {
        requestId: response.requestId || null,
        status: data.status || null,
      },
      evidence: {
        operation: "GET_ORDER",
        method: "GET",
        endpoint: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
        httpStatus: response.httpStatus ?? null,
        resourceId: data.id ?? orderId,
      },
    };
  },
};
