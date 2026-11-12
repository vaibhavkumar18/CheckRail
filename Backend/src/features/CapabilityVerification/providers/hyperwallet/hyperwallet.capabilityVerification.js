import {
    createHyperwalletRecipient,
    getHyperwalletRecipient,
} from "./hyperwallet.client.js";

import {
    normalizeCapabilityResult,
} from "../../utils/normalizeCapabilityResult.js";

const createEvidence = ({
    operation,
    method,
    endpoint,
    httpStatus,
    resourceId = null,
}) => ({
    type: "API_REQUEST",
    operation,
    method,
    endpoint,
    httpStatus,
    resourceId,
    observedAt: new Date().toISOString(),
});

const createFailedCheck = (operation, error, resourceId = null) => ({
    name: operation,
    status: "FAILED",
    message: error.message || "Hyperwallet operation failed.",
    providerStatus: error.providerStatus ?? null,
    providerErrorCode: error.providerErrorCode ?? null,
    resourceId,
});

const validateRecipientPayload = (recipient) => {
    if (!recipient || typeof recipient !== "object" || Array.isArray(recipient)) {
        throw new Error("A recipient object is required.");
    }

    // Prevent accidental submission of credential-like fields.
    const forbiddenFields = [
        "password",
        "clientSecret",
        "client_secret",
        "accessToken",
        "access_token",
        "username",
    ];

    for (const field of forbiddenFields) {
        if (Object.prototype.hasOwnProperty.call(recipient, field)) {
            throw new Error(
                `Recipient payload must not contain the field '${field}'.`
            );
        }
    }

    return recipient;
};

export const verifyHyperwalletCapability = async ({
    credentials,
    environment,
    capabilityCode,
    options = {},
}) => {
    if (environment !== "SANDBOX") {
        throw new Error(
            "Hyperwallet capability execution is currently restricted to SANDBOX."
        );
    }

    if (capabilityCode !== "RECIPIENT_MANAGEMENT") {
        throw new Error(
            `Hyperwallet capability '${capabilityCode}' is not implemented yet.`
        );
    }

    const checks = [];
    const evidence = [];

    // --------------------------------------------------
    // CREATE RECIPIENT
    // --------------------------------------------------

    if (options.action === "CREATE_RECIPIENT") {
        let recipient;

        try {
            recipient = validateRecipientPayload(options.recipient);
        } catch (error) {
            checks.push(createFailedCheck("CREATE_RECIPIENT", error));

            checks.push({
                name: "GET_RECIPIENT",
                status: "NOT_RUN",
                message: "Recipient retrieval was not attempted.",
            });

            return normalizeCapabilityResult({
                provider: "HYPERWALLET",
                environment,
                capabilityCode,
                checks,
                evidence,
            });
        }

        try {
            const result = await createHyperwalletRecipient({
                credentials,
                recipient,
            });

            const createdRecipient = result.data;
            const recipientToken = createdRecipient?.token || null;

            checks.push({
                name: "CREATE_RECIPIENT",
                status: recipientToken ? "PASSED" : "FAILED",
                message: recipientToken
                    ? "Hyperwallet Sandbox recipient created successfully."
                    : "Hyperwallet returned a successful response without a recipient token.",
                providerStatus: result.httpStatus,
                resourceId: recipientToken,
                recipientStatus: createdRecipient?.status || null,
                verificationStatus:
                    createdRecipient?.verificationStatus || null,
            });

            evidence.push(
                createEvidence({
                    operation: "CREATE_RECIPIENT",
                    method: "POST",
                    endpoint: "/rest/v4/users",
                    httpStatus: result.httpStatus,
                    resourceId: recipientToken,
                })
            );

            checks.push({
                name: "GET_RECIPIENT",
                status: "NOT_RUN",
                message: recipientToken
                    ? "Recipient retrieval was not part of this creation run."
                    : "Recipient retrieval cannot be attempted without a returned recipient token.",
                resourceId: recipientToken,
            });
        } catch (error) {
            checks.push(createFailedCheck("CREATE_RECIPIENT", error));

            checks.push({
                name: "GET_RECIPIENT",
                status: "NOT_RUN",
                message: "Recipient retrieval was not attempted because creation failed.",
            });

            if (error.providerStatus !== undefined) {
                evidence.push(
                    createEvidence({
                        operation: "CREATE_RECIPIENT",
                        method: "POST",
                        endpoint: "/rest/v4/users",
                        httpStatus: error.providerStatus,
                    })
                );
            }
        }
    }

    // --------------------------------------------------
    // GET EXISTING RECIPIENT
    // --------------------------------------------------

    else if (options.action === "GET_RECIPIENT") {
        const userToken = options.userToken;

        if (!userToken || typeof userToken !== "string") {
            const error = new Error(
                "A Hyperwallet recipient token is required."
            );

            checks.push(createFailedCheck("GET_RECIPIENT", error));

            checks.push({
                name: "CREATE_RECIPIENT",
                status: "NOT_RUN",
                message: "Recipient creation was not part of this retrieval run.",
            });
        } else {
            try {
                const result = await getHyperwalletRecipient({
                    credentials,
                    userToken,
                });

                const recipient = result.data;
                const returnedToken = recipient?.token || null;

                checks.push({
                    name: "GET_RECIPIENT",
                    status: returnedToken ? "PASSED" : "FAILED",
                    message: returnedToken
                        ? "Hyperwallet recipient retrieved successfully."
                        : "Hyperwallet did not return a recipient record.",
                    providerStatus: result.httpStatus,
                    resourceId: returnedToken || userToken,
                    recipientStatus: recipient?.status || null,
                    verificationStatus:
                        recipient?.verificationStatus || null,
                });

                evidence.push(
                    createEvidence({
                        operation: "GET_RECIPIENT",
                        method: "GET",
                        endpoint: `/rest/v4/users/${encodeURIComponent(userToken)}`,
                        httpStatus: result.httpStatus,
                        resourceId: returnedToken || userToken,
                    })
                );
            } catch (error) {
                checks.push(
                    createFailedCheck("GET_RECIPIENT", error, userToken)
                );

                if (error.providerStatus !== undefined) {
                    evidence.push(
                        createEvidence({
                            operation: "GET_RECIPIENT",
                            method: "GET",
                            endpoint: `/rest/v4/users/${encodeURIComponent(userToken)}`,
                            httpStatus: error.providerStatus,
                            resourceId: userToken,
                        })
                    );
                }
            }

            checks.push({
                name: "CREATE_RECIPIENT",
                status: "NOT_RUN",
                message: "Recipient creation was not part of this retrieval run.",
            });
        }
    } else {
        throw new Error(
            "Unsupported recipient action. Use CREATE_RECIPIENT or GET_RECIPIENT."
        );
    }

    return normalizeCapabilityResult({
        provider: "HYPERWALLET",
        environment,
        capabilityCode,
        checks,
        evidence,
    });
};