import { EncryptedCallData } from './infrasctructure/encrypted-call-data';

/**
 * Interface representing WebRTC answer data transmitted during connection establishment.
 * Extends EncryptedCallData with the necessary information for responding to a WebRTC connection offer.
 * Used in the signaling process to complete peer-to-peer connection negotiation.
 */
export interface AnswerCallData extends EncryptedCallData {}
