import { CallData } from '../models/infrasctructure/call-data';
import { CallPayload } from '../models/infrasctructure/call-payload';
import { Logger } from '../utils/logger';
import { AnswerCallHandler } from './handle/answer-call-handler';
import { CallHandler } from './handle/call-handler';
import { CloseCallHandler } from './handle/close-call-handler';
import { DialCallHandler, DialCallHandlerConfig } from './handle/dial-call-handler';
import { IceCallHandler } from './handle/ice-call-handler';
import { OfferCallHandler } from './handle/offer-call-handler';

/**
 * Configuration interface for the handle service.
 * Extends DialCallHandlerConfig to provide configuration options for call handlers.
 */
export type HandleServiceConfig = {} & DialCallHandlerConfig;

/**
 * Service interface for dispatching incoming call payloads to appropriate handlers.
 * Acts as a central routing mechanism for all types of signaling messages.
 */
export interface HandleService {
    /**
     * Initializes the handle service and its associated call handlers.
     *
     * @param config - Configuration with options for various call handlers
     */
    initialize(config: HandleServiceConfig): void;

    /**
     * Processes an incoming call payload by routing it to the appropriate handler.
     * Parses, validates, and dispatches the call to the correct handler based on its type.
     *
     * @param payload - The incoming call payload to be processed
     * @returns Promise resolving when the call has been handled
     */
    call(payload: CallPayload): Promise<void>;
}

/**
 * Factory function that creates and returns an implementation of the HandleService interface.
 * Centralizes the routing logic for different types of call messages.
 *
 * @param logger - Logger instance for error and debugging information
 * @param dialCallHandler - Handler for 'dial' call requests
 * @param offerCallHandler - Handler for 'offer' call requests
 * @param answerCallHandler - Handler for 'answer' call requests
 * @param iceCallHandler - Handler for 'ice' call requests
 * @param closeCallHandler - Handler for 'close' call requests
 * @returns An implementation of the HandleService interface
 */
export function getHandleService(
    logger: Logger,
    dialCallHandler: DialCallHandler,
    offerCallHandler: OfferCallHandler,
    answerCallHandler: AnswerCallHandler,
    iceCallHandler: IceCallHandler,
    closeCallHandler: CloseCallHandler,
): HandleService {
    async function processCallInternal<TypeData extends CallData>(
        handler: CallHandler<TypeData>,
        payload: CallPayload,
        validate: boolean,
    ): Promise<boolean> {
        const request = handler.parse(payload);
        if (validate) {
            const isValid = handler.validate(request);
            if (!isValid) {
                logger.debug(`[handle-service] Call '${request.a}' is not valid, skipped.`);
                return true;
            }
        }
        logger.debug(`[handle-service] Processing incoming call '${request.a}' from ${request.b.a}...`);
        if (!(await handler.handle(request))) {
            logger.debug(`[handle-service] Postpone processing call '${payload.a}'.`, payload);
            queue.push(payload);
            return false;
        }
        logger.debug(`[handle-service] Successfully processed call '${payload.a}'`, payload);
        return true;
    }

    async function processCall(payload: CallPayload, validate: boolean = true): Promise<boolean> {
        switch (payload.a) {
            case 'dial':
                return await processCallInternal(dialCallHandler, payload, validate);
            case 'offer':
                return await processCallInternal(offerCallHandler, payload, validate);
            case 'answer':
                return await processCallInternal(answerCallHandler, payload, validate);
            case 'ice':
                return await processCallInternal(iceCallHandler, payload, validate);
            case 'close':
                return await processCallInternal(closeCallHandler, payload, validate);
        }
        return true;
    }

    let queue: Array<CallPayload> = [];

    async function processCallQueue() {
        for (let payload = queue.shift(); payload !== undefined; payload = queue.shift()) {
            if (!(await processCall(payload, false))) {
                break;
            }
        }
        setTimeout(processCallQueue, 500);
    }

    processCallQueue().catch(logger.error);
    return {
        initialize(config: HandleServiceConfig): void {
            dialCallHandler.initialize(config);
            logger.debug('[handle-service] Initialized.');
        },
        async call(payload: CallPayload): Promise<void> {
            await processCall(payload);
        },
    };
}
