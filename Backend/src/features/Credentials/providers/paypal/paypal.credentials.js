export const PAYPAL_PROVIDER = "PAYPAL";

export const PAYPAL_ENVIRONMENTS = Object.freeze([
    "SANDBOX",
    "LIVE",
]);

export const PAYPAL_CREDENTIAL_FIELDS = Object.freeze([
    {
        name: "clientId",
        label: "Client ID",
        secret: false,
        required: true,
    },
    {
        name: "clientSecret",
        label: "Client Secret",
        secret: true,
        required: true,
    },
    {
        name: "webhookId",
        label: "Webhook ID",
        secret: false,
        required: false,
    },
]);
