/**
 * Interface describing the web Real-Time Communication (WebRTC) dependencies.
 * Provides access to the browser's WebRTC implementation for peer-to-peer communication.
 *
 * This abstraction allows for easier testing and mocking of WebRTC functionality.
 */
export interface WebRTC {
    /**
     * RTCPeerConnection constructor reference.
     * Used to create peer-to-peer connections for audio, video, and data communication.
     */
    PeerConnection: typeof RTCPeerConnection;

    /**
     * RTCDataChannel constructor or interface reference.
     * Used to create channels for sending arbitrary data between peers.
     */
    DataChannel: typeof RTCDataChannel;
}

/**
 * Create default WebRTC implementation based on browser globals
 */
export function getDefaultWebRTC(): WebRTC {
    return {
        PeerConnection: RTCPeerConnection,
        DataChannel: RTCDataChannel,
    };
}
