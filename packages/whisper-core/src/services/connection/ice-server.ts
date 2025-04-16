/**
 * Interface representing an ICE (Interactive Connectivity Establishment) server configuration.
 * ICE servers facilitate establishing peer-to-peer connections by providing mechanisms
 * to overcome NAT traversal and firewall restrictions.
 */
export interface IceServer {
    /**
     * URL or array of URLs for the ICE server (STUN or TURN).
     */
    urls: string;

    /**
     * Optional username for authentication with the ICE server.
     */
    username?: string;

    /**
     * Optional credential for authentication with the ICE server.
     */
    credential?: string;
}
