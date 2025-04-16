import { EncryptionHolderCallData } from './infrasctructure/encryption-holder-call-data';

/**
 * Interface representing data required to initiate a connection with a peer.
 * Extends EncryptionHolderCallData to provide the encryption information needed for secure communication.
 * Used as the first step in establishing a peer-to-peer connection.
 */
export interface DialCallData extends EncryptionHolderCallData {}
