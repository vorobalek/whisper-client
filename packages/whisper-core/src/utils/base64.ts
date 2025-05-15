import { decodeBase64, encodeBase64 } from './nacl-util-wrapper';

/**
 * Interface for Base64 encoding and decoding operations.
 * Provides methods to convert between Base64 strings and binary data.
 */
export interface Base64 {
    /**
     * Decodes a Base64 string into binary data.
     * @param input - Base64 encoded string
     * @returns Binary representation of the input as Uint8Array
     */
    decode(input: string): Uint8Array;

    /**
     * Encodes binary data into a Base64 string.
     * @param input - Binary data to be encoded
     * @returns Base64 encoded string representation of the input
     */
    encode(input: Uint8Array): string;
}

/**
 * Factory function that creates and returns an implementation of the Base64 interface.
 * Uses tweetnacl-util library for the underlying encoding/decoding operations.
 *
 * @returns An implementation of the Base64 interface
 */
export function getBase64(): Base64 {
    return {
        decode(input: string): Uint8Array {
            return decodeBase64(input);
        },
        encode(input: Uint8Array): string {
            return encodeBase64(input);
        },
    };
}
