/**
 * Defines the allowed method names for WebRTC signaling calls.
 * These methods represent the different stages and operations in the WebRTC connection process.
 *
 * - 'update': Updates peer information in the signaling server
 * - 'dial': Initiates a connection request to a peer
 * - 'offer': Sends a WebRTC SDP offer during connection negotiation
 * - 'answer': Responds to an offer with a WebRTC SDP answer
 * - 'ice': Exchanges ICE candidates for network connectivity
 * - 'close': Terminates an existing connection
 */
export type CallMethodName = 'update' | 'dial' | 'offer' | 'answer' | 'ice' | 'close';
