import {
    createMockBase64,
    createMockCallService,
    createMockConnection,
    createMockCryptography,
    createMockLogger,
    createMockSessionService,
    createMockTimeService,
    createMockUtf8,
    createMockWebRTC,
} from '../../__mocks__/test-utils';
import { CallService } from '../../src/services/call-service';
import { getConnectionService } from '../../src/services/connection-service';
// Import ConnectionState after mocking
import { ConnectionState } from '../../src/services/connection/connection';
import { SessionService } from '../../src/services/session-service';
import { TimeService } from '../../src/services/time-service';
import { Base64 } from '../../src/utils/base64';
import { Cryptography } from '../../src/utils/cryptography';
import { Logger } from '../../src/utils/logger';
import { Utf8 } from '../../src/utils/utf8';

// Use a map to store mock connections by public key
const mockConnections: Record<string, any> = {};

// Mock the imported functions and modules
jest.mock('../../src/services/connection/connection', () => {
    return {
        ConnectionState: {
            New: 'new',
            Connecting: 'connecting',
            Open: 'open',
            Closed: 'closed',
        },
        getConnection: jest.fn().mockImplementation((publicKey) => mockConnections[publicKey]),
        translateConnection: jest.fn().mockImplementation((conn) => conn),
    };
});

describe('ConnectionService', () => {
    let connectionService: ReturnType<typeof getConnectionService>;
    let mockLogger: Logger;
    let mockTimeService: TimeService;
    let mockCallService: CallService;
    let mockSessionService: SessionService;
    let mockBase64: Base64;
    let mockUtf8: Utf8;
    let mockCryptography: Cryptography;
    let mockOnIncomingConnection: jest.Mock;

    beforeEach(() => {
        // Reset mock connections map
        for (const key in mockConnections) {
            delete mockConnections[key];
        }

        // Create mock dependencies
        mockLogger = createMockLogger();
        mockTimeService = createMockTimeService();
        mockCallService = createMockCallService();
        mockSessionService = createMockSessionService();
        mockBase64 = createMockBase64();
        mockUtf8 = createMockUtf8();
        mockCryptography = createMockCryptography();
        mockOnIncomingConnection = jest.fn();

        // Create the service
        connectionService = getConnectionService(
            mockLogger,
            mockTimeService,
            mockCallService,
            mockSessionService,
            mockBase64,
            mockUtf8,
            mockCryptography,
        );
    });

    describe('initialize', () => {
        it('should log debug message when initialized', () => {
            // Given
            const config = {
                webRTC: createMockWebRTC(),
            };

            // When
            connectionService.initialize(config);

            // Then
            expect(mockLogger.debug).toHaveBeenCalledWith('[connection-service] Initialized.');
        });

        it('should store the onIncomingConnection callback', async () => {
            // Given
            const config = {
                webRTC: createMockWebRTC(),
                onIncomingConnection: mockOnIncomingConnection,
            };

            // When
            connectionService.initialize(config);
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.New });
            mockConnections['test-key'] = conn;
            connectionService.createIncoming('test-key');

            // Then - verify callback was called
            await new Promise(process.nextTick); // Wait for the promise to resolve
            expect(mockOnIncomingConnection).toHaveBeenCalled();
        });

        it('should handle errors in onIncomingConnection callback', async () => {
            // Given
            const errorMessage = 'Test callback error';
            const callbackWithError = jest.fn().mockImplementation(() => {
                throw new Error(errorMessage);
            });

            const config = {
                webRTC: createMockWebRTC(),
                onIncomingConnection: callbackWithError,
            };

            // When
            connectionService.initialize(config);
            connectionService.createIncoming('test-key');

            // Then - verify error was logged
            await new Promise(process.nextTick); // Wait for the promise to resolve
            expect(callbackWithError).toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                '[connection-service] On incoming connection callback error.',
                expect.any(Error),
            );
        });
    });

    describe('connections', () => {
        it('should return array of connections', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn1 = createMockConnection({ publicKey: 'test-key1', state: ConnectionState.New });
            const conn2 = createMockConnection({ publicKey: 'test-key2', state: ConnectionState.New });
            mockConnections['test-key1'] = conn1;
            mockConnections['test-key2'] = conn2;
            connectionService.createOutgoing('test-key1');
            connectionService.createOutgoing('test-key2');

            // When
            const result = connectionService.connections;

            // Then
            expect(result.length).toBe(2);
            expect(result[0]).toBe(conn1);
            expect(result[1]).toBe(conn2);
        });
    });

    describe('getConnection', () => {
        it('should return connection by public key', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.New });
            mockConnections['test-key'] = conn;
            connectionService.createOutgoing('test-key');

            // When
            const result = connectionService.getConnection('test-key');

            // Then
            expect(result).toBe(conn);
        });

        it('should return undefined for unknown public key', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });

            // When
            const result = connectionService.getConnection('non-existent-key');

            // Then
            expect(result).toBeUndefined();
        });
    });

    describe('createIncoming', () => {
        it('should create a new connection', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.New });
            mockConnections['test-key'] = conn;

            // When
            const result = connectionService.createIncoming('test-key');

            // Then
            expect(result).toBe(conn);
        });
    });

    describe('createOutgoing', () => {
        it('should create a new connection', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.New });
            mockConnections['test-key'] = conn;

            // When
            const result = connectionService.createOutgoing('test-key');

            // Then
            expect(result).toBe(conn);
        });
    });

    describe('deleteConnection', () => {
        it('should close and delete the connection', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.Open });
            mockConnections['test-key'] = conn;
            connectionService.createOutgoing('test-key');

            // When
            connectionService.deleteConnection('test-key');

            // Then
            expect(conn.close).toHaveBeenCalled();
            expect(connectionService.getConnection('test-key')).toBeUndefined();
        });

        it('should not try to close connection if already closed', () => {
            // Given
            connectionService.initialize({ webRTC: createMockWebRTC() });
            const conn = createMockConnection({ publicKey: 'test-key', state: ConnectionState.Closed });
            mockConnections['test-key'] = conn;
            connectionService.createOutgoing('test-key');

            // When
            connectionService.deleteConnection('test-key');

            // Then
            expect(conn.close).not.toHaveBeenCalled();
            expect(connectionService.getConnection('test-key')).toBeUndefined();
        });
    });
});
