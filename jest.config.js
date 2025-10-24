export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  moduleNameMapper: {
    '^node-fetch$': '<rootDir>/src/__mocks__/node-fetch.ts',
    '^playwright$': '<rootDir>/src/__mocks__/playwright.ts',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
