
export const PAYPAL_CAPABILITIES = {
    PAYMENT_PROCESSING: {
        code: "PAYMENT_PROCESSING",
        name: "Payment Processing",
        description:
            "Create and capture customer payments using PayPal.",
        operations: [
            "CREATE_ORDER",
            "CAPTURE_ORDER",
        ],
    },

    REFUND_PROCESSING: {
        code: "REFUND_PROCESSING",
        name: "Refund Processing",
        description:
            "Refund previously captured PayPal payments.",
        operations: [
            "CREATE_REFUND",
            "GET_REFUND",
        ],
    },

    PAYOUT_PROCESSING: {
        code: "PAYOUT_PROCESSING",
        name: "Payout Processing",
        description:
            "Create and track payouts to recipients.",
        operations: [
            "CREATE_PAYOUT",
            "GET_PAYOUT",
        ],
    },

    WEBHOOK_MANAGEMENT: {
        code: "WEBHOOK_MANAGEMENT",
        name: "Webhook Management",
        description:
            "Configure and manage PayPal webhook subscriptions.",
        operations: [
            "LIST_WEBHOOKS",
            "CREATE_WEBHOOK",
        ],
    },
};
