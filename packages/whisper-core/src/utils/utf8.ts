import { decodeUTF8, encodeUTF8 } from './nacl-util-wrapper';

/**
 * Interface for UTF-8 string encoding and decoding operations.
 * Provides methods to convert between UTF-8 strings and binary data.
 */
export interface Utf8 {
    /**
     * Converts a UTF-8 string to a binary representation as Uint8Array.
     * @param input - UTF-8 string to be converted to binary
     * @returns Binary representation of the input string
     */
    decode(input: string): Uint8Array;

    /**
     * Converts binary data to a UTF-8 string.
     * @param input - Binary data to be converted to string
     * @returns UTF-8 string representation of the binary data
     */
    encode(input: Uint8Array): string;
}

/**
 * Factory function that creates and returns an implementation of the Utf8 interface.
 * Uses tweetnacl-util library for the underlying encoding/decoding operations.
 *
 * @returns An implementation of the Utf8 interface
 */
export function getUtf8(): Utf8 {
    return {
        decode(input: string): Uint8Array {
            return decodeUTF8(input);
        },
        encode(input: Uint8Array): string {
            return encodeUTF8(input);
        },
    };
}
