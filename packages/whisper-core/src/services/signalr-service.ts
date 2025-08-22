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
    serverUrl?: string;
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

    /**
     * Timeout for the initialization of the SignalR connection.
     * If the connection is not established within this time, the initialization will be skipped.
     */
    initializationTimeout: number;
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
    let readyResolver: (() => void) | undefined;
    let readyPromise: Promise<void> | undefined;
    function resetReadyPromise(): void {
        if (!readyPromise) {
            readyPromise = new Promise<void>((resolve) => {
                readyResolver = () => {
                    resolve();
                    readyPromise = undefined;
                };
            });
        }
    }
    let serverUrl: string | undefined;
    return {
        async initialize(config: SignalRServiceEffectiveConfig): Promise<void> {
            resetReadyPromise();
            serverUrl = config.serverUrl;
            connection = new HubConnectionBuilder()
                .withUrl(`${config.serverUrl}/signal/v1`)
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds(retryContext: RetryContext): number | null {
                        return Math.max(1000 + 1000 * retryContext.previousRetryCount, 5000);
                    },
                })
                .configureLogging(LogLevel.None)
                .build();
            connection.onreconnecting(() => {
                resetReadyPromise();
                logger.warn('[signalr-service] Reconnecting ...');
            });
            connection.onreconnected(async () => {
                readyResolver?.call(this);
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
                } catch (error: any) {
                    logger.error(`[signalr-service] Error while processing signalR call.`, error.message);
                }
            });
            async function startConnection(
                connection: HubConnection,
                signalRService: SignalRService,
                retryCount: number,
            ): Promise<void> {
                try {
                    await connection.start();
                    readyResolver?.call(signalRService);
                    logger.debug('[signalr-service] SignalR is ready.');
                    await config.onReady();
                } catch (error: any) {
                    logger.error('[signalr-service] SignalR connection error.', error.message);
                    resetReadyPromise();
                    const retryDelay = Math.min(1000 + 1000 * retryCount, 5000);
                    setTimeout(() => startConnection(connection, signalRService, retryCount + 1), retryDelay);
                }
            }
            startConnection(connection, this, 0);
            await Promise.race([
                new Promise((resolve) => setTimeout(resolve, config.initializationTimeout)),
                readyPromise,
            ]);
        },
        get ready(): boolean {
            return !readyPromise;
        },
        async call<TypeData extends CallData, TypeResponse extends CallResponse>(
            request: CallRequest<TypeData>,
        ): Promise<TypeResponse> {
            if (!this.ready) {
                await readyPromise;
            }
            if (!connection) {
                throw newError(logger, '[signalr-service] SignalR connection is not initialized.');
            }
            const method = request.a;
            try {
                const response = await connection.invoke<TypeResponse>('call', request);
                if (!response) {
                    const error = `[signalr-service] Unexpected answer on call ${method} from ${serverUrl}.`;
                    logger.error(error);
                    throw error;
                }
                if (!response.ok) {
                    const error = `[signalr-service] Request was not successful on call '${method}'. Reason: ${response.reason}; Response: ${JSON.stringify(response)}.`;
                    logger.error(error, response);
                    throw error;
                }
                logger.debug(
                    `[signalr-service] Call '${method}' successfully sent. Response: ${JSON.stringify(response)}`,
                );
                return response;
            } catch (error) {
                logger.error(`[signalr-service] Error while sending request.`, error, request);
                throw error;
            }
        },
    };
}
