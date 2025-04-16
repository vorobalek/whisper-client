import {
    ConnectionSaga,
    ConnectionSagaState,
    ConnectionSagaType,
    getConnectionSaga,
} from '../../../src/services/connection/connection-saga';
import { newError } from '../../../src/utils/new-error';
import {
    createMockLogger,
    createMockTimeService,
    createMockCallService,
    createMockSessionService,
    createMockDataChannel,
    createMockPeerConnection,
    createMockWebRTC,
} from '../../../__mocks__/test-utils';

describe('ConnectionSaga (Edge Cases)', () => {
    let mockLogger: any;
    let mockTimeService: any;
    let mockCallService: any;
    let mockSessionService: any;
    let mockBase64: any;
    let mockUtf8: any;
    let mockCryptography: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = createMockLogger();
        mockTimeService = createMockTimeService();
        mockCallService = createMockCallService();
        mockSessionService = createMockSessionService();
        mockBase64 = {
            encode: jest.fn((data) => 'encoded-' + Buffer.from(data).toString('hex')),
            decode: jest.fn((str) => {
                if (str.startsWith('encoded-')) {
                    return Buffer.from(str.substring(8), 'hex');
                }
                return new Uint8Array(Buffer.from(str, 'base64'));
            }),
        };
        mockUtf8 = {
            encode: jest.fn((data) => Buffer.from(data).toString('utf-8')),
            decode: jest.fn((str) => new Uint8Array(Buffer.from(str, 'utf-8'))),
        };
        mockCryptography = {
            generateEncryptionKeyPair: jest.fn(() => ({
                publicKey: new Uint8Array([1, 2, 3]),
                secretKey: new Uint8Array([4, 5, 6]),
            })),
            generateSharedSymmetricKey: jest.fn(() => new Uint8Array([7, 8, 9])),
            encrypt: jest.fn((data) => data),
            decrypt: jest.fn((data) => data),
            sign: jest.fn(() => new Uint8Array([10, 11, 12])),
            verifySignature: jest.fn(() => true),
            generateSigningKeyPair: jest.fn(() => ({
                publicKey: new Uint8Array([13, 14, 15]),
                secretKey: new Uint8Array([16, 17, 18]),
            })),
        };
    });

    it('should ignore setDescription when remote description is already set', async () => {
        // Setup mocks using test-utils factories
        const mockDataChannel = createMockDataChannel({ readyState: 'connecting' });
        const mockPeerConnection = createMockPeerConnection(
            { getStats: jest.fn().mockResolvedValue(new Map()) },
            mockDataChannel,
        );
        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Start the saga and initialize the RTCPeerConnection
        const openPromise = saga.open(ConnectionSagaState.AwaitOffer);

        // Simulate receiving an offer by calling continue()
        saga.continue();

        // Simulate receiving an offer by setting a remote description
        const encryptedOfferDataBase64 = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' })),
        );
        await saga.setDescription(encryptedOfferDataBase64);

        // At this point, the remote description should be set
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledTimes(1);

        // Clear the mock to check if it's called again
        mockPeerConnection.setRemoteDescription.mockClear();

        // Now try to set the description again
        const encryptedOfferDataBase64Again = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer-again' })),
        );

        // Mock remoteDescription to be non-null - this is what causes the early return
        mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp' } as RTCSessionDescription;

        // Call setDescription again - this should be ignored
        await saga.setDescription(encryptedOfferDataBase64Again);

        // Verify that setRemoteDescription was NOT called again
        expect(mockPeerConnection.setRemoteDescription).not.toHaveBeenCalled();
    }, 10000);

    it('should directly test handling of empty messages in the saga', () => {
        const mockDataChannel = { send: jest.fn() };
        const mockWebRTC = createMockWebRTC();

        const saga: any = getConnectionSaga(
            'mock-remote-public-key',
            'incoming',
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [],
        );

        saga.getSharedSymmetricKey = () => new Uint8Array([1, 2, 3]);
        saga.getRtcSendDataChannel = () => mockDataChannel;

        saga.send('');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Message is empty'),
        );
        expect(mockDataChannel.send).not.toHaveBeenCalled();

        saga.send('   ');
        expect(mockDataChannel.send).not.toHaveBeenCalled();
    });

    it('should handle empty messages correctly', async () => {
        // Create a saga with a mock data channel
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';

        // Mock WebRTC objects and their behavior
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'open',
            onopen: jest.fn(),
            onmessage: jest.fn(),
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            onicecandidate: jest.fn(),
            ondatachannel: jest.fn(),
            close: jest.fn(),
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'host',
                            address: '192.168.1.1',
                        },
                    ],
                ]),
            ),
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
        );

        // Set up a message handler
        const receivedMessages: string[] = [];
        saga.onMessage = (message) => {
            receivedMessages.push(message);
        };

        // Initialize the saga in the Connected state
        await saga.open(ConnectionSagaState.Connected);

        // Trigger the data channel onmessage event with empty message
        if (mockPeerConnection.ondatachannel) {
            // @ts-ignore
            mockPeerConnection.ondatachannel({ channel: mockDataChannel });

            // Simulate receiving an empty message
            if (mockDataChannel.onmessage) {
                // @ts-ignore
                mockDataChannel.onmessage({ data: '' });

                // Verify that no message was handled (empty messages should be ignored)
                expect(receivedMessages.length).toBe(0);
            }
        }

        // Clean up
        saga.abort();
    });

    it('should cover the relay server connection path', async () => {
        // Mock dependencies with relay candidate type
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'open',
            onopen: null,
            onmessage: null,
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            onicecandidate: null,
            ondatachannel: null,
            close: jest.fn(),
            // This is the key change - we're using a relay server instead of host
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'relay',
                            address: '203.0.113.1',
                        },
                    ],
                ]),
            ),
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the connection saga
        const publicKey = 'mock-relay-public-key';
        const connectionType = 'outgoing' as ConnectionSagaType;

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
            1000, // Use shorter timeout
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Clear previous warn calls
        mockLogger.warn.mockClear();

        // Initialize the saga directly in the Connected state
        await saga.open(ConnectionSagaState.Connected);

        // Verify that the warning about relay server was logged
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server 203.0.113.1'));
    }, 10000); // Increase test timeout

    it('should properly handle rtcReceiveDataChannelSafeKiller and re-initialization', async () => {
        // Mock dependencies
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: null,
            onmessage: null,
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            close: jest.fn(),
            onicecandidate: null,
            ondatachannel: null,
            remoteDescription: null as unknown as RTCSessionDescription,
            addIceCandidate: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'host',
                            address: '192.168.1.1',
                        },
                    ],
                ]),
            ),
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming' as ConnectionSagaType;

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
            1000, // Short timeout for testing
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Initialize the saga
        await saga.open(ConnectionSagaState.New);

        // Now start the saga with AwaitOffer state
        await saga.open(ConnectionSagaState.AwaitOffer);

        // Simulate receiving data channel
        if (mockPeerConnection.ondatachannel) {
            const receiveChannel = { ...mockDataChannel };
            // @ts-ignore
            mockPeerConnection.ondatachannel({ channel: receiveChannel });

            // Trigger onopen event on the receive channel
            if (receiveChannel.onopen) {
                // @ts-ignore
                receiveChannel.onopen();
            }
        }

        // Now set a description to trigger the SDP exchange
        const encryptedOfferDataBase64 = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' })),
        );

        await saga.setDescription(encryptedOfferDataBase64);
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
        mockPeerConnection.setRemoteDescription.mockClear();

        // Set the remote description property to simulate it being already set
        mockPeerConnection.remoteDescription = {
            type: 'offer',
            sdp: 'mock-sdp-offer',
        } as unknown as RTCSessionDescription;

        // Try to set the description again - this should be ignored
        await saga.setDescription(encryptedOfferDataBase64);
        expect(mockPeerConnection.setRemoteDescription).not.toHaveBeenCalled();

        // Now re-initialize (this will trigger rtcReceiveDataChannelSafeKiller)
        await saga.open(ConnectionSagaState.AwaitOffer);

        // Verify the RTC peer connection was closed and re-created
        expect(mockPeerConnection.close).toHaveBeenCalled();
        expect(mockWebRTC.PeerConnection).toHaveBeenCalledTimes(3); // Initial + first AwaitOffer + re-initialization
    }, 15000); // Increase timeout to 15 seconds

    it('should handle empty messages when sending data', async () => {
        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming' as ConnectionSagaType;

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            createMockWebRTC(),
        );

        // Clear any previous debug calls
        mockLogger.debug.mockClear();

        // Try to send an empty message which will be caught by the trim check
        saga.send('   ');

        // Verify the debug message about empty messages was logged
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
                "Message is empty and won't be sent in incoming connection with mock-remote-public-key",
            ),
        );
    }, 15000);

    it('should handle dataChannel.onopen when state is not AwaitingConnection', async () => {
        // Mock WebRTC objects and their behavior
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: jest.fn(),
            onmessage: jest.fn(),
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            addIceCandidate: jest.fn().mockResolvedValue(undefined),
            onicecandidate: jest.fn(),
            ondatachannel: jest.fn(),
            onconnectionstatechange: jest.fn(),
            close: jest.fn(),
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'host',
                            address: '192.168.1.1',
                        },
                    ],
                ]),
            ),
            remoteDescription: null as RTCSessionDescription | null,
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Open the saga in Connected state (which is different from AwaitingConnection)
        await saga.open(ConnectionSagaState.Connected);

        // Explicitly trigger the dataChannel.onopen event when in a state other than AwaitingConnection
        // This will hit the "else" branch in the dataChannel.onopen handler
        if (mockDataChannel.onopen) {
            // @ts-ignore
            mockDataChannel.onopen();
        }

        // Verify the state is still Connected (not changed by the event)
        expect(saga.state).toBe(ConnectionSagaState.Connected);

        // Clean up
        saga.abort();
    });

    it('should log a warning when using relay server for connection', async () => {
        // Mock WebRTC objects and their behavior
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: jest.fn(),
            onmessage: jest.fn(),
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            addIceCandidate: jest.fn().mockResolvedValue(undefined),
            onicecandidate: jest.fn(),
            ondatachannel: jest.fn(),
            onconnectionstatechange: jest.fn(),
            close: jest.fn(),
            // Mock getStats to return a relay candidate
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'relay', // This is a relay candidate
                            address: '123.45.67.89', // Relay server address
                        },
                    ],
                ]),
            ),
            remoteDescription: { type: 'answer', sdp: 'mock-sdp' } as RTCSessionDescription,
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Skip the AwaitingConnection state and go directly to Connected
        await saga.open(ConnectionSagaState.Connected);

        // Verify the saga moved to Connected state
        expect(saga.state).toBe(ConnectionSagaState.Connected);

        // Verify that the relay server warning was logged
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `[connection-saga] Using relay server 123.45.67.89 in ${connectionType} connection with ${publicKey}.`,
        );

        // Clean up
        saga.abort();
    }, 10000); // Increased timeout from default 5000ms to 10000ms

    it('should handle DataChannel events and edge cases', async () => {
        // Setup mocks
        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: jest.fn(),
            onmessage: jest.fn(),
            close: jest.fn(),
            send: jest.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: jest.fn(() => mockDataChannel),
            createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: jest.fn().mockResolvedValue(undefined),
            setRemoteDescription: jest.fn().mockResolvedValue(undefined),
            addIceCandidate: jest.fn().mockResolvedValue(undefined),
            onicecandidate: jest.fn(),
            ondatachannel: jest.fn(),
            onconnectionstatechange: jest.fn(),
            close: jest.fn(),
            getStats: jest.fn().mockResolvedValue(
                new Map([
                    [
                        'candidate-pair-id',
                        {
                            type: 'candidate-pair',
                            selected: true,
                            localCandidateId: 'local-candidate-id',
                        },
                    ],
                    [
                        'local-candidate-id',
                        {
                            candidateType: 'relay',
                            address: '192.168.1.1',
                        },
                    ],
                ]),
            ),
            remoteDescription: null as RTCSessionDescription | null,
        };

        const mockWebRTC = createMockWebRTC();
        // Override PeerConnection to use our mockPeerConnection
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        // Create the saga
        const publicKey = 'mock-remote-public-key';
        const connectionType: ConnectionSagaType = 'incoming';

        const saga = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC as any,
            [], // iceServers
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Track state transitions
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start the saga in AwaitOffer state
        const openPromise = saga.open(ConnectionSagaState.AwaitOffer);

        // Simulate receiving an offer
        saga.continue();

        // Provide the necessary SDP description
        const encryptedOfferDataBase64 = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' })),
        );
        await saga.setDescription(encryptedOfferDataBase64);

        // Test ICE candidate handling - both the null and valid candidate cases
        if (mockPeerConnection.onicecandidate) {
            // First simulate a valid ICE candidate
            mockPeerConnection.onicecandidate({
                candidate: {
                    toJSON: () => ({
                        candidate: 'candidate:1 1 UDP 123456 192.168.1.1 12345 typ host',
                        sdpMid: '0',
                        sdpMLineIndex: 0,
                        usernameFragment: 'mock-username-fragment',
                    }),
                },
            });

            // Then simulate the null candidate case (ICE gathering complete)
            mockPeerConnection.onicecandidate({ candidate: null });
        }

        // Trigger the ondatachannel event
        if (mockPeerConnection.ondatachannel) {
            mockPeerConnection.ondatachannel({ channel: { ...mockDataChannel } });
        }

        // Test adding ICE candidate before remote description is set
        const encryptedIceDataBase64 = mockBase64.encode(
            mockUtf8.decode(
                JSON.stringify({
                    candidate: 'candidate:1 1 UDP 123456 192.168.1.1 12345 typ host',
                    sdpMid: '0',
                    sdpMLineIndex: 0,
                }),
            ),
        );

        // Reset remote description to simulate the scenario
        mockPeerConnection.remoteDescription = null;
        await saga.addIceCandidate(encryptedIceDataBase64);

        // Set remote description to test different code path
        mockPeerConnection.remoteDescription = {
            type: 'offer',
            sdp: 'mock-sdp',
            toJSON: () => ({ type: 'offer', sdp: 'mock-sdp' }),
        };
        await saga.addIceCandidate(encryptedIceDataBase64);

        // Simulate data channel open event when in AwaitingConnection state
        stateTransitions.push(ConnectionSagaState.AwaitingConnection);
        mockDataChannel.onopen();

        // Simulate receiving a message in non-ArrayBuffer format
        if (mockDataChannel.onmessage) {
            mockDataChannel.onmessage({ data: 'not-an-array-buffer' });
        }

        // Simulate receiving a valid message
        let receivedMessage: string | undefined;
        saga.onMessage = (message) => {
            receivedMessage = message;
        };

        if (mockDataChannel.onmessage) {
            const buffer = new ArrayBuffer(10);
            mockDataChannel.onmessage({ data: buffer });
        }

        // Test sending empty message
        saga.send('  ');

        // Test sending valid message
        saga.send('test message');

        // Wait for the saga to complete
        await openPromise;

        // Verify we reached the Connected state
        expect(stateTransitions).toContain(ConnectionSagaState.Connected);
        expect(saga.state).toBe(ConnectionSagaState.Connected);

        // Verify other expectations
        expect(mockCallService.answer).toHaveBeenCalled();
        expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Wrong message type received'));
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server'));
    });
});
