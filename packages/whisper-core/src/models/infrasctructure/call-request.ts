import { CallData } from './call-data';
import { CallMethodName } from './call-method-name';

/**
 * Base interface for all call requests sent to the signaling server.
 * Defines the core structure common to all WebRTC signaling requests.
 */
export interface CallRequestBase {
    /**
     * The method name that identifies the type of signaling action being requested.
     * Determines how the request will be routed and processed by the server.
     */
    a: CallMethodName;

    /**
     * Cryptographic signature of the request payload.
     * Used to verify the authenticity and integrity of the request.
     */
    c: string;
}

/**
 * Generic interface for a complete call request with typed data payload.
 * Extends the base request with a method-specific data structure.
 *
 * @typeParam TypeData - The specific data type for this request method
 */
export interface CallRequest<TypeData extends CallData> extends CallRequestBase {
    /**
     * Request payload containing method-specific data.
     * Structure varies based on the method name in property 'a'.
     */
    b: TypeData;
}
