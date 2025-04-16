import { CloseCallData } from '../../models/close-call-data';
import { CallRequest } from '../../models/infrasctructure/call-request';
import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { Utf8 } from '../../utils/utf8';
import { ConnectionService } from '../connection-service';
import { ConnectionState } from '../connection/connection';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { CallHandler, getCallHandler } from './call-handler';

/**
 * Interface for handling 'close' call requests in the WebRTC signaling process.
 * Extends the base CallHandler with connection termination functionality.
 */
export interface CloseCallHandler extends CallHandler<CloseCallData> {}

/**
 * Factory function that creates and returns an implementation of the CloseCallHandler interface.
 * Handles incoming requests to terminate WebRTC connections.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @param connectionService - Service for managing peer connections
 * @returns An implementation of the CloseCallHandler interface
 */
export function getCloseCallHandler(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    connectionService: ConnectionService,
): CloseCallHandler {
    const handler = getCallHandler<CloseCallData>(logger, timeService, sessionService, base64, utf8, cryptography);
    return {
        ...handler,
        handle(request: CallRequest<CloseCallData>): Promise<boolean> {
            const peerPublicKey = request.b.a;
            const connection = connectionService.getConnection(peerPublicKey);
            if (!connection) {
                logger.debug(
                    `[close-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. No one connection is there.`,
                );
                return Promise.resolve(true);
            }
            if (connection.state === ConnectionState.Closed) {
                logger.debug(
                    `[close-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. Connection is not in suitable state (not ${ConnectionState.Closed} expected, ${connection.state} found).`,
                );
                return Promise.resolve(true);
            }
            const connectionOpenedAt = connection.openedAt;
            if (connectionOpenedAt !== undefined && connectionOpenedAt !== null && connectionOpenedAt >= request.b.b) {
                logger.debug(
                    `[close-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. Timestamp is too late.`,
                );
                return Promise.resolve(true);
            }
            connection.close();
            return Promise.resolve(true);
        },
    };
}
