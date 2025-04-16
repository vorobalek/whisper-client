import {
    createMockLogger,
    createMockTimeService,
    createMockSessionService,
    createMockBase64,
    createMockUtf8,
    createMockCryptography,
    createMockCallService,
} from '../../../__mocks__/test-utils';
import { CallService } from '../../../src/services/call-service';
import { ConnectionState, getConnection, translateConnection } from '../../../src/services/connection/connection';
import { ConnectionSagaState } from '../../../src/services/connection/connection-saga';
import { IceServer } from '../../../src/services/connection/ice-server';
import { WebRTC } from '../../../src/services/connection/web-rtc';
import { SessionService } from '../../../src/services/session-service';
import { TimeService } from '../../../src/services/time-service';
import { Base64 } from '../../../src/utils/base64';
import { Cryptography } from '../../../src/utils/cryptography';
import { Logger } from '../../../src/utils/logger';
import { Utf8 } from '../../../src/utils/utf8';

const mockSagaOpen = jest.fn().mockImplementation(async (state) => {
    return {
        type: 'mock',
        state,
    };
});

const mockSagaClose = jest.fn();
const mockSagaContinue = jest.fn();
const mockSagaAbort = jest.fn();
const mockSagaSend = jest.fn();
const mockSagaSetEncryption = jest.fn();
const mockSagaSetDescription = jest.fn().mockResolvedValue(undefined);
const mockSagaAddIceCandidate = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/services/connection/connection-saga', () => {
    const originalModule = jest.requireActual('../../../src/services/connection/connection-saga');

    return {
        ...originalModule,
        getConnectionSaga: jest.fn().mockImplementation((publicKey, type) => ({
            publicKey,
            type,
            state: originalModule.ConnectionSagaState.New,
            open: mockSagaOpen,
            close: mockSagaClose,
            continue: mockSagaContinue,
            abort: mockSagaAbort,
            send: mockSagaSend,
            setEncryption: mockSagaSetEncryption,
            setDescription: mockSagaSetDescription,
            addIceCandidate: mockSagaAddIceCandidate,
            onMessage: null,
            onStateChanged: null,
        })),
    };
});

describe('Connection Tests', () => {
    let mockLogger: Logger;
    let mockCallService: CallService;
    let mockCryptography: Cryptography;
    let mockTimeService: TimeService;
    let mockSessionService: SessionService;
    let mockPublicKey: string;
    let mockBase64: Base64;
    let mockUtf8: Utf8;
    let mockWebRTC: WebRTC;
    let mockIceServers: IceServer[];

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = createMockLogger();
        mockPublicKey = 'test-public-key';
        mockCallService = createMockCallService() as unknown as CallService;
        mockTimeService = createMockTimeService() as unknown as TimeService;
        mockSessionService = createMockSessionService() as unknown as SessionService;
        mockBase64 = createMockBase64() as unknown as Base64;
        mockUtf8 = createMockUtf8() as unknown as Utf8;
        mockCryptography = createMockCryptography() as unknown as Cryptography;
        mockWebRTC = {
            PeerConnection: jest.fn(),
            DataChannel: jest.fn(),
        } as unknown as WebRTC;
        mockIceServers = [{ urls: 'stun:stun.example.com' }];
    });

    describe('Connection Creation', () => {
        it('should create a connection', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            expect(connection).toBeDefined();
            expect(connection.publicKey).toBe(mockPublicKey);
            expect(connection.state).toBe(ConnectionState.New);
        });

        it('should translate internal connection to external connection', () => {
            const internalConnection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            const externalConnection = translateConnection(internalConnection);

            expect(externalConnection).toBeDefined();
            expect(externalConnection.publicKey).toBe(mockPublicKey);
            expect(externalConnection.state).toBe(ConnectionState.New);
        });
    });

    describe('Connection State Management', () => {
        it('should have the correct initial state', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            expect(connection.state).toBe(ConnectionState.New);
        });

        it('should handle onProgress callback', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            const onProgressMock = jest.fn();
            connection.onProgress = onProgressMock;

            expect(connection.onProgress).toBe(onProgressMock);
        });

        it('should handle onStateChanged callback', () => {
            // Create a connection with mocked sagas
            const onStateChangedMock = jest.fn();

            // Mock getConnectionSaga to return an object with mutable state
            let sagaState = ConnectionSagaState.New;
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => {
                    return {
                        publicKey,
                        type,
                        get state() {
                            return sagaState;
                        },
                        open: mockSagaOpen,
                        close: mockSagaClose,
                        continue: mockSagaContinue,
                        abort: mockSagaAbort,
                        send: mockSagaSend,
                        setEncryption: mockSagaSetEncryption,
                        setDescription: mockSagaSetDescription,
                        addIceCandidate: mockSagaAddIceCandidate,
                        onMessage: null,
                        onStateChanged: null,
                    };
                },
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Set the state change callback
            connection.onStateChanged = onStateChangedMock;

            // Get mock saga
            const mockSaga = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock
                .results[0].value;

            // Check initial state
            expect(connection.state).toBe(ConnectionState.New);

            // Change state manually and call onStateChanged
            sagaState = ConnectionSagaState.Connected;
            mockSaga.onStateChanged(ConnectionSagaState.New, ConnectionSagaState.Connected);

            // onStateChanged should be called with correct arguments
            expect(onStateChangedMock).toHaveBeenCalledWith(ConnectionState.New, ConnectionState.Open);
        });

        it('should handle onMessage callback', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            const onMessageMock = jest.fn();
            connection.onMessage = onMessageMock;

            expect(connection.onMessage).toBe(onMessageMock);
        });
    });

    describe('Connection Operations', () => {
        it('should open incoming connection', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.openIncoming();
            expect(mockSagaOpen).toHaveBeenCalledTimes(2);
        });

        it('should open outgoing connection', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.openOutgoing();
            expect(mockSagaOpen).toHaveBeenCalledTimes(2);
        });

        it('should open regular connection via external interface', async () => {
            const internalConnection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            const externalConnection = translateConnection(internalConnection);
            await externalConnection.open();

            expect(mockSagaOpen).toHaveBeenCalledTimes(2);
        });

        it('should close the connection', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.close();
            expect(mockSagaAbort).toHaveBeenCalledTimes(2);
        });

        it('should send messages when connection is ready', async () => {
            const mockSagaWithConnectedState = {
                publicKey: mockPublicKey,
                type: 'incoming',
                state: ConnectionSagaState.Connected,
                send: mockSagaSend,
                abort: mockSagaAbort,
                continue: mockSagaContinue,
                open: mockSagaOpen,
                setEncryption: mockSagaSetEncryption,
                setDescription: mockSagaSetDescription,
                addIceCandidate: mockSagaAddIceCandidate,
                onMessage: null,
                onStateChanged: null,
            };

            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                () => mockSagaWithConnectedState,
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.send('test message');
            expect(mockSagaSend).toHaveBeenCalledWith('test message');
        });

        it('should correctly handle incomingState and outgoingState', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            expect(connection.incomingState).toBe(ConnectionSagaState.Connected);
            expect(connection.outgoingState).toBe(ConnectionSagaState.Connected);
        });

        it('should throw an error when sending message but connection is not ready', async () => {
            // Reset mock implementation to return non-Connected state
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New, // Not Connected
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Attempt to send a message when neither saga is in Connected state
            expect(() => {
                connection.send('test message');
            }).toThrow('[connection] Connection is not ready yet.');

            // Send should not be called since we're throwing an error
            expect(mockSagaSend).not.toHaveBeenCalled();
        });

        // Add a test case for sending message through outgoing saga when it's in Connected state
        it('should send message through outgoing saga when it is connected', async () => {
            // Access the mock module to manipulate internal saga state
            const connectionSagaModule = require('../../../src/services/connection/connection-saga');

            // Create connection
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Directly modify the state of the saga objects
            const sagas = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock.results;

            // Set incoming saga to not connected
            sagas[0].value.state = connectionSagaModule.ConnectionSagaState.AwaitConnection;

            // Set outgoing saga to connected
            sagas[1].value.state = connectionSagaModule.ConnectionSagaState.Connected;

            // Send a message
            connection.send('test message');

            // Verify that the outgoing saga's send method was called
            expect(mockSagaSend).toHaveBeenCalledWith('test message');
        });
    });

    describe('Connection Handling', () => {
        it('should continue incoming saga', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.continueIncoming();
            expect(mockSagaContinue).toHaveBeenCalledTimes(1);
        });

        it('should continue outgoing saga', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.continueOutgoing();
            expect(mockSagaContinue).toHaveBeenCalledTimes(1);
        });

        it('should set incoming encryption', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.setIncomingEncryption('test-key');
            expect(mockSagaSetEncryption).toHaveBeenCalledWith('test-key');
        });

        it('should set outgoing encryption', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.setOutgoingEncryption('test-key');
            expect(mockSagaSetEncryption).toHaveBeenCalledWith('test-key');
        });

        it('should set incoming description', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.setIncomingDescription('test-description');
            expect(mockSagaSetDescription).toHaveBeenCalledWith('test-description');
        });

        it('should set outgoing description', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.setOutgoingDescription('test-description');
            expect(mockSagaSetDescription).toHaveBeenCalledWith('test-description');
        });

        it('should add incoming ICE candidate', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.addIncomingIce('test-candidate');
            expect(mockSagaAddIceCandidate).toHaveBeenCalledWith('test-candidate');
        });

        it('should add outgoing ICE candidate', async () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            await connection.addOutgoingIce('test-candidate');
            expect(mockSagaAddIceCandidate).toHaveBeenCalledWith('test-candidate');
        });
    });

    describe('Connection Callbacks', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should handle onProgress callback', () => {
            // Create a connection with mocked sagas
            const onProgressMock = jest.fn();

            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Set the progress callback
            connection.onProgress = onProgressMock;

            // Get the onStateChanged handler for the incoming saga
            const mockSaga = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock
                .results[0].value;

            // Trigger a state change that should update progress
            mockSaga.onStateChanged(ConnectionSagaState.New, ConnectionSagaState.AwaitOffer);

            // Progress should be called
            expect(onProgressMock).toHaveBeenCalled();
            // The progress value should be calculated based on the state
            expect(onProgressMock).toHaveBeenCalledWith(expect.any(Number));
        });

        it('should handle onMessage callback', () => {
            // Create a connection with mocked sagas
            const onMessageMock = jest.fn();

            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.Connected,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Set the message callback
            connection.onMessage = onMessageMock;

            // Get the onMessage handlers for both sagas
            const incomingSaga = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock
                .results[0].value;
            const outgoingSaga = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock
                .results[1].value;

            // Trigger message from incoming saga
            incomingSaga.onMessage('test message from incoming');

            // Trigger message from outgoing saga
            outgoingSaga.onMessage('test message from outgoing');

            // onMessage should be called twice with the respective messages
            expect(onMessageMock).toHaveBeenCalledTimes(2);
            expect(onMessageMock).toHaveBeenCalledWith('test message from incoming');
            expect(onMessageMock).toHaveBeenCalledWith('test message from outgoing');
        });

        it('should handle errors in callbacks gracefully', () => {
            // Create callbacks that throw errors
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });

            // Mock sagas with state changes
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.Connected,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Set up callbacks that will throw errors
            connection.onProgress = errorCallback;
            connection.onStateChanged = errorCallback;
            connection.onMessage = errorCallback;

            // Reference to the saga handlers
            const mockSaga = require('../../../src/services/connection/connection-saga').getConnectionSaga.mock
                .results[0].value;

            // 1. Test state change callback error handling
            let errorThrown = false;
            try {
                mockSaga.onStateChanged(ConnectionSagaState.New, ConnectionSagaState.Connected);
            } catch (e) {
                errorThrown = true;
            }
            // Error should be caught inside connectionOnStateChange and not propagate
            expect(errorThrown).toBe(false);
            // But the callback should still have been called
            expect(errorCallback).toHaveBeenCalled();

            // Reset the mock for the next test
            errorCallback.mockClear();

            // 2. Test message callback error handling
            errorThrown = false;
            try {
                mockSaga.onMessage('test message');
            } catch (e) {
                errorThrown = true;
            }
            // Error should be caught inside connectionOnMessage and not propagate
            expect(errorThrown).toBe(false);
            // But the callback should still have been called
            expect(errorCallback).toHaveBeenCalled();
        });
    });

    describe('Connection Extended Operations', () => {
        it('should initialize with correct default values', () => {
            // Reset mock implementation to return New state
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            expect(connection.publicKey).toBe(mockPublicKey);
            expect(connection.state).toBe(ConnectionState.New);
            expect(connection.openedAt).toBeUndefined();
            expect(connection.incomingState).toBe(ConnectionSagaState.New);
            expect(connection.outgoingState).toBe(ConnectionSagaState.New);
        });

        it('should correctly translate an internal connection to external interface', () => {
            // Reset mock implementation to return New state
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            // Create internal connection
            const internalConnection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Translate to external interface
            const externalConnection = translateConnection(internalConnection);

            // Test that the external connection has the same basic properties
            expect(externalConnection.publicKey).toBe(mockPublicKey);
            expect(externalConnection.state).toBe(ConnectionState.New);

            // Test that the external connection doesn't expose internal methods
            expect((externalConnection as any).incomingState).toBeUndefined();
            expect((externalConnection as any).outgoingState).toBeUndefined();
            expect((externalConnection as any).openIncoming).toBeUndefined();
            expect((externalConnection as any).openOutgoing).toBeUndefined();
            expect((externalConnection as any).continueIncoming).toBeUndefined();
            expect((externalConnection as any).continueOutgoing).toBeUndefined();
            expect((externalConnection as any).setIncomingEncryption).toBeUndefined();
            expect((externalConnection as any).setOutgoingEncryption).toBeUndefined();
        });

        it('should set openedAt timestamp when opening a connection', async () => {
            // Reset mock implementation
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Test openIncoming
            const incomingResult = await connection.openIncoming();
            expect(incomingResult).toBe(connection);
            expect(connection.openedAt).toBe(mockTimeService.serverTime);

            // Create a new connection for testing openOutgoing
            const connection2 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Test openOutgoing
            const outgoingResult = await connection2.openOutgoing();
            expect(outgoingResult).toBe(connection2);
            expect(connection2.openedAt).toBe(mockTimeService.serverTime);
        });

        it('should call CallService.close when closing the connection', () => {
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            connection.close();

            // Should call the CallService.close method
            expect(mockCallService.close).toHaveBeenCalledWith(
                mockSessionService.signingPublicKeyBase64,
                mockPublicKey,
            );
        });
    });

    describe('Connection State Determination', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should return Closed state when either saga is Closed', () => {
            // First test with incoming saga Closed
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.Closed : ConnectionSagaState.Connected,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection1 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection1.state).toBe(ConnectionState.Closed);

            // Now test with outgoing saga Closed
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.Connected : ConnectionSagaState.Closed,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection2 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection2.state).toBe(ConnectionState.Closed);
        });

        it('should return Open state when either saga is Connected', () => {
            // Test with incoming saga Connected
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.Connected : ConnectionSagaState.AwaitingOffer,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection1 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection1.state).toBe(ConnectionState.Open);

            // Test with outgoing saga Connected
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.AwaitingOffer : ConnectionSagaState.Connected,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection2 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection2.state).toBe(ConnectionState.Open);
        });

        it('should return New state when both sagas are New', () => {
            // Mock with both sagas in New state
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection.state).toBe(ConnectionState.New);
        });

        it('should return Connecting state when in intermediate states', () => {
            // Test with first combination
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.AwaitingOffer : ConnectionSagaState.New,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection1 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection1.state).toBe(ConnectionState.Connecting);

            // Test with second combination
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: type === 'incoming' ? ConnectionSagaState.New : ConnectionSagaState.AwaitingAnswer,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection2 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection2.state).toBe(ConnectionState.Connecting);

            // Test with third combination
            jest.clearAllMocks();
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state:
                        type === 'incoming'
                            ? ConnectionSagaState.SendingAnswer
                            : ConnectionSagaState.AwaitingConnection,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            const connection3 = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );
            expect(connection3.state).toBe(ConnectionState.Connecting);
        });
    });

    describe('Connection Translation', () => {
        it('should correctly access and set callbacks through translated interface', () => {
            // Create internal connection
            const connection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            // Translate to external interface
            const externalConnection = translateConnection(connection);

            // Test onProgress getter/setter
            const onProgressMock = jest.fn();
            expect(externalConnection.onProgress).toBeUndefined();
            externalConnection.onProgress = onProgressMock;
            expect(connection.onProgress).toBe(onProgressMock);
            expect(externalConnection.onProgress).toBe(onProgressMock);

            // Test onStateChanged getter/setter
            const onStateChangedMock = jest.fn();
            expect(externalConnection.onStateChanged).toBeUndefined();
            externalConnection.onStateChanged = onStateChangedMock;
            expect(connection.onStateChanged).toBe(onStateChangedMock);
            expect(externalConnection.onStateChanged).toBe(onStateChangedMock);

            // Test onMessage getter/setter
            const onMessageMock = jest.fn();
            expect(externalConnection.onMessage).toBeUndefined();
            externalConnection.onMessage = onMessageMock;
            expect(connection.onMessage).toBe(onMessageMock);
            expect(externalConnection.onMessage).toBe(onMessageMock);

            // Test send method
            // Mock a connected saga
            require('../../../src/services/connection/connection-saga').getConnectionSaga.mockImplementation(
                (publicKey: string, type: string) => ({
                    publicKey,
                    type,
                    state: ConnectionSagaState.Connected,
                    open: mockSagaOpen,
                    close: mockSagaClose,
                    continue: mockSagaContinue,
                    abort: mockSagaAbort,
                    send: mockSagaSend,
                    setEncryption: mockSagaSetEncryption,
                    setDescription: mockSagaSetDescription,
                    addIceCandidate: mockSagaAddIceCandidate,
                    onMessage: null,
                    onStateChanged: null,
                }),
            );

            // Create a new connection with connected sagas
            const connectedConnection = getConnection(
                mockPublicKey,
                mockLogger,
                mockTimeService,
                mockCallService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockWebRTC,
                mockIceServers,
            );

            const translatedConnected = translateConnection(connectedConnection);

            // Test sending a message through the translated interface
            translatedConnected.send('test message');
            expect(mockSagaSend).toHaveBeenCalledWith('test message');

            // Test close method
            translatedConnected.close();
            expect(mockCallService.close).toHaveBeenCalledWith(
                mockSessionService.signingPublicKeyBase64,
                mockPublicKey,
            );
            expect(mockSagaAbort).toHaveBeenCalled();
        });
    });
});
