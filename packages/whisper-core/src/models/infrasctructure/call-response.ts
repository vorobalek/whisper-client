/**
 * Interface representing a response from the signaling server to a call request.
 * Contains status information and timing data about the processed request.
 */
export interface CallResponse {
    /**
     * Boolean flag indicating if the request was successfully processed.
     * True indicates success, false indicates failure.
     */
    ok: boolean;

    /**
     * Server timestamp when the response was generated.
     * Used for synchronization and validating response freshness.
     */
    timestamp: number;

    /**
     * Optional text description explaining the reason for failure.
     * Present only when 'ok' is false.
     */
    reason?: string;

    /**
     * Optional array of specific error messages when multiple issues occurred.
     * Provides detailed diagnostics for troubleshooting.
     */
    errors?: string[];
}
