
import { PAYPAL_PAYMENT_PROCESSING_SCENARIO } from "../scenarios/paypal/paymentProcessing.scenarios.js";

import { HYPERWALLET_RECIPIENT_MANAGEMENT_SCENARIO } from "../scenarios/hyperwallet/recipientManagement.scenarios.js";

import { HYPERWALLET_PAYMENT_DISBURSEMENT_SCENARIO } from "../scenarios/hyperwallet/paymentDisbursement.scenarios.js";

import { PAYPAL_SANDBOX_TEST_POLICY } from "../policies/paypalTestPolicy.js";
import { HYPERWALLET_SANDBOX_TEST_POLICY } from "../policies/hyperwalletTestPolicy.js";

const PROVIDER_SUITES = {
  PAYPAL: {
    policy: PAYPAL_SANDBOX_TEST_POLICY,
    scenarios: {
      PAYMENT_PROCESSING: PAYPAL_PAYMENT_PROCESSING_SCENARIO,
    },
  },

  HYPERWALLET: {
    policy: HYPERWALLET_SANDBOX_TEST_POLICY,
    scenarios: {
      RECIPIENT_MANAGEMENT:
        HYPERWALLET_RECIPIENT_MANAGEMENT_SCENARIO,

      PAYMENT_DISBURSEMENT:
        HYPERWALLET_PAYMENT_DISBURSEMENT_SCENARIO,
    },
  },
};

export const getProviderScenarioSuite = ({
  provider,
  capabilityCode,
}) => {
  const suite = PROVIDER_SUITES[provider];

  if (!suite || !suite.policy?.enabled) {
    return null;
  }

  const scenario = suite.scenarios[capabilityCode];

  if (!scenario) {
    return null;
  }

  return {
    policy: suite.policy,
    scenario,
  };
};

export const getProviderScenarioCodes = (provider) => {
  const suite = PROVIDER_SUITES[provider];

  return suite ? Object.keys(suite.scenarios) : [];
};
