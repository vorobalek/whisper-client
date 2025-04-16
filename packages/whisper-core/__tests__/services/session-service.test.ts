import { createMockLogger, createMockBase64, createMockKeyPair } from '../../__mocks__/test-utils';
import { getSessionService, SessionServiceConfig } from '../../src/services/session-service';
import { Base64 } from '../../src/utils/base64';
import { CryptoKeyPair } from '../../src/utils/cryptography';
import { Logger } from '../../src/utils/logger';
import { newError } from '../../src/utils/new-error';

// Mock the dependencies
jest.mock('../../src/utils/new-error', () => ({
    newError: jest.fn().mockImplementation((logger, message) => new Error(message)),
}));

describe('SessionService', () => {
    let sessionService: ReturnType<typeof getSessionService>;
    let mockLogger: Logger;
    let mockBase64: Base64;
    let mockKeyPair: CryptoKeyPair;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockBase64 = createMockBase64({ '1,2,3': 'encoded-public-key' });
        mockKeyPair = createMockKeyPair();
        sessionService = getSessionService(mockLogger, mockBase64);
    });

    describe('initialize', () => {
        it('should accept a valid signing key pair', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: mockKeyPair,
            };

            // When
            await sessionService.initialize(config);

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[session-service] Signing key pair found.');
        });

        it('should throw error when signing key pair is undefined', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: undefined as unknown as CryptoKeyPair,
            };

            // When/Then
            await expect(sessionService.initialize(config)).rejects.toThrow(
                '[session-service] Failed to initialize. Incomplete signing key pair.',
            );
            expect(newError).toHaveBeenCalledWith(
                mockLogger,
                '[session-service] Failed to initialize. Incomplete signing key pair.',
            );
        });

        it('should throw error when signing key pair is null', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: null as unknown as CryptoKeyPair,
            };

            // When/Then
            await expect(sessionService.initialize(config)).rejects.toThrow(
                '[session-service] Failed to initialize. Incomplete signing key pair.',
            );
            expect(newError).toHaveBeenCalledWith(
                mockLogger,
                '[session-service] Failed to initialize. Incomplete signing key pair.',
            );
        });
    });

    describe('signingKeyPair getter', () => {
        it('should return the signing key pair when initialized', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: mockKeyPair,
            };
            await sessionService.initialize(config);

            // When
            const result = sessionService.signingKeyPair;

            // Then
            expect(result).toBe(mockKeyPair);
        });

        it('should throw error when accessed before initialization', () => {
            // When/Then
            expect(() => sessionService.signingKeyPair).toThrow(
                '[session-service] Sign key pair has not initialized yet.',
            );
            expect(newError).toHaveBeenCalledWith(
                mockLogger,
                '[session-service] Sign key pair has not initialized yet.',
            );
        });
    });

    describe('signingPublicKeyBase64 getter', () => {
        it('should return the encoded public key when initialized', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: mockKeyPair,
            };
            await sessionService.initialize(config);

            // When
            const result = sessionService.signingPublicKeyBase64;

            // Then
            expect(mockBase64.encode).toHaveBeenCalledWith(mockKeyPair.publicKey);
            expect(result).toBe('encoded-public-key');
        });

        it('should throw error when accessed before initialization', () => {
            // When/Then
            expect(() => sessionService.signingPublicKeyBase64).toThrow(
                '[session-service] Sign key pair has not initialized yet.',
            );
            expect(newError).toHaveBeenCalledWith(
                mockLogger,
                '[session-service] Sign key pair has not initialized yet.',
            );
        });
    });

    describe('signingPublicKeyBase64Safe getter', () => {
        it('should return the encoded public key when initialized', async () => {
            // Given
            const config: SessionServiceConfig = {
                signingKeyPair: mockKeyPair,
            };
            await sessionService.initialize(config);

            // When
            const result = sessionService.signingPublicKeyBase64Safe;

            // Then
            expect(mockBase64.encode).toHaveBeenCalledWith(mockKeyPair.publicKey);
            expect(result).toBe('encoded-public-key');
        });

        it('should return undefined when accessed before initialization', () => {
            // When
            const result = sessionService.signingPublicKeyBase64Safe;

            // Then
            expect(result).toBeUndefined();
            expect(mockBase64.encode).not.toHaveBeenCalled();
        });
    });
});
