
import {
    encryptSecret,
    decryptSecret,
} from "../features/Credentials/encryption.service.js";

// Test Client Secret (dummy value only)
const originalSecret = "paypal_sandbox_test_secret_123";

try {
    // 1. Encrypt
    const encryptedData = encryptSecret(originalSecret);

    console.log(
        "Encryption successful:",
        Boolean(encryptedData.encrypted)
    );

    // 2. Decrypt
    const decryptedSecret = decryptSecret(encryptedData);

    console.log(
        "Decryption successful:",
        decryptedSecret === originalSecret
    );

    // 3. Verify encrypted value differs from original
    console.log(
        "Encrypted value differs:",
        encryptedData.encrypted !== originalSecret
    );

    // 4. Verify different encryption produces different ciphertext
    const secondEncryption = encryptSecret(originalSecret);

    console.log(
        "Unique encryption IV:",
        encryptedData.iv !== secondEncryption.iv
    );

    // 5. Verify tampering is rejected
    try {
        decryptSecret({
            ...encryptedData,
            encrypted: encryptedData.encrypted.slice(0, -4) + "AAAA",
        });

        console.log("Tamper detection: FAILED");
    } catch {
        console.log("Tamper detection: PASSED");
    }

} catch (error) {
    console.error("Encryption test failed:", error.message);
    process.exitCode = 1;
}
