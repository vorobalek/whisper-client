import { createMockLogger } from '../../__mocks__/test-utils';
import { newError } from '../../src/utils/new-error';

describe('newError utility', () => {
    let logger: ReturnType<typeof createMockLogger>;
    beforeEach(() => {
        logger = createMockLogger();
    });

    it('should create a new Error with the given message and log it', () => {
        // Given
        const errorMessage = 'Test error message';

        // When
        const error = newError(logger, errorMessage);

        // Then
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(errorMessage);
        expect(logger.error).toHaveBeenCalledWith(error);
    });

    it('should handle undefined message', () => {
        // When
        const error = newError(logger);

        // Then
        expect(error).toBeInstanceOf(Error);
        // JavaScript Error constructor converts undefined to empty string
        expect(error.message).toBe('');
        expect(logger.error).toHaveBeenCalledWith(error);
    });
});
