import { CallServiceConfig, getCallService } from './services/call-service';
import { ConnectionServiceConfig, getConnectionService } from './services/connection-service';
import { Connection, translateConnection } from './services/connection/connection';
import { getDefaultWebRTC } from './services/connection/web-rtc';
import { getHandleService, HandleServiceConfig } from './services/handle-service';
import { getAnswerCallHandler } from './services/handle/answer-call-handler';
import { getCloseCallHandler } from './services/handle/close-call-handler';
import { getDialCallHandler } from './services/handle/dial-call-handler';
import { getIceCallHandler } from './services/handle/ice-call-handler';
import { getOfferCallHandler } from './services/handle/offer-call-handler';
import { LoggerServiceConfig } from './services/logger-service';
import { getPushService, PushServiceConfig } from './services/push-service';
import { getSessionService, SessionServiceConfig } from './services/session-service';
import { getSignalRService, SignalRServiceConfig } from './services/signalr-service';
import { getTimeService } from './services/time-service';
import { getWorkerService, WorkerServiceConfig } from './services/worker-service';
import { getApiClient } from './utils/api-client';
import { getBase64 } from './utils/base64';
import { CryptoKeyPair, getCryptography } from './utils/cryptography';
import { Logger } from './utils/logger';
import { getUtf8 } from './utils/utf8';
import { urlBase64ToUint8Array } from './utils/web-push-helpers';

/**
 * Configuration interface for the Whisper messenger.
 * Combines configuration options from all services used by Whisper.
 */
export type WhisperConfig = {
    /**
     * Optional callback triggered when Whisper may work unstably.
     * Called when certain required features (like notifications) are unavailable.
     *
     * @param reason - Description of why the application may work unstably
     * @returns Promise that resolves when the warning has been acknowledged
     */
    onMayWorkUnstably?: (reason: string) => Promise<void>;
} & LoggerServiceConfig &
    SignalRServiceConfig &
    WorkerServiceConfig &
    PushServiceConfig &
    SessionServiceConfig &
    CallServiceConfig &
    ConnectionServiceConfig &
    HandleServiceConfig;

/**
 * Main interface for the Whisper messenger.
 * Provides methods for managing connections and accessing messenger functionality.
 */
export interface Whisper {
    /**
     * Gets the public key of the current user.
     * This is the user's identity in the messenger.
     *
     * @returns The user's public key as a string, or undefined if not initialized
     */
    get publicKey(): string | undefined;

    /**
     * Gets the current server time.
     * Used for synchronizing timestamps across the system.
     *
     * @returns Current server time in milliseconds
     */
    get serverTime(): number;

    /**
     * Gets all active connections managed by the messenger.
     *
     * @returns Array of all connection objects
     */
    get connections(): Connection[];

    /**
     * Gets or creates a connection with a peer identified by their public key.
     * If a connection already exists, it is returned; otherwise, a new outgoing connection is created.
     *
     * @param publicKeyBase64 - Public key of the peer to connect to
     * @returns Connection object for communicating with the peer
     */
    get(publicKeyBase64: string): Connection;

    /**
     * Terminates and removes a connection with a peer.
     *
     * @param publicKeyBase64 - Public key of the peer whose connection should be removed
     */
    delete(publicKeyBase64: string): void;

    /**
     * Shows a browser notification to the user.
     *
     * @param title - Title of the notification
     * @param options - Additional notification options
     * @returns Boolean indicating if the notification was successfully shown
     */
    showNotification(title: string, options?: NotificationOptions): boolean;
}

/**
 * Interface for initializing and creating Whisper messenger instances.
 * Provides factory methods for creating and configuring the messenger.
 */
export interface WhisperPrototype {
    /**
     * Initializes a new Whisper messenger instance with the provided configuration.
     * Sets up all required services and establishes necessary connections.
     *
     * @param config - Configuration options for all services
     * @returns Promise resolving to a configured Whisper instance
     */
    initialize(config: WhisperConfig): Promise<Whisper>;

    /**
     * Generates a new signing key pair for user authentication.
     *
     * @returns A cryptographic key pair for signing operations
     */
    generateSigningKeyPair(): CryptoKeyPair;
}

/**
 * Factory function that creates and returns an implementation of the WhisperPrototype interface.
 * Sets up the dependency injection chain for all required services.
 *
 * @param logger - Logger instance for error and debugging information
 * @returns An implementation of the WhisperPrototype interface
 */
export function getPrototype(logger: Logger): WhisperPrototype {
    const base64 = getBase64();
    const utf8 = getUtf8();
    const timeService = getTimeService(logger);
    const cryptography = getCryptography(logger);
    const apiClient = getApiClient(logger);
    const signalRService = getSignalRService(logger);
    const workerService = getWorkerService(logger);
    const sessionService = getSessionService(logger, base64);
    const pushService = getPushService(logger, workerService, base64);
    const callService = getCallService(
        logger,
        timeService,
        sessionService,
        apiClient,
        signalRService,
        base64,
        utf8,
        cryptography,
    );
    const connectionService = getConnectionService(
        logger,
        timeService,
        callService,
        sessionService,
        base64,
        utf8,
        cryptography,
    );
    const dialCallHandler = getDialCallHandler(
        logger,
        timeService,
        sessionService,
        base64,
        utf8,
        cryptography,
        connectionService,
    );
    const offerCallHandler = getOfferCallHandler(
        logger,
        timeService,
        sessionService,
        base64,
        utf8,
        cryptography,
        connectionService,
    );
    const answerCallHandler = getAnswerCallHandler(
        logger,
        timeService,
        sessionService,
        base64,
        utf8,
        cryptography,
        connectionService,
    );
    const iceCallHandler = getIceCallHandler(
        logger,
        timeService,
        sessionService,
        base64,
        utf8,
        cryptography,
        connectionService,
    );
    const closeCallHandler = getCloseCallHandler(
        logger,
        timeService,
        sessionService,
        base64,
        utf8,
        cryptography,
        connectionService,
    );
    const handleService = getHandleService(
        logger,
        dialCallHandler,
        offerCallHandler,
        answerCallHandler,
        iceCallHandler,
        closeCallHandler,
    );
    let busy = false;
    let initializationResolver: ((value: Whisper) => void) | undefined;
    let initializationPromise = new Promise<Whisper>((resolve) => {
        initializationResolver = resolve;
    });
    const whisper: Whisper = {
        get publicKey(): string | undefined {
            return sessionService.signingPublicKeyBase64Safe;
        },
        get serverTime(): number {
            return timeService.serverTime;
        },
        get connections(): Connection[] {
            return connectionService.connections.map(translateConnection);
        },
        get(publicKeyBase64: string): Connection {
            const connection = connectionService.getConnection(publicKeyBase64);
            return translateConnection(connection || connectionService.createOutgoing(publicKeyBase64));
        },
        delete(publicKeyBase64: string) {
            connectionService.deleteConnection(publicKeyBase64);
        },
        showNotification(title: string, options?: NotificationOptions) {
            return pushService.showNotification(title, options);
        },
    };
    return {
        async initialize(config: WhisperConfig): Promise<Whisper> {
            if (busy) {
                logger.warn('[whisper] Parallel initialization attempt.');
                await initializationPromise;
                return whisper;
            }
            busy = true;
            handleService.initialize(config);
            connectionService.initialize({
                ...config,
                webRTC: getDefaultWebRTC(),
            });
            callService.initialize({
                ...config,
                navigator: window.navigator,
            });

            await workerService.initialize({
                ...config,
                navigator: window.navigator,
            });

            await sessionService.initialize(config);

            await pushService.initialize({
                ...config,
                onCall: handleService.call,
                notification: window.Notification,
                pushManager: window.PushManager,
                urlBase64ToUint8Array: urlBase64ToUint8Array,
            });

            const subscription = await pushService.getSubscription();

            await signalRService.initialize({
                ...config,
                onCall: handleService.call,
                onReady: async () => {
                    await callService.update(sessionService.signingPublicKeyBase64, subscription);
                },
                initializationTimeout: 5000,
            });

            workerService.controller?.postMessage({ type: 'CLIENT_READY' });
            setInterval(async () => {
                await callService.update(sessionService.signingPublicKeyBase64, subscription);
            }, 60 * 1000);

            if (!subscription) {
                if (config.onMayWorkUnstably) {
                    await config.onMayWorkUnstably(
                        'Due to notifications unavailable, Whisper Messenger may work unstably.',
                    );
                }
            }

            logger.log('[whisper] Initialized.');
            initializationResolver?.call(this, whisper);
            busy = false;
            return whisper;
        },
        generateSigningKeyPair(): CryptoKeyPair {
            return cryptography.generateSigningKeyPair();
        },
    };
}
