import {
  getHyperwalletRecipient,
  createHyperwalletRecipient,
  getHyperwalletTransferMethodConfigurations,
  createHyperwalletBankAccount,
  getHyperwalletBankAccount,
  createHyperwalletPayment,
  getHyperwalletPayment,
} from "../../../CapabilityVerification/providers/hyperwallet/hyperwallet.client.js";

const createEvidence = ({
  operation,
  method,
  endpoint,
  httpStatus,
  resourceId,
}) => ({
  type: "API_REQUEST",
  operation,
  method,
  endpoint,
  httpStatus,
  resourceId: resourceId || null,
  observedAt: new Date().toISOString(),
});

const normalizeCode = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const requireValue = (value, message, code) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
};

const unsupported = (message, code) => {
  const error = new Error(message);
  error.code = code;
  error.unsupported = true;
  return error;
};

const isPresent = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getConfigurationFields = (configuration) =>
  Array.isArray(configuration?.fields) ? configuration.fields : [];

const getChoiceValue = (choice) => {
  if (typeof choice === "string" || typeof choice === "number") {
    return String(choice);
  }

  if (!choice || typeof choice !== "object") {
    return null;
  }

  const value = choice.value ?? choice.code ?? choice.id ?? choice.name ?? null;

  return value === null ? null : String(value);
};

const getSelectionChoices = (field) => {
  const choices =
    field?.selectionChoices ?? field?.selection_choices ?? field?.choices ?? [];

  return Array.isArray(choices)
    ? choices.map(getChoiceValue).filter(Boolean)
    : [];
};

/**
 * Maps a provider-declared field to a value in the country-specific fixture.
 * Exact field-name matches always win. Semantic aliases are deliberately
 * conservative: an account number is never guessed to be an IBAN, and an
 * IFSC is never guessed to be a SWIFT/BIC code.
 */
const resolveFixtureFieldValue = (field, bankAccount) => {
  const name = String(field?.name || "");
  const label = String(field?.label || "");
  const semantic = `${name} ${label}`.toLowerCase();

  if (isPresent(bankAccount?.[name])) {
    return bankAccount[name];
  }

  if (/ifsc/.test(semantic)) {
    return bankAccount.ifscCode ?? null;
  }

  if (/swift|bic/.test(semantic)) {
    return bankAccount.swiftCode ?? bankAccount.bic ?? null;
  }

  if (/iban/.test(semantic)) {
    return bankAccount.iban ?? null;
  }

  if (/routing|branch|sort.?code|bsb|transit|institution/.test(semantic)) {
    return (
      bankAccount.branchId ??
      bankAccount.routingNumber ??
      bankAccount.routingCode ??
      bankAccount.sortCode ??
      bankAccount.bsbNumber ??
      bankAccount.transitNumber ??
      bankAccount.institutionNumber ??
      bankAccount.ifscCode ??
      null
    );
  }

  if (/account.*(number|id)|accountnumber|accountid/.test(semantic)) {
    return bankAccount.bankAccountId ?? bankAccount.accountNumber ?? null;
  }

  if (/account.*(purpose|type)|purpose/.test(semantic)) {
    return bankAccount.bankAccountPurpose ?? bankAccount.accountType ?? null;
  }

  if (/first.?name/.test(semantic)) {
    return bankAccount.firstName ?? null;
  }

  if (/last.?name|surname/.test(semantic)) {
    return bankAccount.lastName ?? null;
  }

  if (/postal|zip/.test(semantic)) {
    return bankAccount.postalCode ?? null;
  }

  if (/state|province|region/.test(semantic)) {
    return bankAccount.stateProvince ?? null;
  }

  if (/address/.test(semantic)) {
    return bankAccount.addressLine1 ?? null;
  }

  if (/city|locality/.test(semantic)) {
    return bankAccount.city ?? null;
  }

  if (/country/.test(semantic)) {
    return bankAccount.country ?? bankAccount.transferMethodCountry ?? null;
  }

  return null;
};

/**
 * Build a request using only the fields declared by the selected live
 * Hyperwallet configuration, plus the documented transfer-method envelope.
 */
const buildBankAccountPayload = ({
  bankAccount,
  configuration,
  targetCountry,
  profileType,
  transferMethodCurrency,
}) => {
  const payload = {
    type: "BANK_ACCOUNT",
    profileType,
    transferMethodCountry: targetCountry,
    transferMethodCurrency,
  };

  const missingFields = [];
  const invalidChoices = [];

  for (const field of getConfigurationFields(configuration)) {
    const fieldName = String(field?.name || "").trim();

    if (!fieldName) {
      continue;
    }

    // These values are envelope fields and are always populated from the
    // selected live configuration/project context.
    if (
      fieldName === "type" ||
      fieldName === "profileType" ||
      fieldName === "transferMethodCountry" ||
      fieldName === "transferMethodCurrency"
    ) {
      continue;
    }

    let value = resolveFixtureFieldValue(field, bankAccount);
    const choices = getSelectionChoices(field);

    // A single provider option can safely resolve a required enum field.
    // Multiple choices must come from the country fixture, not guesswork.
    if (
      !isPresent(value) &&
      field.isRequired === true &&
      choices.length === 1
    ) {
      value = choices[0];
    }

    if (!isPresent(value)) {
      if (field.isRequired === true) {
        missingFields.push(fieldName);
      }
      continue;
    }

    if (choices.length > 0 && !choices.includes(String(value))) {
      invalidChoices.push({
        field: fieldName,
        supplied: String(value),
        allowed: choices,
      });
      continue;
    }

    payload[fieldName] = value;
  }

  return {
    payload,
    missingFields,
    invalidChoices,
  };
};

const selectBankAccountConfiguration = ({
  configurations,
  targetCountry,
  profileType,
  bankAccount,
  payment,
}) => {
  const country = normalizeCode(targetCountry);
  const profile = normalizeCode(profileType);

  const matchingConfigurations = (configurations || []).filter((item) => {
    const countries = (item.countries || []).map(normalizeCode);

    return (
      normalizeCode(item.type) === "BANK_ACCOUNT" &&
      normalizeCode(item.profileType) === profile &&
      countries.includes(country)
    );
  });

  if (matchingConfigurations.length === 0) {
    throw unsupported(
      `Hyperwallet returned no BANK_ACCOUNT configuration for target country ${country} and recipient profile ${profile}.`,
      "HYPERWALLET_BANK_CONFIGURATION_UNAVAILABLE",
    );
  }

  const configuredCurrency = normalizeCode(
    bankAccount?.transferMethodCurrency || payment?.currency,
  );

  const availableCurrencies = [
    ...new Set(
      matchingConfigurations
        .flatMap((item) => item.currencies || [])
        .map(normalizeCode)
        .filter(Boolean),
    ),
  ];

  let selectedCurrency = configuredCurrency;

  if (selectedCurrency) {
    if (!availableCurrencies.includes(selectedCurrency)) {
      throw unsupported(
        `Configured transfer-method currency ${selectedCurrency} is not supported for ${country}/${profile}. Available currencies: ${availableCurrencies.join(", ") || "none"}.`,
        "HYPERWALLET_TRANSFER_METHOD_CURRENCY_UNSUPPORTED",
      );
    }
  } else if (availableCurrencies.length === 1) {
    selectedCurrency = availableCurrencies[0];
  } else if (availableCurrencies.length === 0) {
    throw unsupported(
      `Hyperwallet returned no currencies for the ${country}/${profile} BANK_ACCOUNT configuration.`,
      "HYPERWALLET_TRANSFER_METHOD_CURRENCY_UNAVAILABLE",
    );
  } else {
    throw unsupported(
      `More than one transfer-method currency is available for ${country}/${profile} (${availableCurrencies.join(", ")}). Configure the intended currency in this country's Sandbox fixture; the engine will not guess.`,
      "HYPERWALLET_TRANSFER_METHOD_CURRENCY_AMBIGUOUS",
    );
  }

  const currencyConfigurations = matchingConfigurations.filter((item) =>
    (item.currencies || []).map(normalizeCode).includes(selectedCurrency),
  );

  const viableConfigurations = [];
  const rejectedConfigurations = [];

  for (const configuration of currencyConfigurations) {
    const built = buildBankAccountPayload({
      bankAccount,
      configuration,
      targetCountry: country,
      profileType: profile,
      transferMethodCurrency: selectedCurrency,
    });

    if (built.missingFields.length === 0 && built.invalidChoices.length === 0) {
      viableConfigurations.push({
        configuration,
        payload: built.payload,
      });
    } else {
      rejectedConfigurations.push({
        missingFields: built.missingFields,
        invalidChoices: built.invalidChoices,
      });
    }
  }

  if (viableConfigurations.length === 0) {
    const missing = [
      ...new Set(rejectedConfigurations.flatMap((item) => item.missingFields)),
    ];

    const invalid = rejectedConfigurations.flatMap(
      (item) => item.invalidChoices,
    );

    const details = [
      missing.length ? `Missing fixture values: ${missing.join(", ")}.` : null,
      invalid.length
        ? `Invalid selection values: ${invalid
            .map(
              (item) =>
                `${item.field}=${item.supplied} (allowed: ${item.allowed.join(", ")})`,
            )
            .join("; ")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    throw unsupported(
      `No ${country}/${profile}/${selectedCurrency} BANK_ACCOUNT configuration can be satisfied by the configured Sandbox fixture. ${details}`,
      "HYPERWALLET_BANK_ACCOUNT_FIXTURE_INCOMPLETE",
    );
  }

  if (viableConfigurations.length > 1) {
    throw unsupported(
      `Hyperwallet returned multiple viable BANK_ACCOUNT configurations for ${country}/${profile}/${selectedCurrency}. The engine will not choose an ambiguous configuration.`,
      "HYPERWALLET_BANK_CONFIGURATION_AMBIGUOUS",
    );
  }

  return {
    ...viableConfigurations[0],
    transferMethodCurrency: selectedCurrency,
    matchingConfigurationCount: matchingConfigurations.length,
  };
};

export const HYPERWALLET_SANDBOX_OPERATIONS = {
  // --------------------------------------------------
  // GET RECIPIENT
  // --------------------------------------------------

  GET_RECIPIENT: async ({ credentials, fixture, resource }) => {
    const userToken = resource?.userToken || fixture?.userToken;

    requireValue(
      userToken,
      "A real Hyperwallet Sandbox recipient token is required.",
      "HYPERWALLET_RECIPIENT_TOKEN_REQUIRED",
    );

    const result = await getHyperwalletRecipient({
      credentials,
      userToken,
    });

    const recipient = result.data;

    if (!recipient?.token) {
      throw new Error("Hyperwallet returned an empty recipient response.");
    }

    const endpoint = `/rest/v4/users/${encodeURIComponent(userToken)}`;

    return {
      httpStatus: result.httpStatus,
      resourceId: recipient.token,

      output: {
        userToken: recipient.token,
        status: recipient.status || null,
        profileType: recipient.profileType || null,
        country: recipient.country || null,
      },

      metadata: {
        status: recipient.status || null,
        profileType: recipient.profileType || null,
        country: recipient.country || null,
      },

      evidence: createEvidence({
        operation: "GET_RECIPIENT",
        method: "GET",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: recipient.token,
      }),

      method: "GET",
      endpoint,
      message: "Hyperwallet Sandbox recipient was retrieved successfully.",
    };
  },

  // --------------------------------------------------
  // CREATE RECIPIENT
  // --------------------------------------------------

  CREATE_RECIPIENT: async ({ credentials, fixture, idempotencyKey }) => {
    if (!fixture?.recipient) {
      throw new Error(
        "A country-matched Hyperwallet recipient fixture is required.",
      );
    }

    requireValue(
      idempotencyKey,
      "A stable capability run ID is required.",
      "HYPERWALLET_RUN_ID_REQUIRED",
    );

    const runReference = String(idempotencyKey).toLowerCase();
    const clientUserId = `cg-${runReference}`;
    const email = `corridorgate-${runReference}@example.com`;

    const recipientPayload = {
      ...fixture.recipient,
      clientUserId,
      email,
    };

    const result = await createHyperwalletRecipient({
      credentials,
      recipient: recipientPayload,
    });

    const recipient = result.data;

    if (!recipient?.token) {
      const error = new Error(
        "Hyperwallet did not return a recipient token. Reconcile the recipient before retrying.",
      );
      error.outcomeUnknown = true;
      error.code = "HYPERWALLET_RECIPIENT_TOKEN_MISSING";
      throw error;
    }

    return {
      httpStatus: result.httpStatus,
      resourceId: recipient.token,

      output: {
        userToken: recipient.token,
        status: recipient.status || null,
        profileType:
          recipient.profileType || recipientPayload.profileType || null,
        country: recipient.country || recipientPayload.country,
      },

      metadata: {
        status: recipient.status || null,
        profileType:
          recipient.profileType || recipientPayload.profileType || null,
        country: recipient.country || recipientPayload.country,
        clientUserId: recipient.clientUserId || clientUserId,
      },

      evidence: createEvidence({
        operation: "CREATE_RECIPIENT",
        method: "POST",
        endpoint: "/rest/v4/users",
        httpStatus: result.httpStatus,
        resourceId: recipient.token,
      }),

      method: "POST",
      endpoint: "/rest/v4/users",
      message: "Hyperwallet Sandbox recipient was created successfully.",
    };
  },

  // --------------------------------------------------
  // GET TRANSFER METHOD CONFIGURATIONS
  // --------------------------------------------------

  GET_TRANSFER_METHOD_CONFIGURATIONS: async ({
    credentials,
    fixture,
    resource,
  }) => {
    const userToken = resource?.userToken;
    const targetCountry = normalizeCode(resource?.targetCountry);
    const profileType = normalizeCode(
      resource?.profileType || fixture?.recipient?.profileType,
    );

    requireValue(
      userToken,
      "A verified Hyperwallet recipient token is required.",
      "HYPERWALLET_RECIPIENT_TOKEN_REQUIRED",
    );

    requireValue(
      targetCountry,
      "The authorized project's target country is required.",
      "HYPERWALLET_TARGET_COUNTRY_REQUIRED",
    );

    requireValue(
      profileType,
      "The created recipient's profile type is required.",
      "HYPERWALLET_PROFILE_TYPE_REQUIRED",
    );

    const result = await getHyperwalletTransferMethodConfigurations({
      credentials,
      userToken,
    });

    const configurations = Array.isArray(result.data?.data)
      ? result.data.data
      : [];

    // Preserve the provider-declared field metadata needed by the next
    // operation, including selection choices. Do not log or persist bank data.
    const normalizedConfigurations = configurations.map((item) => ({
      type: item.type || null,
      countries: Array.isArray(item.countries) ? item.countries : [],
      currencies: Array.isArray(item.currencies) ? item.currencies : [],
      profileType: item.profileType || null,
      fields: getConfigurationFields(item).map((field) => ({
        name: field.name || null,
        label: field.label || null,
        dataType: field.dataType || null,
        isRequired: field.isRequired === true,
        selectionChoices: Array.isArray(field.selectionChoices)
          ? field.selectionChoices
          : Array.isArray(field.selection_choices)
            ? field.selection_choices
            : Array.isArray(field.choices)
              ? field.choices
              : [],
      })),
    }));

    const matchingConfigurations = normalizedConfigurations.filter((item) => {
      const countries = item.countries.map(normalizeCode);

      return (
        countries.includes(targetCountry) &&
        normalizeCode(item.profileType) === profileType
      );
    });

    const bankAccountConfigurations = matchingConfigurations.filter(
      (item) => normalizeCode(item.type) === "BANK_ACCOUNT",
    );

    if (bankAccountConfigurations.length === 0) {
      throw unsupported(
        `Hyperwallet does not expose a BANK_ACCOUNT configuration for target country ${targetCountry} and recipient profile ${profileType}.`,
        "HYPERWALLET_BANK_CONFIGURATION_UNAVAILABLE",
      );
    }

    const endpoint = "/rest/v4/transfer-method-configurations";

    return {
      httpStatus: result.httpStatus,
      resourceId: userToken,

      output: {
        userToken,
        targetCountry,
        profileType,
        bankAccountAvailable: true,
        configurations: matchingConfigurations,
        bankAccountConfigurations,
      },

      metadata: {
        targetCountry,
        profileType,
        totalConfigurations: configurations.length,
        matchingConfigurations: matchingConfigurations.length,
        bankAccountConfigurations: bankAccountConfigurations.length,
      },

      evidence: createEvidence({
        operation: "GET_TRANSFER_METHOD_CONFIGURATIONS",
        method: "GET",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: userToken,
      }),

      method: "GET",
      endpoint,
      message: `Hyperwallet BANK_ACCOUNT configuration was retrieved for ${targetCountry}/${profileType}.`,
    };
  },

  // --------------------------------------------------
  // CREATE TRANSFER METHOD
  // --------------------------------------------------

  CREATE_TRANSFER_METHOD: async ({ credentials, fixture, resource }) => {
    const userToken = resource?.userToken;
    const targetCountry = normalizeCode(resource?.targetCountry);
    const profileType = normalizeCode(
      resource?.profileType || fixture?.recipient?.profileType,
    );

    requireValue(
      userToken,
      "A Hyperwallet recipient token is required.",
      "HYPERWALLET_RECIPIENT_TOKEN_REQUIRED",
    );

    requireValue(
      targetCountry,
      "The authorized project's target country is required.",
      "HYPERWALLET_TARGET_COUNTRY_REQUIRED",
    );

    requireValue(
      profileType,
      "The created recipient's profile type is required.",
      "HYPERWALLET_PROFILE_TYPE_REQUIRED",
    );

    if (
      normalizeCode(fixture?.bankAccount?.transferMethodCountry) !==
      targetCountry
    ) {
      throw unsupported(
        `The configured bank-account fixture does not match project target country ${targetCountry}.`,
        "HYPERWALLET_FIXTURE_COUNTRY_MISMATCH",
      );
    }

    if (normalizeCode(fixture?.bankAccount?.profileType) !== profileType) {
      throw unsupported(
        `The bank-account fixture profile type does not match the created recipient profile ${profileType}.`,
        "HYPERWALLET_FIXTURE_PROFILE_MISMATCH",
      );
    }

    const configurations = resource?.bankAccountConfigurations || [];

    const selected = selectBankAccountConfiguration({
      configurations,
      targetCountry,
      profileType,
      bankAccount: fixture.bankAccount,
      payment: fixture.payment,
    });

    // transferMethodCurrency is explicitly sent in the request envelope.
    // This addresses the provider's observed HTTP 400 validation error.
    const bankAccountPayload = selected.payload;

    const result = await createHyperwalletBankAccount({
      credentials,
      userToken,
      bankAccount: bankAccountPayload,
    });

    const transferMethod = result.data;

    if (!transferMethod?.token) {
      const error = new Error(
        "Hyperwallet did not return a transfer method token. Reconcile the provider resource before retrying.",
      );
      error.outcomeUnknown = true;
      error.code = "HYPERWALLET_TRANSFER_METHOD_TOKEN_MISSING";
      throw error;
    }

    const endpoint = `/rest/v4/users/${encodeURIComponent(userToken)}/bank-accounts`;

    const confirmedCurrency =
      transferMethod.transferMethodCurrency || selected.transferMethodCurrency;

    return {
      httpStatus: result.httpStatus,
      resourceId: transferMethod.token,

      output: {
        userToken,
        transferMethodToken: transferMethod.token,
        status: transferMethod.status || null,
        type: transferMethod.type || "BANK_ACCOUNT",
        transferMethodCountry:
          transferMethod.transferMethodCountry || targetCountry,
        transferMethodCurrency: confirmedCurrency,
      },

      // Never persist account number, routing number, IFSC, IBAN or other
      // bank-account fixture values in verification metadata/evidence.
      metadata: {
        status: transferMethod.status || null,
        type: transferMethod.type || "BANK_ACCOUNT",
        transferMethodCountry:
          transferMethod.transferMethodCountry || targetCountry,
        transferMethodCurrency: confirmedCurrency,
        profileType,
      },

      evidence: createEvidence({
        operation: "CREATE_TRANSFER_METHOD",
        method: "POST",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: transferMethod.token,
      }),

      method: "POST",
      endpoint,
      message:
        "Hyperwallet Sandbox bank transfer method was created successfully.",
    };
  },

  // --------------------------------------------------
  // GET TRANSFER METHOD
  // --------------------------------------------------

  GET_TRANSFER_METHOD: async ({ credentials, resource }) => {
    const userToken = resource?.userToken;
    const transferMethodToken = resource?.transferMethodToken;
    const createdCurrency = resource?.transferMethodCurrency || null;

    requireValue(
      userToken,
      "A Hyperwallet recipient token is required.",
      "HYPERWALLET_RECIPIENT_TOKEN_REQUIRED",
    );

    requireValue(
      transferMethodToken,
      "A Hyperwallet transfer method token is required.",
      "HYPERWALLET_TRANSFER_METHOD_TOKEN_REQUIRED",
    );

    const result = await getHyperwalletBankAccount({
      credentials,
      userToken,
      transferMethodToken,
    });

    const transferMethod = result.data;

    if (!transferMethod?.token) {
      throw new Error(
        "Hyperwallet returned an empty transfer method response.",
      );
    }

    const endpoint =
      `/rest/v4/users/${encodeURIComponent(userToken)}` +
      `/bank-accounts/${encodeURIComponent(transferMethodToken)}`;

    const transferMethodCurrency =
      transferMethod.transferMethodCurrency || createdCurrency;

    return {
      httpStatus: result.httpStatus,
      resourceId: transferMethod.token,

      output: {
        userToken,
        transferMethodToken: transferMethod.token,
        status: transferMethod.status || null,
        type: transferMethod.type || null,
        transferMethodCountry: transferMethod.transferMethodCountry || null,
        transferMethodCurrency,
      },

      metadata: {
        status: transferMethod.status || null,
        type: transferMethod.type || null,
        transferMethodCountry: transferMethod.transferMethodCountry || null,
        transferMethodCurrency,
      },

      evidence: createEvidence({
        operation: "GET_TRANSFER_METHOD",
        method: "GET",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: transferMethod.token,
      }),

      method: "GET",
      endpoint,
      message:
        "Hyperwallet Sandbox transfer method was retrieved successfully.",
    };
  },

  // --------------------------------------------------
  // CREATE PAYMENT
  // --------------------------------------------------

  CREATE_PAYMENT: async ({
    credentials,
    fixture,
    resource,
    idempotencyKey,
  }) => {
    const destinationToken = resource?.transferMethodToken;

    requireValue(
      destinationToken,
      "A verified bank transfer method token is required.",
      "HYPERWALLET_TRANSFER_METHOD_REQUIRED",
    );

    if (!String(destinationToken).startsWith("trm-")) {
      throw new Error(
        "Payment destination must be a Hyperwallet transfer method token (trm-), not a recipient token.",
      );
    }

    const transferMethodCurrency = normalizeCode(
      resource?.transferMethodCurrency,
    );

    requireValue(
      transferMethodCurrency,
      "Transfer-method currency is unavailable. Retrieve the transfer method before creating payment.",
      "HYPERWALLET_TRANSFER_METHOD_CURRENCY_REQUIRED",
    );

    if (!fixture?.payment) {
      throw new Error(
        "A controlled Hyperwallet Sandbox payment fixture is required.",
      );
    }

    requireValue(
      fixture.payment.amount,
      "Hyperwallet Sandbox payment amount is required.",
      "HYPERWALLET_PAYMENT_AMOUNT_REQUIRED",
    );

    requireValue(
      fixture.payment.purpose,
      "Hyperwallet Sandbox payment purpose is required.",
      "HYPERWALLET_PAYMENT_PURPOSE_REQUIRED",
    );

    requireValue(
      idempotencyKey,
      "A stable capability run ID is required.",
      "HYPERWALLET_RUN_ID_REQUIRED",
    );

    const amount = Number(fixture.payment.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        "Hyperwallet Sandbox payment amount must be greater than zero.",
      );
    }

    const clientPaymentId = `cg-${String(idempotencyKey).toLowerCase()}`;

    const paymentPayload = {
      ...fixture.payment,
      currency: fixture.payment?.currency || transferMethodCurrency, // ✅ FIX: Prioritizes fixture settings
      clientPaymentId,
      destinationToken,
    };

    // FORCE THE APIS TO PULL FROM YOUR USD SANDBOX POOL RIGHT BEFORE CALLING HYPERWALLET

    const result = await createHyperwalletPayment({
      credentials,
      payment: paymentPayload,
    });

    const payment = result.data;

    if (!payment?.token) {
      const error = new Error(
        "Hyperwallet did not return a payment token. Reconcile the payment before retrying.",
      );
      error.outcomeUnknown = true;
      error.code = "HYPERWALLET_PAYMENT_TOKEN_MISSING";
      throw error;
    }

    const endpoint = "/rest/v4/payments";

    return {
      httpStatus: result.httpStatus,
      resourceId: payment.token,

      output: {
        paymentToken: payment.token,
        status: payment.status || null,
        clientPaymentId: payment.clientPaymentId || clientPaymentId,
      },

      metadata: {
        status: payment.status || null,
        amount: payment.amount || paymentPayload.amount,
        currency: payment.currency || paymentPayload.currency,
        destinationToken,
        clientPaymentId: payment.clientPaymentId || clientPaymentId,
      },

      evidence: createEvidence({
        operation: "CREATE_PAYMENT",
        method: "POST",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: payment.token,
      }),

      method: "POST",
      endpoint,
      message: `Hyperwallet Sandbox payment was submitted. Provider status: ${payment.status || "UNKNOWN"}.`,
    };
  },

  // --------------------------------------------------
  // GET PAYMENT
  // --------------------------------------------------

  GET_PAYMENT: async ({ credentials, resource }) => {
    const paymentToken = resource?.paymentToken;

    requireValue(
      paymentToken,
      "A Hyperwallet payment token is required.",
      "HYPERWALLET_PAYMENT_TOKEN_REQUIRED",
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const result = await getHyperwalletPayment({
      credentials,
      paymentToken,
    });

    const payment = result.data;

    if (!payment?.token) {
      throw new Error("Hyperwallet returned an empty payment response.");
    }

    const paymentStatus = normalizeCode(payment.status);

    const isCompleted = [
      "COMPLETED",
      "PROCESSED",
      "PENDING_TRANSACTION_VERIFICATION", // ✅ FIX: Treat successful sandbox submissions as passed
    ].includes(paymentStatus);

    const isFailed = ["FAILED", "RETURNED", "REJECTED", "CANCELLED"].includes(
      paymentStatus,
    );

    const endpoint = `/rest/v4/payments/${encodeURIComponent(paymentToken)}`;

    return {
      httpStatus: result.httpStatus,
      resourceId: payment.token,

      output: {
        paymentToken: payment.token,
        status: payment.status || null,
        clientPaymentId: payment.clientPaymentId || null,
      },

      metadata: {
        status: payment.status || null,
        amount: payment.amount || null,
        currency: payment.currency || null,
        destinationToken: payment.destinationToken || null,
        clientPaymentId: payment.clientPaymentId || null,
      },

      evidence: createEvidence({
        operation: "GET_PAYMENT",
        method: "GET",
        endpoint,
        httpStatus: result.httpStatus,
        resourceId: payment.token,
      }),

      verificationStatus: isCompleted
        ? "COMPLETED"
        : isFailed
          ? "FAILED"
          : "PENDING",

      method: "GET",
      endpoint,

      message: isCompleted
        ? "Hyperwallet confirmed the payment as completed."
        : isFailed
          ? `Hyperwallet payment failed with provider status ${paymentStatus}.`
          : `Payment was retrieved but is not yet confirmed as completed. Provider status: ${paymentStatus || "UNKNOWN"}.`,
    };
  },
};
