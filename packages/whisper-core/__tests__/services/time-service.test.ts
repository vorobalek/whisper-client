import { createMockLogger, mockDateNow, restoreDateNow } from '../../__mocks__/test-utils';
import { getTimeService, TimeService } from '../../src/services/time-service';
import { Logger } from '../../src/utils/logger';

describe('TimeService', () => {
    let timeService: TimeService;
    let mockLogger: Logger;
    let originalDateNow: typeof Date.now;

    beforeEach(() => {
        // Setup mock logger
        mockLogger = createMockLogger();

        // Save and mock Date.now using utility
        originalDateNow = Date.now;
        mockDateNow(1000);

        // Create time service
        timeService = getTimeService(mockLogger);
    });

    afterEach(() => {
        // Restore original Date.now using utility
        restoreDateNow(originalDateNow);
    });

    describe('serverTime getter', () => {
        it('should return current time when no delta is set', () => {
            // When
            const result = timeService.serverTime;

            // Then
            expect(Date.now).toHaveBeenCalled();
            expect(result).toBe(1000);
        });

        it('should return current time plus delta when delta is set', () => {
            // Given
            timeService.serverTime = 2000; // This sets delta to 1000 (2000 - 1000)

            // When
            const result = timeService.serverTime;

            // Then
            expect(Date.now).toHaveBeenCalled();
            expect(result).toBe(2000);
        });
    });

    describe('serverTime setter', () => {
        it('should set the server time delta correctly', () => {
            // Given
            const serverTime = 5000;

            // When
            timeService.serverTime = serverTime;

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[time-service] Server time delta has been set to: 4000ms');
            expect(timeService.serverTime).toBe(5000);
        });

        it('should update the server time delta when set multiple times', () => {
            // Given - first set to 5000 (delta 4000)
            timeService.serverTime = 5000;

            // When - then update to 3000 (delta 2000)
            timeService.serverTime = 3000;

            // Then
            expect(mockLogger.debug).toHaveBeenLastCalledWith(
                '[time-service] Server time delta has been set to: 2000ms',
            );
            expect(timeService.serverTime).toBe(3000);
        });

        it('should handle negative server time delta', () => {
            // Given - set to a time in the past
            timeService.serverTime = 500;

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[time-service] Server time delta has been set to: -500ms');
            expect(timeService.serverTime).toBe(500);
        });
    });

    it('should update serverTime correctly when Date.now changes', () => {
        // Given
        timeService.serverTime = 5000; // Set delta to 4000 (5000 - 1000)

        // When - time advances
        mockDateNow(2000);

        // Then - server time should be 6000 (2000 + 4000 delta)
        expect(timeService.serverTime).toBe(6000);
    });
});
