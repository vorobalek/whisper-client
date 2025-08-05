export interface Cryptography {
    deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;

    encryptData(key: CryptoKey, data: any): Promise<{ iv: Uint8Array; encryptedData: ArrayBuffer }>;

    decryptData(key: CryptoKey, iv: Uint8Array, encryptedData: ArrayBuffer): Promise<any>;

    getSalt(): Uint8Array;

    getHashString(data: string): Promise<string>;
}

export function getCryptography(): Cryptography {
    async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password).buffer as ArrayBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveKey'],
        );
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt.buffer as ArrayBuffer,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    async function encryptData(key: CryptoKey, data: any): Promise<{ iv: Uint8Array; encryptedData: ArrayBuffer }> {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = encoder.encode(JSON.stringify(data));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
            key,
            encodedData.buffer as ArrayBuffer,
        );
        return { iv, encryptedData };
    }

    async function decryptData(key: CryptoKey, iv: Uint8Array, encryptedData: ArrayBuffer): Promise<any> {
        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
            key,
            encryptedData,
        );
        const decoder = new TextDecoder();
        const decodedData = decoder.decode(decryptedData);
        return JSON.parse(decodedData);
    }

    function getSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    async function getHashString(data: string): Promise<string> {
        const dataBytes = new TextEncoder().encode(data);
        const hashBytes = await crypto.subtle.digest('SHA-256', dataBytes.buffer as ArrayBuffer);
        return new TextDecoder().decode(hashBytes);
    }

    return {
        deriveKey,
        encryptData,
        decryptData,
        getSalt,
        getHashString,
    };
}
