import { Base64 } from '../utils/base64';
import { Cryptography } from '../utils/cryptography';
import { Logger } from '../utils/logger';
import { Utf8 } from '../utils/utf8';
import { CallService } from './call-service';
import {
    ConnectionInternal,
    Connection,
    ConnectionState,
    getConnection,
    translateConnection,
} from './connection/connection';
import { IceServer } from './connection/ice-server';
import { WebRTC } from './connection/web-rtc';
import { SessionService } from './session-service';
import { TimeService } from './time-service';

/**
 * Configuration interface for the connection service.
 * Defines callbacks and configuration options for managing peer connections.
 */
export type ConnectionServiceConfig = {
    /**
     * Callback triggered when a new incoming connection is established.
     * Allows the application to react to peer connection attempts.
     *
     * @param connection - The new incoming connection that was established
     */
    onIncomingConnection?: (connection: Connection) => void;

    /**
     * Array of ICE server configurations for WebRTC connections.
     * Used to assist in traversing NATs and establishing peer connections.
     */
    iceServers?: IceServer[];
};

/**
 * Extended configuration interface with additional properties for internal use.
 * Includes all properties from ConnectionServiceConfig plus WebRTC dependencies.
 */
type ConnectionServiceEffectiveConfig = ConnectionServiceConfig & {
    /**
     * WebRTC interface implementations.
     */
    webRTC: WebRTC;
};

/**
 * Service interface for managing peer-to-peer connections.
 * Provides methods for creating, accessing, and managing WebRTC connections.
 */
export interface ConnectionService {
    /**
     * Initializes the connection service with the provided configuration.
     * Sets up callbacks and default configuration for WebRTC connections.
     *
     * @param config - Configuration with callbacks and WebRTC settings
     */
    initialize(config: ConnectionServiceEffectiveConfig): void;

    /**
     * Gets all active connections managed by the service.
     *
     * @returns Array of all connection objects
     */
    get connections(): ConnectionInternal[];

    /**
     * Retrieves a connection by the peer's public key.
     *
     * @param publicKey - Public key of the peer to find
     * @returns The connection if found, or undefined if no connection exists
     */
    getConnection(publicKey: string): ConnectionInternal | undefined;

    /**
     * Creates a new incoming connection with the specified peer.
     *
     * @param peerSigningPublicKey - Public key of the peer initiating the connection
     * @returns The newly created connection object
     */
    createIncoming(peerSigningPublicKey: string): ConnectionInternal;

    /**
     * Creates a new outgoing connection to the specified peer.
     *
     * @param peerSigningPublicKey - Public key of the peer to connect to
     * @returns The newly created connection object
     */
    createOutgoing(peerSigningPublicKey: string): ConnectionInternal;

    /**
     * Terminates and removes a connection with the specified peer.
     *
     * @param publicKey - Public key of the peer whose connection should be removed
     */
    deleteConnection(publicKey: string): void;
}

/**
 * Factory function that creates and returns an implementation of the ConnectionService interface.
 * Manages the lifecycle of peer-to-peer WebRTC connections.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param callService - Service for making signaling calls
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for encryption operations
 * @returns An implementation of the ConnectionService interface
 */
export function getConnectionService(
    logger: Logger,
    timeService: TimeService,
    callService: CallService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
): ConnectionService {
    let onIncomingConnection: ((connection: Connection) => void) | undefined;
    let iceServers: IceServer[] | undefined;
    let webRTC: WebRTC;
    let connections: {
        [publicKey: string]: ConnectionInternal;
    } = {};
    function createConnection(publicKey: string): ConnectionInternal {
        const connection = getConnection(
            publicKey,
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
        connections[publicKey] = connection;
        return connection;
    }
    return {
        initialize(config: ConnectionServiceEffectiveConfig): void {
            onIncomingConnection = config.onIncomingConnection;
            iceServers = config.iceServers;
            webRTC = config.webRTC;
            logger.debug('[connection-service] Initialized.');
        },
        get connections(): ConnectionInternal[] {
            return Object.values(connections);
        },
        getConnection(publicKey: string): ConnectionInternal | undefined {
            return connections[publicKey];
        },
        createIncoming(publicKey: string): ConnectionInternal {
            const connection = createConnection(publicKey);
            new Promise<void>((resolve) => {
                if (onIncomingConnection) {
                    onIncomingConnection(translateConnection(connection));
                }
                resolve();
            }).catch((err) => {
                logger.error('[connection-service] On incoming connection callback error.', err);
            });
            return connection;
        },
        createOutgoing(publicKey: string): ConnectionInternal {
            return createConnection(publicKey);
        },
        deleteConnection(publicKey: string) {
            if (
                connections[publicKey]?.state !== undefined &&
                connections[publicKey]?.state !== null &&
                connections[publicKey].state !== ConnectionState.Closed
            ) {
                connections[publicKey].close();
            }
            delete connections[publicKey];
        },
    };
}
