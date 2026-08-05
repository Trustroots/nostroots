const baseConfig = require("./jest.config");

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [
    "src/secureRandom.ts",
    "src/secureRandom.bootstrap.ts",
    "src/hooks/useKeyImport.ts",
    "src/nostr/keystore.nostr.ts",
  ],
  testMatch: [
    "<rootDir>/src/secureRandom.test.ts",
    "<rootDir>/src/hooks/useKeyImport.test.ts",
    "<rootDir>/src/nostr/keystore.nostr.test.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
