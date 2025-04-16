import { createMockLogger } from '../../__mocks__/test-utils';
import { getCryptography } from '../../src/utils/cryptography';
import { Logger } from '../../src/utils/logger';
import { sign, box, secretbox } from '../../src/utils/nacl-wrapper';

describe('Cryptography utility', () => {
    let cryptography: ReturnType<typeof getCryptography>;
    let mockLogger: Logger;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = createMockLogger();
        cryptography = getCryptography(mockLogger);
    });

    describe('sign', () => {
        it('should sign data with a secret key', () => {
            // Given
            const data = new Uint8Array([1, 2, 3, 4]);
            const keyPair = sign.keyPair();

            // When
            const signature = cryptography.sign(data, keyPair.secretKey);

            // Then
            expect(signature).toBeInstanceOf(Uint8Array);
            expect(signature.length).toBe(64); // nacl signatures are 64 bytes

            // Verify the signature works with nacl's verify
            const isValid = sign.detached.verify(data, signature, keyPair.publicKey);
            expect(isValid).toBe(true);
        });
    });

    describe('verifySignature', () => {
        it('should verify a valid signature', () => {
            // Given
            const data = new Uint8Array([1, 2, 3, 4]);
            const keyPair = sign.keyPair();
            const signature = sign.detached(data, keyPair.secretKey);

            // When
            const result = cryptography.verifySignature(data, signature, keyPair.publicKey);

            // Then
            expect(result).toBe(true);
        });

        it('should reject an invalid signature', () => {
            // Given
            const data = new Uint8Array([1, 2, 3, 4]);
            const keyPair = sign.keyPair();
            const wrongKeyPair = sign.keyPair();
            const signature = sign.detached(data, wrongKeyPair.secretKey);

            // When
            const result = cryptography.verifySignature(data, signature, keyPair.publicKey);

            // Then
            expect(result).toBe(false);
        });

        it('should reject if data has been tampered with', () => {
            // Given
            const originalData = new Uint8Array([1, 2, 3, 4]);
            const tamperedData = new Uint8Array([1, 2, 3, 5]); // Changed last byte
            const keyPair = sign.keyPair();
            const signature = sign.detached(originalData, keyPair.secretKey);

            // When
            const result = cryptography.verifySignature(tamperedData, signature, keyPair.publicKey);

            // Then
            expect(result).toBe(false);
        });
    });

    describe('generateSigningKeyPair', () => {
        it('should generate a valid signing key pair', () => {
            // When
            const keyPair = cryptography.generateSigningKeyPair();

            // Then
            expect(keyPair).toBeDefined();
            expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.publicKey.length).toBe(32); // nacl signing public keys are 32 bytes
            expect(keyPair.secretKey.length).toBe(64); // nacl signing secret keys are 64 bytes

            // Verify we can use the key pair to sign and verify
            const data = new Uint8Array([1, 2, 3, 4]);
            const signature = cryptography.sign(data, keyPair.secretKey);
            const isValid = cryptography.verifySignature(data, signature, keyPair.publicKey);
            expect(isValid).toBe(true);
        });
    });

    describe('generateEncryptionKeyPair', () => {
        it('should generate a valid encryption key pair', () => {
            // When
            const keyPair = cryptography.generateEncryptionKeyPair();

            // Then
            expect(keyPair).toBeDefined();
            expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);
            expect(keyPair.publicKey.length).toBe(32); // nacl box public keys are 32 bytes
            expect(keyPair.secretKey.length).toBe(32); // nacl box secret keys are 32 bytes
        });
    });

    describe('generateSharedSymmetricKey', () => {
        it('should generate a shared key that both parties can derive', () => {
            // Given
            const aliceKeyPair = cryptography.generateEncryptionKeyPair();
            const bobKeyPair = cryptography.generateEncryptionKeyPair();

            // When - Alice derives the shared key
            const aliceSharedKey = cryptography.generateSharedSymmetricKey(
                bobKeyPair.publicKey,
                aliceKeyPair.secretKey,
            );

            // When - Bob derives the shared key
            const bobSharedKey = cryptography.generateSharedSymmetricKey(aliceKeyPair.publicKey, bobKeyPair.secretKey);

            // Then - Both derived shared keys should be identical
            expect(aliceSharedKey).toEqual(bobSharedKey);
            expect(aliceSharedKey.length).toBe(32); // nacl shared keys are 32 bytes
        });
    });

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt data correctly', () => {
            // Given
            const originalData = new Uint8Array([1, 2, 3, 4, 5]);
            const keyPair = cryptography.generateEncryptionKeyPair();
            const sharedKey = cryptography.generateSharedSymmetricKey(keyPair.publicKey, keyPair.secretKey);

            // When - Encrypt
            const encrypted = cryptography.encrypt(originalData, sharedKey);

            // Then - Should be longer than original due to nonce
            expect(encrypted.length).toBeGreaterThan(originalData.length);
            expect(encrypted.length).toBe(originalData.length + secretbox.nonceLength + 16); // +16 for the auth tag

            // When - Decrypt
            const decrypted = cryptography.decrypt(encrypted, sharedKey);

            // Then - Should match original data
            expect(decrypted).toEqual(originalData);
        });

        it('should throw an error when encryption fails', () => {
            jest.resetModules();
            jest.doMock('../../src/utils/nacl-wrapper', () => ({
                ...jest.requireActual('../../src/utils/nacl-wrapper'),
                secretbox: jest.fn(() => null),
            }));
            const { getCryptography } = require('../../src/utils/cryptography');
            const cryptographyWithMock = getCryptography(mockLogger);
            const originalData = new Uint8Array([1, 2, 3, 4, 5]);
            const secretKey = new Uint8Array(32);
            expect(() => {
                cryptographyWithMock.encrypt(originalData, secretKey);
            }).toThrow('[cryptography] Encryption failed.');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should throw an error when decryption fails due to wrong key', () => {
            // Given
            const originalData = new Uint8Array([1, 2, 3, 4, 5]);
            const correctKeyPair = cryptography.generateEncryptionKeyPair();
            const wrongKeyPair = cryptography.generateEncryptionKeyPair();

            const correctSharedKey = cryptography.generateSharedSymmetricKey(
                correctKeyPair.publicKey,
                correctKeyPair.secretKey,
            );

            const wrongSharedKey = cryptography.generateSharedSymmetricKey(
                wrongKeyPair.publicKey,
                wrongKeyPair.secretKey,
            );

            // When - Encrypt with correct key
            const encrypted = cryptography.encrypt(originalData, correctSharedKey);

            // Then - Decrypt with wrong key should throw
            expect(() => {
                cryptography.decrypt(encrypted, wrongSharedKey);
            }).toThrow('[cryptography] Failed to decrypt data.');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should throw an error when decryption fails due to data tampering', () => {
            // Given
            const originalData = new Uint8Array([1, 2, 3, 4, 5]);
            const keyPair = cryptography.generateEncryptionKeyPair();
            const sharedKey = cryptography.generateSharedSymmetricKey(keyPair.publicKey, keyPair.secretKey);

            // When - Encrypt
            const encrypted = cryptography.encrypt(originalData, sharedKey);

            // Tamper with the encrypted data (not the nonce part)
            const tampered = new Uint8Array(encrypted);
            tampered[secretbox.nonceLength + 1] ^= 1; // Flip a bit

            // Then - Decrypt with tampered data should throw
            expect(() => {
                cryptography.decrypt(tampered, sharedKey);
            }).toThrow('[cryptography] Failed to decrypt data.');
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
