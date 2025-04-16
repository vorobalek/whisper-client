import { createMockLogger } from '../../__mocks__/test-utils';
import { CallData } from '../../src/models/infrasctructure/call-data';
import { CallMethodName } from '../../src/models/infrasctructure/call-method-name';
import { CallRequest } from '../../src/models/infrasctructure/call-request';
import { CallResponse } from '../../src/models/infrasctructure/call-response';
import { getApiClient } from '../../src/utils/api-client';
import { Logger } from '../../src/utils/logger';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Interface for test data
interface TestCallData extends CallData {
    b: string;
}

interface TestCallResponse extends CallResponse {
    data: string;
}

describe('ApiClient', () => {
    let apiClient: ReturnType<typeof getApiClient>;
    let mockLogger: Logger;

    beforeEach(() => {
        // Reset the fetch mock
        mockFetch.mockReset();

        // Create mock logger using centralized factory
        mockLogger = createMockLogger();

        // Create API client
        apiClient = getApiClient(mockLogger);
    });

    describe('call', () => {
        it('should make a POST request to the server with correct parameters', async () => {
            // Given
            const serverUrl = 'https://api.example.com';
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'publicKey123',
                    b: 'test data',
                },
                c: 'signature123',
            };

            const mockResponse: TestCallResponse = {
                ok: true,
                timestamp: Date.now(),
                data: 'response data',
            };

            // Mock successful response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockResponse),
            });

            // When
            const result = await apiClient.call<TestCallData, TestCallResponse>(serverUrl, request);

            // Then
            expect(mockFetch).toHaveBeenCalledWith(`${serverUrl}/api/v1/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            expect(result).toEqual(mockResponse);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Call 'testMethod' successfully sent"),
                request,
            );
        });

        it('should reject when response is not OK with proper error message', async () => {
            // Given
            const serverUrl = 'https://api.example.com';
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'publicKey123',
                    b: 'test data',
                },
                c: 'signature123',
            };

            // Mock error response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: jest.fn().mockResolvedValueOnce('Bad Request'),
            });

            // When/Then
            await expect(apiClient.call<TestCallData, TestCallResponse>(serverUrl, request)).rejects.toMatch(
                /Error while sending call 'testMethod'/,
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                '[api-client] Error while sending call \'testMethod\'. Status: 400; Body: "Bad Request".',
            );
        });

        it('should reject when response has ok: false', async () => {
            // Given
            const serverUrl = 'https://api.example.com';
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'publicKey123',
                    b: 'test data',
                },
                c: 'signature123',
            };

            const mockResponse: TestCallResponse = {
                ok: false,
                timestamp: Date.now(),
                reason: 'Validation failed',
                data: 'error data',
            };

            // Mock successful HTTP response but business failure
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockResponse),
            });

            // When/Then
            await expect(apiClient.call<TestCallData, TestCallResponse>(serverUrl, request)).rejects.toMatch(
                /Request was not successful/,
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Request was not successful on call 'testMethod'"),
                mockResponse,
            );
        });

        it('should reject when response is null or undefined', async () => {
            // Given
            const serverUrl = 'https://api.example.com';
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'publicKey123',
                    b: 'test data',
                },
                c: 'signature123',
            };

            // Mock successful HTTP response but null response body
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(null),
            });

            // When/Then
            await expect(apiClient.call<TestCallData, TestCallResponse>(serverUrl, request)).rejects.toMatch(
                /Unexpected answer on call/,
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Unexpected answer on call testMethod'),
            );
        });

        it('should reject when fetch throws an error', async () => {
            // Given
            const serverUrl = 'https://api.example.com';
            const request: CallRequest<TestCallData> = {
                a: 'testMethod' as CallMethodName,
                b: {
                    a: 'publicKey123',
                    b: 'test data',
                },
                c: 'signature123',
            };

            const networkError = new Error('Network error');

            // Mock fetch error
            mockFetch.mockRejectedValueOnce(networkError);

            // When/Then
            await expect(apiClient.call<TestCallData, TestCallResponse>(serverUrl, request)).rejects.toBe(networkError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error while sending request'),
                networkError,
                request,
            );
        });
    });
});
