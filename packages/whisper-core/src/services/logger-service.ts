/**
 * Configuration interface for the logger service.
 * Defines callback handlers for different log severity levels.
 */
export interface LoggerServiceConfig {
    /**
     * Handler for trace-level logs (most verbose).
     * Used for highly detailed debugging information.
     */
    onTrace?: (...args: any[]) => void;

    /**
     * Handler for debug-level logs.
     * Used for information useful during development and troubleshooting.
     */
    onDebug?: (...args: any[]) => void;

    /**
     * Handler for standard information logs.
     * Used for general operational information.
     */
    onLog?: (...args: any[]) => void;

    /**
     * Handler for warning-level logs.
     * Used for potentially problematic situations that don't prevent normal operation.
     */
    onWarn?: (...args: any[]) => void;

    /**
     * Handler for error-level logs.
     * Used for error conditions that may impact application functionality.
     */
    onError?: (...args: any[]) => void;
}

/**
 * Service for centralized logging throughout the application.
 * Provides methods for logging at different severity levels and
 * delegates to the appropriate handlers configured during initialization.
 */
export type LoggerService = {
    /**
     * Initializes the logger service with the provided configuration.
     * Sets up handlers for different log severity levels.
     *
     * @param config - Configuration with handlers for each log level
     */
    initialize(config: LoggerServiceConfig): void;

    /**
     * Records trace-level information for detailed debugging.
     *
     * @param args - Arguments to be logged
     */
    trace(...args: any[]): void;

    /**
     * Records debug information useful during development.
     *
     * @param args - Arguments to be logged
     */
    debug(...args: any[]): void;

    /**
     * Records general informational messages about system operation.
     *
     * @param args - Arguments to be logged
     */
    log(...args: any[]): void;

    /**
     * Records warnings that don't prevent normal operation.
     *
     * @param args - Arguments to be logged
     */
    warn(...args: any[]): void;

    /**
     * Records error conditions that may impact application functionality.
     *
     * @param args - Arguments to be logged
     */
    error(...args: any[]): void;
};

/**
 * Factory function that creates and returns an implementation of the LoggerService.
 * Provides a centralized logging mechanism with configurable handlers for each severity level.
 *
 * @returns An implementation of the LoggerService interface
 */
export function getLoggerService(): LoggerService {
    let onTrace: ((...args: any[]) => void) | undefined;
    let onDebug: ((...args: any[]) => void) | undefined;
    let onLog: ((...args: any[]) => void) | undefined;
    let onWarn: ((...args: any[]) => void) | undefined;
    let onError: ((...args: any[]) => void) | undefined;
    return {
        initialize(config: LoggerServiceConfig) {
            onTrace = config.onTrace;
            onDebug = config.onDebug;
            onLog = config.onLog;
            onWarn = config.onWarn;
            onError = config.onError;
            this.debug('[logger-service] Initialized.');
        },
        trace(...args: any[]) {
            if (onTrace) {
                onTrace(...args);
            }
        },
        debug(...args: any[]) {
            if (onDebug) {
                onDebug(...args);
            }
        },
        log(...args: any[]) {
            if (onLog) {
                onLog(...args);
            }
        },
        warn(...args: any[]) {
            if (onWarn) {
                onWarn(...args);
            }
        },
        error(...args: any[]) {
            if (onError) {
                onError(...args);
            }
        },
    };
}
