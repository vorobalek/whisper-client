/**
 * Base interface for all call data objects used in communication protocols.
 * Defines the common structure that all call data must implement.
 */
export interface CallData {
    /**
     * Signing public key of the sender.
     * Used for identity verification and message authentication.
     */
    a: string;
}
