import {
    createMockLogger,
    createMockTimeService,
    createMockSessionService,
    createMockBase64,
    createMockUtf8,
    createMockCryptography,
} from '../../../__mocks__/test-utils';
import { CloseCallData } from '../../../src/models/close-call-data';
import { CallRequest } from '../../../src/models/infrasctructure/call-request';
import { ConnectionService } from '../../../src/services/connection-service';
import { ConnectionInternal, ConnectionState } from '../../../src/services/connection/connection';
import { ConnectionSagaState } from '../../../src/services/connection/connection-saga';
import { getCloseCallHandler, CloseCallHandler } from '../../../src/services/handle/close-call-handler';
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

describe('CloseCallHandler', () => {
    let mockLogger: Logger;
    let mockTimeService: jest.Mocked<TimeService>;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockBase64: jest.Mocked<Base64>;
    let mockUtf8: jest.Mocked<Utf8>;
    let mockCryptography: jest.Mocked<Cryptography>;
    let mockConnectionService: jest.Mocked<ConnectionService>;
    let closeCallHandler: CloseCallHandler;

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

        closeCallHandler = getCloseCallHandler(
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
        let request: CallRequest<CloseCallData>;

        beforeEach(() => {
            request = {
                a: 'close',
                b: {
                    a: 'peerPublicKey',
                    b: 1500,
                    c: 'myPublicKey',
                },
                c: 'signature',
            };
        });

        it('should close connection if it exists and is in valid state', async () => {
            // Create a proper ConnectionInternal mock
            const mockConnection: Partial<ConnectionInternal> = {
                get openedAt() {
                    return 1000;
                }, // Earlier than request timestamp (1500)
                get publicKey() {
                    return 'peerPublicKey';
                },
                get state() {
                    return ConnectionState.Open;
                }, // Not in Closed state
                get incomingState() {
                    return ConnectionSagaState.Connected;
                },
                get outgoingState() {
                    return ConnectionSagaState.Connected;
                },
                close: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            const result = await closeCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.close).toHaveBeenCalled();
            // Note: The handler doesn't call deleteConnection as assumed initially
        });

        it('should not close connection if it is already closed', async () => {
            const mockConnection: Partial<ConnectionInternal> = {
                get openedAt() {
                    return 1000;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                get state() {
                    return ConnectionState.Closed;
                }, // Already closed
                get incomingState() {
                    return ConnectionSagaState.Closed;
                },
                get outgoingState() {
                    return ConnectionSagaState.Closed;
                },
                close: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            const result = await closeCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.close).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[close-call-handler] Incoming call 'close' from peerPublicKey ignored. Connection is not in suitable state (not closed expected, closed found).`,
            );
        });

        it('should not close connection if timestamp is too late', async () => {
            const mockConnection: Partial<ConnectionInternal> = {
                get openedAt() {
                    return 2000;
                }, // Later than request timestamp (1500)
                get publicKey() {
                    return 'peerPublicKey';
                },
                get state() {
                    return ConnectionState.Open;
                },
                get incomingState() {
                    return ConnectionSagaState.Connected;
                },
                get outgoingState() {
                    return ConnectionSagaState.Connected;
                },
                close: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            const result = await closeCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.close).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[close-call-handler] Incoming call 'close' from peerPublicKey ignored. Timestamp is too late.`,
            );
        });

        it('should handle non-existent connection gracefully', async () => {
            mockConnectionService.getConnection.mockReturnValue(undefined);

            const result = await closeCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[close-call-handler] Incoming call 'close' from peerPublicKey ignored. No one connection is there.`,
            );
        });
    });
});
