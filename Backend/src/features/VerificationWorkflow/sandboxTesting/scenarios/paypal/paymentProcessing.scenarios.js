export const PAYPAL_PAYMENT_PROCESSING_SCENARIO = Object.freeze({
  id: "PAYPAL_PAYMENT_PROCESSING_SANDBOX_V1",
  provider: "PAYPAL",
  capabilityCode: "PAYMENT_PROCESSING",
  name: "PayPal Sandbox Payment Processing",
  environment: "SANDBOX",

  steps: [
    {
      id: "CREATE_ORDER",
      operation: "CREATE_ORDER",
      dependsOn: [],
      writeOperation: true,
      pauseAfterSuccess: true,
    },
    {
      id: "CAPTURE_ORDER",
      operation: "CAPTURE_ORDER",
      dependsOn: ["CREATE_ORDER"],
      writeOperation: true,
    },
    {
      id: "GET_ORDER",
      operation: "GET_ORDER",
      dependsOn: ["CAPTURE_ORDER"],
      writeOperation: false,
    },
  ],
});
