import { CallData } from '../models/infrasctructure/call-data';
import { CallRequest } from '../models/infrasctructure/call-request';
import { CallResponse } from '../models/infrasctructure/call-response';
import { Logger } from './logger';

/**
 * Interface for making API calls to the server.
 * Provides method for sending requests and receiving responses using HTTP.
 */
export interface ApiClient {
    /**
     * Sends a call request to the server and returns the response.
     * Uses HTTP POST to transmit the request and handles the JSON response.
     *
     * @param serverUrl - URL of the server to send the request to
     * @param request - Call request containing the method and data
     * @returns Promise resolving to the typed response from the server
     */
    call<TypeData extends CallData, TypeResponse extends CallResponse>(
        serverUrl: string,
        request: CallRequest<TypeData>,
    ): Promise<TypeResponse>;
}

/**
 * Factory function that creates and returns an implementation of the ApiClient interface.
 * Handles HTTP communication details including error handling and response parsing.
 *
 * @param logger - Logger instance for error and debugging information
 * @returns An implementation of the ApiClient interface
 */
export function getApiClient(logger: Logger): ApiClient {
    return {
        call<TypeData extends CallData, TypeResponse extends CallResponse>(
            serverUrl: string,
            request: CallRequest<TypeData>,
        ): Promise<TypeResponse> {
            return new Promise<TypeResponse>((resolve, reject) => {
                const method = request.a;
                fetch(`${serverUrl}/api/v1/call`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(request),
                })
                    .then((response) => {
                        if (response.ok) {
                            response.json().then((result) => {
                                const typedResponse = result as TypeResponse;
                                if (!typedResponse) {
                                    const error = `[api-client] Unexpected answer on call ${method} from ${serverUrl}.`;
                                    logger.error(error);
                                    reject(error);
                                    return;
                                }
                                if (!typedResponse.ok) {
                                    const error = `[api-client] Request was not successful on call '${method}'. Reason: ${typedResponse.reason}; Response: ${JSON.stringify(typedResponse)}.`;
                                    logger.error(error, typedResponse);
                                    reject(error);
                                    return;
                                }
                                logger.debug(
                                    `[api-client] Call '${method}' successfully sent. Response: ${JSON.stringify(typedResponse)}`,
                                    request,
                                );
                                resolve(result);
                            });
                        } else {
                            response.text().then((body) => {
                                const error = `[api-client] Error while sending call '${method}'. Status: ${response.status}; Body: ${JSON.stringify(body)}.`;
                                logger.error(error);
                                reject(error);
                            });
                        }
                    })
                    .catch((err) => {
                        logger.error(`[api-client] Error while sending request.`, err, request);
                        reject(err);
                    });
            });
        },
    };
}
