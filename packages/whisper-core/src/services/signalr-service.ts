import { CallData } from '../models/infrasctructure/call-data';
import { CallPayload } from '../models/infrasctructure/call-payload';
import { CallRequest } from '../models/infrasctructure/call-request';
import { CallResponse } from '../models/infrasctructure/call-response';
import { Logger } from '../utils/logger';
import { newError } from '../utils/new-error';
import { HubConnection, HubConnectionBuilder, LogLevel, RetryContext } from '@microsoft/signalr';

/**
 * Configuration interface for the SignalR service.
 * Defines the server URL for establishing the SignalR connection.
 */
export type SignalRServiceConfig = {
    /**
     * URL of the SignalR server endpoint.
     * Used to establish the real-time communication channel.
     */
    serverUrl: string;
};

/**
 * Extended configuration interface with additional callback properties.
 * Used internally by the service implementation.
 */
type SignalRServiceEffectiveConfig = {
    /**
     * Callback triggered when a call payload is received through SignalR.
     *
     * @param payload - The received call payload that needs to be processed
     * @returns Promise that resolves when the call has been handled
     */
    onCall: (payload: CallPayload) => Promise<void>;

    /**
     * Callback triggered when the SignalR connection is ready or reconnected.
     * Allows the application to perform initialization tasks that depend on an active connection.
     *
     * @returns Promise that resolves when the ready operations are complete
     */
    onReady: () => Promise<void>;
} & SignalRServiceConfig;

/**
 * Service interface for managing real-time communication with the server.
 * Provides methods for initializing the SignalR connection and making calls.
 */
export interface SignalRService {
    /**
     * Initializes the SignalR service with the provided configuration.
     * Establishes the connection to the SignalR hub and sets up event handlers.
     *
     * @param config - Configuration with server URL and callback functions
     * @returns Promise that resolves when initialization is complete
     */
    initialize(config: SignalRServiceEffectiveConfig): Promise<void>;

    /**
     * Gets a boolean indicating whether the SignalR connection is ready.
     *
     * @returns true if the connection is established and ready, false otherwise
     */
    get ready(): boolean;

    /**
     * Sends a call request to the server through the SignalR connection.
     *
     * @template TypeData - The specific type of call data being sent
     * @param request - The call request to send to the server
     * @returns Promise resolving to the server's response
     */
    call<TypeData extends CallData>(request: CallRequest<TypeData>): Promise<CallResponse>;
}

/**
 * Factory function that creates and returns an implementation of the SignalRService interface.
 * Manages the real-time communication channel with the server using SignalR.
 *
 * @param logger - Logger instance for error and debugging information
 * @returns An implementation of the SignalRService interface
 */
export function getSignalRService(logger: Logger): SignalRService {
    let connection: HubConnection | undefined;
    let ready: boolean = false;
    let readyPromise: Promise<void> | undefined;
    let readyPromiseResolve: (() => void) | undefined;
    let serverUrl: string | undefined;
    return {
        async initialize(config: SignalRServiceEffectiveConfig): Promise<void> {
            serverUrl = config.serverUrl;
            connection = new HubConnectionBuilder()
                .withUrl(`${config.serverUrl}/signal/v1`)
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds(retryContext: RetryContext): number | null {
                        return Math.max(1000 + 1000 * retryContext.previousRetryCount, 5000);
                    },
                })
                .configureLogging(LogLevel.Warning)
                .build();
            connection.onreconnecting(() => {
                ready = false;
                logger.warn('[signalr-service] Reconnecting ...');
                readyPromise = new Promise<void>((resolve) => {
                    readyPromiseResolve = resolve;
                });
            });
            connection.onreconnected(async () => {
                ready = true;
                if (readyPromiseResolve) {
                    readyPromiseResolve();
                }
                logger.warn('[signalr-service] Reconnected.');
                await config.onReady();
            });
            connection.on('call', async (payload: CallPayload) => {
                logger.debug('[signalr-service] Message received.', payload);
                if (!config.onCall) {
                    logger.warn('[signalr-service] Signalling message callback is not initialized.');
                    return;
                }
                if (!payload || !payload.a) {
                    logger.error('[signalr-service] Invalid payload data.');
                    return;
                }
                try {
                    await config.onCall(payload);
                } catch (error) {
                    logger.error(`[signalr-service] Error while processing signalR call.`, error);
                }
            });
            await connection
                .start()
                .then(async () => {
                    ready = true;
                    logger.debug('[signalr-service] SignalR is ready.');
                    await config.onReady();
                })
                .catch((err) => {
                    logger.error('[signalr-service] SignalR connection error.', err);
                    ready = false;
                });
        },
        get ready(): boolean {
            return ready;
        },
        async call<TypeData extends CallData, TypeResponse extends CallResponse>(
            request: CallRequest<TypeData>,
        ): Promise<TypeResponse> {
            if (readyPromise !== undefined && readyPromise !== null) {
                await readyPromise;
            }
            return new Promise<TypeResponse>((resolve, reject) => {
                if (!connection) {
                    throw newError(logger, '[signalr-service] SignalR connection is not initialized.');
                }
                const method = request.a;
                connection
                    .invoke<TypeResponse>('call', request)
                    .then((response) => {
                        if (!response) {
                            const error = `[signalr-service] Unexpected answer on call ${method} from ${serverUrl}.`;
                            logger.error(error);
                            reject(error);
                            return;
                        }
                        if (!response.ok) {
                            const error = `[signalr-service] Request was not successful on call '${method}'. Reason: ${response.reason}; Response: ${JSON.stringify(response)}.`;
                            logger.error(error, response);
                            reject(error);
                            return;
                        }
                        logger.debug(
                            `[signalr-service] Call '${method}' successfully sent. Response: ${JSON.stringify(response)}`,
                        );
                        resolve(response);
                    })
                    .catch((err) => {
                        logger.error(`[signalr-service] Error while sending request.`, err, request);
                        reject(err);
                    });
            });
        },
    };
}
