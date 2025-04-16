import { Logger } from './logger';

/**
 * Creates a new Error object and logs it through the provided logger.
 * This utility function ensures all errors are properly logged before being thrown.
 *
 * @param logger - The logger instance used to record the error
 * @param message - Optional message describing the error
 * @returns A new Error object with the provided message
 */
export function newError(logger: Logger, message?: string): Error {
    const error = new Error(message);
    logger.error(error);
    return error;
}
