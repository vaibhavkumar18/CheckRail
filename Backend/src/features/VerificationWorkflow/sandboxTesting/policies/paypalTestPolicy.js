import { SANDBOX_TEST_POLICY } from "./sandboxTestPolicy.js";

export const PAYPAL_SANDBOX_TEST_POLICY = Object.freeze({
  ...SANDBOX_TEST_POLICY,

  provider: "PAYPAL",

  enabled: true,

  allowedOperations: ["CREATE_ORDER", "CAPTURE_ORDER", "GET_ORDER"],

  maximumTestAmount: "5.00",

  allowedCurrencies: ["USD"],
});
