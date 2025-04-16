import {
    createMockLogger,
    createMockTimeService,
    createMockSessionService,
    createMockBase64,
    createMockUtf8,
    createMockCryptography,
} from '../../../__mocks__/test-utils';
import { DialCallData } from '../../../src/models/dial-call-data';
import { CallRequest } from '../../../src/models/infrasctructure/call-request';
import { ConnectionService } from '../../../src/services/connection-service';
import { ConnectionInternal, ConnectionState } from '../../../src/services/connection/connection';
import { ConnectionSagaState } from '../../../src/services/connection/connection-saga';
import {
    getDialCallHandler,
    DialCallHandler,
    DialCallHandlerConfig,
} from '../../../src/services/handle/dial-call-handler';
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

describe('DialCallHandler', () => {
    let mockLogger: Logger;
    let mockTimeService: jest.Mocked<TimeService>;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockBase64: jest.Mocked<Base64>;
    let mockUtf8: jest.Mocked<Utf8>;
    let mockCryptography: jest.Mocked<Cryptography>;
    let mockConnectionService: jest.Mocked<ConnectionService>;
    let dialCallHandler: DialCallHandler;
    let mockConfig: DialCallHandlerConfig;
    let mockFocusOnDial: jest.Mock;
    let mockRequestDial: jest.Mock;

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
            createIncoming: jest.fn(),
            createOutgoing: jest.fn(),
            deleteConnection: jest.fn(),
            initialize: jest.fn(),
        } as unknown as jest.Mocked<ConnectionService>;

        dialCallHandler = getDialCallHandler(
            mockLogger,
            mockTimeService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
            mockConnectionService,
        );

        mockFocusOnDial = jest.fn().mockImplementation(async () => true);
        mockRequestDial = jest.fn().mockImplementation(async () => true);

        mockConfig = {
            focusOnDial: mockFocusOnDial,
            requestDial: mockRequestDial,
        };

        dialCallHandler.initialize(mockConfig);
    });

    describe('initialize', () => {
        it('should initialize the handler and log debug message', () => {
            const handler = getDialCallHandler(
                mockLogger,
                mockTimeService,
                mockSessionService,
                mockBase64,
                mockUtf8,
                mockCryptography,
                mockConnectionService,
            );

            handler.initialize(mockConfig);

            expect(mockLogger.debug).toHaveBeenCalledWith('[dial-call-handler] Initialized.');
        });
    });

    describe('handle', () => {
        let request: CallRequest<DialCallData>;

        beforeEach(() => {
            request = {
                a: 'dial',
                b: {
                    a: 'peerPublicKey',
                    b: 1500,
                    c: 'myPublicKey',
                    d: 'encryptionKey',
                },
                c: 'signature',
            };
        });

        it('should continue existing connection when in AwaitingDial state', async () => {
            const connectionMock = {
                setIncomingEncryption: jest.fn(),
                openIncoming: jest.fn().mockResolvedValue(undefined),
                continueIncoming: jest.fn(),
                get incomingState() {
                    return ConnectionSagaState.AwaitingDial;
                },
            };
            mockConnectionService.getConnection = jest.fn().mockReturnValue(connectionMock);

            const result = await dialCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(connectionMock.setIncomingEncryption).toHaveBeenCalledWith('encryptionKey');
            expect(connectionMock.continueIncoming).toHaveBeenCalled();
            expect(connectionMock.openIncoming).not.toHaveBeenCalled();
        });

        it('should reopen connection when not in suitable state', async () => {
            const connectionMock = {
                setIncomingEncryption: jest.fn(),
                openIncoming: jest.fn().mockResolvedValue(undefined),
                continueIncoming: jest.fn(),
            };
            mockConnectionService.getConnection = jest.fn().mockReturnValue(connectionMock);

            const result = await dialCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(connectionMock.setIncomingEncryption).toHaveBeenCalledWith('encryptionKey');
            expect(connectionMock.continueIncoming).not.toHaveBeenCalled();
            expect(connectionMock.openIncoming).toHaveBeenCalled();
            expect(mockFocusOnDial).toHaveBeenCalled();
        });

        it('should create new connection when none exists', async () => {
            mockConnectionService.getConnection = jest.fn().mockReturnValueOnce(undefined);
            const connectionMock = {
                setIncomingEncryption: jest.fn(),
                openIncoming: jest.fn().mockResolvedValue(undefined),
            };
            mockConnectionService.createIncoming = jest.fn().mockReturnValue(connectionMock);

            const result = await dialCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockConnectionService.getConnection).toHaveBeenCalledWith('peerPublicKey');
            expect(mockConnectionService.createIncoming).toHaveBeenCalledWith('peerPublicKey');
            expect(connectionMock.setIncomingEncryption).toHaveBeenCalledWith('encryptionKey');
            expect(connectionMock.openIncoming).toHaveBeenCalled();
            expect(mockFocusOnDial).toHaveBeenCalled();
            expect(mockRequestDial).toHaveBeenCalled();
        });

        it('should return false if focusOnDial returns false', async () => {
            mockConnectionService.getConnection = jest.fn().mockReturnValueOnce(undefined);
            mockFocusOnDial.mockImplementation(async () => false);

            const result = await dialCallHandler.handle(request);

            expect(result).toBe(false);
            expect(mockFocusOnDial).toHaveBeenCalled();
            expect(mockRequestDial).not.toHaveBeenCalled();
            expect(mockConnectionService.createIncoming).not.toHaveBeenCalled();
        });

        it('should log and return true if request is declined', async () => {
            mockConnectionService.getConnection = jest.fn().mockReturnValueOnce(undefined);
            mockRequestDial.mockImplementation(async () => false);

            const result = await dialCallHandler.handle(request);

            expect(result).toBe(true);
            expect(mockFocusOnDial).toHaveBeenCalled();
            expect(mockRequestDial).toHaveBeenCalled();
            expect(mockConnectionService.createIncoming).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[dial-call-handler] Incoming call 'dial' from peerPublicKey declined.`,
            );
        });
    });
});
