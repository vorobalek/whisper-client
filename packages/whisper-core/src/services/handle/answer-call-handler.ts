import { AnswerCallData } from '../../models/answer-call-data';
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
 * Interface for handling 'answer' call requests in the WebRTC signaling process.
 * Extends the base CallHandler with answer-specific functionality.
 */
export interface AnswerCallHandler extends CallHandler<AnswerCallData> {}

/**
 * Factory function that creates and returns an implementation of the AnswerCallHandler interface.
 * Handles incoming WebRTC connection answers during the signaling process.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @param connectionService - Service for managing peer connections
 * @returns An implementation of the AnswerCallHandler interface
 */
export function getAnswerCallHandler(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    connectionService: ConnectionService,
): AnswerCallHandler {
    const handler = getCallHandler<AnswerCallData>(logger, timeService, sessionService, base64, utf8, cryptography);
    return {
        ...handler,
        async handle(request: CallRequest<AnswerCallData>): Promise<boolean> {
            const peerPublicKey = request.b.a;
            const connection = connectionService.getConnection(peerPublicKey);
            if (!connection) {
                logger.debug(
                    `[answer-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. No one connection is there.`,
                );
                return true;
            }
            if (connection.incomingState !== ConnectionSagaState.AwaitingAnswer) {
                logger.debug(
                    `[answer-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. Incoming saga is not in suitable state (${ConnectionSagaState[ConnectionSagaState.AwaitingAnswer]} expected, ${ConnectionSagaState[connection.incomingState]} found).`,
                );
                return true;
            }
            connection.setIncomingEncryption(request.b.d);
            await connection.setIncomingDescription(request.b.e);
            connection.continueIncoming();
            return true;
        },
    };
}
