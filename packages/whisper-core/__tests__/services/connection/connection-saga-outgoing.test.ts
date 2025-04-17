// connection-saga-outgoing.test.ts
//
// This file contains tests for the outgoing connection saga logic in connection-saga.ts.
// It specifically tests the state progression and behaviors for outgoing WebRTC connections.
// The test is moved here as part of a refactor to logically group tests by connection direction and flow.
import { createMockDataChannel } from '../../../__mocks__/test-utils';
import {
    ConnectionSaga,
    ConnectionSagaState,
    ConnectionSagaType,
    getConnectionSaga,
} from '../../../src/services/connection/connection-saga';

describe('ConnectionSaga (outgoing)', () => {
    // Mock all the required dependencies
    const mockLogger = {
        debug: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn(),
    };

    const mockTimeService = {
        get serverTime() {
            return 123456789;
        },
    };

    const mockCallService = {
        dial: jest.fn().mockResolvedValue(undefined),
        offer: jest.fn().mockResolvedValue(undefined),
        answer: jest.fn().mockResolvedValue(undefined),
        ice: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
    };

    const mockSessionService = {
        signingPublicKeyBase64: 'mock-signing-public-key',
        signingPublicKeyBase64Safe: 'mock-signing-public-key-safe',
        signingKeyPair: {
            publicKey: new Uint8Array([1, 2, 3]),
            secretKey: new Uint8Array([4, 5, 6]),
        },
        initialize: jest.fn().mockResolvedValue(undefined),
    };

    const mockBase64 = {
        encode: jest.fn((data) => 'encoded-' + Buffer.from(data).toString('hex')),
        decode: jest.fn((str) => {
            if (str.startsWith('encoded-')) {
                return Buffer.from(str.substring(8), 'hex');
            }
            return new Uint8Array(Buffer.from(str, 'base64'));
        }),
    };

    const mockUtf8 = {
        encode: jest.fn((data) => Buffer.from(data).toString('utf-8')),
        decode: jest.fn((str) => new Uint8Array(Buffer.from(str, 'utf-8'))),
    };

    // Mock cryptography methods with simple implementations
    const mockCryptography = {
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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test for the outgoing connection saga
    it('should progress through all states for an outgoing connection', async () => {
        // Track state transitions
        const stateTransitions: ConnectionSagaState[] = [];

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

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
            DataChannel: createMockDataChannel(),
        };

        // Create the connection saga for the test
        const publicKey = 'mock-remote-public-key';
        const connectionType: ConnectionSagaType = 'outgoing';

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
            // @ts-ignore
            mockWebRTC,
            [], // iceServers
        );

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Track state transitions
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start the saga in the SendDial state for an outgoing connection
        const openPromise = saga.open(ConnectionSagaState.SendDial);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockCallService.dial).toHaveBeenCalled();

        const encryptedOfferDataBase64 = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' })),
        );
        await saga.setDescription(encryptedOfferDataBase64);

        saga.continue();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockCallService.answer).toHaveBeenCalled();

        // Verify that the saga methods were called appropriately
        expect(mockCallService.dial).toHaveBeenCalled();
        expect(mockCallService.answer).toHaveBeenCalled();
        expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
        expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();

        // Simulate onicecandidate event
        if (mockPeerConnection.onicecandidate) {
            // @ts-ignore
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
        }

        // Trigger the ondatachannel event to create the receive data channel
        if (mockPeerConnection.ondatachannel) {
            // @ts-ignore
            mockPeerConnection.ondatachannel({ channel: { ...mockDataChannel } });
        }

        // Simulate data channel opened
        if (mockDataChannel.onopen) {
            // @ts-ignore
            mockDataChannel.onopen();
        }

        // Wait for the saga to complete all state transitions
        await openPromise;

        // Verify that the saga went through all the expected states
        expect(stateTransitions).toContain(ConnectionSagaState.SendDial);
        expect(stateTransitions).toContain(ConnectionSagaState.SendingDial);
        expect(stateTransitions).toContain(ConnectionSagaState.DialSent);
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitOffer);
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingOffer);
        expect(stateTransitions).toContain(ConnectionSagaState.OfferReceived);
        expect(stateTransitions).toContain(ConnectionSagaState.SendAnswer);
        expect(stateTransitions).toContain(ConnectionSagaState.SendingAnswer);
        expect(stateTransitions).toContain(ConnectionSagaState.AnswerSent);
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingConnection);
        expect(stateTransitions).toContain(ConnectionSagaState.Connected);

        // Verify the last state is Connected
        expect(saga.state).toBe(ConnectionSagaState.Connected);

        // Test sending a message
        saga.send('test message');
        expect(mockDataChannel.send).toHaveBeenCalled();

        // Test receiving a message
        const mockMessage = new ArrayBuffer(10);
        let receivedMessage: string | undefined;
        saga.onMessage = (message) => {
            receivedMessage = message;
        };

        if (mockDataChannel.onmessage) {
            // @ts-ignore
            mockDataChannel.onmessage({ data: mockMessage });
        }

        // Verify abort functionality
        saga.abort();
        expect(mockPeerConnection.close).toHaveBeenCalled();
        expect(mockDataChannel.close).toHaveBeenCalled();
        expect(saga.state).toBe(ConnectionSagaState.Closed);
    });
});
