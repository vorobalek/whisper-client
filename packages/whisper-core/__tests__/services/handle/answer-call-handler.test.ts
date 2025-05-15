import {
    createMockBase64,
    createMockCryptography,
    createMockLogger,
    createMockSessionService,
    createMockTimeService,
    createMockUtf8,
} from '../../../__mocks__/test-utils';
import { AnswerCallData } from '../../../src/models/answer-call-data';
import { CallRequest } from '../../../src/models/infrasctructure/call-request';
import { ConnectionService } from '../../../src/services/connection-service';
import { ConnectionInternal, ConnectionState } from '../../../src/services/connection/connection';
import { ConnectionSagaState } from '../../../src/services/connection/connection-saga';
import { AnswerCallHandler, getAnswerCallHandler } from '../../../src/services/handle/answer-call-handler';
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

describe('AnswerCallHandler', () => {
    let mockLogger: Logger;
    let mockTimeService: jest.Mocked<TimeService>;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockBase64: jest.Mocked<Base64>;
    let mockUtf8: jest.Mocked<Utf8>;
    let mockCryptography: jest.Mocked<Cryptography>;
    let mockConnectionService: jest.Mocked<ConnectionService>;
    let answerCallHandler: AnswerCallHandler;

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

        answerCallHandler = getAnswerCallHandler(
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
        let request: CallRequest<AnswerCallData>;

        beforeEach(() => {
            request = {
                a: 'answer',
                b: {
                    a: 'peerPublicKey',
                    b: 1500,
                    c: 'myPublicKey',
                    d: 'encryptionPublicKey',
                    e: 'encryptedSdpAnswer',
                },
                c: 'signature',
            };
        });

        it('should process the answer and continue incoming saga if connection exists and is in correct state', async () => {
            // Create a mock connection with the expected state
            const mockConnection: Partial<ConnectionInternal> = {
                get incomingState() {
                    return ConnectionSagaState.AwaitingAnswer;
                },
                get state() {
                    return ConnectionState.Connecting;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                setIncomingEncryption: jest.fn(),
                setIncomingDescription: jest.fn().mockResolvedValue(undefined),
                continueIncoming: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            const result = await answerCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.setIncomingEncryption).toHaveBeenCalledWith('encryptionPublicKey');
            expect(mockConnection.setIncomingDescription).toHaveBeenCalledWith('encryptedSdpAnswer');
            expect(mockConnection.continueIncoming).toHaveBeenCalled();
        });

        it('should handle non-existent connection gracefully', async () => {
            mockConnectionService.getConnection.mockReturnValue(undefined);

            const result = await answerCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[answer-call-handler] Incoming call 'answer' from peerPublicKey ignored. No one connection is there.`,
            );
        });

        it('should not process answer if connection incoming saga is in the wrong state', async () => {
            // Create a mock connection with the incorrect state
            const mockConnection: Partial<ConnectionInternal> = {
                get incomingState() {
                    return ConnectionSagaState.Connected;
                }, // Not AwaitingAnswer
                get state() {
                    return ConnectionState.Open;
                },
                get publicKey() {
                    return 'peerPublicKey';
                },
                setIncomingEncryption: jest.fn(),
                setIncomingDescription: jest.fn(),
                continueIncoming: jest.fn(),
            };

            mockConnectionService.getConnection.mockReturnValue(mockConnection as ConnectionInternal);

            const result = await answerCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnection.setIncomingEncryption).not.toHaveBeenCalled();
            expect(mockConnection.setIncomingDescription).not.toHaveBeenCalled();
            expect(mockConnection.continueIncoming).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[answer-call-handler] Incoming call 'answer' from peerPublicKey ignored. Incoming saga is not in suitable state (AwaitingAnswer expected, Connected found).`,
            );
        });
    });
});
