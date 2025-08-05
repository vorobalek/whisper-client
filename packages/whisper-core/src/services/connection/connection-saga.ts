import { IceSource } from '../../models/ice-source';
import { Base64 } from '../../utils/base64';
import { Cryptography, CryptoKeyPair } from '../../utils/cryptography';
import { Logger } from '../../utils/logger';
import { newError } from '../../utils/new-error';
import { Utf8 } from '../../utils/utf8';
import { CallService } from '../call-service';
import { SessionService } from '../session-service';
import { TimeService } from '../time-service';
import { IceServer } from './ice-server';
import { WebRTC } from './web-rtc';
import { gzip, ungzip } from 'pako';

/**
 * Enumeration of all possible states in a WebRTC connection establishment saga.
 * These states represent the sequential steps in the WebRTC connection handshake process,
 * from initialization through negotiation to connection establishment.
 */
export enum ConnectionSagaState {
    New = 0,
    AwaitDial,
    AwaitingDial,
    DialAccepted,
    SendDial,
    SendingDial,
    DialSent,
    AwaitOffer,
    AwaitingOffer,
    OfferReceived,
    SendOffer,
    SendingOffer,
    OfferSent,
    AwaitAnswer,
    AwaitingAnswer,
    AnswerReceived,
    SendAnswer,
    SendingAnswer,
    AnswerSent,
    AwaitConnection,
    AwaitingConnection,
    Connected,
    Closed,
}

/**
 * Defines the connection direction type.
 * 'incoming' represents connections initiated by remote peers.
 * 'outgoing' represents connections initiated by the local peer.
 */
export type ConnectionSagaType = 'incoming' | 'outgoing';

/**
 * Interface for managing a WebRTC connection establishment saga.
 * Handles the state machine and cryptographic operations required for secure
 * peer-to-peer connection establishment via a signaling server.
 */
export interface ConnectionSaga {
    /**
     * Optional callback triggered when the saga state changes.
     *
     * @param from - Previous state
     * @param to - New state
     */
    onStateChanged?: (from: ConnectionSagaState, to: ConnectionSagaState) => void;
    /**
     * Optional callback triggered when a message is received from the peer.
     *
     * @param message - The received message
     */
    onMessage?: (message: string) => void;

    /**
     * The public key of the remote peer in this connection.
     */
    get publicKey(): string;

    /**
     * The current state of the connection saga.
     */
    get state(): ConnectionSagaState;

    /**
     * The direction of this connection (incoming or outgoing).
     */
    get type(): ConnectionSagaType;

    /**
     * Function to continue the saga when awaiting external input.
     */
    get continue(): () => void;

    /**
     * Function to abort the saga and terminate the connection attempt.
     */
    get abort(): () => void;

    /**
     * Initializes and starts the connection saga with the specified initial state.
     *
     * @param initialState - Starting state for the saga
     * @returns Promise resolving to this saga instance when initialized
     */
    open(initialState: ConnectionSagaState): Promise<ConnectionSaga>;

    /**
     * Sets the encryption key for secure communication with the peer.
     *
     * @param encryptionPublicKeyBase64 - Base64-encoded public key from the remote peer
     */
    setEncryption(encryptionPublicKeyBase64: string): void;

    /**
     * Sets the SDP session description received from the peer.
     * This contains the offer or answer needed for WebRTC connection.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted SDP data
     * @returns Promise that resolves when description is processed
     */
    setDescription(encryptedDataBase64: string): Promise<void>;

    /**
     * Adds an ICE candidate received from the peer.
     * These are network connection options for establishing the WebRTC link.
     *
     * @param encryptedDataBase64 - Base64-encoded encrypted ICE candidate
     * @returns Promise that resolves when the candidate is added
     */
    addIceCandidate(encryptedDataBase64: string): Promise<void>;

    /**
     * Sends a message to the peer once the connection is established.
     *
     * @param message - Message to send to the peer
     */
    send(message: string): void;
}

/**
 * Internal interface representing a WebRTC SDP description.
 * Contains session description data used during connection negotiation.
 */
interface WebRtcDescription {
    /**
     * Session Description Protocol (SDP) data containing connection parameters.
     */
    sdp?: string;
    // noinspection SpellCheckingInspection
    /**
     * Type of SDP message in the WebRTC handshake process.
     */
    type: 'answer' | 'offer' | 'pranswer' | 'rollback';
}

/**
 * Internal interface representing a WebRTC ICE candidate.
 * Contains network connectivity information for peer connection.
 */
interface WebRtcIceCandidate {
    /**
     * The candidate's connectivity information string.
     */
    candidate?: string;
    /**
     * The index of the media description this candidate is associated with.
     */
    sdpMLineIndex?: number | null;
    /**
     * The identification tag of the media description this candidate is associated with.
     */
    sdpMid?: string | null;
    /**
     * The fragment identifier for this candidate, matching the username fragment in the SDP.
     */
    usernameFragment?: string | null;
}

/**
 * Factory function that creates and returns a ConnectionSaga implementation.
 * Manages the WebRTC connection establishment process between peers including
 * secure key exchange, signaling, and data channel creation.
 *
 * @param publicKey - Public key of the remote peer
 * @param type - Direction of the connection (incoming or outgoing)
 * @param logger - Logger for recording connection events
 * @param timeService - Service for retrieving server time
 * @param callService - Service for signaling with the remote peer
 * @param sessionService - Service for session management
 * @param base64 - Utility for Base64 encoding/decoding
 * @param utf8 - Utility for UTF-8 encoding/decoding
 * @param cryptography - Utility for cryptographic operations
 * @param webRTC - WebRTC interface implementation
 * @param iceServers - Optional list of ICE servers for NAT traversal
 * @param maxStepWaitMilliseconds - Maximum wait time for each step in milliseconds
 * @returns An implementation of the ConnectionSaga interface
 */
export function getConnectionSaga(
    publicKey: string,
    type: ConnectionSagaType,
    logger: Logger,
    timeService: TimeService,
    callService: CallService,
    sessionService: SessionService,
    base64: Base64,
    utf8: Utf8,
    cryptography: Cryptography,
    webRTC: WebRTC,
    iceServers?: IceServer[],
    maxStepWaitMilliseconds: number = 60 * 1000,
): ConnectionSaga {
    let createdAt = timeService.serverTime;
    let encryptionKeyPair: CryptoKeyPair = cryptography.generateEncryptionKeyPair();
    let state: ConnectionSagaState = ConnectionSagaState.New;
    const stateAwaiterGteMap: {
        [state: number]: (() => void)[];
    } = {};

    function setState(value: ConnectionSagaState) {
        const current = state;
        state = value;
        new Promise<void>((resolve) => {
            if (saga.onStateChanged) {
                saga.onStateChanged(current, state);
            }
            resolve();
        }).catch((err) => {
            logger.error(`[connection-saga] State change callback error in ${type} connection with ${publicKey}.`, err);
        });
        for (let i = value; i >= 0; --i) {
            if (stateAwaiterGteMap[i]) {
                for (const callback of stateAwaiterGteMap[i]) {
                    callback();
                }
                stateAwaiterGteMap[i] = [];
            }
        }
    }

    let _continueCallback: (() => void) | undefined;
    let iceCandidates: WebRtcIceCandidate[] = [];
    let _rtcPeerConnection: RTCPeerConnection | undefined;

    function getRtcPeerConnection(): RTCPeerConnection {
        if (!_rtcPeerConnection) {
            throw newError(
                logger,
                `[connection-saga] WebRTC peer connection is not initialized in ${type} connection with ${publicKey}.`,
            );
        }
        return _rtcPeerConnection;
    }

    let _rtcSendDataChannel: RTCDataChannel | undefined;
    let rtcReceiveDataChannel: RTCDataChannel | undefined;

    function getRtcSendDataChannel(): RTCDataChannel {
        if (!_rtcSendDataChannel) {
            throw newError(
                logger,
                `[connection-saga] WebRTC data send channel is not initialized in ${type} connection with ${publicKey}.`,
            );
        }
        return _rtcSendDataChannel;
    }

    let _sharedSymmetricKey: Uint8Array | undefined;

    function getSharedSymmetricKey(): Uint8Array {
        if (!_sharedSymmetricKey) {
            throw newError(
                logger,
                `[connection-saga] Shared symmetric key is not initialized in ${type} connection with ${publicKey}.`,
            );
        }
        return _sharedSymmetricKey;
    }

    function setSharedSymmetricKey(value: Uint8Array) {
        _sharedSymmetricKey = value;
    }

    async function awaitStateGte(value: ConnectionSagaState): Promise<void> {
        if (state >= value) {
            return;
        }
        await new Promise<void>((resolve) => {
            logger.debug(
                `[connection-saga] Awaiting for saga state = ${ConnectionSagaState[value]} in ${type} connection with ${publicKey}. Current state = ${ConnectionSagaState[state]}`,
            );
            stateAwaiterGteMap[value] = stateAwaiterGteMap[value] || [];
            stateAwaiterGteMap[value].push(resolve);
        });
        logger.debug(
            `[connection-saga] Got saga state = ${ConnectionSagaState[state]} in ${type} connection with ${publicKey}.`,
        );
    }

    function setContinueCallback(value: () => void, reason?: string): void {
        _continueCallback = value;
        logger.debug(`[connection-saga] Continue callback set.`, reason);
    }

    function removeContinueCallback(reason?: string): void {
        _continueCallback = undefined;
        logger.debug(`[connection-saga] Continue callback removed.`, reason);
    }

    let rtcSendDataChannelSafeKiller: (() => void) | undefined;
    let rtcReceiveDataChannelSafeKiller: (() => void) | undefined;
    let stepTimeout: NodeJS.Timeout | undefined;

    async function awaitDial(): Promise<boolean> {
        logger.debug(`[connection-saga] Awaiting for Dial in ${type} connection with ${publicKey}`);
        return await new Promise<void>(async (resolve, reject) => {
            stepTimeout = setTimeout(reject, maxStepWaitMilliseconds);
            setContinueCallback(resolve, 'Awaiting for Dial.');
            setState(ConnectionSagaState.AwaitingDial);
        }).then(
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Dial Accepted.');
                logger.debug(`[connection-saga] Dial received in ${type} connection with ${publicKey}.`);
                setState(ConnectionSagaState.DialAccepted);
                return true;
            },
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Timeout awaiting for Dial.');
                setState(ConnectionSagaState.New);
                return false;
            },
        );
    }

    async function sendDial(): Promise<void> {
        logger.debug(`[connection-saga] Sending Dial in ${type} connection with ${publicKey}`);
        setState(ConnectionSagaState.SendingDial);
        await callService.dial(
            sessionService.signingPublicKeyBase64,
            publicKey,
            base64.encode(encryptionKeyPair.publicKey),
        );
        setState(ConnectionSagaState.DialSent);
        logger.debug(`[connection-saga] Dial sent in ${type} connection with ${publicKey}`);
    }

    async function awaitOffer(): Promise<boolean> {
        logger.debug(`[connection-saga] Awaiting for Offer in ${type} connection with ${publicKey}`);
        return await new Promise<void>(async (resolve, reject) => {
            stepTimeout = setTimeout(reject, maxStepWaitMilliseconds);
            setContinueCallback(resolve, 'Awaiting for Offer');
            setState(ConnectionSagaState.AwaitingOffer);
        }).then(
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Offer Received');
                logger.debug(`[connection-saga] Offer received in ${type} connection with ${publicKey}`);
                setState(ConnectionSagaState.OfferReceived);
                return true;
            },
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Timeout awaiting for Offer.');
                setState(ConnectionSagaState.New);
                return false;
            },
        );
    }

    async function gatherWebRtcOffer(): Promise<WebRtcDescription> {
        logger.debug(`[connection-saga] Gathering WebRTC offer data in ${type} connection with ${publicKey}`);
        const offer = await getRtcPeerConnection().createOffer();
        await getRtcPeerConnection().setLocalDescription(offer);
        return offer;
    }

    async function sendOffer(): Promise<void> {
        logger.debug(`[connection-saga] Sending Offer in ${type} connection with ${publicKey}`);
        setState(ConnectionSagaState.SendingOffer);
        const offerData = await gatherWebRtcOffer();
        const offerDataString = JSON.stringify(offerData);
        const offerDataBytes = utf8.decode(offerDataString);
        const offerDataEncrypted = cryptography.encrypt(offerDataBytes, getSharedSymmetricKey());
        await callService.offer(
            sessionService.signingPublicKeyBase64,
            publicKey,
            base64.encode(encryptionKeyPair.publicKey),
            offerDataEncrypted,
        );
        setState(ConnectionSagaState.OfferSent);
        logger.debug(`[connection-saga] Offer sent in ${type} connection with ${publicKey}`);
    }

    async function awaitAnswer(): Promise<boolean> {
        logger.debug(`[connection-saga] Awaiting for Answer in ${type} connection with ${publicKey}`);
        return await new Promise<void>(async (resolve, reject) => {
            stepTimeout = setTimeout(reject, maxStepWaitMilliseconds);
            setContinueCallback(resolve, 'Awaiting for Answer');
            setState(ConnectionSagaState.AwaitingAnswer);
        }).then(
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Answer Received');
                logger.debug(`[connection-saga] Answer received in ${type} connection with ${publicKey}`);
                setState(ConnectionSagaState.AnswerReceived);
                return true;
            },
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Timeout awaiting for Answer.');
                setState(ConnectionSagaState.New);
                return false;
            },
        );
    }

    async function gatherWebRtcAnswer(): Promise<WebRtcDescription> {
        logger.debug(`[connection-saga] Gathering WebRTC answer data in ${type} connection with ${publicKey}`);
        const answer = await getRtcPeerConnection().createAnswer();
        await getRtcPeerConnection().setLocalDescription(answer);
        return answer;
    }

    async function sendAnswer(): Promise<void> {
        logger.debug(`[connection-saga] Sending Answer step in ${type} connection with ${publicKey}`);
        setState(ConnectionSagaState.SendingAnswer);
        const answerData = await gatherWebRtcAnswer();
        const answerDataString = JSON.stringify(answerData);
        const answerDataBytes = utf8.decode(answerDataString);
        const answerDataEncrypted = cryptography.encrypt(answerDataBytes, getSharedSymmetricKey());
        await callService.answer(
            sessionService.signingPublicKeyBase64,
            publicKey,
            base64.encode(encryptionKeyPair.publicKey),
            answerDataEncrypted,
        );
        setState(ConnectionSagaState.AnswerSent);
        logger.debug(`[connection-saga] Answer sent in ${type} connection with ${publicKey}`);
    }

    async function awaitConnection(): Promise<boolean> {
        logger.debug(`[connection-saga] Awaiting for Connection in ${type} connection with ${publicKey}`);
        return await new Promise<void>(async (resolve, reject) => {
            stepTimeout = setTimeout(reject, maxStepWaitMilliseconds);
            setContinueCallback(resolve, 'Awaiting for Connection');
            setState(ConnectionSagaState.AwaitingConnection);
        }).then(
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Connection Established');
                logger.debug(`[connection-saga] Connected in ${type} connection with ${publicKey}`);
                return true;
            },
            () => {
                clearTimeout(stepTimeout);
                removeContinueCallback('Timeout awaiting for Connection.');
                setState(ConnectionSagaState.New);
                return false;
            },
        );
    }

    async function sendIce(candidate: WebRtcIceCandidate): Promise<void> {
        const source = {
            incoming: IceSource.Incoming,
            outgoing: IceSource.Outgoing,
        }[type];
        const candidateString = JSON.stringify(candidate);
        const candidateBytes = utf8.decode(candidateString);
        const encryptedData = cryptography.encrypt(candidateBytes, getSharedSymmetricKey());
        await callService.ice(
            sessionService.signingPublicKeyBase64,
            publicKey,
            base64.encode(encryptionKeyPair.publicKey),
            encryptedData,
            source,
        );
    }

    function initializePeerConnection(): void {
        getRtcPeerConnection().onicecandidate = async (event) => {
            if (event.candidate) {
                const candidate = event.candidate.toJSON();
                await sendIce({
                    candidate: candidate.candidate,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    sdpMid: candidate.sdpMid,
                    usernameFragment: candidate.usernameFragment,
                });
                logger.debug(`[connection-saga] ICE candidate found in ${type} connection with ${publicKey}`);
            } else {
                logger.debug(
                    `[connection-saga] ICE candidate collection completed in ${type} connection with ${publicKey}.`,
                );
            }
        };
        getRtcPeerConnection().ondatachannel = (event) => {
            const dataChannel = event.channel;
            rtcReceiveDataChannelSafeKiller = initializeDataChanel(dataChannel, 'receive');
            rtcReceiveDataChannel = dataChannel;
        };
    }

    function initializeDataChanel(dataChannel: RTCDataChannel, suffix: string): () => void {
        logger.debug(`[connection-saga] [${dataChannel.id}] DataChannel-${suffix}(${dataChannel.label}) created`);
        dataChannel.onopen = async () => {
            if (state === ConnectionSagaState.Closed) {
                dataChannel.close();
                return;
            }
            await awaitStateGte(ConnectionSagaState.AwaitingConnection);
            if (state === ConnectionSagaState.AwaitingConnection) {
                saga.continue();
            } else {
                logger.debug(
                    `[connection-saga] Continue callback skipped. Expected state ${ConnectionSagaState[ConnectionSagaState.AwaitingConnection]}, got ${ConnectionSagaState[state]}`,
                );
            }
            logger.debug(
                `[connection-saga] ${suffix} dataChannel with label '${dataChannel.label}' opened in ${type} connection with ${publicKey}.`,
            );
            logger.debug(
                `[connection-saga] ${suffix} dataChannel with label '${dataChannel.label}' ready state '${dataChannel.readyState}' in ${type} connection with ${publicKey}.`,
            );
        };
        dataChannel.onmessage = (event) => {
            if (!(event.data instanceof ArrayBuffer)) {
                logger.warn(
                    `[connection-saga] Wrong message type received via ${suffix} dataChannel with label '${dataChannel.label}' in ${type} connection with ${publicKey}.`,
                );
                return;
            }
            const dataBytes = new Uint8Array(event.data);
            const decryptedBytes = cryptography.decrypt(dataBytes, getSharedSymmetricKey());
            let inflatedBytes: Uint8Array;
            try {
                inflatedBytes = ungzip(decryptedBytes);
            } catch (err) {
                logger.warn(`[connection-saga] Gzip decompression failed, using raw decrypted data.`, err);
                inflatedBytes = decryptedBytes;
            }
            const message = utf8.encode(inflatedBytes);
            new Promise<void>((resolve) => {
                saga.onMessage?.call(saga, message);
                resolve();
            }).catch((err) => {
                logger.error(`[connection-saga] Message callback error in ${type} connection with ${publicKey}.`, err);
            });
        };
        return () => {
            dataChannel.onopen = null;
            dataChannel.onmessage = null;
            dataChannel.close();
            logger.debug(
                `[connection-saga] ${suffix} dataChannel with label '${dataChannel.label}' has been safe killed.`,
            );
        };
    }

    function initializeRtc(dataChannelName: string): void {
        if (rtcSendDataChannelSafeKiller !== undefined && rtcSendDataChannelSafeKiller !== null) {
            rtcSendDataChannelSafeKiller();
        }
        if (rtcReceiveDataChannelSafeKiller !== undefined && rtcReceiveDataChannelSafeKiller !== null) {
            rtcReceiveDataChannelSafeKiller();
        }
        if (_rtcPeerConnection !== undefined && _rtcPeerConnection !== null) {
            _rtcPeerConnection.onicecandidate = null;
            _rtcPeerConnection.ondatachannel = null;
            _rtcPeerConnection.onconnectionstatechange = null;
            _rtcPeerConnection.close();
        }
        _rtcPeerConnection = new webRTC.PeerConnection({ iceServers: iceServers });
        initializePeerConnection();
        const dataChannel = getRtcPeerConnection().createDataChannel(dataChannelName);
        rtcSendDataChannelSafeKiller = initializeDataChanel(dataChannel, 'send');
        _rtcSendDataChannel = dataChannel;
        iceCandidates = [];
    }

    async function open(initialState: ConnectionSagaState): Promise<void> {
        clearTimeout(stepTimeout);
        setState(initialState);
        initializeRtc(`${createdAt}:${type}:${publicKey}`);

        if (state === ConnectionSagaState.AwaitDial && (await awaitDial())) {
            setState(ConnectionSagaState.SendOffer);
        }

        if (state === ConnectionSagaState.SendDial) {
            await sendDial();
            setState(ConnectionSagaState.AwaitOffer);
        }

        if (state === ConnectionSagaState.AwaitOffer && (await awaitOffer())) {
            setState(ConnectionSagaState.SendAnswer);
        }

        if (state === ConnectionSagaState.SendOffer) {
            await sendOffer();
            setState(ConnectionSagaState.AwaitAnswer);
        }

        if (state === ConnectionSagaState.AwaitAnswer && (await awaitAnswer())) {
            setState(ConnectionSagaState.AwaitConnection);
        }

        if (state === ConnectionSagaState.SendAnswer) {
            await sendAnswer();
            setState(ConnectionSagaState.AwaitConnection);
        }

        if (state === ConnectionSagaState.AwaitConnection && (await awaitConnection())) {
            setState(ConnectionSagaState.Connected);
        }

        if (state === ConnectionSagaState.Connected) {
            let stats = await getRtcPeerConnection().getStats();
            let candidatePair = [...stats.values()].find(
                (s) => s.type == 'candidate-pair' && (s.selected === undefined || s.selected),
            );
            let candidate = stats.get(candidatePair.localCandidateId);
            if (candidate.candidateType == 'relay') {
                logger.warn(
                    `[connection-saga] Using relay server ${candidate.address} in ${type} connection with ${publicKey}.`,
                );
            } else {
                logger.log(
                    `[connection-saga] Using P2P ${candidate.candidateType} in ${type} connection with ${publicKey}.`,
                );
            }
        }
    }

    const saga: ConnectionSaga = {
        get publicKey(): string {
            return publicKey;
        },
        get state(): ConnectionSagaState {
            return state;
        },
        get type(): ConnectionSagaType {
            return type;
        },
        get continue(): () => void {
            return () => {
                if (!_continueCallback) {
                    throw newError(
                        logger,
                        `[connection-saga] Expected to have continue callback initialized in ${type} connection with ${publicKey} on state='${ConnectionSagaState[state]}'.`,
                    );
                }
                _continueCallback();
            };
        },
        get abort(): () => void {
            return () => {
                setState(ConnectionSagaState.Closed);
                if (_rtcSendDataChannel) {
                    try {
                        _rtcSendDataChannel.close();
                        logger.debug(
                            `[connection-saga] Sending DataChannel.close() called in ${type} connection with ${publicKey}.`,
                        );
                    } catch (error) {
                        logger.error(
                            `[connection-saga] Error closing sending DataChannel in ${type} connection.`,
                            error,
                        );
                    }
                }
                if (rtcReceiveDataChannel) {
                    try {
                        rtcReceiveDataChannel.close();
                        logger.debug(
                            `[connection-saga] Receiving DataChannel.close() called in ${type} connection with ${publicKey}.`,
                        );
                    } catch (error) {
                        logger.error(
                            `[connection-saga] Error closing receiving DataChannel in ${type} connection.`,
                            error,
                        );
                    }
                }
                if (_rtcPeerConnection) {
                    try {
                        _rtcPeerConnection.close();
                        logger.debug(
                            `[connection-saga] RTCPeerConnection.close() called in ${type} connection with ${publicKey}.`,
                        );
                    } catch (error) {
                        logger.error(
                            `[connection-saga] Error closing RTC peer connection in ${type} connection.`,
                            error,
                        );
                    }
                }
            };
        },
        onStateChanged: undefined,
        onMessage: undefined,
        async open(initialState: ConnectionSagaState): Promise<ConnectionSaga> {
            await open(initialState);
            return this;
        },
        setEncryption(encryptionPublicKeyBase64: string) {
            logger.debug(`[connection-saga] Received encryption public key in ${type} connection with ${publicKey}`);
            const encryptionPublicKey = base64.decode(encryptionPublicKeyBase64);
            setSharedSymmetricKey(
                cryptography.generateSharedSymmetricKey(encryptionPublicKey, encryptionKeyPair.secretKey),
            );
            logger.debug(
                `[connection-saga] Created encryption shared symmetric key in ${type} connection with ${publicKey}`,
            );
        },
        async setDescription(encryptedDataBase64: string): Promise<void> {
            logger.debug(
                `[connection-saga] Received remote WebRTC description in ${type} connection with ${publicKey}`,
            );
            if (getRtcPeerConnection().remoteDescription) {
                logger.debug(
                    `[connection-saga] Remote WebRTC description ignored in ${type} connection with ${publicKey}. Remote WebRTC description already set.`,
                );
                return;
            }
            const encryptedDataBytes = base64.decode(encryptedDataBase64);
            const remoteDataBytes = cryptography.decrypt(encryptedDataBytes, getSharedSymmetricKey());
            const remoteDataString = utf8.encode(remoteDataBytes);
            const remoteData = JSON.parse(remoteDataString);
            const remoteDescription = remoteData as WebRtcDescription;
            if (!remoteDescription) {
                throw newError(
                    logger,
                    `[connection-saga] Wrong remote WebRTC description format in ${type} connection with ${publicKey}.`,
                );
            }
            await getRtcPeerConnection().setRemoteDescription(remoteDescription);
            for (const iceCandidate of iceCandidates) {
                logger.debug(
                    `[connection-saga] Taking remote WebRTC ice candidate from cache in ${type} connection with with ${publicKey}.`,
                );
                await getRtcPeerConnection().addIceCandidate(iceCandidate);
            }
            logger.debug(`[connection-saga] Set remote WebRTC description in ${type} connection with ${publicKey}.`);
        },
        async addIceCandidate(encryptedDataBase64: string): Promise<void> {
            logger.debug(
                `[connection-saga] Received remote WebRTC ice candidate in ${type} connection with ${publicKey}`,
            );
            const encryptedDataBytes = base64.decode(encryptedDataBase64);
            const remoteDataBytes = cryptography.decrypt(encryptedDataBytes, getSharedSymmetricKey());
            const remoteDataString = utf8.encode(remoteDataBytes);
            const remoteData = JSON.parse(remoteDataString);
            const remoteIceCandidate = remoteData as WebRtcIceCandidate;
            if (!remoteIceCandidate) {
                throw newError(
                    logger,
                    `[connection-saga] Wrong remote WebRTC ice candidate format in ${type} connection with ${publicKey}.`,
                );
            }
            if (getRtcPeerConnection().remoteDescription) {
                await getRtcPeerConnection().addIceCandidate(remoteIceCandidate);
            } else {
                logger.debug(
                    `[connection-saga] Cached remote WebRTC ice candidate in ${type} connection with ${publicKey}. Remote description is not ready yet.`,
                );
                iceCandidates.push(remoteIceCandidate);
            }
            logger.debug(
                `[connection-saga] Added remote WebRTC ice candidate in ${type} connection with ${publicKey}.`,
            );
        },
        send(message: string): void {
            try {
                const data = message.trim();
                if (!data) {
                    logger.debug(
                        `[connection-saga] Message is empty and won't be sent in ${type} connection with ${publicKey}.`,
                    );
                    return;
                }
                const dataBytes = utf8.decode(data);
                const compressedBytes = gzip(dataBytes);
                const dataEncrypted = cryptography.encrypt(compressedBytes, getSharedSymmetricKey());
                getRtcSendDataChannel().send(new Uint8Array(dataEncrypted.buffer as ArrayBuffer));
            } catch (error) {
                logger.error(`[connection-saga] Error sending data in ${type} connection with ${publicKey}.`);
            }
        },
    };
    return saga;
}
