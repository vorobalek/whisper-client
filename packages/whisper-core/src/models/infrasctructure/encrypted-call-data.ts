import { EncryptionHolderCallData } from './encryption-holder-call-data';

/**
 * Interface for call data that contains encrypted payload information.
 * Extends EncryptionHolderCallData to include the encrypted data property.
 */
export interface EncryptedCallData extends EncryptionHolderCallData {
    /**
     * Base64-encoded encrypted data payload.
     * Contains information that has been encrypted for secure transmission.
     */
    e: string;
}
