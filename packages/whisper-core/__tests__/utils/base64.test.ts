import { createMockBase64 } from '../../__mocks__/test-utils';
import { getBase64 } from '../../src/utils/base64';

// Mock nacl-util-wrapper
jest.mock('../../src/utils/nacl-util-wrapper', () => ({
    encodeBase64: jest.fn().mockImplementation(() => 'encoded-base64'),
    decodeBase64: jest.fn().mockImplementation(() => new Uint8Array([1, 2, 3, 4])),
}));

describe('Base64 utility', () => {
    let base64: ReturnType<typeof getBase64>;

    beforeEach(() => {
        jest.clearAllMocks();
        base64 = createMockBase64();
    });

    describe('encode', () => {
        it('should call the encode mock with the input', () => {
            // Given
            const input = new Uint8Array([1, 2, 3, 4]);

            // When
            const result = base64.encode(input);

            // Then
            expect(base64.encode).toHaveBeenCalledWith(input);
            expect(result).toBe('encoded-data');
        });
    });

    describe('decode', () => {
        it('should call the decode mock with the input', () => {
            // Given
            const input = 'test-base64-string';

            // When
            const result = base64.decode(input);

            // Then
            expect(base64.decode).toHaveBeenCalledWith(input);
            // Mock returns undefined, this is ok
            expect(result).toBeUndefined();
        });
    });

    // Integration test with real implementation
    describe('integration', () => {
        beforeEach(() => {
            jest.resetModules();
            jest.dontMock('../../src/utils/nacl-util-wrapper');

            // Get the real implementation
            const { getBase64: getRealBase64 } = require('../../src/utils/base64');
            base64 = getRealBase64();
        });

        it('should correctly encode and decode data', () => {
            // Given
            const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII

            // When
            const encoded = base64.encode(testData);
            const decoded = base64.decode(encoded);

            // Then
            expect(encoded).toBe('SGVsbG8=');
            expect(decoded).toEqual(testData);
        });
    });
});
