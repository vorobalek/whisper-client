import {
    createMockBase64,
    createMockCryptography,
    createMockLogger,
    createMockSessionService,
    createMockUtf8,
} from '../../../__mocks__/test-utils';
import { CloseCallData } from '../../../src/models/close-call-data';
import { CallPayload } from '../../../src/models/infrasctructure/call-payload';
import { CallRequest } from '../../../src/models/infrasctructure/call-request';
import { getCallHandler } from '../../../src/services/handle/call-handler';
import { SessionService } from '../../../src/services/session-service';
import { TimeService } from '../../../src/services/time-service';
import { Base64 } from '../../../src/utils/base64';
import { Cryptography } from '../../../src/utils/cryptography';
import { Logger } from '../../../src/utils/logger';
import { Utf8 } from '../../../src/utils/utf8';

// Mock the newError function before importing any modules that use it
jest.mock('../../../src/utils/new-error', () => ({
    newError: jest.fn().mockImplementation((logger, message) => {
        return new Error(message);
    }),
}));

jest.mock('../../../src/services/time-service');
jest.mock('../../../src/services/session-service');
jest.mock('../../../src/utils/base64');
jest.mock('../../../src/utils/utf8');
jest.mock('../../../src/utils/cryptography');

describe('CallHandler', () => {
    let mockLogger: Logger;
    let mockTimeService: jest.Mocked<TimeService>;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockBase64: jest.Mocked<Base64>;
    let mockUtf8: jest.Mocked<Utf8>;
    let mockCryptography: jest.Mocked<Cryptography>;
    let callHandler: ReturnType<typeof getCallHandler<CloseCallData>>;
    let originalDateNow: () => number;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Date.now for time control in tests
        originalDateNow = Date.now;
        Date.now = jest.fn(() => 1000);

        mockLogger = createMockLogger();
        // IMPORTANT: now mockTimeService with configurable serverTime
        let _serverTime = 1000;
        mockTimeService = {
            get serverTime() {
                return _serverTime;
            },
            set serverTime(val: number) {
                _serverTime = val;
            },
        } as unknown as jest.Mocked<TimeService>;
        mockSessionService = createMockSessionService() as unknown as jest.Mocked<SessionService>;
        mockBase64 = createMockBase64() as unknown as jest.Mocked<Base64>;
        mockUtf8 = createMockUtf8() as unknown as jest.Mocked<Utf8>;
        mockCryptography = createMockCryptography() as unknown as jest.Mocked<Cryptography>;

        callHandler = getCallHandler<CloseCallData>(
            mockLogger,
            mockTimeService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
        );
    });

    afterEach(() => {
        // Restore Date.now
        Date.now = originalDateNow;
    });

    describe('parse', () => {
        it('should parse valid payload', () => {
            const closeData: CloseCallData = {
                a: 'publicKey',
                b: 1500,
                c: 'myPublicKey',
            };

            const payload: CallPayload = {
                a: 'close',
                b: JSON.stringify(closeData),
                c: 'signature',
            };

            const result = callHandler.parse(payload);

            expect(result).toEqual({
                a: 'close',
                b: closeData,
                c: 'signature',
            });
        });

        it('should throw an error when data cannot be parsed', () => {
            // Prepare mock implementation
            const error = new Error('JSON parse error');
            jest.spyOn(JSON, 'parse').mockImplementation(() => {
                throw error;
            });

            // Payload with invalid JSON
            const payload: CallPayload = {
                a: 'close',
                b: '{invalid-json',
                c: 'signature',
            };

            // Should throw error
            expect(() => callHandler.parse(payload)).toThrow();

            // Restore JSON.parse
            jest.spyOn(JSON, 'parse').mockRestore();
        });

        it('should throw an error when parsed data is null', () => {
            // Prepare mock implementation
            jest.spyOn(JSON, 'parse').mockReturnValue(null);

            // Payload with null data after parsing
            const payload: CallPayload = {
                a: 'close',
                b: 'null',
                c: 'signature',
            };

            // Should throw error
            expect(() => callHandler.parse(payload)).toThrow();

            // Restore JSON.parse
            jest.spyOn(JSON, 'parse').mockRestore();
        });
    });

    describe('validate', () => {
        let request: CallRequest<CloseCallData>;

        beforeEach(() => {
            request = {
                a: 'close',
                b: {
                    a: 'peerPublicKey',
                    b: 1500, // Within 1 minute of server time (1000)
                    c: 'myPublicKey', // Matches session service public key
                },
                c: 'signature',
            };
            // Override mockSessionService for this describe
            mockSessionService = {
                ...mockSessionService,
                signingPublicKeyBase64: 'myPublicKey',
            } as any;
            // Mock base64.decode and utf8.decode for correct verifySignature operation
            const validBytes = new Uint8Array([1, 2, 3]);
            mockBase64.decode = jest.fn((input) => {
                if (input === 'signature' || input === 'peerPublicKey') return validBytes;
                return new Uint8Array([9, 9, 9]);
            });
            mockUtf8.decode = jest.fn((input) => {
                if (input === JSON.stringify(request.b)) return validBytes;
                return new Uint8Array([9, 9, 9]);
            });
            mockCryptography.verifySignature = jest.fn((data, signature, publicKey) => true);
            // Recreate callHandler with new mockSessionService
            callHandler = getCallHandler<CloseCallData>(
                mockLogger,
                mockTimeService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
            );
        });

        it('should validate request with valid timestamp, key and signature', () => {
            const result = callHandler.validate(request);

            expect(result).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[close-call-handler] Request timestamp is valid (delta 500ms).',
            );
            expect(mockLogger.debug).toHaveBeenCalledWith('[close-call-handler] Message is intended for this user.');
            expect(mockLogger.debug).toHaveBeenCalledWith('[close-call-handler] Signature is valid.');
        });

        it('should fail validation if timestamp is stale', () => {
            request.b.b = 100000; // More than 5 seconds from server time

            const result = callHandler.validate(request);

            expect(result).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[close-call-handler] Request timestamp is more than 5 seconds stale (delta 99000ms).',
            );
        });

        it('should fail validation if message is not intended for the user', () => {
            request.b.c = 'differentPublicKey';

            const result = callHandler.validate(request);

            expect(result).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                '[close-call-handler] Message is not intended for this user.',
            );
        });

        it('should fail validation if signature is invalid', () => {
            mockCryptography.verifySignature.mockReturnValue(false);

            const result = callHandler.validate(request);

            expect(result).toBe(false);
            expect(mockLogger.debug).toHaveBeenCalledWith('[close-call-handler] Signature is not valid.');
        });
    });

    describe('handle', () => {
        it('should throw error by default', async () => {
            const request: CallRequest<CloseCallData> = {
                a: 'close',
                b: {
                    a: 'peerPublicKey',
                    b: 1500,
                    c: 'myPublicKey',
                },
                c: 'signature',
            };

            // The base handle method is expected to throw an error
            try {
                await callHandler.handle(request);
                // If we reach here, the test should fail
                expect('Should have thrown').toBe('But did not throw');
            } catch (error: any) {
                expect(error.message).toBe('[close-call-handler] Base handle method is not implemented.');
            }
        });
    });
});
