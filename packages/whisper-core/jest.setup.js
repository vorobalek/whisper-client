// Mock for browser-specific APIs that might not be available in Jest
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock for Worker that might not be available in Node.js environment
class MockWorker {
    constructor(stringUrl) {
        this.url = stringUrl;
        this.onmessage = null;
    }

    postMessage(msg) {
        if (this.onmessage) {
            this.onmessage({ data: { type: 'MOCK_RESPONSE', original: msg } });
        }
    }

    terminate() {}
}

global.Worker = MockWorker;

// Mock RTCPeerConnection
class MockRTCPeerConnection {
    constructor() {
        this.localDescription = null;
        this.remoteDescription = null;
        this.iceConnectionState = 'new';
        this.connectionState = 'new';
        this.onicecandidate = null;
        this.oniceconnectionstatechange = null;
        this.ondatachannel = null;
        this.onconnectionstatechange = null;
    }

    createOffer() {
        return Promise.resolve({ type: 'offer', sdp: 'mock-sdp' });
    }

    createAnswer() {
        return Promise.resolve({ type: 'answer', sdp: 'mock-sdp' });
    }

    setLocalDescription(desc) {
        this.localDescription = desc;
        return Promise.resolve();
    }

    setRemoteDescription(desc) {
        this.remoteDescription = desc;
        return Promise.resolve();
    }

    addIceCandidate() {
        return Promise.resolve();
    }

    createDataChannel(label) {
        return new MockRTCDataChannel(label);
    }

    close() {}

    getStats() {
        return Promise.resolve(new Map());
    }
}

// Mock RTCDataChannel
class MockRTCDataChannel {
    constructor(label) {
        this.label = label;
        this.readyState = 'connecting';
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.binaryType = 'arraybuffer';
    }

    send() {}
    close() {}
}

global.RTCPeerConnection = MockRTCPeerConnection;
global.RTCDataChannel = MockRTCDataChannel;

// Mock Notification if not available
if (!global.Notification) {
    global.Notification = class Notification {
        constructor(title, options) {
            this.title = title;
            this.options = options;
        }

        static requestPermission() {
            return Promise.resolve('granted');
        }

        static get permission() {
            return 'granted';
        }
    };
}

// Add any other mocks needed for browser APIs
if (!global.crypto) {
    global.crypto = {
        subtle: {
            // Add mock implementations as needed
            generateKey: jest.fn().mockResolvedValue({}),
            exportKey: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
            importKey: jest.fn().mockResolvedValue({}),
            sign: jest.fn().mockResolvedValue(new Uint8Array([5, 6, 7, 8])),
            verify: jest.fn().mockResolvedValue(true),
        },
        getRandomValues: jest.fn((arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }),
    };
}

// Suppress console during tests
global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
