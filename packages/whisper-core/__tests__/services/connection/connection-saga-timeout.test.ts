// connection-saga-timeout.test.ts
//
// This file contains tests for timeout handling logic in connection-saga.ts.
// It specifically tests the awaitDial timeout and related flows for WebRTC connections.
// The test is moved here as part of a refactor to logically group tests by connection feature.
import { ConnectionSagaState, getConnectionSaga } from '../../../src/services/connection/connection-saga';

describe('ConnectionSaga (Timeout handling)', () => {
    // Mock all the required dependencies
    const mockLogger = {
        debug: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trace: vi.fn(),
    };

    const mockTimeService = {
        get serverTime() {
            return 123456789;
        },
    };

    const mockCallService = {
        dial: vi.fn().mockResolvedValue(undefined),
        offer: vi.fn().mockResolvedValue(undefined),
        answer: vi.fn().mockResolvedValue(undefined),
        ice: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
    };

    const mockSessionService = {
        signingPublicKeyBase64: 'mock-signing-public-key',
        signingPublicKeyBase64Safe: 'mock-signing-public-key-safe',
        signingKeyPair: {
            publicKey: new Uint8Array([1, 2, 3]),
            secretKey: new Uint8Array([4, 5, 6]),
        },
        initialize: vi.fn().mockResolvedValue(undefined),
    };

    const mockBase64 = {
        encode: vi.fn((data) => 'encoded-' + Buffer.from(data).toString('hex')),
        decode: vi.fn((str) => {
            if (str.startsWith('encoded-')) {
                return Buffer.from(str.substring(8), 'hex');
            }
            return new Uint8Array(Buffer.from(str, 'base64'));
        }),
    };

    const mockUtf8 = {
        encode: vi.fn((data) => Buffer.from(data).toString('utf-8')),
        decode: vi.fn((str) => new Uint8Array(Buffer.from(str, 'utf-8'))),
    };

    // Mock cryptography methods with simple implementations
    const mockCryptography = {
        generateEncryptionKeyPair: vi.fn(() => ({
            publicKey: new Uint8Array([1, 2, 3]),
            secretKey: new Uint8Array([4, 5, 6]),
        })),
        generateSharedSymmetricKey: vi.fn(() => new Uint8Array([7, 8, 9])),
        encrypt: vi.fn((data) => data),
        decrypt: vi.fn((data) => data),
        sign: vi.fn(() => new Uint8Array([10, 11, 12])),
        verifySignature: vi.fn(() => true),
        generateSigningKeyPair: vi.fn(() => ({
            publicKey: new Uint8Array([13, 14, 15]),
            secretKey: new Uint8Array([16, 17, 18]),
        })),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle timeout in awaitDial', async () => {
        // Create saga with a small maxStepWaitMilliseconds value to speed up the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'outgoing';

        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: vi.fn(),
            onmessage: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: vi.fn(() => mockDataChannel),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: vi.fn(function () {
                return mockPeerConnection;
            }),
        };

        // Create saga with a very short timeout
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
            10, // Very short timeout of 10ms for testing
        );

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Initiate connection
        await saga.open(ConnectionSagaState.AwaitDial);

        // Wait for more than the timeout
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went to AwaitingDial state and then back to New
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingDial);
        expect(stateTransitions).toContain(ConnectionSagaState.New);

        // Verify we ended up at New state due to timeout
        expect(saga.state).toBe(ConnectionSagaState.New);

        // Verify debug logs were called showing timeout
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Dial in outgoing connection'),
        );

        // Clean up
        saga.abort();
    });

    it('should handle timeout in awaitOffer', async () => {
        // Create saga with a small maxStepWaitMilliseconds value to speed up the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'outgoing';

        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: vi.fn(),
            onmessage: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: vi.fn(() => mockDataChannel),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: vi.fn(function () {
                return mockPeerConnection;
            }),
        };

        // Create saga with a very short timeout
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
            10, // Very short timeout of 10ms for testing
        );

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Initiate connection
        await saga.open(ConnectionSagaState.AwaitOffer);

        // Wait for more than the timeout
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went to AwaitingOffer state and then back to New
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingOffer);
        expect(stateTransitions).toContain(ConnectionSagaState.New);

        // Verify we ended up at New state due to timeout
        expect(saga.state).toBe(ConnectionSagaState.New);

        // Verify debug logs were called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Offer in outgoing connection'),
        );

        // Clean up
        saga.abort();
    });

    it('should handle timeout in awaitAnswer', async () => {
        // Create saga with a small maxStepWaitMilliseconds value to speed up the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'outgoing';

        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: vi.fn(),
            onmessage: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: vi.fn(() => mockDataChannel),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: vi.fn(function () {
                return mockPeerConnection;
            }),
        };

        // Create saga with a very short timeout
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
            10, // Very short timeout of 10ms for testing
        );

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start with encryption for proper initialization
        saga.setEncryption('mock-encryption-public-key');

        // Initiate connection
        await saga.open(ConnectionSagaState.AwaitAnswer);

        // Wait for more than the timeout
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went to AwaitingAnswer state and then back to New
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingAnswer);
        expect(stateTransitions).toContain(ConnectionSagaState.New);

        // Verify we ended up at New state due to timeout
        expect(saga.state).toBe(ConnectionSagaState.New);

        // Verify debug logs were called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Answer in outgoing connection'),
        );

        // Clean up
        saga.abort();
    });

    it('should handle timeout in awaitConnection', async () => {
        // Create saga with a small maxStepWaitMilliseconds value to speed up the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'outgoing';

        const mockDataChannel = {
            id: 'data-channel-id',
            label: 'mock-data-channel',
            readyState: 'connecting',
            onopen: vi.fn(),
            onmessage: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
        };

        const mockPeerConnection = {
            createDataChannel: vi.fn(() => mockDataChannel),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: vi.fn(function () {
                return mockPeerConnection;
            }),
        };

        // Create saga with a very short timeout
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
            10, // Very short timeout of 10ms for testing
        );

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start with encryption for proper initialization
        saga.setEncryption('mock-encryption-public-key');

        // Initiate connection in the AwaitConnection state
        await saga.open(ConnectionSagaState.AwaitConnection);

        // Wait for more than the timeout
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went to AwaitingConnection state and then back to New
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingConnection);
        expect(stateTransitions).toContain(ConnectionSagaState.New);

        // Verify we ended up at New state due to timeout
        expect(saga.state).toBe(ConnectionSagaState.New);

        // Verify debug logs were called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Connection in outgoing connection'),
        );

        // Clean up
        saga.abort();
    });
});
