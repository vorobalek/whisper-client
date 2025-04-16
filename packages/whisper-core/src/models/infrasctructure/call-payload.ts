import { CallMethodName } from './call-method-name';

/**
 * Represents the standardized payload structure for WebRTC signaling messages.
 * This structure is used for all communication with the signaling server
 * to establish and manage peer-to-peer connections.
 */
export type CallPayload = {
    /**
     * The method name identifying the type of signaling action.
     * Determines how the rest of the payload will be interpreted.
     */
    a: CallMethodName;

    /**
     * The sender's public key, used for peer identification and message validation.
     */
    b: string;

    /**
     * The recipient's public key, indicating which peer should receive this message.
     */
    c: string;
};
