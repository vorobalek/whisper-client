import { getLoggerService, LoggerServiceConfig } from '../../src/services/logger-service';

describe('LoggerService', () => {
    let loggerService: ReturnType<typeof getLoggerService>;
    let mockConfig: LoggerServiceConfig;

    beforeEach(() => {
        mockConfig = {
            onTrace: jest.fn(),
            onDebug: jest.fn(),
            onLog: jest.fn(),
            onWarn: jest.fn(),
            onError: jest.fn(),
        };
        loggerService = getLoggerService();
    });

    it('should initialize with config callbacks', () => {
        // When
        loggerService.initialize(mockConfig);

        // Then
        expect(mockConfig.onDebug).toHaveBeenCalledWith('[logger-service] Initialized.');
    });

    it('should call onTrace when trace is called', () => {
        // Given
        loggerService.initialize(mockConfig);
        const args = ['test message', { data: 'test' }];

        // When
        loggerService.trace(...args);

        // Then
        expect(mockConfig.onTrace).toHaveBeenCalledWith(...args);
    });

    it('should call onDebug when debug is called', () => {
        // Given
        loggerService.initialize(mockConfig);
        const args = ['test message', { data: 'test' }];

        // When
        loggerService.debug(...args);

        // Then
        expect(mockConfig.onDebug).toHaveBeenCalledWith(...args);
    });

    it('should call onLog when log is called', () => {
        // Given
        loggerService.initialize(mockConfig);
        const args = ['test message', { data: 'test' }];

        // When
        loggerService.log(...args);

        // Then
        expect(mockConfig.onLog).toHaveBeenCalledWith(...args);
    });

    it('should call onWarn when warn is called', () => {
        // Given
        loggerService.initialize(mockConfig);
        const args = ['test message', { data: 'test' }];

        // When
        loggerService.warn(...args);

        // Then
        expect(mockConfig.onWarn).toHaveBeenCalledWith(...args);
    });

    it('should call onError when error is called', () => {
        // Given
        loggerService.initialize(mockConfig);
        const args = ['test message', { data: 'test' }];

        // When
        loggerService.error(...args);

        // Then
        expect(mockConfig.onError).toHaveBeenCalledWith(...args);
    });

    it('should not throw if onTrace is not provided', () => {
        // Given
        const partialConfig: LoggerServiceConfig = {
            onDebug: jest.fn(),
            onLog: jest.fn(),
            onWarn: jest.fn(),
            onError: jest.fn(),
        };
        loggerService.initialize(partialConfig);

        // When/Then
        expect(() => loggerService.trace('test')).not.toThrow();
    });

    it('should not throw if onDebug is not provided', () => {
        // Given
        const partialConfig: LoggerServiceConfig = {
            onTrace: jest.fn(),
            onLog: jest.fn(),
            onWarn: jest.fn(),
            onError: jest.fn(),
        };
        loggerService.initialize(partialConfig);

        // When/Then
        expect(() => loggerService.debug('test')).not.toThrow();
    });

    it('should not throw if onLog is not provided', () => {
        // Given
        const partialConfig: LoggerServiceConfig = {
            onTrace: jest.fn(),
            onDebug: jest.fn(),
            onWarn: jest.fn(),
            onError: jest.fn(),
        };
        loggerService.initialize(partialConfig);

        // When/Then
        expect(() => loggerService.log('test')).not.toThrow();
    });

    it('should not throw if onWarn is not provided', () => {
        // Given
        const partialConfig: LoggerServiceConfig = {
            onTrace: jest.fn(),
            onDebug: jest.fn(),
            onLog: jest.fn(),
            onError: jest.fn(),
        };
        loggerService.initialize(partialConfig);

        // When/Then
        expect(() => loggerService.warn('test')).not.toThrow();
    });

    it('should not throw if onError is not provided', () => {
        // Given
        const partialConfig: LoggerServiceConfig = {
            onTrace: jest.fn(),
            onDebug: jest.fn(),
            onLog: jest.fn(),
            onWarn: jest.fn(),
        };
        loggerService.initialize(partialConfig);

        // When/Then
        expect(() => loggerService.error('test')).not.toThrow();
    });
});
