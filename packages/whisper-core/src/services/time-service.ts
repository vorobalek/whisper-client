import { Logger } from '../utils/logger';

/**
 * Service interface for managing server time synchronization.
 * Provides methods to get and set the current server time, accounting for
 * the time difference between client and server.
 */
export interface TimeService {
    /**
     * Gets the current server time, adjusted for the client-server time delta.
     *
     * @returns Current server time in milliseconds
     */
    get serverTime(): number;

    /**
     * Sets the server time and calculates the delta with the local time.
     * This delta is then used to adjust future time calculations.
     *
     * @param value - The server time to synchronize with
     */
    set serverTime(value: number);
}

/**
 * Factory function that creates and returns an implementation of the TimeService interface.
 * Maintains the time difference between client and server for time synchronization.
 *
 * @param logger - Logger instance for debugging information
 * @returns An implementation of the TimeService interface
 */
export function getTimeService(logger: Logger): TimeService {
    let serverTimeDelta = 0;
    return {
        get serverTime(): number {
            return Date.now() + serverTimeDelta;
        },
        set serverTime(value: number) {
            serverTimeDelta = value - Date.now();
            logger.debug(`[time-service] Server time delta has been set to: ${serverTimeDelta}ms`);
        },
    };
}
