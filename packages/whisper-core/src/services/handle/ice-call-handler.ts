import { IceCallData } from '../../models/ice-call-data';
import { IceSource } from '../../models/ice-source';
import { CallRequest } from '../../models/infrasctructure/call-request';
import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { Utf8 } from '../../utils/utf8';
import { ConnectionService } from '../connection-service';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { getCallHandler, CallHandler } from './call-handler';

/**
 * Interface for handling 'ice' call requests in the WebRTC signaling process.
 * Extends the base CallHandler with ICE candidate-specific functionality.
 */
export interface IceCallHandler extends CallHandler<IceCallData> {}

/**
 * Factory function that creates and returns an implementation of the IceCallHandler interface.
 * Handles incoming ICE (Interactive Connectivity Establishment) candidates
 * during the WebRTC connection establishment process.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @param connectionService - Service for managing peer connections
 * @returns An implementation of the IceCallHandler interface
 */
export function getIceCallHandler(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    connectionService: ConnectionService,
): IceCallHandler {
    const handler = getCallHandler<IceCallData>(logger, timeService, sessionService, base64, utf8, cryptography);
    return {
        ...handler,
        async handle(request: CallRequest<IceCallData>): Promise<boolean> {
            const peerPublicKey = request.b.a;
            const connection = connectionService.getConnection(peerPublicKey);
            if (!connection) {
                logger.debug(
                    `[ice-call-handler] Incoming call '${request.a}' from ${peerPublicKey} ignored. No one connection is there.`,
                );
                return true;
            }
            switch (request.b.f) {
                case IceSource.Incoming:
                    connection.setOutgoingEncryption(request.b.d);
                    await connection.addOutgoingIce(request.b.e);
                    break;
                case IceSource.Outgoing:
                    connection.setIncomingEncryption(request.b.d);
                    await connection.addIncomingIce(request.b.e);
                    break;
                default:
                    logger.debug(`[ice-call-handler] Unknown ice source from ${peerPublicKey} ignored.`);
                    break;
            }
            return true;
        },
    };
}
