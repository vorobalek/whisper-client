// Common mocks for whisper-core tests
import type { WorkerService } from '../src/services/worker-service';

// Minimal interfaces for strict typing of mocks
interface MockRTCDataChannel {
    id: string;
    label: string;
    readyState: string;
    onopen: jest.Mock<any, any>;
    onmessage: jest.Mock<any, any>;
    close: jest.Mock<any, any>;
    send: jest.Mock<any, any>;
}

interface MockRTCPeerConnection {
    createDataChannel: jest.Mock<any, any>;
    createOffer: jest.Mock<any, any>;
    createAnswer: jest.Mock<any, any>;
    setLocalDescription: jest.Mock<any, any>;
    setRemoteDescription: jest.Mock<any, any>;
    addIceCandidate: jest.Mock<any, any>;
    onicecandidate: jest.Mock<any, any>;
    ondatachannel: jest.Mock<any, any>;
    onconnectionstatechange: jest.Mock<any, any>;
    close: jest.Mock<any, any>;
    getStats: jest.Mock<any, any>;
    remoteDescription: any;
}

export function createMockLogger() {
    return {
        trace: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
}

export function createMockTimeService() {
    return {
        get serverTime() {
            return 123456789;
        },
        set serverTime(_value: number) {},
    };
}

export function createMockSessionService() {
    return {
        initialize: jest.fn(),
        get signingKeyPair() {
            return { publicKey: new Uint8Array([1, 2, 3]), secretKey: new Uint8Array([4, 5, 6]) };
        },
        get signingPublicKeyBase64() {
            return 'abc123';
        },
        get signingPublicKeyBase64Safe() {
            return 'abc123';
        },
    };
}

export function createMockBase64(arg: any = {}) {
    // Backward compatibility: if arg has keys other than encode/decode, treat as encodeMap
    if (typeof arg === 'object' && arg !== null && !('encode' in arg) && !('decode' in arg)) {
        const encodeMap = arg;
        return {
            encode: jest.fn((data: Uint8Array) => {
                const key = Array.from(data).join(',');
                if (encodeMap[key]) return encodeMap[key];
                return 'encoded-data';
            }),
            decode: jest.fn(),
        };
    }
    // New API
    return {
        encode: arg.encode || jest.fn((data: Uint8Array) => 'encoded-data'),
        decode: arg.decode || jest.fn(),
    };
}

export function createMockUtf8({ encode, decode }: { encode?: any; decode?: any } = {}) {
    return {
        encode: encode || jest.fn(),
        decode: decode || jest.fn().mockReturnValue(new Uint8Array([7, 8, 9])),
    };
}

export function createMockCryptography(
    overrides: Partial<{
        generateEncryptionKeyPair: () => any;
        generateSharedSymmetricKey: () => any;
        encrypt: (data: any) => any;
        decrypt: (data: any) => any;
        sign: () => any;
        verifySignature: () => any;
        generateSigningKeyPair: () => any;
    }> = {},
) {
    return {
        generateEncryptionKeyPair:
            overrides.generateEncryptionKeyPair ||
            jest.fn(() => ({
                publicKey: new Uint8Array([1, 2, 3]),
                secretKey: new Uint8Array([4, 5, 6]),
            })),
        generateSharedSymmetricKey: overrides.generateSharedSymmetricKey || jest.fn(() => new Uint8Array([7, 8, 9])),
        encrypt: overrides.encrypt || jest.fn((data) => data),
        decrypt: overrides.decrypt || jest.fn((data) => data),
        sign: overrides.sign || jest.fn(() => new Uint8Array([10, 11, 12])),
        verifySignature: overrides.verifySignature || jest.fn(() => true),
        generateSigningKeyPair:
            overrides.generateSigningKeyPair ||
            jest.fn(() => ({
                publicKey: new Uint8Array([13, 14, 15]),
                secretKey: new Uint8Array([16, 17, 18]),
            })),
    };
}

export function createMockCallService() {
    return {
        initialize: jest.fn(),
        update: jest.fn(),
        dial: jest.fn(),
        offer: jest.fn(),
        answer: jest.fn(),
        ice: jest.fn(),
        close: jest.fn(),
    };
}

// Factory for creating mockConfig for push-service
export function createMockPushConfig(overrides = {}) {
    const TEST_VAPID_KEY = 'BDuixZ_tK0mDQPXYYuT1zWcql3BKy_y_dJmUVd9M5hTpCkE-BCvqeXGKyKqX2YRxLQIw1x_SZTHxY7MNwUx4hI0';
    const notificationMock = jest.fn() as unknown as typeof Notification;
    (notificationMock as any).permission = 'granted';
    notificationMock.requestPermission = jest.fn().mockResolvedValue('granted');
    const basePushManager = {
        getSubscription: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
    } as unknown as typeof PushManager;
    return {
        vapidKey: TEST_VAPID_KEY,
        onCall: jest.fn().mockResolvedValue(undefined),
        onPermissionDefault: jest.fn().mockResolvedValue(undefined),
        onPermissionGranted: jest.fn().mockResolvedValue(undefined),
        onPermissionDenied: jest.fn().mockResolvedValue(undefined),
        notification: notificationMock,
        urlBase64ToUint8Array: () => new Uint8Array([1, 2, 3]),
        pushManager: basePushManager,
        ...overrides,
    };
}

export function createMockWebRTC(): any {
    class MockPeerConnection {
        static generateCertificate = jest.fn().mockResolvedValue({});
        constructor(_config?: any) {}
    }
    return {
        PeerConnection: MockPeerConnection as any,
        DataChannel: jest.fn() as any,
    };
}

export function createMockDialCallHandler() {
    return {
        initialize: jest.fn(),
        parse: jest.fn(),
        validate: jest.fn(),
        handle: jest.fn(),
    };
}

export function createMockOfferCallHandler() {
    return {
        parse: jest.fn(),
        validate: jest.fn(),
        handle: jest.fn(),
    };
}

export function createMockAnswerCallHandler() {
    return {
        parse: jest.fn(),
        validate: jest.fn(),
        handle: jest.fn(),
    };
}

export function createMockIceCallHandler() {
    return {
        parse: jest.fn(),
        validate: jest.fn(),
        handle: jest.fn(),
    };
}

export function createMockCloseCallHandler() {
    return {
        parse: jest.fn(),
        validate: jest.fn(),
        handle: jest.fn(),
    };
}

export function createMockWorkerService({
    registration,
    container,
    controller,
}: { registration?: any; container?: any; controller?: any } = {}): WorkerService {
    return {
        async initialize(_config: any) {
            return;
        },
        get registration() {
            return registration;
        },
        get container() {
            return container;
        },
        get controller() {
            return controller;
        },
    };
}

export function createMockServiceWorker({
    register = jest.fn(),
    ready = Promise.resolve({ scope: 'http://localhost/' }),
    addEventListener = jest.fn(),
    controller = { state: 'activated' },
} = {}) {
    return {
        register,
        ready,
        addEventListener,
        controller,
    };
}

export function createMockNotification({
    permission = 'granted',
    requestPermissionResult = 'granted',
    asConstructor = false,
} = {}) {
    if (asConstructor) {
        // @ts-ignore
        function MockNotification(this: any, ...args: any[]) {
            MockNotification.calls.push(args);
        }
        MockNotification.calls = [] as any[];
        (MockNotification as any).permission = permission;
        (MockNotification as any).requestPermission = jest.fn().mockResolvedValue(requestPermissionResult);
        return MockNotification as any;
    }
    return {
        permission,
        requestPermission: jest.fn().mockResolvedValue(requestPermissionResult),
    } as any;
}

// You can add other mock factories here as needed

// Utility to mock Date.now in tests
export function mockDateNow(value: number) {
    Date.now = jest.fn().mockReturnValue(value);
}

// Utility to restore Date.now in tests
export function restoreDateNow(original: typeof Date.now) {
    Date.now = original;
}

// Centralized service mocks for Whisper tests
export function mockWhisperCoreServices() {
    // Singletons for all service mocks
    const callServiceMock = {
        initialize: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const connectionServiceMock = {
        initialize: jest.fn(),
        connections: [] as any[],
        getConnection: jest.fn(),
        createOutgoing: jest.fn(),
        deleteConnection: jest.fn(),
    };
    const handleServiceMock = {
        initialize: jest.fn(),
        call: jest.fn(),
    };
    const pushServiceMock = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getSubscription: jest
            .fn()
            .mockResolvedValue({ endpoint: 'test-endpoint', keys: { p256dh: 'key1', auth: 'key2' } }),
        showNotification: jest.fn().mockReturnValue(true),
    };
    const sessionServiceMock = {
        initialize: jest.fn().mockResolvedValue(undefined),
        signingKeyPair: {} as any,
        signingPublicKeyBase64: 'test-public-key',
        signingPublicKeyBase64Safe: 'test-public-key-safe',
    };
    const signalRServiceMock = {
        initialize: jest.fn().mockImplementation(async (config) => {
            if (config.onReady) {
                await config.onReady();
            }
        }),
    };
    const workerServiceMock = {
        initialize: jest.fn().mockResolvedValue(undefined),
        controller: {
            postMessage: jest.fn(),
        },
    };
    const timeServiceMock = {
        serverTime: 12345,
    };
    let translateConnectionMock = jest.fn((conn) =>
        conn ? { publicKey: conn.publicKey || 'mock-key', state: conn.state || 0 } : conn,
    );
    jest.mock('../src/services/call-service', () => ({
        getCallService: jest.fn(() => callServiceMock),
    }));
    jest.mock('../src/services/connection-service', () => ({
        getConnectionService: jest.fn(() => connectionServiceMock),
    }));
    jest.mock('../src/services/handle-service', () => ({
        getHandleService: jest.fn(() => handleServiceMock),
    }));
    jest.mock('../src/services/push-service', () => ({
        getPushService: jest.fn(() => pushServiceMock),
    }));
    jest.mock('../src/services/session-service', () => ({
        getSessionService: jest.fn(() => sessionServiceMock),
    }));
    jest.mock('../src/services/signalr-service', () => ({
        getSignalRService: jest.fn(() => signalRServiceMock),
    }));
    jest.mock('../src/services/worker-service', () => ({
        getWorkerService: jest.fn(() => workerServiceMock),
    }));
    jest.mock('../src/services/time-service', () => ({
        getTimeService: jest.fn(() => timeServiceMock),
    }));
    jest.mock('../src/services/connection/connection', () => {
        const original = jest.requireActual('../src/services/connection/connection');
        return {
            ...original,
            translateConnection: translateConnectionMock,
        };
    });

    jest.mock('../src/utils/api-client', () => ({
        getApiClient: jest.fn().mockReturnValue({}),
    }));
    jest.mock('../src/utils/base64', () => ({
        getBase64: jest.fn().mockReturnValue({}),
    }));
    jest.mock('../src/utils/cryptography', () => ({
        getCryptography: jest.fn().mockReturnValue({
            generateSigningKeyPair: jest.fn().mockReturnValue({
                publicKey: new Uint8Array(),
                secretKey: new Uint8Array(),
            }),
        }),
    }));
    jest.mock('../src/utils/utf8', () => ({
        getUtf8: jest.fn().mockReturnValue({}),
    }));
}

// Centralized browser API mocks for Whisper tests
export function setupWhisperBrowserMocks() {
    jest.useFakeTimers();
    (global as any).RTCPeerConnection = jest.fn();
    (global as any).RTCDataChannel = jest.fn();
    (global as any).window = {
        Notification: jest.fn(),
        PushManager: jest.fn(),
        urlBase64ToUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
    };
}

export function teardownWhisperBrowserMocks() {
    jest.useRealTimers();
    delete (global as any).RTCPeerConnection;
    delete (global as any).RTCDataChannel;
    delete (global as any).window;
}

export function createMockNavigator({ serviceWorker, sendBeacon }: Partial<Navigator & { sendBeacon?: any }> = {}) {
    const nav: any = {};
    if (serviceWorker !== undefined) nav.serviceWorker = serviceWorker;
    if (sendBeacon !== undefined) nav.sendBeacon = sendBeacon;
    return nav;
}

// Centralized mock for PushSubscription
export function createMockPushSubscription(overrides: Partial<PushSubscription> = {}): PushSubscription {
    return {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        expirationTime: null,
        options: { applicationServerKey: new Uint8Array([1, 2, 3]) },
        getKey: jest.fn().mockImplementation((key) => {
            if (key === 'p256dh') return new Uint8Array([4, 5, 6]);
            if (key === 'auth') return new Uint8Array([7, 8, 9]);
            return null;
        }),
        unsubscribe: jest.fn().mockResolvedValue(true),
        ...overrides,
    } as unknown as PushSubscription;
}

// Centralized mock for PushManager
export function createMockPushManager(
    overrides: Partial<PushManager> = {},
    subscription?: PushSubscription,
): PushManager {
    const mockSubscription = subscription || createMockPushSubscription();
    return {
        getSubscription: jest.fn().mockResolvedValue(mockSubscription),
        subscribe: jest.fn().mockResolvedValue(mockSubscription),
        ...overrides,
    } as unknown as PushManager;
}

// Centralized mock for ServiceWorkerContainer
export function createMockServiceWorkerContainer(
    overrides: Partial<ServiceWorkerContainer> = {},
    registration?: any,
    controller?: any,
): ServiceWorkerContainer {
    const eventListeners: Record<string, Function[]> = {};
    return {
        addEventListener: jest.fn().mockImplementation((event, handler) => {
            if (!eventListeners[event]) eventListeners[event] = [];
            eventListeners[event].push(handler);
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        controller: controller || { postMessage: jest.fn() },
        oncontrollerchange: null,
        onmessage: null,
        onmessageerror: null,
        ready: Promise.resolve(registration),
        getRegistration: jest.fn(),
        getRegistrations: jest.fn(),
        register: jest.fn(),
        startMessages: jest.fn(),
        ...overrides,
    } as unknown as ServiceWorkerContainer;
}

// Centralized mock for Connection
export function createMockConnection(overrides: Partial<any> = {}) {
    return {
        publicKey: 'test-public-key',
        state: 'new',
        close: jest.fn(),
        ...overrides,
    };
}

export function createMockDataChannel(overrides: Partial<MockRTCDataChannel> = {}): MockRTCDataChannel {
    return {
        id: 'data-channel-id',
        label: 'mock-data-channel',
        readyState: 'connecting',
        onopen: jest.fn(),
        onmessage: jest.fn(),
        close: jest.fn(),
        send: jest.fn(),
        ...overrides,
    };
}

export function createMockPeerConnection(
    overrides: Partial<MockRTCPeerConnection> = {},
    mockDataChannel?: MockRTCDataChannel,
): MockRTCPeerConnection {
    return {
        createDataChannel: jest.fn(() => mockDataChannel || createMockDataChannel()),
        createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
        setLocalDescription: jest.fn().mockResolvedValue(undefined),
        setRemoteDescription: jest.fn().mockResolvedValue(undefined),
        addIceCandidate: jest.fn().mockResolvedValue(undefined),
        onicecandidate: jest.fn(),
        ondatachannel: jest.fn(),
        onconnectionstatechange: jest.fn(),
        close: jest.fn(),
        getStats: jest.fn().mockResolvedValue(
            new Map([
                [
                    'candidate-pair-id',
                    {
                        type: 'candidate-pair',
                        selected: true,
                        localCandidateId: 'local-candidate-id',
                    },
                ],
                [
                    'local-candidate-id',
                    {
                        candidateType: 'host',
                        address: '192.168.1.1',
                    },
                ],
            ]),
        ),
        remoteDescription: null,
        ...overrides,
    };
}

// Factory for creating a mock CryptoKeyPair
export function createMockKeyPair(overrides = {}) {
    return {
        publicKey: new Uint8Array([1, 2, 3]),
        secretKey: new Uint8Array([4, 5, 6]),
        ...overrides,
    };
}

// Factory for creating a mock Whisper config
export function createMockWhisperConfig(overrides = {}) {
    return {
        serverUrl: 'https://test-server.com',
        onCall: jest.fn(),
        onReady: jest.fn(),
        focusOnDial: jest.fn(),
        requestDial: jest.fn(),
        version: '1.0.0',
        signingKeyPair: createMockKeyPair(),
        vapidKey: 'test-vapid-key',
        iceServers: [{ urls: 'stun:test.com' }],
        navigator: { serviceWorker: {} },
        ...overrides,
    };
}
