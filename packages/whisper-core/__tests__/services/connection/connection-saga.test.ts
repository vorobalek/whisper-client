import {
    ConnectionSaga,
    ConnectionSagaState,
    ConnectionSagaType,
    getConnectionSaga,
} from '../../../src/services/connection/connection-saga';
import { newError } from '../../../src/utils/new-error';

describe('ConnectionSaga', () => {
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

    it('should cover the sendOffer function', async () => {
        // Mock dependencies
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
            getStats: jest.fn().mockResolvedValue(new Map()),
            remoteDescription: null as RTCSessionDescription | null,
        };

        const mockWebRTC = {
            PeerConnection: jest.fn(() => mockPeerConnection),
        };

        // Create the connection saga for the test
        const publicKey = 'mock-offer-public-key';
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
            // @ts-ignore
            mockWebRTC,
            [], // iceServers
            1000, // Shorter timeout for tests
        );

        // Set encryption for the saga - this initializes the shared symmetric key
        saga.setEncryption('mock-encryption-public-key');

        // Use the existing outgoing call flow test for setup
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start the saga at SendOffer state and immediately trigger it
        const sagaPromise = saga.open(ConnectionSagaState.SendOffer);

        // Wait for saga to complete
        await sagaPromise;

        // Verify that offer was created and sent
        expect(mockPeerConnection.createOffer).toHaveBeenCalled();
        expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
        expect(mockCallService.offer).toHaveBeenCalledWith(
            mockSessionService.signingPublicKeyBase64,
            publicKey,
            expect.any(String), // encryption public key
            expect.any(Uint8Array), // encrypted offer data
        );

        // Verify state transitions
        expect(stateTransitions).toContain(ConnectionSagaState.SendingOffer);
        expect(stateTransitions).toContain(ConnectionSagaState.OfferSent);
    }, 10000);

    it('should cover accessor methods', async () => {
        // Create the connection saga for the test
        const publicKey = 'mock-accessor-public-key';
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
            // @ts-ignore
            {},
        );

        // Test the accessors
        expect(saga.publicKey).toBe(publicKey);
        expect(saga.type).toBe(connectionType);
        expect(saga.state).toBe(ConnectionSagaState.New);

        // Verify abort and continue are functions
        expect(typeof saga.abort).toBe('function');
        expect(typeof saga.continue).toBe('function');
    });

    it('should handle successful awaitDial branch', async () => {
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

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start the saga in AwaitDial state
        const openPromise = saga.open(ConnectionSagaState.AwaitDial);

        // Immediately call continue to simulate successful dial
        saga.continue();

        // Wait for the saga to process
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went through the expected states
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingDial);
        expect(stateTransitions).toContain(ConnectionSagaState.DialAccepted);
        expect(stateTransitions).toContain(ConnectionSagaState.SendOffer);

        // Verify debug logs were called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Dial in outgoing connection'),
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Dial received in outgoing connection'));

        // Clean up
        saga.abort();
    });

    it('should handle successful awaitAnswer branch', async () => {
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

        // Set encryption for the saga
        saga.setEncryption('mock-encryption-public-key');

        // Trace states
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (from, to) => {
            stateTransitions.push(to);
        };

        // Start the saga in AwaitAnswer state
        const openPromise = saga.open(ConnectionSagaState.AwaitAnswer);

        // Immediately call continue to simulate successful answer
        saga.continue();

        // Wait for the saga to process
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Verify that we went through the expected states
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitingAnswer);
        expect(stateTransitions).toContain(ConnectionSagaState.AnswerReceived);
        expect(stateTransitions).toContain(ConnectionSagaState.AwaitConnection);

        // Verify debug logs were called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Awaiting for Answer in outgoing connection'),
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Answer received in outgoing connection'),
        );

        // Clean up
        saga.abort();
    });
});
