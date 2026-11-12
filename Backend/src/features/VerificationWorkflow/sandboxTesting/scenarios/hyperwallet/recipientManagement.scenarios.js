export const HYPERWALLET_RECIPIENT_MANAGEMENT_SCENARIO = Object.freeze({
  id: "HYPERWALLET_RECIPIENT_MANAGEMENT_SANDBOX_V1",

  provider: "HYPERWALLET",

  capabilityCode: "RECIPIENT_MANAGEMENT",

  name: "Hyperwallet Sandbox Recipient Management",

  environment: "SANDBOX",

  steps: [
    {
      id: "CREATE_RECIPIENT",
      operation: "CREATE_RECIPIENT",
      dependsOn: [],
      writeOperation: true,
    },
    {
      id: "GET_RECIPIENT",
      operation: "GET_RECIPIENT",
      dependsOn: ["CREATE_RECIPIENT"],
      writeOperation: false,
    },
  ],
});

