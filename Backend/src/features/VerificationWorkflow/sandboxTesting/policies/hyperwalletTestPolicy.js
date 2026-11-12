import { SANDBOX_TEST_POLICY } from "./sandboxTestPolicy.js";

export const HYPERWALLET_SANDBOX_TEST_POLICY =
  Object.freeze({
    ...SANDBOX_TEST_POLICY,

    provider: "HYPERWALLET",

    enabled: true,

    allowedOperations: [
      "CREATE_RECIPIENT",
      "GET_RECIPIENT",

      "GET_TRANSFER_METHOD_CONFIGURATIONS",
      "CREATE_TRANSFER_METHOD",
      "GET_TRANSFER_METHOD",

      "CREATE_PAYMENT",
      "GET_PAYMENT",
    ],

    manualOnlyOperations: [],

    blockedOperations: [
      "CREATE_TRANSFER",
      "CREATE_PAYOUT",
    ],
  });