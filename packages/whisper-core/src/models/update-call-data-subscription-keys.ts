/**
 * Interface representing the cryptographic keys used in Web Push Protocol.
 * These keys are essential for the encryption of push notification payloads,
 * ensuring secure delivery of messages through public push services.
 */
export interface UpdateCallDataSubscriptionKeys {
    /**
     * The P-256 Diffie-Hellman public key.
     * Used by the push service for encrypting the message data.
     */
    a: string;

    /**
     * Authentication secret.
     * Used to authenticate the sender and prevent unauthorized notifications.
     */
    b: string;
}
