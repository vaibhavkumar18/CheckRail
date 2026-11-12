
import crypto from "crypto";
import config from "../../config/config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// --------------------------------------------------
// Get Encryption Key
// --------------------------------------------------

const getEncryptionKey = () => {
    const encodedKey = config.CREDENTIAL_ENCRYPTION_KEY;

    if (!encodedKey) {
        throw new Error(
            "CREDENTIAL_ENCRYPTION_KEY is not configured."
        );
    }

    const key = Buffer.from(encodedKey, "base64");

    if (
        key.length !== 32 ||
        key.toString("base64") !== encodedKey
    ) {
        throw new Error(
            "CREDENTIAL_ENCRYPTION_KEY must be a valid Base64-encoded 32-byte key."
        );
    }

    return key;
};

// --------------------------------------------------
// Encrypt Secret
// --------------------------------------------------

export const encryptSecret = (plainText) => {
    if (
        typeof plainText !== "string" ||
        plainText.length === 0
    ) {
        throw new Error("Invalid secret provided for encryption.");
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
        ALGORITHM,
        key,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(plainText, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
        encrypted: encrypted.toString("base64"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
    };
};

// --------------------------------------------------
// Decrypt Secret
// --------------------------------------------------

export const decryptSecret = ({
    encrypted,
    iv,
    authTag,
}) => {
    if (
        typeof encrypted !== "string" ||
        typeof iv !== "string" ||
        typeof authTag !== "string"
    ) {
        throw new Error("Invalid encrypted credential data.");
    }

    const key = getEncryptionKey();

    const ivBuffer = Buffer.from(iv, "hex");
    const authTagBuffer = Buffer.from(authTag, "hex");
    const encryptedBuffer = Buffer.from(encrypted, "base64");

    if (
        ivBuffer.length !== IV_LENGTH ||
        authTagBuffer.length !== AUTH_TAG_LENGTH ||
        encryptedBuffer.length === 0 ||
        encryptedBuffer.toString("base64") !== encrypted
    ) {
        throw new Error("Invalid encrypted credential format.");
    }

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        ivBuffer
    );

    decipher.setAuthTag(authTagBuffer);

    const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
};
