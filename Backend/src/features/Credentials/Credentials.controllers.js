import * as CredentialsService from "./Credentials.services.js";

// --------------------------------------------------
// Error Handler
// --------------------------------------------------

const handleControllerError = (res, error, operation) => {
  // Do not log raw provider errors or credential-related data.
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message:
        "Credentials already exist for this integration and environment. Update the existing credentials instead.",
    });
  }

  console.error(`Credentials ${operation} failed.`);

  return res.status(500).json({
    success: false,
    message: `Unable to ${operation.toLowerCase()} credentials.`,
  });
};

// --------------------------------------------------
// Create Credentials
// POST /integrations/:integrationId/credentials
// --------------------------------------------------

export const createCredentials = async (req, res) => {
  try {
    const credential = await CredentialsService.createCredentials({
      integrationId: req.params.integrationId,
      ...req.body,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Provider credentials saved successfully.",
      data: credential,
    });
  } catch (error) {
    return handleControllerError(res, error, "Create");
  }
};

// --------------------------------------------------
// Get Credentials
// GET /integrations/:integrationId/credentials
// --------------------------------------------------

export const getCredentials = async (req, res) => {
  try {
    const credentials = await CredentialsService.getCredentials({
      integrationId: req.params.integrationId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Credentials retrieved successfully.",
      data: credentials,
    });
  } catch (error) {
    return handleControllerError(res, error, "Retrieve");
  }
};

// --------------------------------------------------
// Update Credentials
// PATCH /integrations/:integrationId/credentials/:credentialId
// --------------------------------------------------

export const updateCredentials = async (req, res) => {
  try {
    const credential = await CredentialsService.updateCredentials({
      integrationId: req.params.integrationId,
      credentialId: req.params.credentialId,
      ...req.body,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Provider credentials updated successfully.",
      data: credential,
    });
  } catch (error) {
    console.error(`Credentials failed:`, {
      name: error.name,
      code: error.code,
      message: error.message,
      constraint: error.constraint,
    });
    return handleControllerError(res, error, "Update");
  }
};

// --------------------------------------------------
// Delete Credentials
// DELETE /integrations/:integrationId/credentials/:credentialId
// --------------------------------------------------

export const deleteCredentials = async (req, res) => {
  try {
    const credential = await CredentialsService.deleteCredentials({
      integrationId: req.params.integrationId,
      credentialId: req.params.credentialId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Provider credentials deleted successfully.",
      data: credential,
    });
  } catch (error) {
    return handleControllerError(res, error, "Delete");
  }
};
