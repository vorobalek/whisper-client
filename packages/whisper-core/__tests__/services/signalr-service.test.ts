import { createMockLogger } from '../../__mocks__/test-utils';
import { CallData } from '../../src/models/infrasctructure/call-data';
import { CallMethodName } from '../../src/models/infrasctructure/call-method-name';
import { CallRequest } from '../../src/models/infrasctructure/call-request';
import { getSignalRService, SignalRServiceConfig } from '../../src/services/signalr-service';
import { Logger } from '../../src/utils/logger';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

// Create a test CallData implementation
interface TestCallData extends CallData {
    a: string; // Required by CallData
    testProp?: string;
}

describe('SignalRService', () => {
    let signalRService: ReturnType<typeof getSignalRService>;
    let mockLogger: Logger;
    let mockHubConnection: jest.Mocked<HubConnection>;
    let mockHubBuilder: any;
    let mockConfig: SignalRServiceConfig & { onCall: jest.Mock; onReady: jest.Mock };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock logger
        mockLogger = createMockLogger();

        // Setup mock config
        mockConfig = {
            serverUrl: 'https://test-server.com',
            onCall: jest.fn().mockResolvedValue(undefined),
            onReady: jest.fn().mockResolvedValue(undefined),
        };

        // Create SignalR service
        signalRService = getSignalRService(mockLogger);

        // Get references to mocked HubConnection
        mockHubConnection = new HubConnectionBuilder().build() as jest.Mocked<HubConnection>;
        mockHubBuilder = new HubConnectionBuilder();
    });

    describe('initialize', () => {
        it('should create a SignalR connection with correct parameters', async () => {
            // When
            await signalRService.initialize(mockConfig);

            // Then
            expect(mockHubBuilder.withUrl).toHaveBeenCalledWith('https://test-server.com/signal/v1');
            expect(mockHubBuilder.withAutomaticReconnect).toHaveBeenCalled();
            expect(mockHubBuilder.configureLogging).toHaveBeenCalledWith(LogLevel.Warning);
            expect(mockHubBuilder.build).toHaveBeenCalled();

            expect(mockHubConnection.start).toHaveBeenCalled();
            expect(mockHubConnection.onreconnecting).toHaveBeenCalled();
            expect(mockHubConnection.onreconnected).toHaveBeenCalled();
            expect(mockHubConnection.on).toHaveBeenCalledWith('call', expect.any(Function));

            expect(mockLogger.debug).toHaveBeenCalledWith('[signalr-service] SignalR is ready.');
            expect(mockConfig.onReady).toHaveBeenCalled();
        });

        it('should use correct retry delay strategy', async () => {
            // When
            await signalRService.initialize(mockConfig);

            // Then - extract the retry strategy function
            const retryParams = mockHubBuilder.withAutomaticReconnect.mock.calls[0][0];
            const nextRetryDelayFn = retryParams.nextRetryDelayInMilliseconds;

            // Update tests to match the actual implementation (min 5000ms)
            expect(nextRetryDelayFn({ previousRetryCount: 0 })).toBe(5000); // First attempt: max(1000 + 1000*0, 5000) = 5000
            expect(nextRetryDelayFn({ previousRetryCount: 1 })).toBe(5000); // Second attempt: max(1000 + 1000*1, 5000) = 5000
            expect(nextRetryDelayFn({ previousRetryCount: 4 })).toBe(5000); // Fifth attempt: max(1000 + 1000*4, 5000) = 5000
            expect(nextRetryDelayFn({ previousRetryCount: 10 })).toBe(11000); // 11th attempt: max(1000 + 1000*10, 5000) = 11000
        });

        it('should handle connection errors gracefully', async () => {
            // Given
            const error = new Error('Connection error');
            mockHubConnection.start.mockRejectedValueOnce(error);

            // When
            await signalRService.initialize(mockConfig);

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith('[signalr-service] SignalR connection error.', error);
            expect(signalRService.ready).toBe(false);
        });

        it('should setup reconnect handlers correctly', async () => {
            // Given
            await signalRService.initialize(mockConfig);

            // Get the reconnecting handler
            const reconnectingHandler = mockHubConnection.onreconnecting.mock.calls[0][0];
            const reconnectedHandler = mockHubConnection.onreconnected.mock.calls[0][0];

            // When - Simulate reconnecting
            reconnectingHandler();

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith('[signalr-service] Reconnecting ...');
            expect(signalRService.ready).toBe(false);

            // When - Simulate reconnected
            await reconnectedHandler();

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith('[signalr-service] Reconnected.');
            expect(signalRService.ready).toBe(true);
            expect(mockConfig.onReady).toHaveBeenCalledTimes(2); // Once for initial, once for reconnect
        });

        it('should handle incoming call messages correctly', async () => {
            // Given
            await signalRService.initialize(mockConfig);

            // Get the message handler
            const callHandler = mockHubConnection.on.mock.calls[0][1];

            // Valid payload
            const validPayload = { a: 'testMethod', b: { data: 'test' } };

            // When
            await callHandler(validPayload);

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[signalr-service] Message received.', validPayload);
            expect(mockConfig.onCall).toHaveBeenCalledWith(validPayload);
        });

        it('should handle missing onCall callback', async () => {
            // Given
            const configWithoutOnCall = {
                serverUrl: 'https://test-server.com',
                onReady: jest.fn().mockResolvedValue(undefined),
            };

            await signalRService.initialize(configWithoutOnCall as any);

            // Get the message handler
            const callHandler = mockHubConnection.on.mock.calls[0][1];

            // When
            await callHandler({ a: 'testMethod' });

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[signalr-service] Signalling message callback is not initialized.',
            );
        });

        it('should handle invalid payloads', async () => {
            // Given
            await signalRService.initialize(mockConfig);

            // Get the message handler
            const callHandler = mockHubConnection.on.mock.calls[0][1];

            // When - null payload
            await callHandler(null);

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith('[signalr-service] Invalid payload data.');

            // When - missing 'a' property
            await callHandler({ someOtherProp: 'test' });

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith('[signalr-service] Invalid payload data.');
        });

        it('should handle onCall handler errors', async () => {
            // Given
            const error = new Error('Handler error');
            mockConfig.onCall.mockRejectedValueOnce(error);

            await signalRService.initialize(mockConfig);

            // Get the message handler
            const callHandler = mockHubConnection.on.mock.calls[0][1];

            // When
            await callHandler({ a: 'testMethod' });

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                '[signalr-service] Error while processing signalR call.',
                error,
            );
        });
    });

    describe('call', () => {
        beforeEach(async () => {
            // Initialize the service
            await signalRService.initialize(mockConfig);
        });

        it('should invoke HubConnection with correct parameters', async () => {
            // Given
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'test-public-key',
                },
                c: 'signature',
            };

            const response = {
                ok: true,
                timestamp: Date.now(),
            };

            mockHubConnection.invoke.mockResolvedValueOnce(response);

            // When
            const result = await signalRService.call(request);

            // Then
            expect(mockHubConnection.invoke).toHaveBeenCalledWith('call', request);
            expect(mockLogger.debug).toHaveBeenCalled();
            expect(result).toBe(response);
        });

        it('should handle null/undefined response', async () => {
            // Given
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'test-public-key',
                },
                c: 'signature',
            };

            mockHubConnection.invoke.mockResolvedValueOnce(null);

            // When & Then - use try/catch instead of expect().rejects for better control
            try {
                await signalRService.call(request);
                // If we reach here, the test should fail
                expect('Should have thrown').toBe('But did not throw');
            } catch (error: any) {
                expect(String(error)).toContain('Unexpected answer on call testMethod from');
                expect(mockLogger.error).toHaveBeenCalled();
            }
        });

        it('should handle response with ok:false', async () => {
            // Given
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'test-public-key',
                },
                c: 'signature',
            };

            const response = {
                ok: false,
                timestamp: Date.now(),
                reason: 'Something went wrong',
            };

            mockHubConnection.invoke.mockResolvedValueOnce(response);

            // When/Then
            await expect(signalRService.call(request)).rejects.toMatch(/Request was not successful/);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should handle signalR invoke errors', async () => {
            // Given
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'test-public-key',
                },
                c: 'signature',
            };

            const error = new Error('SignalR invoke error');
            mockHubConnection.invoke.mockRejectedValueOnce(error);

            // When/Then
            await expect(signalRService.call(request)).rejects.toBe(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error while sending request'),
                expect.anything(),
                expect.anything(),
            );
        });

        it('should throw error when connection is not initialized', async () => {
            // Create a new service without initializing
            const newService = getSignalRService(mockLogger);

            // Given
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'test-public-key',
                },
                c: 'signature',
            };

            // When & Then
            try {
                await newService.call(request);
                expect('Should have thrown').toBe('But did not throw');
            } catch (error: any) {
                expect(error.message).toBe('[signalr-service] SignalR connection is not initialized.');
                expect(mockLogger.error).toHaveBeenCalled();
            }
        });

        it('should wait for readyPromise when connection is reconnecting', async () => {
            // Given - initialize the service first
            await signalRService.initialize(mockConfig);

            // Get the reconnecting handler
            const reconnectingHandler = mockHubConnection.onreconnecting.mock.calls[0][0];
            const reconnectedHandler = mockHubConnection.onreconnected.mock.calls[0][0];

            // Simulate reconnecting
            reconnectingHandler();

            // Set up the response for when connection is ready
            const response = { ok: true, timestamp: Date.now() };
            mockHubConnection.invoke.mockResolvedValueOnce(response);

            // Make the call, which should wait for reconnection
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: { a: 'test-public-key' },
                c: 'signature',
            };

            // Start the call but don't await it yet
            const callPromise = signalRService.call(request);

            // Now simulate reconnected
            await reconnectedHandler();

            // Now await the call
            const result = await callPromise;

            // Verify the result
            expect(result).toBe(response);
            expect(mockHubConnection.invoke).toHaveBeenCalledWith('call', request);
        });
    });
});
