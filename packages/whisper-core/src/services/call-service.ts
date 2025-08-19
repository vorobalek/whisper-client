import { AnswerCallData } from '../models/answer-call-data';
import { CloseCallData } from '../models/close-call-data';
import { DialCallData } from '../models/dial-call-data';
import { IceCallData } from '../models/ice-call-data';
import { IceSource } from '../models/ice-source';
import { CallData } from '../models/infrasctructure/call-data';
import { CallMethodName } from '../models/infrasctructure/call-method-name';
import { CallRequest } from '../models/infrasctructure/call-request';
import { CallResponse } from '../models/infrasctructure/call-response';
import { OfferCallData } from '../models/offer-call-data';
import { UpdateCallData } from '../models/update-call-data';
import { ApiClient } from '../utils/api-client';
import { Base64 } from '../utils/base64';
import { Cryptography } from '../utils/cryptography';
import { Logger } from '../utils/logger';
import { newError } from '../utils/new-error';
import { Utf8 } from '../utils/utf8';
import { Subscription } from './push-service';
import { SessionService } from './session-service';
import { SignalRService } from './signalr-service';
import { TimeService } from './time-service';

/**
 * Configuration interface for the call service.
 * Defines properties needed for making API calls to the server.
 */
export type CallServiceConfig = {
    /**
     * URL of the server to send API calls to.
     * Used for HTTP and SignalR communication.
     */
    serverUrl?: string;
};

// Internal effective config for testability and browser API injection
// (not exported, just like PushServiceEffectiveConfig)
type CallServiceEffectiveConfig = CallServiceConfig & {
    navigator: Navigator;
};

/**
 * Service interface for making various types of signaling calls.
 * Provides methods for the WebRTC signaling process and connection management.
 */
export interface CallService {
    /**
     * Initializes the call service with the provided configuration.
     * Sets up the server URL for API calls.
     *
     * @param config - Configuration with server URL and optional browser API overrides
     */
    initialize(config: CallServiceEffectiveConfig): void;

    /**
     * Updates the server with the client's current status and subscription information.
     * Used to register the client for push notifications.
     *
     * @param publicKey - Public key of the client
     * @param subscription - Optional push notification subscription details
     * @returns Promise resolving to the server's response
     */
    update(publicKey: string, subscription?: Subscription): Promise<CallResponse>;

    /**
     * Initiates a dial request to a peer.
     * First step in establishing a WebRTC connection.
     *
     * @param publicKey - Public key of the sender
     * @param peerPublicKey - Public key of the peer to connect to
     * @param encryptionPublicKey - Public encryption key for secure communication
     * @returns Promise resolving to the server's response
     */
    dial(publicKey: string, peerPublicKey: string, encryptionPublicKey: string): Promise<CallResponse>;

    /**
     * Sends a WebRTC offer to a peer.
     * Contains the initial session description for establishing a connection.
     *
     * @param publicKey - Public key of the sender
     * @param peerPublicKey - Public key of the peer to connect to
     * @param encryptionPublicKey - Public encryption key for secure communication
     * @param encryptedData - Encrypted session description information
     * @returns Promise resolving to the server's response
     */
    offer(
        publicKey: string,
        peerPublicKey: string,
        encryptionPublicKey: string,
        encryptedData: Uint8Array,
    ): Promise<CallResponse>;

    /**
     * Sends a WebRTC answer to a peer.
     * Response to an offer with the local session description.
     *
     * @param publicKey - Public key of the sender
     * @param peerPublicKey - Public key of the peer to connect to
     * @param encryptionPublicKey - Public encryption key for secure communication
     * @param encryptedData - Encrypted session description information
     * @returns Promise resolving to the server's response
     */
    answer(
        publicKey: string,
        peerPublicKey: string,
        encryptionPublicKey: string,
        encryptedData: Uint8Array,
    ): Promise<CallResponse>;

    /**
     * Sends ICE (Interactive Connectivity Establishment) candidates to a peer.
     * Used to establish the optimal connection path between peers.
     *
     * @param publicKey - Public key of the sender
     * @param peerPublicKey - Public key of the peer to connect to
     * @param encryptionPublicKey - Public encryption key for secure communication
     * @param encryptedData - Encrypted ICE candidate information
     * @param source - Source of the ICE candidate (incoming or outgoing)
     * @returns Promise resolving to the server's response
     */
    ice(
        publicKey: string,
        peerPublicKey: string,
        encryptionPublicKey: string,
        encryptedData: Uint8Array,
        source: IceSource,
    ): Promise<CallResponse>;

    /**
     * Sends a close request to terminate a connection with a peer.
     * Uses the Beacon API for reliable delivery even during page unload.
     *
     * @param publicKey - Public key of the sender
     * @param peerPublicKey - Public key of the peer to disconnect from
     */
    close(publicKey: string, peerPublicKey: string): void;
}

/**
 * Factory function that creates and returns an implementation of the CallService interface.
 * Manages the signaling process for WebRTC connections.
 *
 * @param logger - Logger instance for error and debugging information
 * @param timeService - Service for managing time synchronization
 * @param sessionService - Service for accessing session information
 * @param apiClient - Client for making HTTP API calls
 * @param signalRService - Service for real-time SignalR communication
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Cryptography service for signing operations
 * @returns An implementation of the CallService interface
 */
export function getCallService(
    logger: Logger,
    timeService: TimeService,
    sessionService: SessionService,
    apiClient: ApiClient,
    signalRService: SignalRService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
): CallService {
    let serverUrl: string | undefined;
    let navigator: Navigator;

    function getBase64Signature(data: any): string {
        const dataString = JSON.stringify(data);
        const dataBytes = utf8.decode(dataString);
        const signatureSecretKey = sessionService.signingKeyPair.secretKey;
        const dataSignature = cryptography.sign(dataBytes, signatureSecretKey);
        return base64.encode(dataSignature);
    }

    async function signAndSend<TypeData extends CallData>(
        method: CallMethodName,
        data: TypeData,
    ): Promise<CallResponse> {
        const request: CallRequest<TypeData> = {
            a: method,
            b: data,
            c: getBase64Signature(data),
        };
        let response: CallResponse | undefined;
        let trySignalR = signalRService.ready;
        let tryApi = false;

        if (trySignalR) {
            try {
                response = await signalRService.call(request);
            } catch (error) {
                tryApi = true;
                logger.warn(
                    `[call-service] Error while sending call '${request.a}' via signalR. Trying to use http API.`,
                    error,
                );
            }
        } else {
            tryApi = true;
            logger.warn(
                `[call-service] SignalR is not ready. Trying to use http API.`,
            );
        }

        if (tryApi) {
            if (!serverUrl) {
                throw newError(logger, '[call-service] Server URL is missing.');
            }
            try {
                response = await apiClient.call(serverUrl, request);
            } catch (error) {
                logger.error(
                    `[call-service] Error while sending call '${request.a}' via http API.`,
                    error,
                );
            }
        }

        if (!response) {
            throw newError(logger, `[call-service] Failed to send call '${request.a}'.`);
        }

        timeService.serverTime = response.timestamp;
        return response;
    }

    return {
        initialize(config: CallServiceEffectiveConfig): void {
            serverUrl = config.serverUrl;
            navigator = config.navigator;
            logger.debug('[call-service] Initialized.');
        },
        async update(publicKey: string, subscription?: Subscription): Promise<CallResponse> {
            const data: UpdateCallData = {
                a: publicKey,
                b: !!subscription
                    ? {
                          a: subscription.endpoint,
                          b: subscription.expirationTime,
                          c: {
                              a: subscription.keys.p256dh,
                              b: subscription.keys.auth,
                          },
                      }
                    : undefined,
            };
            return await signAndSend<UpdateCallData>('update', data);
        },
        async dial(publicKey: string, peerPublicKey: string, encryptionPublicKeyBase64: string): Promise<CallResponse> {
            const data: DialCallData = {
                a: publicKey,
                b: timeService.serverTime,
                c: peerPublicKey,
                d: encryptionPublicKeyBase64,
            };
            return await signAndSend<DialCallData>('dial', data);
        },
        async offer(
            publicKey: string,
            peerPublicKey: string,
            encryptionPublicKeyBase64: string,
            encryptedData: Uint8Array,
        ): Promise<CallResponse> {
            const encryptedDataBase64 = base64.encode(encryptedData);
            const data: OfferCallData = {
                a: publicKey,
                b: timeService.serverTime,
                c: peerPublicKey,
                d: encryptionPublicKeyBase64,
                e: encryptedDataBase64,
            };
            return await signAndSend<OfferCallData>('offer', data);
        },
        async answer(
            publicKey: string,
            peerPublicKey: string,
            encryptionPublicKeyBase64: string,
            encryptedData: Uint8Array,
        ): Promise<CallResponse> {
            const encryptedDataBase64 = base64.encode(encryptedData);
            const data: AnswerCallData = {
                a: publicKey,
                b: timeService.serverTime,
                c: peerPublicKey,
                d: encryptionPublicKeyBase64,
                e: encryptedDataBase64,
            };
            return await signAndSend<AnswerCallData>('answer', data);
        },
        async ice(
            publicKey: string,
            peerPublicKey: string,
            encryptionPublicKeyBase64: string,
            encryptedData: Uint8Array,
            source: IceSource,
        ): Promise<CallResponse> {
            const encryptedDataBase64 = base64.encode(encryptedData);
            const data: IceCallData = {
                a: publicKey,
                b: timeService.serverTime,
                c: peerPublicKey,
                d: encryptionPublicKeyBase64,
                e: encryptedDataBase64,
                f: source,
            };
            return await signAndSend<IceCallData>('ice', data);
        },
        close(publicKey: string, peerPublicKey: string): void {
            const data: CloseCallData = {
                a: publicKey,
                b: timeService.serverTime,
                c: peerPublicKey,
            };
            const request: CallRequest<CloseCallData> = {
                a: 'close',
                b: data,
                c: getBase64Signature(data),
            };
            const headers = {
                type: 'application/json',
            };
            const blob = new Blob([JSON.stringify(request)], headers);
            navigator.sendBeacon(`${serverUrl}/api/v1/call`, blob);
        },
    };
}
