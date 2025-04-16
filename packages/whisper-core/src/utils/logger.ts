/**
 * Interface for structured logging functionality within the application.
 * Provides methods for logging at different severity levels.
 */
export interface Logger {
    /**
     * Records verbose trace information for detailed debugging purposes.
     * @param args - Arguments to be logged
     */
    trace(...args: any[]): void;

    /**
     * Records debug information useful during development.
     * @param args - Arguments to be logged
     */
    debug(...args: any[]): void;

    /**
     * Records general informational messages about system operation.
     * @param args - Arguments to be logged
     */
    log(...args: any[]): void;

    /**
     * Records warnings that don't prevent the application from functioning
     * but indicate potential issues.
     * @param args - Arguments to be logged
     */
    warn(...args: any[]): void;

    /**
     * Records error conditions that may impact application functionality.
     * @param args - Arguments to be logged
     */
    error(...args: any[]): void;
}
