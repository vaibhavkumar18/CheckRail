
import {
    getCredentialsForProviderVerification,
} from "../features/Credentials/Credentials.services.js";

const integrationId = "8d86f905-f953-4fdd-8623-1f02f46e5717";
const userId = "44d0cd0b-d319-4bdc-ace7-1b3abb88084f";

const providers = ["PAYPAL", "HYPERWALLET"];

for (const provider of providers) {
    try {
        const credentials =
            await getCredentialsForProviderVerification({
                integrationId,
                provider,
                environment: "SANDBOX",
                userId,
            });

        const expectedFields =
            provider === "PAYPAL"
                ? ["clientId", "clientSecret"]
                : ["username", "password"];

        const valid = expectedFields.every(
            (field) =>
                typeof credentials[field] === "string" &&
                credentials[field].length > 0
        );

        console.log({
            provider,
            decryptedSuccessfully: valid,
            credentialId: credentials.id,
        });

        if (!valid) {
            throw new Error("Required credential fields are missing.");
        }
    } catch (error) {
        console.error(`${provider} verification failed:`, error.message);
    }
}
