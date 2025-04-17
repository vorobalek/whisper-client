module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
    collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.d.ts', '!**/node_modules/**', '!**/dist/**'],
    coverageReporters: ['text', 'clover', 'lcov', 'html', 'json-summary'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
};
