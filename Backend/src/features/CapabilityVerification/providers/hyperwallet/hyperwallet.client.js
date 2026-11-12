import { VerificationError } from "../../../Verification/utils/verificationErrors.js";

const BASE_URL = "https://api.sandbox.hyperwallet.com";
const REQUEST_TIMEOUT = 15000;

const parseResponse = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: "Invalid Hyperwallet response.",
    };
  }
};

export const hyperwalletRequest = async ({
  credentials,
  method,
  path,
  body,
  query = {},
}) => {
  if (
    !credentials?.username ||
    !credentials?.password ||
    !credentials?.programToken
  ) {
    throw new VerificationError(
      "Hyperwallet credentials are incomplete.",
      {
        statusCode: 400,
        code: "HYPERWALLET_CREDENTIALS_INCOMPLETE",
      },
    );
  }

  const authorization = Buffer.from(
    `${credentials.username}:${credentials.password}`,
  ).toString("base64");

  const url = new URL(`${BASE_URL}/rest/v4${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
  } catch (cause) {
    const error = new VerificationError(
      "Hyperwallet request outcome is unknown. Do not blindly retry.",
      {
        statusCode: 502,
        code: "HYPERWALLET_NETWORK_ERROR",
      },
    );

    error.outcomeUnknown = true;
    error.cause = cause;

    throw error;
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const providerErrors = Array.isArray(data?.errors)
      ? data.errors.map((item) => ({
          code: item.code || null,
          fieldName:
            item.fieldName || item.field || item.name || null,
          message: item.message || null,
        }))
      : [];

    const detailedMessage = providerErrors
      .map((item) =>
        [item.fieldName, item.message]
          .filter(Boolean)
          .join(": "),
      )
      .filter(Boolean)
      .join("; ");

    const error = new VerificationError(
      detailedMessage ||
        data?.message ||
        "Hyperwallet API operation failed.",
      {
        statusCode: 502,
        code: "HYPERWALLET_API_ERROR",
        providerStatus: response.status,
      },
    );

    error.providerStatus = response.status;
    error.providerErrorCode =
      providerErrors[0]?.code || null;
    error.providerErrors = providerErrors;

    throw error;
  }

  return {
    httpStatus: response.status,
    data,
  };
};

// RECIPIENT MANAGEMENT

export const getHyperwalletRecipient = async ({
  credentials,
  userToken,
}) => {
  if (!userToken) {
    throw new VerificationError(
      "Hyperwallet recipient token is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_USER_TOKEN_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "GET",
    path: `/users/${encodeURIComponent(userToken)}`,
  });
};

export const createHyperwalletRecipient = async ({
  credentials,
  recipient,
}) => {
  if (!recipient || typeof recipient !== "object") {
    throw new VerificationError(
      "A valid Hyperwallet recipient payload is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_RECIPIENT_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "POST",
    path: "/users",
    body: {
      ...recipient,
      programToken: credentials.programToken,
    },
  });
};

// TRANSFER METHOD CONFIGURATION

export const getHyperwalletTransferMethodConfigurations =
  async ({ credentials, userToken }) => {
    if (!userToken) {
      throw new VerificationError(
        "Hyperwallet recipient token is required.",
        {
          statusCode: 400,
          code: "HYPERWALLET_USER_TOKEN_REQUIRED",
        },
      );
    }

    return hyperwalletRequest({
      credentials,
      method: "GET",
      path: "/transfer-method-configurations",
      query: {
        userToken,
        limit: 100,
      },
    });
  };

// CREATE BANK ACCOUNT TRANSFER METHOD

export const createHyperwalletBankAccount = async ({
  credentials,
  userToken,
  bankAccount,
}) => {
  if (!userToken) {
    throw new VerificationError(
      "Hyperwallet recipient token is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_USER_TOKEN_REQUIRED",
      },
    );
  }

  if (!bankAccount || typeof bankAccount !== "object") {
    throw new VerificationError(
      "A valid bank account payload is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_BANK_ACCOUNT_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "POST",
    path: `/users/${encodeURIComponent(userToken)}/bank-accounts`,
    body: {
      ...bankAccount,
      programToken: credentials.programToken,
    },
  });
};

// RETRIEVE BANK ACCOUNT TRANSFER METHOD

export const getHyperwalletBankAccount = async ({
  credentials,
  userToken,
  transferMethodToken,
}) => {
  if (!userToken || !transferMethodToken) {
    throw new VerificationError(
      "Recipient and transfer method tokens are required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_TRANSFER_METHOD_TOKENS_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "GET",
    path:
      `/users/${encodeURIComponent(userToken)}` +
      `/bank-accounts/${encodeURIComponent(transferMethodToken)}`,
  });
};

// PAYMENT DISBURSEMENT

export const createHyperwalletPayment = async ({
  credentials,
  payment,
}) => {
  if (!payment || typeof payment !== "object") {
    throw new VerificationError(
      "A valid Hyperwallet payment payload is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_PAYMENT_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "POST",
    path: "/payments",
    body: {
      ...payment,
      programToken: credentials.programToken,
    },
  });
};

export const getHyperwalletPayment = async ({
  credentials,
  paymentToken,
}) => {
  if (!paymentToken) {
    throw new VerificationError(
      "Hyperwallet payment token is required.",
      {
        statusCode: 400,
        code: "HYPERWALLET_PAYMENT_TOKEN_REQUIRED",
      },
    );
  }

  return hyperwalletRequest({
    credentials,
    method: "GET",
    path: `/payments/${encodeURIComponent(paymentToken)}`,
  });
};