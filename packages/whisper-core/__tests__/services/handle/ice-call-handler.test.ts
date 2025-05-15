import {
    createMockBase64,
    createMockCryptography,
    createMockLogger,
    createMockSessionService,
    createMockTimeService,
    createMockUtf8,
} from '../../../__mocks__/test-utils';
import { IceCallData } from '../../../src/models/ice-call-data';
import { IceSource } from '../../../src/models/ice-source';
import { CallRequest } from '../../../src/models/infrasctructure/call-request';
import { ConnectionService } from '../../../src/services/connection-service';
import { ConnectionInternal, ConnectionState } from '../../../src/services/connection/connection';
import { getIceCallHandler, IceCallHandler } from '../../../src/services/handle/ice-call-handler';
import { SessionService } from '../../../src/services/session-service';
import { TimeService } from '../../../src/services/time-service';
import { Base64 } from '../../../src/utils/base64';
import { Cryptography } from '../../../src/utils/cryptography';
import { Logger } from '../../../src/utils/logger';
import { Utf8 } from '../../../src/utils/utf8';

jest.mock('../../../src/services/time-service');
jest.mock('../../../src/services/session-service');
jest.mock('../../../src/utils/base64');
jest.mock('../../../src/utils/utf8');
jest.mock('../../../src/utils/cryptography');
jest.mock('../../../src/services/connection-service');

describe('IceCallHandler', () => {
    let mockLogger: Logger;
    let mockTimeService: jest.Mocked<TimeService>;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockBase64: jest.Mocked<Base64>;
    let mockUtf8: jest.Mocked<Utf8>;
    let mockCryptography: jest.Mocked<Cryptography>;
    let mockConnectionService: jest.Mocked<ConnectionService>;
    let iceCallHandler: IceCallHandler;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = createMockLogger();
        mockTimeService = createMockTimeService() as unknown as jest.Mocked<TimeService>;
        mockSessionService = createMockSessionService() as unknown as jest.Mocked<SessionService>;
        mockBase64 = createMockBase64() as unknown as jest.Mocked<Base64>;
        mockUtf8 = createMockUtf8() as unknown as jest.Mocked<Utf8>;
        mockCryptography = createMockCryptography() as unknown as jest.Mocked<Cryptography>;
        mockConnectionService = {
            getConnection: jest.fn(),
        } as unknown as jest.Mocked<ConnectionService>;

        iceCallHandler = getIceCallHandler(
            mockLogger,
            mockTimeService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockConnectionService,
        );
    });

    describe('handle', () => {
        let request: CallRequest<IceCallData>;

        beforeEach(() => {
            request = {
                a: 'ice',
                b: {
                    a: 'peerPublicKey',
                    b: 1500,
                    c: 'myPublicKey',
                    d: 'encryptionPublicKey',
                    e: 'encryptedIceCandidate',
                    f: IceSource.Incoming, // Default to Incoming source
                },
                c: 'signature',
            };
        });

        it('should handle non-existent connection gracefully', async () => {
            mockConnectionService.getConnection.mockReturnValue(undefined);

            const result = await iceCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[ice-call-handler] Incoming call 'ice' from peerPublicKey ignored. No one connection is there.`,
            );
        });

        it('should process incoming ice candidate correctly', async () => {
            // Create a mock connection
            const mockConnection: Partial<ConnectionInternal> = {
                get state() {
                    return ConnectionState.Connecting;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                setOutgoingEncryption: jest.fn(),
                addOutgoingIce: jest.fn().mockResolvedValue(undefined),
                setIncomingEncryption: jest.fn(),
                addIncomingIce: jest.fn().mockResolvedValue(undefined),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            // Set incoming source
            request.b.f = IceSource.Incoming;

            const result = await iceCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.setOutgoingEncryption).toHaveBeenCalledWith('encryptionPublicKey');
            expect(mockConnection.addOutgoingIce).toHaveBeenCalledWith('encryptedIceCandidate');
            expect(mockConnection.setIncomingEncryption).not.toHaveBeenCalled();
            expect(mockConnection.addIncomingIce).not.toHaveBeenCalled();
        });

        it('should process outgoing ice candidate correctly', async () => {
            // Create a mock connection
            const mockConnection: Partial<ConnectionInternal> = {
                get state() {
                    return ConnectionState.Connecting;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                setOutgoingEncryption: jest.fn(),
                addOutgoingIce: jest.fn().mockResolvedValue(undefined),
                setIncomingEncryption: jest.fn(),
                addIncomingIce: jest.fn().mockResolvedValue(undefined),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            // Set outgoing source
            request.b.f = IceSource.Outgoing;

            const result = await iceCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.setIncomingEncryption).toHaveBeenCalledWith('encryptionPublicKey');
            expect(mockConnection.addIncomingIce).toHaveBeenCalledWith('encryptedIceCandidate');
            expect(mockConnection.setOutgoingEncryption).not.toHaveBeenCalled();
            expect(mockConnection.addOutgoingIce).not.toHaveBeenCalled();
        });

        it('should handle unknown ice source gracefully', async () => {
            // Create a mock connection
            const mockConnection: Partial<ConnectionInternal> = {
                get state() {
                    return ConnectionState.Connecting;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                setOutgoingEncryption: jest.fn(),
                addOutgoingIce: jest.fn(),
                setIncomingEncryption: jest.fn(),
                addIncomingIce: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            // Set unknown source
            request.b.f = IceSource.Unknown;

            const result = await iceCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.setOutgoingEncryption).not.toHaveBeenCalled();
            expect(mockConnection.addOutgoingIce).not.toHaveBeenCalled();
            expect(mockConnection.setIncomingEncryption).not.toHaveBeenCalled();
            expect(mockConnection.addIncomingIce).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[ice-call-handler] Unknown ice source from peerPublicKey ignored.`,
            );
        });
    });
});
