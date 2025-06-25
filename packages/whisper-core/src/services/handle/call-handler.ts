import { CloseCallData } from '../../models/close-call-data';
import { CallData } from '../../models/infrasctructure/call-data';
import { CallPayload } from '../../models/infrasctructure/call-payload';
import { CallRequest } from '../../models/infrasctructure/call-request';
import { Base64 } from '../../utils/base64';
import { Cryptography } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { newError } from '../../utils/new-error';
import { Utf8 } from '../../utils/utf8';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';

/**
 * Generic interface for handling different types of call requests.
 * Provides methods for parsing, validating, and processing call requests.
 *
 * @template TypeData - The specific type of call data this handler processes
 */
export interface CallHandler<TypeData extends CallData> {
    /**
     * Parses a raw call payload into a typed call request.
     *
     * @param payloadData - The raw call payload to parse
     * @returns A properly typed call request object
     */
    parse(payloadData: CallPayload): CallRequest<TypeData>;

    /**
     * Validates a call request to ensure it is legitimate and intended for this recipient.
     * Performs timestamp validation, recipient validation, and signature verification.
     *
     * @param request - The call request to validate
     * @returns Boolean indicating if the request is valid
     */
    validate(request: CallRequest<TypeData>): boolean;

    /**
     * Processes a validated call request and performs the necessary actions.
     * This method must be implemented by specific call handlers.
     *
     * @param request - The validated call request to handle
     * @returns Promise resolving to a boolean indicating if handling was successful
     */
    handle(request: CallRequest<TypeData>): Promise<boolean>;
}

/**
 * Factory function that creates a base implementation of the CallHandler interface.
 * Provides common functionality for parsing and validating call requests.
 *
 * @template TypeData - The specific type of call data this handler processes
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signature verification
 * @returns A partial implementation of the CallHandler interface
 */
export function getCallHandler<TypeData extends CloseCallData>(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
): CallHandler<TypeData> {
    function validateTimestamp(request: CallRequest<TypeData>): boolean {
        const delta = request.b.b - timeService.serverTime;
        if (Math.abs(delta) > 5 * 1000) {
            logger.debug(
                `[${request.a}-call-handler] Request timestamp is more than 5 seconds stale (delta ${delta}ms).`,
            );
            return false;
        }
        logger.debug(`[${request.a}-call-handler] Request timestamp is valid (delta ${delta}ms).`);
        return true;
    }

    function validatePublicKey(request: CallRequest<TypeData>): boolean {
        const isIntendedForMe = sessionService.signingPublicKeyBase64 === request.b.c;
        if (!isIntendedForMe) {
            logger.debug(`[${request.a}-call-handler] Message is not intended for this user.`);
            return false;
        }
        logger.debug(`[${request.a}-call-handler] Message is intended for this user.`);
        return true;
    }

    function validateSignature(request: CallRequest<TypeData>): boolean {
        const message = JSON.stringify(request.b);
        const messageBytes = utf8.decode(message);
        const signature = base64.decode(request.c);
        const singingPublicKeyBase64 = request.b.a;
        const signingPublicKey = base64.decode(singingPublicKeyBase64);
        const isSignatureVerified = cryptography.verifySignature(messageBytes, signature, signingPublicKey);
        if (!isSignatureVerified) {
            logger.debug(`[${request.a}-call-handler] Signature is not valid.`);
            return false;
        }
        logger.debug(`[${request.a}-call-handler] Signature is valid.`);
        return true;
    }

    return {
        parse(payloadData: CallPayload): CallRequest<TypeData> {
            const data = JSON.parse(payloadData.b) as TypeData;
            if (!data) {
                throw newError(
                    logger,
                    `[${payloadData.a}-call-handler] Unable to parse call data for call '${payloadData.a}'. Data: ${payloadData.b}`,
                );
            }
            return {
                a: payloadData.a,
                b: data,
                c: payloadData.c,
            };
        },
        validate(request: CallRequest<TypeData>): boolean {
            if (!validateTimestamp(request)) {
                return false;
            }
            if (!validatePublicKey(request)) {
                return false;
            }
            return validateSignature(request);
        },
        handle(request: CallRequest<TypeData>): Promise<boolean> {
            throw newError(logger, `[${request.a}-call-handler] Base handle method is not implemented.`);
        },
    };
}
