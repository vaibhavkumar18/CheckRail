/**
 * Dynamic Hyperwallet Sandbox fixtures keyed by the project's target country.
 * Each invocation creates a fresh recipient, email, bank account and payment ID
 * using registered sandbox bank/routing identifiers and valid account formats.
 */

import { randomInt } from "node:crypto";

const normalizeCountry = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const randomDigits = (length) => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += String(randomInt(0, 10));
  }
  return result;
};

// Generates a purely alphabetic suffix (e.g., "KMPQ") for human name fields
const randomLetters = (length) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[randomInt(0, alphabet.length)];
  }
  return result;
};

// Timestamp + cryptographically generated suffix keeps fixture identifiers
// distinct across repeated Sandbox runs without using real personal data.
const generateRunSuffix = () =>
  `${Date.now().toString().slice(-8)}${randomDigits(5)}`;

// Generate a structurally valid German IBAN (MOD-97 check digits) using
// Commerzbank's registered BLZ (37040044).
const generateValidGermanIban = () => {
  const bankCode = "37040044";
  const accountNumber = `05${randomDigits(8)}`;
  const bban = `${bankCode}${accountNumber}`;
  const numericIban = `${bban}131400`;
  const remainder = BigInt(numericIban) % 97n;
  const checkDigits = String(98n - remainder).padStart(2, "0");
  return `DE${checkDigits}${bban}`;
};

const COUNTRY_CONFIGS = Object.freeze({
  CA: {
    currency: "CAD",
    city: "Toronto",
    stateProvince: "ON",
    postalCode: "M5V 2T6",
    buildBankFields: (suffix) => {
      const accountNumber = `1${suffix.slice(-8)}`; // 9-digit non-zero account number
      return {
        bankId: "001", // Registered Bank of Montreal (BMO) institution ID
        branchId: "39142", // Registered BMO Toronto branch transit number (matches ON)
        bankAccountId: accountNumber,
        accountNumber,
        bankAccountPurpose: "CHECKING",
        accountType: "CHECKING",
      };
    },
  },
  US: {
    currency: "USD",
    city: "San Francisco",
    stateProvince: "CA",
    postalCode: "94105",
    buildBankFields: (suffix) => {
      const accountNumber = `40${suffix.slice(-9)}`; // 11-digit account number
      return {
        branchId: "121000358", // Registered Bank of America California ABA routing number
        routingNumber: "121000358",
        bankAccountId: accountNumber,
        accountNumber,
        bankAccountPurpose: "CHECKING",
        accountType: "CHECKING",
      };
    },
  },
  IN: {
    currency: "INR",
    city: "Bengaluru",
    stateProvince: "Karnataka",
    postalCode: "560001",
    buildBankFields: (suffix) => {
      const accountNumber = `50100${suffix.slice(-9)}`; // 14-digit account number
      return {
        branchId: "HDFC0000001", // Registered HDFC Bank IFSC code
        ifscCode: "HDFC0000001",
        bankAccountId: accountNumber,
        accountNumber,
        bankAccountPurpose: "SAVINGS",
        accountType: "SAVINGS",
      };
    },
  },
  GB: {
    currency: "GBP",
    city: "London",
    stateProvince: "Greater London",
    postalCode: "EC1A 1BB",
    buildBankFields: (suffix) => {
      const accountNumber = `2${suffix.slice(-7)}`; // 8-digit non-zero account number
      return {
        branchId: "200000", // Registered Barclays London sort code
        bankAccountId: accountNumber,
        accountNumber,
        bankAccountPurpose: "CHECKING",
        accountType: "CHECKING",
      };
    },
  },
  DE: {
    currency: "EUR",
    city: "Berlin",
    stateProvince: "Berlin",
    postalCode: "10115",
    buildBankFields: () => {
      const iban = generateValidGermanIban();
      return {
        bankAccountId: iban,
        accountNumber: iban,
        iban,
        bankAccountPurpose: "CHECKING",
        accountType: "CHECKING",
      };
    },
  },
  AU: {
    currency: "AUD",
    city: "Sydney",
    stateProvince: "NSW",
    postalCode: "2000",
    buildBankFields: (suffix) => {
      const accountNumber = `1${suffix.slice(-8)}`; // 9-digit non-zero account number
      return {
        branchId: "062000", // Registered Commonwealth Bank Sydney NSW BSB code
        bsbNumber: "062000",
        bankAccountId: accountNumber,
        accountNumber,
        bankAccountPurpose: "CHECKING",
        accountType: "CHECKING",
      };
    },
  },
});

const assertCountryConsistency = ({ country, recipient, bankAccount }) => {
  if (normalizeCountry(recipient.country) !== country) {
    throw new Error(
      "Hyperwallet recipient fixture does not match the project's target country.",
    );
  }

  if (
    normalizeCountry(bankAccount.transferMethodCountry) !== country ||
    normalizeCountry(bankAccount.country) !== country
  ) {
    throw new Error(
      "Hyperwallet bank-account fixture does not match the project's target country.",
    );
  }
};

export const createHyperwalletSandboxFixture = ({ targetCountry } = {}) => {
  const country = normalizeCountry(targetCountry);

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("A valid two-letter project target country is required.");
  }

  const config = COUNTRY_CONFIGS[country];
  if (!config) {
    throw new Error(
      `Unsupported target country ${country}. Supported countries: ${Object.keys(COUNTRY_CONFIGS).join(", ")}`,
    );
  }

  const uniqueSuffix = generateRunSuffix();
  const alphaSuffix = randomLetters(4);

  const sharedIdentity = {
    profileType: "INDIVIDUAL",
    firstName: "CorridorGate",
    lastName: `Payee${alphaSuffix}`,
    addressLine1: `${uniqueSuffix.slice(0, 3)} Sandbox Test Road`,
    city: config.city,
    stateProvince: config.stateProvince,
    country,
    postalCode: config.postalCode,
  };

  const recipient = {
    ...sharedIdentity,
    clientUserId: `cg-${country.toLowerCase()}-${uniqueSuffix}`,
    dateOfBirth: "1990-01-15",
    email: `cg-${country.toLowerCase()}-${uniqueSuffix}@example.com`,
  };

  const bankAccount = {
    ...sharedIdentity,
    transferMethodCountry: country,
    transferMethodCurrency: config.currency,
    ...config.buildBankFields(uniqueSuffix),
  };

  const payment = {
    clientPaymentId: `pay-${country.toLowerCase()}-${uniqueSuffix}`,
    amount: "1.00",
    // USD funding pool is retained for cross-border testing.
    // Change to config.currency only if your Sandbox program requires domestic funding.
    currency: "USD",
    purpose: "PAYROLL",
    memo: `CorridorGate Sandbox verification (${country})`,
    notes: "Synthetic Sandbox test payment only",
  };

  assertCountryConsistency({ country, recipient, bankAccount });

  return Object.freeze({
    country,
    recipient: Object.freeze(recipient),
    bankAccount: Object.freeze(bankAccount),
    payment: Object.freeze(payment),
  });
};
