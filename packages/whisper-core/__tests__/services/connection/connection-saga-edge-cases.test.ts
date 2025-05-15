import {
    createMockBase64,
    createMockCallService,
    createMockCryptography,
    createMockDataChannel,
    createMockLogger,
    createMockPeerConnection,
    createMockSessionService,
    createMockTimeService,
    createMockUtf8,
    createMockWebRTC,
} from '../../../__mocks__/test-utils';
import { ConnectionSagaState, getConnectionSaga } from '../../../src/services/connection/connection-saga';

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
        mockBase64 = createMockBase64({
            encode: jest.fn((data) => 'encoded-' + Buffer.from(data).toString('hex')),
            decode: jest.fn((str) => {
                if (str.startsWith('encoded-')) {
                    return Buffer.from(str.substring(8), 'hex');
                }
                return new Uint8Array(Buffer.from(str, 'base64'));
            }),
        });
        mockUtf8 = createMockUtf8({
            encode: jest.fn((data) => Buffer.from(data).toString('utf-8')),
            decode: jest.fn((str) => new Uint8Array(Buffer.from(str, 'utf-8'))),
        });
        mockCryptography = createMockCryptography({
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
        });
    });

    it('should not call setRemoteDescription if remote description is already set', async () => {
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

    it('should not send empty outgoing messages and log debug', () => {
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
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Message is empty'));
        expect(mockDataChannel.send).not.toHaveBeenCalled();

        saga.send('   ');
        expect(mockDataChannel.send).not.toHaveBeenCalled();
    });

    it('should not call onMessage for empty incoming messages on open data channel', async () => {
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';

        // Arrange: create mock WebRTC and peer connection with data channel
        const mockDataChannel = createMockDataChannel({ readyState: 'open' });
        const mockPeerConnection = createMockPeerConnection({}, mockDataChannel);
        const mockWebRTC = createMockWebRTC();
        mockWebRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        const saga: any = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockWebRTC,
            [],
        );
        saga.onMessage = jest.fn();

        // Act: open saga to Connected state and simulate data channel open + empty message
        await saga.open(ConnectionSagaState.Connected);
        mockPeerConnection.ondatachannel({ channel: mockDataChannel });
        mockDataChannel.onmessage({ data: '' });

        // Assert: no message callback and no send
        expect(saga.onMessage).not.toHaveBeenCalled();
        saga.abort();
    });

    it('should log relay server address when relay candidate is used', async () => {
        const { saga, mockPeerConnection } = createTestSaga({
            peerConnectionOverrides: {
                getStats: jest.fn().mockResolvedValue(
                    new Map([
                        [
                            'candidate-pair-id',
                            { type: 'candidate-pair', selected: true, localCandidateId: 'local-candidate-id' },
                        ],
                        ['local-candidate-id', { candidateType: 'relay', address: '123.45.67.89' }],
                    ]),
                ),
                readyState: 'connecting',
            },
        });
        saga.setEncryption('mock-encryption-public-key');
        mockLogger.warn.mockClear();
        await saga.open(ConnectionSagaState.Connected);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server 123.45.67.89'));
        saga.abort();
    });

    it('should close and recreate peer connection on data channel after restart', async () => {
        const { saga, mockDataChannel, mockPeerConnection, mockWebRTC } = createTestSaga({
            dataChannelOverrides: { readyState: 'connecting' },
            peerConnectionOverrides: {
                onicecandidate: undefined as any,
                ondatachannel: undefined as any,
                remoteDescription: null,
            },
            timeout: 1000,
        });
        saga.setEncryption('mock-encryption-public-key');
        await saga.open(ConnectionSagaState.New);
        await saga.open(ConnectionSagaState.AwaitOffer);
        mockPeerConnection.ondatachannel({ channel: mockDataChannel });
        mockDataChannel.onopen?.();
        const offer = JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' });
        const encrypted = mockBase64.encode(mockUtf8.decode(offer));
        await saga.setDescription(encrypted);
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
        mockPeerConnection.setRemoteDescription.mockClear();
        mockPeerConnection.remoteDescription = { type: 'offer', sdp: 'mock-sdp-offer' } as any;
        await saga.setDescription(encrypted);
        expect(mockPeerConnection.setRemoteDescription).not.toHaveBeenCalled();
        await saga.open(ConnectionSagaState.AwaitOffer);
        expect(mockPeerConnection.close).toHaveBeenCalled();
        expect(mockWebRTC.PeerConnection).toHaveBeenCalledTimes(3);
    });

    it('should not change state if dataChannel opens when already connected', async () => {
        const publicKey = 'mock-remote-public-key';
        const connectionType = 'incoming';
        const mockDataChannel = createMockDataChannel({ readyState: 'connecting' });
        const mockPeerConnection = createMockPeerConnection({}, mockDataChannel);
        const webRTC = createMockWebRTC();
        webRTC.PeerConnection = jest.fn(() => mockPeerConnection);

        const saga: any = getConnectionSaga(
            publicKey,
            connectionType,
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            webRTC,
            [],
        );
        saga.setEncryption('mock-encryption-public-key');
        await saga.open(ConnectionSagaState.Connected);
        mockDataChannel.onopen();
        expect(saga.state).toBe(ConnectionSagaState.Connected);
        saga.abort();
    });

    it('should log relay server address if relay candidate is used (alternative path)', async () => {
        const { saga, mockPeerConnection } = createTestSaga({
            peerConnectionOverrides: {
                getStats: jest.fn().mockResolvedValue(
                    new Map([
                        [
                            'candidate-pair-id',
                            { type: 'candidate-pair', selected: true, localCandidateId: 'local-candidate-id' },
                        ],
                        ['local-candidate-id', { candidateType: 'relay', address: '123.45.67.89' }],
                    ]),
                ),
                readyState: 'connecting',
            },
        });
        saga.setEncryption('mock-encryption-public-key');
        mockLogger.warn.mockClear();
        await saga.open(ConnectionSagaState.Connected);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server 123.45.67.89'));
        saga.abort();
    });

    it('should handle all DataChannel edge cases and state transitions', async () => {
        const { saga, mockDataChannel, mockPeerConnection } = createTestSaga({
            dataChannelOverrides: { readyState: 'connecting' },
            peerConnectionOverrides: {
                getStats: jest.fn().mockResolvedValue(
                    new Map([
                        [
                            'candidate-pair-id',
                            { type: 'candidate-pair', selected: true, localCandidateId: 'local-candidate-id' },
                        ],
                        ['local-candidate-id', { candidateType: 'relay', address: '192.168.1.1' }],
                    ]),
                ),
                remoteDescription: null,
            },
        });
        saga.setEncryption('mock-encryption-public-key');
        const stateTransitions: ConnectionSagaState[] = [];
        saga.onStateChanged = (_from: ConnectionSagaState, to: ConnectionSagaState) => stateTransitions.push(to);
        const openPromise = saga.open(ConnectionSagaState.AwaitOffer);
        saga.continue();
        const encryptedOffer = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ type: 'offer', sdp: 'mock-sdp-offer' })),
        );
        await saga.setDescription(encryptedOffer);
        mockPeerConnection.onicecandidate({
            candidate: {
                toJSON: () => ({
                    candidate: 'candidate:1 1 UDP ...',
                    sdpMid: '0',
                    sdpMLineIndex: 0,
                    usernameFragment: 'u',
                }),
            },
        });
        mockPeerConnection.onicecandidate({ candidate: null });
        mockPeerConnection.ondatachannel({ channel: mockDataChannel });
        const encryptedIce = mockBase64.encode(
            mockUtf8.decode(JSON.stringify({ candidate: 'candidate:1 1 UDP ...', sdpMid: '0', sdpMLineIndex: 0 })),
        );
        mockPeerConnection.remoteDescription = null;
        await saga.addIceCandidate(encryptedIce);
        mockPeerConnection.remoteDescription = {
            type: 'offer',
            sdp: 'mock-sdp',
            toJSON: () => ({ type: 'offer', sdp: 'mock-sdp' }),
        } as any;
        await saga.addIceCandidate(encryptedIce);
        stateTransitions.push(ConnectionSagaState.AwaitingConnection);
        mockDataChannel.onopen();
        mockDataChannel.onmessage({ data: 'not-an-array-buffer' });
        let received: string | undefined;
        saga.onMessage = (msg: string) => {
            received = msg;
        };
        mockDataChannel.onmessage({ data: new ArrayBuffer(10) });
        saga.send('  ');
        saga.send('test message');
        await openPromise;
        expect(stateTransitions).toContain(ConnectionSagaState.Connected);
        expect(saga.state).toBe(ConnectionSagaState.Connected);
        expect(mockCallService.answer).toHaveBeenCalled();
        expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Wrong message type received'));
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server'));
    });

    // Helper function for creating saga and mocks
    function createTestSaga({
        publicKey = 'mock-remote-public-key',
        connectionType = 'incoming',
        dataChannelOverrides = {},
        peerConnectionOverrides = {},
        webRTCOverrides = {},
        sagaOverrides = {},
        iceServers = [],
        timeout = undefined,
    }: any = {}) {
        const mockDataChannel = createMockDataChannel(dataChannelOverrides);
        const mockPeerConnection = createMockPeerConnection(peerConnectionOverrides, mockDataChannel);
        const mockWebRTC = { ...createMockWebRTC(), ...webRTCOverrides };
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
            mockWebRTC,
            iceServers,
            timeout,
        );
        Object.assign(saga, sagaOverrides);
        return { saga, mockDataChannel, mockPeerConnection, mockWebRTC };
    }

    it('should cover the relay server connection path', async () => {
        const { saga, mockPeerConnection } = createTestSaga({
            publicKey: 'mock-relay-public-key',
            connectionType: 'outgoing',
            dataChannelOverrides: { readyState: 'open' },
            peerConnectionOverrides: {
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
            },
            timeout: 1000,
        });
        saga.setEncryption('mock-encryption-public-key');
        mockLogger.warn.mockClear();
        await saga.open(ConnectionSagaState.Connected);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using relay server 203.0.113.1'));
    }, 10000);
});
