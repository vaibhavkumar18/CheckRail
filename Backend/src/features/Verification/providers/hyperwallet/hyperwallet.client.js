import { VerificationError } from "../../utils/verificationErrors.js";

const BASE_URL = "https://api.sandbox.hyperwallet.com";

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
  if (!credentials?.username || !credentials?.password) {
    throw new VerificationError(
      "Hyperwallet username or password is missing.",
      {
        statusCode: 400,
        code: "HYPERWALLET_CREDENTIALS_MISSING",
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
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new VerificationError("Unable to connect to Hyperwallet Sandbox.", {
      statusCode: 502,
      code: "HYPERWALLET_NETWORK_ERROR",
    });
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = new VerificationError(
      data?.errors?.[0]?.message ||
        data?.message ||
        "Hyperwallet API operation failed.",
      {
        statusCode: 502,
        code: "HYPERWALLET_API_ERROR",
        providerStatus: response.status,
      },
    );

    error.providerErrorCode = data?.errors?.[0]?.code || null;

    throw error;
  }

  return {
    httpStatus: response.status,
    data,
  };
};

// Verify Hyperwallet Sandbox API access.
export const checkHyperwalletApiAccess = async (credentials) => {
  console.log("Hyperwallet client diagnostic:", {
    credentialsReceived: Boolean(credentials),
    usernamePresent: Boolean(credentials?.username),
    passwordPresent: Boolean(credentials?.password),
    programTokenPresent:
      typeof credentials?.programToken === "string" &&
      credentials.programToken.trim().length > 0,
  });

  if (!credentials?.programToken) {
    throw new VerificationError("Hyperwallet program token is missing.", {
      statusCode: 400,
      code: "HYPERWALLET_PROGRAM_TOKEN_MISSING",
    });
  }

  // Keep the existing hyperwalletRequest call below.
  const result = await hyperwalletRequest({
    credentials,
    method: "GET",
    path: "/users",
    query: {
      programToken: credentials.programToken,
    },
  });

  return {
    ...result,
    successful: true,
  };
};
