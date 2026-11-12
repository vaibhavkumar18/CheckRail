export const HYPERWALLET_PAYMENT_DISBURSEMENT_SCENARIO =
  Object.freeze({
    id: "HYPERWALLET_PAYMENT_DISBURSEMENT_SANDBOX_V3",

    provider: "HYPERWALLET",

    capabilityCode: "PAYMENT_DISBURSEMENT",

    name: "Hyperwallet Country-Matched Sandbox Recipient, Bank Transfer and Payment Verification",

    environment: "SANDBOX",

    steps: [
      {
        id: "CREATE_RECIPIENT",
        operation: "CREATE_RECIPIENT",
        dependsOn: [],
        writeOperation: true,
      },

      {
        id: "GET_TRANSFER_METHOD_CONFIGURATIONS",
        operation: "GET_TRANSFER_METHOD_CONFIGURATIONS",
        dependsOn: ["CREATE_RECIPIENT"],
        writeOperation: false,
      },

      {
        id: "CREATE_TRANSFER_METHOD",
        operation: "CREATE_TRANSFER_METHOD",
        dependsOn: ["GET_TRANSFER_METHOD_CONFIGURATIONS"],
        writeOperation: true,
      },

      {
        id: "GET_TRANSFER_METHOD",
        operation: "GET_TRANSFER_METHOD",
        dependsOn: ["CREATE_TRANSFER_METHOD"],
        writeOperation: false,
      },

      {
        id: "CREATE_PAYMENT",
        operation: "CREATE_PAYMENT",
        dependsOn: ["GET_TRANSFER_METHOD"],
        writeOperation: true,
      },

      {
        id: "GET_PAYMENT",
        operation: "GET_PAYMENT",
        dependsOn: ["CREATE_PAYMENT"],
        writeOperation: false,
      },
    ],
  });
