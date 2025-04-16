// connection-saga-timeout.test.ts
//
// This file contains tests for timeout handling logic in connection-saga.ts.
// It specifically tests the awaitDial timeout and related flows for WebRTC connections.
// The test is moved here as part of a refactor to logically group tests by connection feature.
import {
    ConnectionSaga,
    ConnectionSagaState,
    ConnectionSagaType,
    getConnectionSaga,
} from '../../../src/services/connection/connection-saga';
import { newError } from '../../../src/utils/new-error';

describe('ConnectionSaga (Timeout handling)', () => {
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

    it('should handle timeout in awaitDial', async () => {
        // Create saga with a small maxStepWaitMilliseconds value to speed up the test
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'outgoing';

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
            close: jest.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
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
            close: jest.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
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
            close: jest.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
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
            close: jest.fn(),
            onicecandidate: null,
            ondatachannel: null,
        };

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
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
