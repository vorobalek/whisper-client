import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { newError } from '../../utils/new-error';
import { Utf8 } from '../../utils/utf8';
import { CallService } from '../call-service';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { ConnectionSaga, ConnectionSagaState, ConnectionSagaType, getConnectionSaga } from './connection-saga';
import { IceServer } from './ice-server';
import { WebRTC } from './web-rtc';

/**
 * Enumeration representing the possible states of a peer connection.
 * Used to track the lifecycle of WebRTC connections.
 */
export enum ConnectionState {
    /** Initial state before any connection attempt */
    New = 'new',
    /** Connection is in the process of being established */
    Connecting = 'connecting',
    /** Connection has been successfully established */
    Open = 'open',
    /** Connection has been terminated */
    Closed = 'closed',
}

/**
 * Public interface for a peer-to-peer connection.
 * Provides methods for managing the connection lifecycle and sending messages.
 */
export interface Connection {
    /**
     * Gets the public key of the peer this connection is established with.
     *
     * @returns The peer's public key as a string
     */
    get publicKey(): string;

    /**
     * Gets the current state of the connection.
     *
     * @returns The connection state (New, Connecting, Open, or Closed)
     */
    get state(): ConnectionState;

    /**
     * Initiates the connection establishment process.
     * Starts the WebRTC signaling process to connect to the peer.
     *
     * @returns Promise resolving to the connection object when opened
     */
    open(): Promise<ConnectionInternal>;

    /**
     * Sends a text message to the peer over the established connection.
     *
     * @param message - The message to send
     */
    send(message: string): void;

    /**
     * Terminates the connection with the peer.
     */
    close(): void;

    /**
     * Gets the callback for connection progress updates.
     *
     * @returns The progress callback function or undefined if not set
     */
    get onProgress(): ((progress: number) => void) | undefined;

    /**
     * Sets the callback for connection progress updates.
     *
     * @param onProgress - Function to call with progress updates (0-100)
     */
    set onProgress(onProgress: ((progress: number) => void) | undefined);

    /**
     * Gets the callback for connection state changes.
     *
     * @returns The state change callback function or undefined if not set
     */
    get onStateChanged(): ((from: ConnectionState, to: ConnectionState) => void) | undefined;

    /**
     * Sets the callback for connection state changes.
     *
     * @param onStateChange - Function to call when the connection state changes
     */
    set onStateChanged(onStateChange: ((from: ConnectionState, to: ConnectionState) => void) | undefined);

    /**
     * Gets the callback for received messages.
     *
     * @returns The message callback function or undefined if not set
     */
    get onMessage(): ((message: string) => void) | undefined;

    /**
     * Sets the callback for received messages.
     *
     * @param onMessage - Function to call when a message is received
     */
    set onMessage(onMessage: ((message: string) => void) | undefined);
}

/**
 * Extended interface for internal connection management.
 * Provides additional methods for handling the WebRTC connection establishment process.
 */
export interface ConnectionInternal {
    /**
     * Callback for connection progress updates.
     */
    onProgress?: (progress: number) => void;
    /**
     * Callback for connection state changes.
     */
    onStateChanged?: (from: ConnectionState, to: ConnectionState) => void;
    /**
     * Callback for received messages.
     */
    onMessage?: (message: string) => void;

    /**
     * Gets the timestamp when the connection was opened.
     *
     * @returns The timestamp in milliseconds or undefined if not yet opened
     */
    get openedAt(): number | undefined;

    /**
     * Gets the public key of the peer this connection is established with.
     *
     * @returns The peer's public key as a string
     */
    get publicKey(): string;

    /**
     * Gets the current state of the connection.
     *
     * @returns The connection state (New, Connecting, Open, or Closed)
     */
    get state(): ConnectionState;

    /**
     * Gets the current state of the incoming connection saga.
     *
     * @returns The state of the incoming connection process
     */
    get incomingState(): ConnectionSagaState;

    /**
     * Gets the current state of the outgoing connection saga.
     *
     * @returns The state of the outgoing connection process
     */
    get outgoingState(): ConnectionSagaState;

    /**
     * Sends a text message to the peer over the established connection.
     *
     * @param message - The message to send
     */
    send(message: string): void;

    /**
     * Initiates the incoming connection establishment process.
     *
     * @returns Promise resolving to the connection object when opened
     */
    openIncoming(): Promise<ConnectionInternal>;

    /**
     * Initiates the outgoing connection establishment process.
     *
     * @returns Promise resolving to the connection object when opened
     */
    openOutgoing(): Promise<ConnectionInternal>;

    /**
     * Terminates the connection with the peer.
     */
    close(): void;

    /**
     * Continues the incoming connection process to the next state.
     */
    continueIncoming(): void;

    /**
     * Continues the outgoing connection process to the next state.
     */
    continueOutgoing(): void;

    /**
     * Sets the encryption key for the incoming connection.
     *
     * @param encryptionPublicKeyBase64 - Base64-encoded public encryption key
     */
    setIncomingEncryption(encryptionPublicKeyBase64: string): void;

    /**
     * Sets the encryption key for the outgoing connection.
     *
     * @param encryptionPublicKeyBase64 - Base64-encoded public encryption key
     */
    setOutgoingEncryption(encryptionPublicKeyBase64: string): void;

    /**
     * Sets the session description for the incoming connection.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted session description
     * @returns Promise that resolves when the description is set
     */
    setIncomingDescription(encryptedDataBase64: string): Promise<void>;

    /**
     * Sets the session description for the outgoing connection.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted session description
     * @returns Promise that resolves when the description is set
     */
    setOutgoingDescription(encryptedDataBase64: string): Promise<void>;

    /**
     * Adds an ICE candidate to the incoming connection.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted ICE candidate
     * @returns Promise that resolves when the ICE candidate is added
     */
    addIncomingIce(encryptedDataBase64: string): Promise<void>;

    /**
     * Adds an ICE candidate to the outgoing connection.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted ICE candidate
     * @returns Promise that resolves when the ICE candidate is added
     */
    addOutgoingIce(encryptedDataBase64: string): Promise<void>;
}

/**
 * Converts an internal connection object to the public Connection interface.
 * Hides internal methods and properties that should not be exposed to consumers.
 *
 * @param connection - The internal connection object to translate
 * @returns A public Connection interface for the same connection
 */
export function translateConnection(connection: ConnectionInternal): Connection {
    return {
        get publicKey(): string {
            return connection.publicKey;
        },
        get state(): ConnectionState {
            return connection.state;
        },
        open(): Promise<ConnectionInternal> {
            return connection.openOutgoing();
        },
        send(message: string) {
            connection.send(message);
        },
        close() {
            connection.close();
        },
        get onProgress(): ((progress: number) => void) | undefined {
            return connection.onProgress;
        },
        set onProgress(onProgress: ((progress: number) => void) | undefined) {
            connection.onProgress = onProgress;
        },
        get onStateChanged(): ((from: ConnectionState, to: ConnectionState) => void) | undefined {
            return connection.onStateChanged;
        },
        set onStateChanged(onStateChange: ((from: ConnectionState, to: ConnectionState) => void) | undefined) {
            connection.onStateChanged = onStateChange;
        },
        get onMessage(): ((message: string) => void) | undefined {
            return connection.onMessage;
        },
        set onMessage(onMessage: ((message: string) => void) | undefined) {
            connection.onMessage = onMessage;
        },
    };
}

/**
 * Factory function that creates and returns an implementation of the ConnectionInternal interface.
 * Manages the WebRTC connection establishment and message exchange between peers.
 *
 * @param publicKey - Public key of the peer to connect to
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param callService - Service for making signaling calls
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for encryption operations
 * @param webRTC - WebRTC interface implementation
 * @param iceServers - Optional array of ICE server configurations
 * @returns An implementation of the ConnectionInternal interface
 */
export function getConnection(
    publicKey: string,
    logger: Logger,
    timeService: TimeService,
    callService: CallService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    webRTC: WebRTC,
    iceServers?: IceServer[],
): ConnectionInternal {
    let openedAt: number | undefined;
    let state: ConnectionState = ConnectionState.New;
    let incomingSaga = createConnectionSaga('incoming');
    let outgoingSaga = createConnectionSaga('outgoing');

    function createConnectionSaga(type: ConnectionSagaType) {
        return getConnectionSaga(
            publicKey,
            type,
            logger,
            timeService,
            callService,
            sessionService,
            base64,
            utf8,
            cryptography,
            webRTC,
            iceServers,
        );
    }

    function connectionOnProgress(progress: number): void {
        new Promise<void>((resolve) => {
            if (connection.onProgress !== undefined && connection.onProgress !== null) {
                connection.onProgress(progress);
            }
            resolve();
        }).catch((err) => {
            logger.error(`[connection] Progress callback error in connection with ${connection.publicKey}.`, err);
        });
    }

    function connectionOnStateChange(from: ConnectionState, to: ConnectionState): void {
        new Promise<void>((resolve) => {
            connection.onStateChanged?.call(connection, from, to);
            resolve();
        }).catch((err) => {
            logger.error(`[connection] State change callback error in connection with ${connection.publicKey}.`, err);
        });
    }

    function connectionOnMessage(message: string) {
        new Promise<void>((resolve) => {
            connection.onMessage?.call(connection, message);
            resolve();
        }).catch((err) => {
            logger.error(`[connection] Message callback error in connection with ${connection.publicKey}.`, err);
        });
    }

    function getConnectionSagaOnStateChanged(type: ConnectionSagaType) {
        return (from: ConnectionSagaState, to: ConnectionSagaState) => {
            const old = state;
            const actual = connection.state;
            if (old !== actual) {
                connectionOnStateChange(old, actual);
                logger.debug(
                    `[connection] State changed in connection with ${connection.publicKey} from ${old} to ${actual}.`,
                );
            }
            if (from !== to) {
                logger.debug(
                    `[connection-saga] State changed in ${type} connection saga with ${connection.publicKey} from ${ConnectionSagaState[from]} to ${ConnectionSagaState[to]}.`,
                );
            }
            const { state: incomingState } = incomingSaga;
            const { state: outgoingState } = outgoingSaga;
            const progress = Math.min(
                Math.ceil((Math.max(incomingState, outgoingState) * 100) / ConnectionSagaState.Connected),
                100,
            );
            logger.debug(`[connection] Progress in connection with ${connection.publicKey}: ${progress}%.`);
            connectionOnProgress(progress);
        };
    }

    function getSaga(): ConnectionSaga | undefined {
        if (incomingSaga.state === ConnectionSagaState.Connected) {
            return incomingSaga;
        }
        if (outgoingSaga.state === ConnectionSagaState.Connected) {
            return outgoingSaga;
        }
        return undefined;
    }

    async function open(
        incomingInitialState: ConnectionSagaState,
        outgoingInitialState: ConnectionSagaState,
    ): Promise<void> {
        openedAt = timeService.serverTime;
        const sagas = await Promise.all([
            incomingSaga.open(incomingInitialState),
            outgoingSaga.open(outgoingInitialState),
        ]);
        logger.debug(
            `[connection] Saga states: ${sagas[0].type}=${ConnectionSagaState[sagas[0].state]}; ${sagas[1].type}=${ConnectionSagaState[sagas[1].state]}`,
        );
    }

    incomingSaga.onMessage = connectionOnMessage;
    outgoingSaga.onMessage = connectionOnMessage;
    incomingSaga.onStateChanged = getConnectionSagaOnStateChanged(incomingSaga.type);
    outgoingSaga.onStateChanged = getConnectionSagaOnStateChanged(outgoingSaga.type);

    const connection: ConnectionInternal = {
        get openedAt(): number | undefined {
            return openedAt;
        },
        get publicKey(): string {
            return publicKey;
        },
        get state(): ConnectionState {
            const { state: inState } = incomingSaga;
            const { state: outState } = outgoingSaga;
            if (inState === ConnectionSagaState.Closed || outState === ConnectionSagaState.Closed) {
                state = ConnectionState.Closed;
            } else if (inState === ConnectionSagaState.Connected || outState === ConnectionSagaState.Connected) {
                state = ConnectionState.Open;
            } else if (inState === ConnectionSagaState.New && outState === ConnectionSagaState.New) {
                state = ConnectionState.New;
            } else {
                state = ConnectionState.Connecting;
            }
            return state;
        },
        get incomingState() {
            return incomingSaga.state;
        },
        get outgoingState() {
            return outgoingSaga.state;
        },
        onProgress: undefined,
        onStateChanged: undefined,
        onMessage: undefined,
        send(message: string) {
            const saga = getSaga();
            if (!saga) {
                throw newError(logger, '[connection] Connection is not ready yet.');
            }
            saga.send(message);
        },
        async openIncoming(): Promise<ConnectionInternal> {
            await open(ConnectionSagaState.SendOffer, ConnectionSagaState.SendDial);
            return this;
        },
        async openOutgoing(): Promise<ConnectionInternal> {
            await open(ConnectionSagaState.AwaitDial, ConnectionSagaState.SendDial);
            return this;
        },
        /**
         * Terminates the connection with the peer.
         */
        close(): void {
            callService.close(sessionService.signingPublicKeyBase64, this.publicKey);
            incomingSaga.abort();
            outgoingSaga.abort();
        },
        continueIncoming(): void {
            incomingSaga.continue();
        },
        continueOutgoing(): void {
            outgoingSaga.continue();
        },
        setIncomingEncryption(encryptionPublicKeyBase64: string): void {
            incomingSaga.setEncryption(encryptionPublicKeyBase64);
        },
        setOutgoingEncryption(encryptionPublicKeyBase64: string): void {
            outgoingSaga.setEncryption(encryptionPublicKeyBase64);
        },
        async setIncomingDescription(encryptedDataBase64: string): Promise<void> {
            await incomingSaga.setDescription(encryptedDataBase64);
        },
        async setOutgoingDescription(encryptedDataBase64: string): Promise<void> {
            await outgoingSaga.setDescription(encryptedDataBase64);
        },
        async addIncomingIce(encryptedDataBase64: string): Promise<void> {
            await incomingSaga.addIceCandidate(encryptedDataBase64);
        },
        async addOutgoingIce(encryptedDataBase64: string): Promise<void> {
            await outgoingSaga.addIceCandidate(encryptedDataBase64);
        },
    };
    return connection;
}
