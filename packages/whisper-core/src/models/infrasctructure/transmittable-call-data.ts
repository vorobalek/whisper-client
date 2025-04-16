import { CallData } from './call-data';

/**
 * Extension of CallData that includes additional properties required for
 * call data that needs to be transmitted between parties.
 *
 * Includes timestamp and recipient information for validation and routing.
 */
export interface TransmittableCallData extends CallData {
    /**
     * Timestamp of when the call data was created.
     * Used for message freshness validation and preventing replay attacks.
     */
    b: number;

    /**
     * Public key of the intended recipient.
     * Used to ensure messages are only processed by the intended recipient.
     */
    c: string;
}
