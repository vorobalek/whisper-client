import { TransmittableCallData } from './transmittable-call-data';

/**
 * Interface for call data that includes encryption key information.
 * Extends TransmittableCallData to include the public encryption key.
 */
export interface EncryptionHolderCallData extends TransmittableCallData {
    /**
     * Base64-encoded public encryption key.
     * Used for encrypting and decrypting sensitive information in the communication.
     */
    d: string;
}
