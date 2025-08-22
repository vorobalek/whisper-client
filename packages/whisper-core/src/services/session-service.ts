import { Base64 } from '../utils/base64';
import { CryptoKeyPair } from '../utils/cryptography';
import { Logger } from '../utils/logger';
import { newError } from '../utils/new-error';

/**
 * Configuration interface for the session service.
 * Defines the cryptographic keys required for session initialization.
 */
export type SessionServiceConfig = {
    /**
     * Cryptographic key pair used for signing operations.
     * Essential for verifying the identity of the current user.
     */
    signingKeyPair?: CryptoKeyPair;
};

/**
 * Service interface for managing user session information.
 * Provides access to the cryptographic identity of the current user.
 */
export interface SessionService {
    /**
     * Initializes the session service with the provided configuration.
     * Sets up the signing key pair for the current session.
     *
     * @param config - Configuration with the signing key pair
     * @returns Promise that resolves when initialization is complete
     * @throws Error if the signing key pair is missing
     */
    initialize(config: SessionServiceConfig): Promise<void>;

    /**
     * Gets the signing key pair for the current session.
     *
     * @returns The cryptographic key pair used for signing operations
     * @throws Error if the signing key pair has not been initialized
     */
    get signingKeyPair(): CryptoKeyPair;

    /**
     * Gets the Base64-encoded public signing key.
     * This is the user's public identity that can be shared with others.
     *
     * @returns The Base64-encoded public signing key
     * @throws Error if the signing key pair has not been initialized
     */
    get signingPublicKeyBase64(): string;

    /**
     * Gets the Base64-encoded public signing key, if available.
     * Returns undefined instead of throwing an error if the key is not initialized.
     *
     * @returns The Base64-encoded public signing key or undefined
     */
    get signingPublicKeyBase64Safe(): string | undefined;
}

/**
 * Factory function that creates and returns an implementation of the SessionService interface.
 * Manages the user's cryptographic identity throughout the application.
 *
 * @param logger - Logger instance for error and debugging information
 * @param base64 - Base64 utility for encoding/decoding operations
 * @returns An implementation of the SessionService interface
 */
export function getSessionService(logger: Logger, base64: Base64): SessionService {
    let signingKeyPair: CryptoKeyPair | undefined;
    return {
        async initialize(config: SessionServiceConfig): Promise<void> {
            if (config.signingKeyPair === undefined || config.signingKeyPair === null) {
                throw newError(logger, '[session-service] Failed to initialize. Incomplete signing key pair.');
            } else {
                signingKeyPair = config.signingKeyPair;
                logger.debug('[session-service] Signing key pair found.');
            }
        },
        get signingKeyPair(): CryptoKeyPair {
            if (!signingKeyPair) {
                throw newError(logger, '[session-service] Sign key pair has not initialized yet.');
            }
            return signingKeyPair;
        },
        get signingPublicKeyBase64(): string {
            if (!signingKeyPair) {
                throw newError(logger, '[session-service] Sign key pair has not initialized yet.');
            }

            return base64.encode(signingKeyPair.publicKey);
        },
        get signingPublicKeyBase64Safe(): string | undefined {
            return signingKeyPair && base64.encode(signingKeyPair.publicKey);
        },
    };
}
