export const HYPERWALLET_CAPABILITIES = {
    RECIPIENT_MANAGEMENT: {
        code: "RECIPIENT_MANAGEMENT",
        name: "Recipient Management",
        description: "Create and retrieve payout recipients.",
        operations: [
            "CREATE_RECIPIENT",
            "GET_RECIPIENT",
        ],
        implementationStatus: "PARTIALLY_IMPLEMENTED",
    },

    PAYOUT_METHODS: {
        code: "PAYOUT_METHODS",
        name: "Payout Method Management",
        description: "Retrieve available payout methods for recipients.",
        operations: [
            "LIST_PAYMENT_METHODS",
        ],
        implementationStatus: "NOT_IMPLEMENTED",
    },

    TRANSFER_PROCESSING: {
        code: "TRANSFER_PROCESSING",
        name: "Transfer Processing",
        description: "Create and retrieve transfers to recipients.",
        operations: [
            "CREATE_TRANSFER",
            "GET_TRANSFER",
        ],
        implementationStatus: "NOT_IMPLEMENTED",
    },

    TRANSFER_NOTIFICATIONS: {
        code: "TRANSFER_NOTIFICATIONS",
        name: "Transfer Notifications",
        description: "Evaluate access to applicable transfer notification capabilities.",
        operations: [
            "LIST_NOTIFICATIONS",
        ],
        implementationStatus: "NOT_IMPLEMENTED",
    },
};