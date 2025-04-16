import { CallRequest } from '../../models/infrasctructure/call-request';
import { OfferCallData } from '../../models/offer-call-data';
import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { Utf8 } from '../../utils/utf8';
import { ConnectionService } from '../connection-service';
import { ConnectionSagaState } from '../connection/connection-saga';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { getCallHandler, CallHandler } from './call-handler';

/**
 * Interface for handling 'offer' call requests in the WebRTC signaling process.
 * Extends the base CallHandler with offer-specific functionality.
 */
export interface OfferCallHandler extends CallHandler<OfferCallData> {}

/**
 * Factory function that creates and returns an implementation of the OfferCallHandler interface.
 * Handles incoming WebRTC connection offers during the signaling process.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @param connectionService - Service for managing peer connections
 * @returns An implementation of the OfferCallHandler interface
 */
export function getOfferCallHandler(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    connectionService: ConnectionService,
): OfferCallHandler {
    const handler = getCallHandler<OfferCallData>(logger, timeService, sessionService, base64, utf8, cryptography);
    return {
        ...handler,
        async handle(request: CallRequest<OfferCallData>): Promise<boolean> {
            const peerPublicKey = request.b.a;
            const connection = connectionService.getConnection(peerPublicKey);
            if (!connection) {
                logger.debug(
                    `[offer-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. No one connection is there.`,
                );
                return true;
            }
            if (connection.outgoingState !== ConnectionSagaState.AwaitingOffer) {
                logger.debug(
                    `[offer-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. Outgoing saga is not in suitable state (${ConnectionSagaState[ConnectionSagaState.AwaitingOffer]} expected, ${ConnectionSagaState[connection.outgoingState]} found).`,
                );
                return true;
            }
            connection.setOutgoingEncryption(request.b.d);
            await connection.setOutgoingDescription(request.b.e);
            connection.continueOutgoing();
            return true;
        },
    };
}
