import { decodeBase64 } from './nacl-util-wrapper';

/**
 * Converts a URL-safe base64 string to a Uint8Array.
 * @param base64String - The base64 string to convert.
 * @returns Uint8Array representation of the decoded string.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    return decodeBase64(base64);
}
