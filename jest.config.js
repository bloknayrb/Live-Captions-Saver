module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  collectCoverageFrom: [
    'teams-captions-saver/**/*.js',
    'Standalone-scripts/**/*.js',
    '!**/node_modules/**',
    '!**/*.config.js',
    '!**/coverage/**'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/Chrome Store Assets/',
    '/IMG/'
  ]
};