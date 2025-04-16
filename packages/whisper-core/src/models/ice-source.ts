/**
 * Enumeration representing the source of ICE candidates in WebRTC connections.
 * Used to identify whether an ICE candidate came from an incoming or outgoing connection.
 */
export enum IceSource {
    /** Default unknown state */
    Unknown = 0,
    /** ICE candidate from an incoming connection */
    Incoming,
    /** ICE candidate from an outgoing connection */
    Outgoing,
}
