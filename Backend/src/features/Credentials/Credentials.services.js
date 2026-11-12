import * as CredentialsModel from "./Credentials.model.js";

import { encryptSecret, decryptSecret } from "./encryption.service.js";

// --------------------------------------------------
// Safe Credential Response
// --------------------------------------------------

const toSafeCredential = (credential) => {
  if (!credential) return null;

  return {
    id: credential.id,
    integrationId: credential.integration_id,
    provider: credential.provider,
    environment: credential.environment,
    credentialVersion: credential.credential_version,
    createdBy: credential.created_by,
    updatedBy: credential.updated_by,
    createdAt: credential.created_at,
    updatedAt: credential.updated_at,
  };
};

// --------------------------------------------------
// Encrypt Provider Credential Object
// --------------------------------------------------

const encryptCredentialPayload = (credentials) => {
  if (
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  ) {
    throw new Error("Invalid provider credentials.");
  }

  return encryptSecret(JSON.stringify(credentials));
};

// --------------------------------------------------
// Decrypt Provider Credential Object
// Supports new and legacy PayPal formats
// --------------------------------------------------

const decryptCredentialPayload = (credential) => {
  if (credential.credentials_encrypted) {
    const decrypted = decryptSecret({
      encrypted: credential.credentials_encrypted,
      iv: credential.encryption_iv,
      authTag: credential.encryption_auth_tag,
    });

    const parsed = JSON.parse(decrypted);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid decrypted credential payload.");
    }

    return parsed;
  }

  // Backward compatibility for legacy PayPal credentials.
  if (credential.provider === "PAYPAL" && credential.client_secret_encrypted) {
    return {
      clientId: credential.client_id,
      clientSecret: decryptSecret({
        encrypted: credential.client_secret_encrypted,
        iv: credential.encryption_iv,
        authTag: credential.encryption_auth_tag,
      }),
      webhookId: credential.webhook_id,
    };
  }

  throw new Error("Credential payload is unavailable.");
};

// --------------------------------------------------
// Create Credentials
// --------------------------------------------------

export const createCredentials = async ({
  integrationId,
  provider,
  environment,
  credentials,
  userId,
}) => {
  const encryptedData = encryptCredentialPayload(credentials);

  const credential = await CredentialsModel.createCredentials({
    integrationId,
    provider,
    environment,
    encryptedPayload: encryptedData.encrypted,
    iv: encryptedData.iv,
    authTag: encryptedData.authTag,
    userId,
  });

  if (!credential) {
    throw new Error("Unable to create credentials. Check integration access.");
  }

  return toSafeCredential(credential);
};

// --------------------------------------------------
// Get Credentials (Safe Metadata)
// --------------------------------------------------

export const getCredentials = async ({ integrationId, userId }) => {
  const credentials = await CredentialsModel.getCredentialsForUser(
    integrationId,
    userId,
  );

  return credentials.map(toSafeCredential);
};

// --------------------------------------------------
// Update Credentials
// --------------------------------------------------

export const updateCredentials = async ({
  credentialId,
  integrationId,
  userId,
  provider,
  credentials,
}) => {
  console.log("Credential payload diagnostic:", {
    provider,
    fields: Object.keys(credentials),
    programTokenPresent:
      typeof credentials.programToken === "string" &&
      credentials.programToken.trim().length > 0,
  });
  const encryptedData = encryptCredentialPayload(credentials);

  const credential = await CredentialsModel.updateCredentials({
    credentialId,
    integrationId,
    userId,
    provider,
    encryptedPayload: encryptedData.encrypted,
    iv: encryptedData.iv,
    authTag: encryptedData.authTag,
  });

  if (!credential) {
    throw new Error(
      "Credential not found or you do not have permission to update it.",
    );
  }

  return toSafeCredential(credential);
};

// --------------------------------------------------
// Delete Credentials
// --------------------------------------------------

export const deleteCredentials = async ({
  credentialId,
  integrationId,
  userId,
}) => {
  const credential = await CredentialsModel.deleteCredentials({
    credentialId,
    integrationId,
    userId,
  });

  if (!credential) {
    throw new Error(
      "Credential not found or you do not have permission to delete it.",
    );
  }

  return {
    id: credential.id,
    integrationId: credential.integration_id,
    provider: credential.provider,
    environment: credential.environment,
  };
};

// --------------------------------------------------
// Internal: Get Decrypted Provider Credentials
// --------------------------------------------------

export const getCredentialsForProviderVerification = async ({
  integrationId,
  provider,
  environment,
  userId,
}) => {
  const credential = await CredentialsModel.getCredentialsForVerification({
    integrationId,
    provider,
    environment,
    userId,
  });

  if (!credential) {
    throw new Error("Provider credentials not found or access denied.");
  }

  const credentials = decryptCredentialPayload(credential);

  return {
    id: credential.id,
    integrationId: credential.integration_id,
    provider: credential.provider,
    environment: credential.environment,
    credentialVersion: credential.credential_version,
    ...credentials,
  };
};

// --------------------------------------------------
// Create Encrypted Credential Snapshot for Workflow
// --------------------------------------------------

export const createEncryptedCredentialSnapshot = async ({
  credentialId,
  userId,
}) => {
  const credential = await CredentialsModel.getCredentialByIdForWorkflow({
    credentialId,
    userId,
  });

  if (!credential) {
    throw new Error(
      "Credential not found or you do not have permission to use it.",
    );
  }

  const credentialVersion = Number(credential.credential_version);

  if (!Number.isInteger(credentialVersion) || credentialVersion < 1) {
    throw new Error("Credential version is invalid.");
  }

  // Normalize both current and legacy credential formats.
  const credentials = decryptCredentialPayload(credential);

  // Encrypt a fresh immutable snapshot.
  const encryptedSnapshot = encryptCredentialPayload(credentials);

  return {
    credential: {
      id: credential.id,
      integration_id: credential.integration_id,
      provider: credential.provider,
      environment: credential.environment,
      credential_version: credentialVersion,
    },

    encryptedSnapshot: {
      encrypted: encryptedSnapshot.encrypted,
      iv: encryptedSnapshot.iv,
      authTag: encryptedSnapshot.authTag,
    },
  };
};

export const createEncryptedCredentialSnapshotFromCredential = (credential) => {
  const credentials = decryptCredentialPayload(credential);
  const encryptedSnapshot = encryptCredentialPayload(credentials);

  return {
    encrypted: encryptedSnapshot.encrypted,
    iv: encryptedSnapshot.iv,
    authTag: encryptedSnapshot.authTag,
  };
};

// --------------------------------------------------
// Decrypt Workflow Credential Snapshot
// Worker-only function
// --------------------------------------------------

export const decryptWorkflowCredentialSnapshot = ({
  encrypted,
  iv,
  authTag,
}) => {
  if (!encrypted || !iv || !authTag) {
    throw new Error("Workflow credential snapshot is incomplete.");
  }

  const decrypted = decryptSecret({
    encrypted,
    iv,
    authTag,
  });

  const credentials = JSON.parse(decrypted);

  if (
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  ) {
    throw new Error("Invalid workflow credential snapshot.");
  }

  return credentials;
};

// --------------------------------------------------
// Backward-Compatible PayPal Verification Function
// --------------------------------------------------

export const getCredentialsForPayPalVerification = async ({
  integrationId,
  environment,
  userId,
}) => {
  return getCredentialsForProviderVerification({
    integrationId,
    provider: "PAYPAL",
    environment,
    userId,
  });
};
