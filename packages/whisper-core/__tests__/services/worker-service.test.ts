import { createMockLogger, createMockNavigator, createMockServiceWorker } from '../../__mocks__/test-utils';
import { getWorkerService } from '../../src/services/worker-service';
import { Logger } from '../../src/utils/logger';

// Define locally for test type safety
type WorkerServiceEffectiveConfig = {
    version: string;
    onNewVersion?: () => void;
    navigator: Navigator;
};

describe('WorkerService', () => {
    let workerService: ReturnType<typeof getWorkerService>;
    let mockLogger: Logger;
    let mockRegister: jest.Mock;
    let mockAddEventListener: jest.Mock;
    let mockServiceWorker: any;
    let mockNavigator: any;

    beforeEach(() => {
        // Create mock logger
        mockLogger = createMockLogger();

        // Create service worker mocks
        mockRegister = jest.fn();
        mockAddEventListener = jest.fn();
        mockServiceWorker = createMockServiceWorker({
            register: mockRegister,
            addEventListener: mockAddEventListener,
        });
        mockNavigator = createMockNavigator({ serviceWorker: mockServiceWorker });

        // Reset mocks
        mockRegister.mockReset();
        mockAddEventListener.mockReset();
        mockRegister.mockResolvedValue({ scope: 'http://localhost/' });

        // Create the service
        workerService = getWorkerService(mockLogger);
    });

    describe('initialize', () => {
        it('should register service worker with correct version', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: mockNavigator,
            };

            // When
            await workerService.initialize(config);

            // Then
            expect(mockRegister).toHaveBeenCalledWith('/service-worker.js?_=1.0.0');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[worker-service] Registered with scope:',
                'http://localhost/',
            );
            expect(mockLogger.debug).toHaveBeenCalledWith('[worker-service] Ready to use.');
            expect(mockLogger.debug).toHaveBeenCalledWith('[worker-service] Initialized.');
            // Explicitly check serviceWorker methods
            expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js?_=1.0.0');
            expect(mockNavigator.serviceWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should handle registration errors gracefully', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: mockNavigator,
            };
            const error = new Error('Registration failed');
            mockRegister.mockRejectedValue(error);

            // When
            await workerService.initialize(config);

            // Then
            expect(mockRegister).toHaveBeenCalledWith('/service-worker.js?_=1.0.0');
            expect(mockLogger.warn).toHaveBeenCalledWith('[worker-service] Error registering:', error);
            expect(mockLogger.debug).toHaveBeenCalledWith('[worker-service] Initialized.');
        });

        it('should handle browsers without service worker support', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: createMockNavigator({}), // No serviceWorker property
            } as any;

            // When
            await workerService.initialize(config);

            // Then
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[worker-service] Service Worker is not supported in this browser.',
            );
        });

        it('should call onNewVersion callback when receiving message', async () => {
            // Given
            const mockCallback = jest.fn();
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: mockNavigator,
                onNewVersion: mockCallback,
            };

            // When
            await workerService.initialize(config);

            // Then verify that event listener was added
            expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            // Simulate message event
            const handler = mockAddEventListener.mock.calls[0][1];
            handler({ data: { type: 'NEW_VERSION_AVAILABLE' } });

            // Verify callback was called
            expect(mockLogger.debug).toHaveBeenCalledWith('[worker-service] New version is available.');
            expect(mockCallback).toHaveBeenCalled();
        });

        it('should not call onNewVersion callback when receiving message with different type', async () => {
            // Given
            const mockCallback = jest.fn();
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: mockNavigator,
                onNewVersion: mockCallback,
            };

            // When
            await workerService.initialize(config);

            // Then verify that event listener was added
            expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            // Simulate message event with different type
            const handler = mockAddEventListener.mock.calls[0][1];
            handler({ data: { type: 'SOME_OTHER_TYPE' } });

            // Verify callback was not called
            expect(mockLogger.debug).not.toHaveBeenCalledWith('[worker-service] New version is available.');
            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('should not throw if onNewVersion is not provided and NEW_VERSION_AVAILABLE message is received', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = {
                version: '1.0.0',
                navigator: mockNavigator,
            };

            // When
            await workerService.initialize(config);

            // Then verify that event listener was added
            expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            // Simulate message event with NEW_VERSION_AVAILABLE, but no onNewVersion
            const handler = mockAddEventListener.mock.calls[0][1];
            expect(() => handler({ data: { type: 'NEW_VERSION_AVAILABLE' } })).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('[worker-service] New version is available.');
        });
    });

    describe('getters', () => {
        it('should return the correct registration value', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = { version: '1.0.0', navigator: mockNavigator };

            // When
            await workerService.initialize(config);

            // Then
            expect(workerService.registration).toEqual({ scope: 'http://localhost/' });
        });

        it('should return the correct container value', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = { version: '1.0.0', navigator: mockNavigator };

            // When
            await workerService.initialize(config);

            // Then
            expect(workerService.container).toBe(mockServiceWorker);
        });

        it('should return the correct controller value', async () => {
            // Given
            const config: WorkerServiceEffectiveConfig = { version: '1.0.0', navigator: mockNavigator };

            // When
            await workerService.initialize(config);

            // Then
            expect(workerService.controller).toBe(mockServiceWorker.controller);
        });
    });
});
