import { createMockUtf8 } from '../../__mocks__/test-utils';
import { getUtf8 } from '../../src/utils/utf8';

// Mock nacl-util-wrapper
jest.mock('../../src/utils/nacl-util-wrapper', () => ({
    encodeUTF8: jest.fn().mockImplementation(() => 'encoded-utf8'),
    decodeUTF8: jest.fn().mockImplementation(() => new Uint8Array([1, 2, 3, 4])),
}));

describe('UTF8 utility', () => {
    let utf8: ReturnType<typeof getUtf8>;

    beforeEach(() => {
        jest.clearAllMocks();
        utf8 = createMockUtf8();
    });

    describe('encode', () => {
        it('should call the encode mock with the input', () => {
            // Given
            const input = new Uint8Array([1, 2, 3, 4]);

            // When
            const result = utf8.encode(input);

            // Then
            expect(utf8.encode).toHaveBeenCalledWith(input);
            expect(result).toBeUndefined();
        });
    });

    describe('decode', () => {
        it('should call the decode mock with the input', () => {
            // Given
            const input = 'test-utf8-string';

            // When
            const result = utf8.decode(input);

            // Then
            expect(utf8.decode).toHaveBeenCalledWith(input);
            expect(result).toEqual(new Uint8Array([7, 8, 9]));
        });
    });

    // Integration test with real implementation
    describe('integration', () => {
        beforeEach(() => {
            jest.resetModules();
            jest.dontMock('../../src/utils/nacl-util-wrapper');

            // Get the real implementation
            const { getUtf8: getRealUtf8 } = require('../../src/utils/utf8');
            utf8 = getRealUtf8();
        });

        it('should correctly encode and decode data', () => {
            // Given
            const TextEncoder = require('util').TextEncoder;
            const testString = 'Hello, world!';
            const testData = new TextEncoder().encode(testString);

            // When
            const encoded = utf8.encode(testData);
            const decoded = utf8.decode(testString);

            // Then
            expect(encoded).toBe(testString);

            // Compare arrays
            const decodedArray = Array.from(decoded);
            const testDataArray = Array.from(testData);
            expect(decodedArray).toEqual(testDataArray);
        });
    });
});
