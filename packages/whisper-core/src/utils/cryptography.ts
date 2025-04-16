import { Logger } from './logger';
import { secretbox, secretbox_open, sign as naclSign, box, box_open, randomBytes } from './nacl-wrapper';
import { newError } from './new-error';

/**
 * Interface representing a cryptographic key pair consisting of a public key and a secret key.
 * Used for both signing operations and encryption/decryption.
 */
export interface CryptoKeyPair {
    /**
     * Public key component of the key pair.
     * This can be shared with other parties.
     */
    readonly publicKey: Uint8Array;

    /**
     * Secret (private) key component of the key pair.
     * This must be kept secure and never shared.
     */
    readonly secretKey: Uint8Array;
}

/**
 * Interface providing cryptographic operations for the application.
 * Implements signing, verification, key generation, and encryption/decryption functionality.
 */
export interface Cryptography {
    /**
     * Creates a digital signature for the provided data using the specified secret key.
     *
     * @param data - Data to be signed
     * @param secretKey - Secret key used for signing
     * @returns Digital signature as Uint8Array
     */
    sign(data: Uint8Array, secretKey: Uint8Array): Uint8Array;

    /**
     * Verifies a digital signature against provided data and public key.
     *
     * @param data - Original data that was signed
     * @param signature - Signature to verify
     * @param publicKey - Public key corresponding to the secret key used for signing
     * @returns Boolean indicating if the signature is valid
     */
    verifySignature(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;

    /**
     * Generates a new key pair for digital signature operations.
     *
     * @returns A new CryptoKeyPair for signing and verification
     */
    generateSigningKeyPair(): CryptoKeyPair;

    /**
     * Generates a new key pair for encryption operations.
     *
     * @returns A new CryptoKeyPair for encryption and decryption
     */
    generateEncryptionKeyPair(): CryptoKeyPair;

    /**
     * Generates a shared symmetric key from a public key and a secret key.
     * Uses Diffie-Hellman key exchange principles.
     *
     * @param publicKey - Other party's public key
     * @param secretKey - Local party's secret key
     * @returns Shared symmetric key as Uint8Array
     */
    generateSharedSymmetricKey(publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;

    /**
     * Encrypts data using a symmetric key.
     *
     * @param data - Data to encrypt
     * @param secretKey - Symmetric key for encryption
     * @returns Encrypted data as Uint8Array
     */
    encrypt(data: Uint8Array, secretKey: Uint8Array): Uint8Array;

    /**
     * Decrypts data using a symmetric key.
     *
     * @param data - Encrypted data
     * @param secretKey - Symmetric key for decryption
     * @returns Decrypted data as Uint8Array
     */
    decrypt(data: Uint8Array, secretKey: Uint8Array): Uint8Array;
}

/**
 * Factory function that creates and returns an implementation of the Cryptography interface.
 * Uses TweetNaCl.js library for the underlying cryptographic operations.
 *
 * @param logger - Logger instance for error reporting
 * @returns An implementation of the Cryptography interface
 */
export function getCryptography(logger: Logger): Cryptography {
    return {
        sign(data: Uint8Array, secretKey: Uint8Array): Uint8Array {
            return naclSign.detached(data, secretKey);
        },
        verifySignature(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
            return naclSign.detached.verify(data, signature, publicKey);
        },
        generateSigningKeyPair(): CryptoKeyPair {
            return naclSign.keyPair();
        },
        generateEncryptionKeyPair(): CryptoKeyPair {
            return box.keyPair();
        },
        generateSharedSymmetricKey(publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array {
            return box.before(publicKey, secretKey);
        },
        encrypt(data: Uint8Array, secretKey: Uint8Array): Uint8Array {
            const nonce = randomBytes(secretbox.nonceLength);
            const ciphertext = secretbox(data, nonce, secretKey);
            if (!ciphertext) {
                throw newError(logger, '[cryptography] Encryption failed.');
            }
            const encrypted = new Uint8Array(nonce.length + ciphertext.length);
            encrypted.set(nonce);
            encrypted.set(ciphertext, nonce.length);
            return encrypted;
        },
        decrypt(data: Uint8Array, secretKey: Uint8Array): Uint8Array {
            const nonce = data.slice(0, secretbox.nonceLength);
            const ciphertext = data.slice(secretbox.nonceLength);
            const decrypted = secretbox_open(ciphertext, nonce, secretKey);
            if (!decrypted) {
                throw newError(logger, '[cryptography] Failed to decrypt data.');
            }
            return decrypted;
        },
    };
}
