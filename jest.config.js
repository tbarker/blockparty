module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleNameMapper: {
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': '<rootDir>/config/jest/CSSStub.js',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|ico|svg|eot|otf|webp|ttf|woff|woff2)$':
      '<rootDir>/config/jest/FileStub.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(ethers|eth-|@rainbow-me|wagmi|viem|@wagmi|@tanstack)/)/',
  ],
  // Longer timeout for integration tests
  testTimeout: 30000,
  // Collect coverage from src components
  collectCoverageFrom: ['src/components/**/*.js', 'src/util/**/*.js', '!src/**/*.test.js'],
  // Mock browser globals
  globals: {
    window: {},
  },
  // Verbose output
  verbose: true,
};
