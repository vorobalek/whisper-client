import {
    createMockKeyPair,
    createMockLogger,
    createMockWhisperConfig,
    mockWhisperCoreServices,
    setupWhisperBrowserMocks,
    teardownWhisperBrowserMocks,
} from '../__mocks__/test-utils';
import { ConnectionState, Whisper, WhisperPrototype } from '../src';
import { Logger } from '../src/utils/logger';

const mockNavigator = { serviceWorker: {} };

// Centralized mocks for all services and browser APIs
mockWhisperCoreServices();
setupWhisperBrowserMocks();

describe('Whisper', () => {
    let whisperPrototype: WhisperPrototype;
    let mockLogger: Logger;

    beforeEach(() => {
        jest.resetModules();
        mockWhisperCoreServices();
        jest.clearAllMocks();

        mockLogger = createMockLogger();

        // Re-require whisper after mocks are set up
        const { getPrototype } = require('../src/whisper');
        whisperPrototype = getPrototype(mockLogger);
    });

    afterAll(() => {
        teardownWhisperBrowserMocks();
    });

    describe('getPrototype', () => {
        it('should create a WhisperPrototype instance', () => {
            expect(whisperPrototype).toBeDefined();
            expect(whisperPrototype.initialize).toBeInstanceOf(Function);
            expect(whisperPrototype.generateSigningKeyPair).toBeInstanceOf(Function);
        });
    });

    describe('initialize', () => {
        const mockKeyPair = createMockKeyPair();
        const mockConfig = createMockWhisperConfig({ signingKeyPair: mockKeyPair, navigator: mockNavigator });

        it('should initialize all services in the correct order', async () => {
            const whisper = await whisperPrototype.initialize(mockConfig);

            // All required services should be initialized
            const { getWorkerService } = require('../src/services/worker-service');
            const { getSessionService } = require('../src/services/session-service');
            const { getPushService } = require('../src/services/push-service');
            const { getSignalRService } = require('../src/services/signalr-service');
            const { getHandleService } = require('../src/services/handle-service');
            const { getConnectionService } = require('../src/services/connection-service');
            const { getCallService } = require('../src/services/call-service');

            // For services that don't directly use webRTC
            expect(getWorkerService().initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverUrl: 'https://test-server.com',
                    onCall: expect.any(Function),
                    onReady: expect.any(Function),
                    focusOnDial: expect.any(Function),
                    requestDial: expect.any(Function),
                    version: '1.0.0',
                    signingKeyPair: expect.any(Object),
                    vapidKey: 'test-vapid-key',
                    iceServers: [{ urls: 'stun:test.com' }],
                    // navigator intentionally omitted
                }),
            );
            expect(getSessionService().initialize).toHaveBeenCalledWith(mockConfig);
            expect(getPushService().initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockConfig,
                    onCall: expect.any(Function),
                }),
            );
            expect(getSignalRService().initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockConfig,
                    onCall: expect.any(Function),
                    onReady: expect.any(Function),
                }),
            );
            expect(getHandleService().initialize).toHaveBeenCalledWith(mockConfig);

            // For the connectionService that includes webRTC
            expect(getConnectionService().initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockConfig,
                    webRTC: expect.objectContaining({
                        PeerConnection: expect.any(Function),
                        DataChannel: expect.any(Function),
                    }),
                }),
            );

            expect(getCallService().initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverUrl: 'https://test-server.com',
                    onCall: expect.any(Function),
                    onReady: expect.any(Function),
                    focusOnDial: expect.any(Function),
                    requestDial: expect.any(Function),
                    version: '1.0.0',
                    signingKeyPair: expect.any(Object),
                    vapidKey: 'test-vapid-key',
                    iceServers: [{ urls: 'stun:test.com' }],
                    // navigator intentionally omitted
                }),
            );

            // Check that the worker message was sent
            const workerService = getWorkerService();
            expect(workerService.controller.postMessage).toHaveBeenCalledWith({ type: 'CLIENT_READY' });

            // Check that the logger was called with initialization complete
            expect(mockLogger.log).toHaveBeenCalledWith('[whisper] Initialized.');

            // Check the Whisper interface
            expect(whisper.publicKey).toBe('test-public-key-safe');
            expect(whisper.serverTime).toBe(12345);
            expect(whisper.connections).toEqual([]);
            expect(typeof whisper.get).toBe('function');
            expect(typeof whisper.delete).toBe('function');
            expect(typeof whisper.showNotification).toBe('function');
        });

        it('should handle parallel initialization attempts', async () => {
            // Start two initializations in parallel
            const promise1 = whisperPrototype.initialize(mockConfig);
            const promise2 = whisperPrototype.initialize(mockConfig);

            // Both should resolve to the same instance
            const [whisper1, whisper2] = await Promise.all([promise1, promise2]);
            expect(whisper1).toBe(whisper2);
            expect(mockLogger.warn).toHaveBeenCalledWith('[whisper] Parallel initialization attempt.');
            expect(mockLogger.log).toHaveBeenCalledWith('[whisper] Initialized.');
        });

        it('should set up a periodic update call', async () => {
            const whisper = await whisperPrototype.initialize(mockConfig);

            const { getCallService } = require('../src/services/call-service');
            const callService = getCallService();

            // Reset the mocks after initialization
            callService.update.mockClear();

            // Fast-forward time to trigger the interval
            jest.advanceTimersByTime(60 * 1000);

            // Check that update was called at least once (don't test exact count)
            expect(callService.update).toHaveBeenCalledWith('test-public-key', expect.anything());
        });

        it('should handle case when push subscription is not available', async () => {
            // Mock a missing subscription
            const { getPushService } = require('../src/services/push-service');
            getPushService().getSubscription.mockResolvedValueOnce(undefined);

            const mockOnMayWorkUnstably = jest.fn().mockResolvedValue(undefined);
            const configWithCallback = {
                ...mockConfig,
                onMayWorkUnstably: mockOnMayWorkUnstably,
            };

            const whisper = await whisperPrototype.initialize(configWithCallback);

            expect(mockOnMayWorkUnstably).toHaveBeenCalledWith(
                'Due to notifications unavailable, Whisper Messenger may work unstably.',
            );
        });

        it('should not call onMayWorkUnstably when push subscription is available', async () => {
            // Mock an available subscription
            const { getPushService } = require('../src/services/push-service');
            getPushService().getSubscription.mockResolvedValueOnce({ endpoint: 'test-endpoint' });

            const mockOnMayWorkUnstably = jest.fn().mockResolvedValue(undefined);
            const configWithCallback = {
                ...mockConfig,
                onMayWorkUnstably: mockOnMayWorkUnstably,
            };

            const whisper = await whisperPrototype.initialize(configWithCallback);

            expect(mockOnMayWorkUnstably).not.toHaveBeenCalled();
        });

        it('should not throw if push subscription is not available and onMayWorkUnstably is not provided', async () => {
            const { getPushService } = require('../src/services/push-service');
            getPushService().getSubscription.mockResolvedValueOnce(undefined);

            const whisper = await whisperPrototype.initialize(mockConfig);
            expect(whisper).toBeDefined();
            expect(mockLogger.log).toHaveBeenCalledWith('[whisper] Initialized.');
        });
    });

    describe('generateSigningKeyPair', () => {
        it('should call cryptography.generateSigningKeyPair', () => {
            const { getCryptography } = require('../src/utils/cryptography');
            const cryptography = getCryptography();

            const result = whisperPrototype.generateSigningKeyPair();

            expect(cryptography.generateSigningKeyPair).toHaveBeenCalled();
            expect(result).toEqual({ publicKey: expect.any(Uint8Array), secretKey: expect.any(Uint8Array) });
        });
    });

    describe('Whisper interface', () => {
        let whisper: Whisper;

        beforeEach(async () => {
            const mockKeyPair = createMockKeyPair();
            const mockConfig = createMockWhisperConfig({ signingKeyPair: mockKeyPair, navigator: mockNavigator });
            whisper = await whisperPrototype.initialize(mockConfig);
        });

        describe('get', () => {
            it('should return existing connection if found', () => {
                const { getConnectionService } = require('../src/services/connection-service');
                const mockConnection = { publicKey: 'test-key', state: ConnectionState.Open };
                getConnectionService().getConnection.mockReturnValueOnce(mockConnection);

                const result = whisper.get('test-key');

                expect(getConnectionService().getConnection).toHaveBeenCalledWith('test-key');
                expect(result).toEqual(
                    expect.objectContaining({
                        publicKey: 'test-key',
                        state: ConnectionState.Open,
                    }),
                );
            });

            it('should create new outgoing connection if not found', () => {
                const { getConnectionService } = require('../src/services/connection-service');
                getConnectionService().getConnection.mockReturnValueOnce(undefined);
                const mockNewConnection = { publicKey: 'test-key', state: ConnectionState.New };
                getConnectionService().createOutgoing.mockReturnValueOnce(mockNewConnection);

                const result = whisper.get('test-key');

                expect(getConnectionService().getConnection).toHaveBeenCalledWith('test-key');
                expect(getConnectionService().createOutgoing).toHaveBeenCalledWith('test-key');
                expect(result).toEqual(
                    expect.objectContaining({
                        publicKey: 'test-key',
                        state: ConnectionState.New,
                    }),
                );
            });
        });

        describe('delete', () => {
            it('should call connectionService.deleteConnection', () => {
                const { getConnectionService } = require('../src/services/connection-service');

                whisper.delete('test-key');

                expect(getConnectionService().deleteConnection).toHaveBeenCalledWith('test-key');
            });
        });

        describe('showNotification', () => {
            it('should call pushService.showNotification', () => {
                const { getPushService } = require('../src/services/push-service');

                const options = { body: 'Test notification body' };
                const result = whisper.showNotification('Test Title', options);

                expect(getPushService().showNotification).toHaveBeenCalledWith('Test Title', options);
                expect(result).toBe(true);
            });
        });

        describe('connections', () => {
            it('should return translated connections from connectionService', () => {
                const { getConnectionService } = require('../src/services/connection-service');
                const { translateConnection } = require('../src/services/connection/connection');

                const mockConnections = [
                    { publicKey: 'key1', state: ConnectionState.Open },
                    { publicKey: 'key2', state: ConnectionState.New },
                ];

                getConnectionService().connections = mockConnections;

                const result = whisper.connections;

                expect(translateConnection).toHaveBeenCalledTimes(2);
                expect(result.length).toBe(2);
                expect(result[0].publicKey).toBe('key1');
                expect(result[1].publicKey).toBe('key2');
            });
        });
    });
});
