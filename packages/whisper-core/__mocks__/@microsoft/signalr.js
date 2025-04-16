// Centralized Jest mock for @microsoft/signalr
const mockConnectionInstance = {
    start: jest.fn().mockResolvedValue(undefined),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
};

const mockConnectionBuilder = {
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    configureLogging: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockConnectionInstance),
};

module.exports = {
    HubConnection: jest.fn(),
    HubConnectionBuilder: jest.fn().mockImplementation(() => mockConnectionBuilder),
    LogLevel: {
        Warning: 'Warning',
    },
};
