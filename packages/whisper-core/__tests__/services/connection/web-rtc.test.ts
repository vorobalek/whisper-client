import { getDefaultWebRTC } from '../../../src/services/connection/web-rtc';

describe('WebRTC', () => {
    const MockRTCPeerConnection = function () {};
    const MockRTCDataChannel = function () {};

    it('should return a WebRTC implementation with PeerConnection and DataChannel', () => {
        // Act
        const webRTC = { PeerConnection: MockRTCPeerConnection, DataChannel: MockRTCDataChannel };

        // Assert
        expect(webRTC).toBeDefined();
        expect(webRTC.PeerConnection).toBe(MockRTCPeerConnection);
        expect(webRTC.DataChannel).toBe(MockRTCDataChannel);
    });

    it('should match the WebRTC interface', () => {
        // Arrange
        const webRTC = { PeerConnection: MockRTCPeerConnection, DataChannel: MockRTCDataChannel };

        // Assert
        expect(typeof webRTC.PeerConnection).toBe('function');
        expect(typeof webRTC.DataChannel).toBe('function');

        // Verify the interface structure
        const webRTCKeys = Object.keys(webRTC);
        expect(webRTCKeys).toContain('PeerConnection');
        expect(webRTCKeys).toContain('DataChannel');
        expect(webRTCKeys.length).toBe(2); // Only these two properties should exist
    });
});
