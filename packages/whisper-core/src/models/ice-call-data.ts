import { IceSource } from './ice-source';
import { EncryptedCallData } from './infrasctructure/encrypted-call-data';

/**
 * Interface representing ICE (Interactive Connectivity Establishment) candidate data
 * transmitted during WebRTC connection establishment.
 *
 * Extends EncryptedCallData with properties specific to ICE candidate exchange.
 */
export interface IceCallData extends EncryptedCallData {
    /**
     * Source of the ICE candidate (incoming or outgoing connection).
     */
    f: IceSource;
}
