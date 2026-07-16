module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    '^otplib$': '<rootDir>/src/__mocks__/otplib.js',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js'
  }
};
