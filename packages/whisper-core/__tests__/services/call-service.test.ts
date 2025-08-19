import {
    createMockBase64,
    createMockCryptography,
    createMockLogger,
    createMockSessionService,
    createMockTimeService,
    createMockUtf8,
} from '../../__mocks__/test-utils';
import { IceSource } from '../../src/models/ice-source';
import { CallResponse } from '../../src/models/infrasctructure/call-response';
import { getCallService } from '../../src/services/call-service';
import { SessionService } from '../../src/services/session-service';
import { SignalRService } from '../../src/services/signalr-service';
import { TimeService } from '../../src/services/time-service';
import { ApiClient } from '../../src/utils/api-client';
import { Base64 } from '../../src/utils/base64';
import { Cryptography } from '../../src/utils/cryptography';
import { Logger } from '../../src/utils/logger';
import { Utf8 } from '../../src/utils/utf8';

let mockNavigator: any = { sendBeacon: jest.fn() };
type CallServiceEffectiveConfig = {
    serverUrl?: string;
    navigator: Navigator;
};

describe('CallService', () => {
    let callService: ReturnType<typeof getCallService>;
    let mockLogger: Logger;
    let mockTimeService: TimeService;
    let mockSessionService: SessionService;
    let mockApiClient: ApiClient;
    let mockSignalRService: SignalRService;
    let mockBase64: Base64;
    let mockUtf8: Utf8;
    let mockCryptography: Cryptography;

    // Mock response
    const mockResponse: CallResponse = {
        ok: true,
        timestamp: 123456789,
    };

    // Test data
    const publicKey = 'test-public-key';
    const peerPublicKey = 'test-peer-public-key';
    const encryptionPublicKey = 'test-encryption-public-key';
    const encryptedData = new Uint8Array([1, 2, 3, 4]);
    const encodedData = 'AQIDBA==';
    const signature = 'test-signature';

    beforeEach(() => {
        // Create mock dependencies
        mockLogger = createMockLogger();
        mockTimeService = createMockTimeService();
        mockSessionService = createMockSessionService();
        mockApiClient = {
            call: jest.fn().mockResolvedValue(mockResponse),
        };
        mockSignalRService = {
            initialize: jest.fn().mockResolvedValue(undefined),
            get ready() {
                return true;
            },
            call: jest.fn().mockResolvedValue(mockResponse),
        };
        mockBase64 = createMockBase64({ '1,2,3,4': 'AQIDBA==' });
        mockUtf8 = createMockUtf8();
        mockCryptography = createMockCryptography();

        // Create the service
        callService = getCallService(
            mockLogger,
            mockTimeService,
            mockSessionService,
            mockApiClient,
            mockSignalRService,
            mockBase64,
            mockUtf8,
            mockCryptography,
        );

        // Initialize with server URL
        callService.initialize({ serverUrl: 'https://test-server.com', navigator: mockNavigator });
    });

    describe('initialize', () => {
        it('should log debug message when initialized', () => {
            // Given
            const config: CallServiceEffectiveConfig = {
                serverUrl: 'https://test-server.com',
                navigator: mockNavigator,
            };

            // When
            callService.initialize(config);

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[call-service] Initialized.');
        });
    });

    describe('signAndSend', () => {
        it('should use SignalR service to send requests', async () => {
            // When
            await callService.update(publicKey);

            // Then
            expect(mockSignalRService.call).toHaveBeenCalled();
            expect(mockTimeService.serverTime).toBe(mockResponse.timestamp);
        });

        it('should fall back to API client if SignalR fails', async () => {
            // Given
            mockSignalRService.call = jest.fn().mockRejectedValue(new Error('SignalR error'));

            // When
            const response = await callService.update(publicKey);

            // Then
            expect(mockSignalRService.call).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalled();
            expect(mockApiClient.call).toHaveBeenCalled();
            expect(response).toBe(mockResponse);
        });

        it('should throw error when server URL is missing', async () => {
            // Given
            callService.initialize({ navigator: mockNavigator }); // Initialize without serverUrl
            mockSignalRService.call = jest.fn().mockRejectedValue(new Error('SignalR error'));

            // When & Then
            await expect(callService.update(publicKey)).rejects.toThrow('[call-service] Server URL is missing.');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should warn and use API client when SignalR is not ready', async () => {
            // Given: a SignalR service that is not ready
            const notReadySignalRService: SignalRService = {
                initialize: jest.fn().mockResolvedValue(undefined),
                get ready() {
                    return false;
                },
                call: jest.fn().mockResolvedValue(mockResponse),
            };

            const service = getCallService(
                mockLogger,
                mockTimeService,
                mockSessionService,
                mockApiClient,
                notReadySignalRService,
                mockBase64,
                mockUtf8,
                mockCryptography,
            );
            service.initialize({ serverUrl: 'https://test-server.com', navigator: mockNavigator });

            // When
            const response = await service.update(publicKey);

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[call-service] SignalR is not ready. Trying to use http API.',
            );
            expect(mockApiClient.call).toHaveBeenCalled();
            expect((notReadySignalRService as any).call).not.toHaveBeenCalled();
            expect(response).toBe(mockResponse);
            expect(mockTimeService.serverTime).toBe(mockResponse.timestamp);
        });

        it('should log error for API failure and then throw when no response is received', async () => {
            // Given: SignalR not ready and API call fails
            const notReadySignalRService: SignalRService = {
                initialize: jest.fn().mockResolvedValue(undefined),
                get ready() {
                    return false;
                },
                call: jest.fn(),
            };

            const failingApiClient: ApiClient = {
                call: jest.fn().mockRejectedValue(new Error('API error')),
            };

            const service = getCallService(
                mockLogger,
                mockTimeService,
                mockSessionService,
                failingApiClient,
                notReadySignalRService,
                mockBase64,
                mockUtf8,
                mockCryptography,
            );
            service.initialize({ serverUrl: 'https://test-server.com', navigator: mockNavigator });

            // When & Then
            await expect(service.update(publicKey)).rejects.toThrow(
                "[call-service] Failed to send call 'update'.",
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[call-service] SignalR is not ready. Trying to use http API.',
            );
            expect((failingApiClient.call as jest.Mock)).toHaveBeenCalled();
            // Ensure the API error was logged from the catch block (string + error)
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("[call-service] Error while sending call 'update' via http API."),
                expect.any(Error),
            );
        });
    });

    describe('update', () => {
        it('should send update request with correct parameters', async () => {
            // Given
            const subscription = {
                endpoint: 'test-endpoint',
                expirationTime: 9999999,
                keys: {
                    p256dh: 'test-p256dh',
                    auth: 'test-auth',
                },
            };

            // When
            await callService.update(publicKey, subscription);

            // Then
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'update',
                b: {
                    a: publicKey,
                    b: {
                        a: subscription.endpoint,
                        b: subscription.expirationTime,
                        c: {
                            a: subscription.keys.p256dh,
                            b: subscription.keys.auth,
                        },
                    },
                },
                c: expect.any(String),
            });
        });

        it('should send update request without subscription if not provided', async () => {
            // When
            await callService.update(publicKey);

            // Then
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'update',
                b: {
                    a: publicKey,
                    b: undefined,
                },
                c: expect.any(String),
            });
        });
    });

    describe('dial', () => {
        it('should send dial request with correct parameters', async () => {
            // When
            await callService.dial(publicKey, peerPublicKey, encryptionPublicKey);

            // Then
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'dial',
                b: {
                    a: publicKey,
                    b: mockTimeService.serverTime,
                    c: peerPublicKey,
                    d: encryptionPublicKey,
                },
                c: expect.any(String),
            });
        });
    });

    describe('offer', () => {
        it('should send offer request with correct parameters', async () => {
            // When
            await callService.offer(publicKey, peerPublicKey, encryptionPublicKey, encryptedData);

            // Then
            expect(mockBase64.encode).toHaveBeenCalledWith(encryptedData);
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'offer',
                b: {
                    a: publicKey,
                    b: mockTimeService.serverTime,
                    c: peerPublicKey,
                    d: encryptionPublicKey,
                    e: encodedData,
                },
                c: expect.any(String),
            });
        });
    });

    describe('answer', () => {
        it('should send answer request with correct parameters', async () => {
            // When
            await callService.answer(publicKey, peerPublicKey, encryptionPublicKey, encryptedData);

            // Then
            expect(mockBase64.encode).toHaveBeenCalledWith(encryptedData);
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'answer',
                b: {
                    a: publicKey,
                    b: mockTimeService.serverTime,
                    c: peerPublicKey,
                    d: encryptionPublicKey,
                    e: encodedData,
                },
                c: expect.any(String),
            });
        });
    });

    describe('ice', () => {
        it('should send ice request with correct parameters', async () => {
            // When
            await callService.ice(publicKey, peerPublicKey, encryptionPublicKey, encryptedData, IceSource.Incoming);

            // Then
            expect(mockBase64.encode).toHaveBeenCalledWith(encryptedData);
            expect(mockSignalRService.call).toHaveBeenCalledWith({
                a: 'ice',
                b: {
                    a: publicKey,
                    b: mockTimeService.serverTime,
                    c: peerPublicKey,
                    d: encryptionPublicKey,
                    e: encodedData,
                    f: IceSource.Incoming,
                },
                c: expect.any(String),
            });
        });
    });

    describe('close', () => {
        it('should use sendBeacon for close requests', () => {
            // Given
            mockNavigator.sendBeacon = jest.fn();
            global.Blob = jest.fn().mockImplementation(() => ({})) as any;
            global.JSON.stringify = jest.fn().mockReturnValue('{"test":"data"}');

            // When
            callService.close(publicKey, peerPublicKey);

            // Then
            expect(mockNavigator.sendBeacon).toHaveBeenCalledWith(
                'https://test-server.com/api/v1/call',
                expect.any(Object),
            );
            expect(global.Blob).toHaveBeenCalledWith(['{"test":"data"}'], { type: 'application/json' });
        });
    });
});
