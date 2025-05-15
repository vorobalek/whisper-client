import { Connection, ConnectionState, getPrototype, Whisper, WhisperPrototype } from '../src/index';
import * as whisperModule from '../src/whisper';

// Mock the connection module (where ConnectionState is actually defined)
jest.mock('../src/services/connection/connection', () => ({
    ConnectionState: {
        New: 'new',
        Connecting: 'connecting',
        Open: 'open',
        Closed: 'closed',
    },
    Connection: jest.fn(),
}));

// Mock the whisper module
jest.mock('../src/whisper', () => ({
    getPrototype: jest.fn(),
    WhisperPrototype: {},
    Whisper: {},
}));

// These tests verify that the main index exports the correct types and functions from the library.
// Mocks are minimal and only for module boundaries, no global hacks required.

describe('index', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should export getPrototype function', () => {
        expect(getPrototype).toBe(whisperModule.getPrototype);
    });

    it('should export Whisper type', () => {
        // Type check - verify that Whisper is a type
        const whisper: Whisper = {
            get publicKey(): string | undefined {
                return undefined;
            },
            get serverTime(): number {
                return 0;
            },
            get connections(): Connection[] {
                return [];
            },
            get(publicKeyBase64: string): Connection {
                return {} as Connection;
            },
            delete(publicKeyBase64: string): void {},
            showNotification(title: string, options?: NotificationOptions): boolean {
                return true;
            },
        };
        expect(whisper).toBeDefined();
    });

    it('should export WhisperPrototype type', () => {
        // Type check - verify that WhisperPrototype is a type
        const prototype: WhisperPrototype = {
            initialize: async (config: any) => ({}) as Whisper,
            generateSigningKeyPair: () => ({}) as any,
        };
        expect(prototype).toBeDefined();
    });

    it('should export Connection type', () => {
        // Type check - verify that Connection is a type
        const connection: Connection = {
            get publicKey(): string {
                return '';
            },
            get state(): ConnectionState {
                return ConnectionState.New;
            },
            open: async () => ({}) as any,
            send: (message: string) => {},
            close: () => {},
            get onProgress(): ((progress: number) => void) | undefined {
                return undefined;
            },
            set onProgress(onProgress: ((progress: number) => void) | undefined) {},
            get onStateChanged(): ((from: ConnectionState, to: ConnectionState) => void) | undefined {
                return undefined;
            },
            set onStateChanged(onStateChange: ((from: ConnectionState, to: ConnectionState) => void) | undefined) {},
            get onMessage(): ((message: string) => void) | undefined {
                return undefined;
            },
            set onMessage(onMessage: ((message: string) => void) | undefined) {},
        };
        expect(connection).toBeDefined();
    });

    it('should export ConnectionState enum', () => {
        expect(ConnectionState).toBeDefined();
        expect(ConnectionState.New).toBe('new');
        expect(ConnectionState.Connecting).toBe('connecting');
        expect(ConnectionState.Open).toBe('open');
        expect(ConnectionState.Closed).toBe('closed');
    });
});
