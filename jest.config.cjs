module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.js', '**/__tests__/**/*.cjs', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: ['static/js/**/*.js', '!static/js/__tests__/**'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageProvider: 'v8',
    verbose: true,
};
