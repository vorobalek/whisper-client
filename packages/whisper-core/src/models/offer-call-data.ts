import { EncryptedCallData } from './infrasctructure/encrypted-call-data';

/**
 * Interface representing WebRTC offer data transmitted during connection establishment.
 * Extends EncryptedCallData with the necessary information for initiating a WebRTC connection.
 * Used in the signaling process to begin peer-to-peer communication.
 */
export interface OfferCallData extends EncryptedCallData {}
