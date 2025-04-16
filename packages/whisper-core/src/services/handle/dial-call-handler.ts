import { DialCallData } from '../../models/dial-call-data';
import { CallRequest } from '../../models/infrasctructure/call-request';
import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { Utf8 } from '../../utils/utf8';
import { ConnectionService } from '../connection-service';
import { ConnectionSagaState } from '../connection/connection-saga';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { CallHandler, getCallHandler } from './call-handler';

/**
 * Configuration interface for the dial call handler.
 * Defines callbacks that allow the application to respond to incoming dial requests.
 */
export type DialCallHandlerConfig = {
    /**
     * Callback to focus the UI on an incoming dial request.
     * If provided, the application can show appropriate UI elements when a dial is received.
     *
     * @param publicKey - Public key of the peer initiating the dial
     * @returns Promise resolving to a boolean indicating if the focus was successful
     */
    focusOnDial?: (publicKey: string) => Promise<boolean>;

    /**
     * Callback to request user permission for an incoming dial.
     * If provided, allows the application to prompt the user to accept or reject the dial.
     *
     * @param publicKey - Public key of the peer initiating the dial
     * @returns Promise resolving to a boolean indicating if the dial was accepted
     */
    requestDial?: (publicKey: string) => Promise<boolean>;
};

/**
 * Interface for handling 'dial' call requests in the signaling process.
 * Extends the base CallHandler with dial-specific initialization.
 */
export interface DialCallHandler extends CallHandler<DialCallData> {
    /**
     * Initializes the dial call handler with the provided configuration.
     * Sets up callbacks for user interaction during dial events.
     *
     * @param config - Configuration with optional focus and request callbacks
     */
    initialize(config: DialCallHandlerConfig): void;
}

/**
 * Factory function that creates and returns an implementation of the DialCallHandler interface.
 * Handles incoming dial requests that initiate the WebRTC connection process.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @param connectionService - Service for managing peer connections
 * @returns An implementation of the DialCallHandler interface
 */
export function getDialCallHandler(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    connectionService: ConnectionService,
): DialCallHandler {
    const handler = getCallHandler<DialCallData>(logger, timeService, sessionService, base64, utf8, cryptography);
    let focusOnDial: ((publicKey: string) => Promise<boolean>) | undefined;
    let requestDial: ((publicKey: string) => Promise<boolean>) | undefined;
    return {
        initialize(config: DialCallHandlerConfig) {
            focusOnDial = config.focusOnDial;
            requestDial = config.requestDial;
            logger.debug('[dial-call-handler] Initialized.');
        },
        ...handler,
        async handle(request: CallRequest<DialCallData>): Promise<boolean> {
            const peerPublicKey = request.b.a;
            let connection = connectionService.getConnection(peerPublicKey);
            if (connection) {
                connection.setIncomingEncryption(request.b.d);
                if (connection.incomingState === ConnectionSagaState.AwaitingDial) {
                    connection.continueIncoming();
                    return true;
                }
                if (connection.incomingState !== ConnectionSagaState.AwaitingAnswer) {
                    logger.debug(
                        `[dial-call-handler] Incoming call '${request.a}' from ${peerPublicKey} triggered connection re-open. Incoming saga is not in suitable state (${ConnectionSagaState[ConnectionSagaState.AwaitingDial]} expected, ${ConnectionSagaState[connection.incomingState]} found).`,
                    );
                    new Promise(async () => {
                        if (focusOnDial !== undefined && focusOnDial !== null) {
                            await focusOnDial(request.b.a);
                        }
                    });
                    await connection.openIncoming();
                }
            } else {
                if (focusOnDial !== undefined && focusOnDial !== null && !(await focusOnDial(request.b.a))) {
                    return false;
                }
                if (requestDial !== undefined && requestDial !== null && !(await requestDial(request.b.a))) {
                    logger.debug(`[dial-call-handler] Incoming call '${request.a}' from ${peerPublicKey} declined.`);
                    return true;
                }
                connection = connectionService.createIncoming(peerPublicKey);
                connection.setIncomingEncryption(request.b.d);
                await connection.openIncoming();
            }
            return true;
        },
    };
}
