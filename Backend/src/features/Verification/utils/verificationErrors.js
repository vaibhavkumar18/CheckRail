export class VerificationError extends Error {
    constructor(message, {
        statusCode = 500,
        code = "VERIFICATION_ERROR",
        providerStatus = null,
        debugId = null,
    } = {}) {
        super(message);

        this.name = "VerificationError";
        this.statusCode = statusCode;
        this.code = code;
        this.providerStatus = providerStatus;
        this.debugId = debugId;
    }
}