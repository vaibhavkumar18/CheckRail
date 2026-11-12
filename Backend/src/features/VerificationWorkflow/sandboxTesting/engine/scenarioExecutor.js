
import { PAYPAL_SANDBOX_TEST_POLICY } from "../policies/paypalTestPolicy.js";
import { HYPERWALLET_SANDBOX_TEST_POLICY } from "../policies/hyperwalletTestPolicy.js";

import { PAYPAL_SANDBOX_FIXTURE } from "../fixtures/paypal.fixtures.js";

import {
  createHyperwalletSandboxFixture,
} from "../fixtures/hyperwallet.fixtures.js";

import { PAYPAL_SANDBOX_OPERATIONS } from "./paypal.operations.js";
import { HYPERWALLET_SANDBOX_OPERATIONS } from "./hyperwallet.operations.js";

import { HYPERWALLET_RECIPIENT_MANAGEMENT_SCENARIO } from "../scenarios/hyperwallet/recipientManagement.scenarios.js";
import { HYPERWALLET_PAYMENT_DISBURSEMENT_SCENARIO } from "../scenarios/hyperwallet/paymentDisbursement.scenarios.js";

import {
  resolveScenarioDependencies,
  validateScenarioDefinition,
} from "./dependencyResolver.js";

import { normalizeScenarioResult } from "./resultNormalizer.js";

const PROVIDER_CONFIG = {
  PAYPAL: {
    policy: PAYPAL_SANDBOX_TEST_POLICY,
    operations: PAYPAL_SANDBOX_OPERATIONS,
    fixture: PAYPAL_SANDBOX_FIXTURE,
  },

  HYPERWALLET: {
    policy: HYPERWALLET_SANDBOX_TEST_POLICY,
    operations: HYPERWALLET_SANDBOX_OPERATIONS,
    scenarios: {
      RECIPIENT_MANAGEMENT: HYPERWALLET_RECIPIENT_MANAGEMENT_SCENARIO,
      PAYMENT_DISBURSEMENT: HYPERWALLET_PAYMENT_DISBURSEMENT_SCENARIO,
    },
  },
};

const getScenarioFixture = ({
  provider,
  capabilityCode,
  executionContext,
}) => {
  const config = PROVIDER_CONFIG[provider];

  if (!config) return null;

  if (provider === "PAYPAL" && capabilityCode === "PAYMENT_PROCESSING") {
    return config.fixture.paymentProcessing;
  }

  if (
    provider === "HYPERWALLET" &&
    capabilityCode === "RECIPIENT_MANAGEMENT"
  ) {
    const countryFixture = executionContext?.hyperwalletFixture;

    if (!countryFixture?.recipient) {
      throw new Error(
        "A country-matched Hyperwallet recipient fixture is required."
      );
    }

    return {
      recipient: countryFixture.recipient,
    };
  }

  if (
    provider === "HYPERWALLET" &&
    capabilityCode === "PAYMENT_DISBURSEMENT"
  ) {
    const countryFixture = executionContext?.hyperwalletFixture;

    if (!countryFixture?.payment) {
      throw new Error(
        "A Hyperwallet payment fixture is required."
      );
    }

    return {
      recipient: countryFixture.recipient,
      bankAccount: countryFixture.bankAccount,
      payment: countryFixture.payment,
    };
  }

  return null;
};

const validateProviderPolicy = ({ run, policy }) => {
  if (!policy || !policy.enabled) {
    throw new Error("Sandbox test policy is disabled for this provider.");
  }

  if (run.environment !== policy.allowedEnvironment) {
    throw new Error(
      "Provider environment is not permitted by the Sandbox policy."
    );
  }
};

const validatePayPalFixture = ({ policy, fixture }) => {
  if (!fixture?.amount || !fixture?.currency) {
    throw new Error("PayPal Sandbox amount and currency fixture are required.");
  }

  if (!policy.allowedCurrencies.includes(fixture.currency)) {
    throw new Error(`Currency ${fixture.currency} is not allowed.`);
  }

  const amount = Number(fixture.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > Number(policy.maximumTestAmount)
  ) {
    throw new Error("PayPal Sandbox test amount exceeds the policy limit.");
  }
};

const validateHyperwalletPaymentFixture = (fixture) => {
  const payment = fixture?.payment;

  if (!payment || typeof payment !== "object") {
    throw new Error("Hyperwallet payment disbursement fixture is missing.");
  }

  const amount = Number(payment.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Hyperwallet Sandbox payment amount must be greater than zero."
    );
  }

  // Currency is intentionally not fixture-hardcoded. CREATE_TRANSFER_METHOD
  // selects a currency from the live Hyperwallet configuration, and
  // CREATE_PAYMENT uses the retrieved transfer-method currency.

  if (typeof payment.purpose !== "string" || !payment.purpose.trim()) {
    throw new Error("Hyperwallet Sandbox payment purpose is required.");
  }
};

const getApprovalUrl = (output) => {
  const links = Array.isArray(output?.links) ? output.links : [];

  const approvalLink = links.find((link) =>
    ["approve", "payer-action"].includes(
      String(link.rel || "").toLowerCase()
    )
  );

  return approvalLink?.href || null;
};

const serializeCompletedSteps = (completedSteps) =>
  Object.fromEntries(
    [...completedSteps.entries()].map(([id, value]) => [
      id,
      {
        status: value.status,
        output: value.output || null,
      },
    ])
  );

const buildResult = ({
  run,
  scenario,
  checks,
  evidence,
  awaitingApproval = false,
  executionContext = null,
}) => ({
  ...normalizeScenarioResult({
    provider: run.provider,
    environment: run.environment,
    capabilityCode: scenario.capabilityCode,
    scenarioId: scenario.id,
    checks,
    evidence,
  }),
  awaitingApproval,
  executionContext,
});

const buildOperationResource = ({
  executionContext,
  completedSteps,
}) => {
  const previousOutputs = Object.fromEntries(
    [...completedSteps.entries()].map(([id, value]) => [
      id,
      value.output || null,
    ])
  );

  const resource = {
    ...(executionContext?.recipientToken
      ? { userToken: executionContext.recipientToken }
      : {}),

    ...(executionContext?.targetCountry
      ? { targetCountry: executionContext.targetCountry }
      : {}),

    ...(previousOutputs.CREATE_ORDER || {}),
    ...(previousOutputs.CREATE_RECIPIENT || {}),
    ...(previousOutputs.GET_TRANSFER_METHOD_CONFIGURATIONS || {}),
    ...(previousOutputs.CREATE_TRANSFER_METHOD || {}),
    ...(previousOutputs.GET_TRANSFER_METHOD || {}),
    ...(previousOutputs.CREATE_PAYMENT || {}),
  };

  return Object.keys(resource).length > 0 ? resource : null;
};

export const executeSandboxScenario = async ({
  run,
  credentials,
  scenario,
  executionContext = null,
  onOperationStart = async () => {},
  onOperationComplete = async () => {},
  onPause = async () => {},
}) => {
  if (!run?.id) {
    throw new Error("Workflow run ID is required.");
  }

  if (run.environment !== "SANDBOX") {
    throw new Error("Automatic scenarios only support Sandbox.");
  }

  if (!scenario) {
    throw new Error("Sandbox scenario definition is required.");
  }

  validateScenarioDefinition(scenario);

  const providerConfig = PROVIDER_CONFIG[run.provider];

  if (!providerConfig) {
    throw new Error(`Unsupported Sandbox provider: ${run.provider}`);
  }

  const { policy, operations } = providerConfig;

  validateProviderPolicy({ run, policy });

  if (providerConfig.scenarios) {
    const registeredScenario =
      providerConfig.scenarios[scenario.capabilityCode];

    if (!registeredScenario || registeredScenario.id !== scenario.id) {
      throw new Error(
        `Unsupported or unregistered scenario: ${run.provider}/${scenario.capabilityCode}.`
      );
    }
  }

  if (executionContext) {
    if (
      executionContext.runId !== run.id ||
      executionContext.provider !== run.provider ||
      executionContext.scenarioId !== scenario.id
    ) {
      throw new Error(
        "Execution context does not match this verification run."
      );
    }
  }

  // Target country is obtained from the authorized backend project context.
  // It is never accepted from frontend input or environment variables.
  if (run.provider === "HYPERWALLET") {
    const targetCountry = String(
      executionContext?.targetCountry || ""
    ).trim().toUpperCase();

    if (!targetCountry) {
      throw new Error(
        "Project target country is required for Hyperwallet verification."
      );
    }

    if (
      !executionContext?.hyperwalletFixture ||
      executionContext.hyperwalletFixture.recipient?.country !== targetCountry
    ) {
      throw new Error(
        "Hyperwallet fixture does not match the project's target country."
      );
    }
  }

  const fixture = getScenarioFixture({
    provider: run.provider,
    capabilityCode: scenario.capabilityCode,
    executionContext,
  });

  if (!fixture) {
    throw new Error(
      `No Sandbox fixture exists for ${run.provider}/${scenario.capabilityCode}.`
    );
  }

  if (run.provider === "PAYPAL") {
    validatePayPalFixture({ policy, fixture });
  }

  if (
    run.provider === "HYPERWALLET" &&
    scenario.capabilityCode === "PAYMENT_DISBURSEMENT"
  ) {
    validateHyperwalletPaymentFixture(fixture);

    if (!fixture?.recipient || fixture.recipient.country !== executionContext.targetCountry) {
      throw new Error(
        "A synthetic recipient fixture matching the project's target country is required."
      );
    }
  }

  const completedSteps = new Map(
    Object.entries(executionContext?.completedSteps || {})
  );

  const checks = [...(executionContext?.checks || [])];
  const evidence = [...(executionContext?.evidence || [])];

  for (const step of scenario.steps) {
    const existingStep = completedSteps.get(step.id);

    if (existingStep?.status === "PASSED") {
      continue;
    }

    const dependency = resolveScenarioDependencies({
      step,
      completedSteps,
    });

    if (!dependency.ready) {
      const check = {
        name: step.operation,
        status: "NOT_RUN",
        message: dependency.reason,
      };

      checks.push(check);

      await onOperationComplete({
        operation: step.operation,
        status: check.status,
        message: check.message,
      });

      completedSteps.set(step.id, { status: "NOT_RUN" });
      continue;
    }

    if (!policy.allowedOperations.includes(step.operation)) {
      const check = {
        name: step.operation,
        status: "UNSUPPORTED",
        message: "Operation is not allowed by the provider Sandbox policy.",
      };

      checks.push(check);

      await onOperationComplete({
        operation: step.operation,
        status: check.status,
        message: check.message,
      });

      completedSteps.set(step.id, { status: "NOT_RUN" });
      continue;
    }

    const operation = operations[step.operation];

    if (typeof operation !== "function") {
      const check = {
        name: step.operation,
        status: "UNSUPPORTED",
        message: "Provider operation is not implemented.",
      };

      checks.push(check);

      await onOperationComplete({
        operation: step.operation,
        status: check.status,
        message: check.message,
      });

      completedSteps.set(step.id, { status: "NOT_RUN" });
      continue;
    }

    const resolvedResource = buildOperationResource({
      executionContext,
      completedSteps,
    });

    await onOperationStart({
      operation: step.operation,
    });

    let result;

    try {
      result = await operation({
        credentials,
        fixture,
        resource: resolvedResource,
        idempotencyKey: run.id,
      });
    } catch (error) {
      const outcomeUnknown = error.outcomeUnknown === true;
      const unsupported = error.unsupported === true;

      const check = {
        name: step.operation,
        status: outcomeUnknown
          ? "UNKNOWN"
          : unsupported
            ? "UNSUPPORTED"
            : "FAILED",
        message: outcomeUnknown
          ? "Provider request outcome is unknown. Reconcile the provider resource before retrying."
          : error.message || "Provider operation failed.",
        providerStatus: error.providerStatus || null,
        providerErrorCode: error.providerErrorCode || null,
        errorCode: error.code || null,
        debugId: error.debugId || null,
      };

      checks.push(check);

      await onOperationComplete({
        operation: step.operation,
        status: check.status,
        message: check.message,
        providerStatus: check.providerStatus,
        errorCode: check.errorCode,
        errorMessage: check.message,
      });

      completedSteps.set(step.id, {
        status: outcomeUnknown ? "UNKNOWN" : "FAILED",
      });

      if (outcomeUnknown) {
        break;
      }

      continue;
    }

    let approvalUrl = null;

    if (step.pauseAfterSuccess === true) {
      approvalUrl = getApprovalUrl(result.output);

      if (!result.resourceId || !approvalUrl) {
        const error = new Error(
          "PayPal order was created, but its order ID or buyer approval URL is missing. Reconcile the order before retrying."
        );

        error.code = "PAYPAL_APPROVAL_LINK_MISSING";
        error.outcomeUnknown = true;

        const check = {
          name: step.operation,
          status: "UNKNOWN",
          message: error.message,
          providerStatus: result.httpStatus || null,
          errorCode: error.code,
        };

        checks.push(check);

        await onOperationComplete({
          operation: step.operation,
          status: check.status,
          message: check.message,
          providerStatus: check.providerStatus,
          errorCode: check.errorCode,
          errorMessage: check.message,
          resourceId: result.resourceId || null,
        });

        completedSteps.set(step.id, {
          status: "UNKNOWN",
          output: result.output || null,
        });

        break;
      }
    }

    // GET_PAYMENT is successful as an API request even when the payment
    // itself is still pending. Preserve the provider's business status rather
    // than treating HTTP 200 as proof of a completed payout.
    if (result.verificationStatus) {
      const providerVerificationStatus = String(
        result.verificationStatus,
      ).toUpperCase();

      const operationStatus = {
        COMPLETED: "PASSED",
        FAILED: "FAILED",
        PENDING: "PENDING",
        UNKNOWN: "UNKNOWN",
      }[providerVerificationStatus] || "UNKNOWN";

      const paymentCheck = {
        name: step.operation,
        status: operationStatus,
        message: result.message,
        providerStatus: result.httpStatus,
        resourceId: result.resourceId,
      };

      const operationEvidence = result.evidence ? [result.evidence] : [];

      await onOperationComplete({
        operation: step.operation,
        status: operationStatus,
        message: result.message,
        providerStatus: result.httpStatus,
        resourceId: result.resourceId,
        evidence: operationEvidence,
      });

      checks.push(paymentCheck);

      evidence.push(
        ...operationEvidence.map((item) => ({
          ...item,
          type: item.type || "API_REQUEST",
          operation: item.operation || step.operation,
          method: item.method || result.method,
          endpoint: item.endpoint || result.endpoint,
          httpStatus: item.httpStatus ?? result.httpStatus,
          resourceId: item.resourceId || result.resourceId,
          observedAt: item.observedAt || new Date().toISOString(),
        })),
      );

      completedSteps.set(step.id, {
        status: operationStatus,
        output: result.output || null,
      });

      if (operationStatus !== "PASSED") {
        break;
      }

      continue;
    }

    const check = {
      name: step.operation,
      status: "PASSED",
      message: result.message,
      providerStatus: result.httpStatus,
      resourceId: result.resourceId,
    };

    const operationEvidence = result.evidence ? [result.evidence] : [];

    await onOperationComplete({
      operation: step.operation,
      status: "PASSED",
      message: result.message,
      providerStatus: result.httpStatus,
      resourceId: result.resourceId,
      output: result.output || null,
      evidence: operationEvidence,
    });

    checks.push(check);

    evidence.push(
      ...operationEvidence.map((item) => ({
        ...item,
        type: item.type || "API_REQUEST",
        operation: item.operation || step.operation,
        method: item.method || result.method,
        endpoint: item.endpoint || result.endpoint,
        httpStatus: item.httpStatus ?? result.httpStatus,
        resourceId: item.resourceId || result.resourceId,
        observedAt: item.observedAt || new Date().toISOString(),
      }))
    );

    completedSteps.set(step.id, {
      status: "PASSED",
      output: result.output || null,
    });

    if (step.pauseAfterSuccess === true) {
      const nextStep = scenario.steps.find(
        (candidate) => !completedSteps.has(candidate.id)
      );

      const nextContext = {
        ...executionContext,
        runId: run.id,
        provider: run.provider,
        scenarioId: scenario.id,
        capabilityCode: scenario.capabilityCode,
        completedSteps: serializeCompletedSteps(completedSteps),
        checks,
        evidence,
        awaitingOperation: nextStep?.operation || null,
        orderId: result.resourceId,
        approvalUrl,
        pausedAt: new Date().toISOString(),
      };

      await onPause({
        operation: step.operation,
        resourceId: result.resourceId,
        approvalUrl,
        executionContext: nextContext,
      });

      return buildResult({
        run,
        scenario,
        checks,
        evidence,
        awaitingApproval: true,
        executionContext: nextContext,
      });
    }
  }

  return buildResult({
    run,
    scenario,
    checks,
    evidence,
  });
};
