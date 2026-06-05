const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...expoPreset,
  setupFiles: ["./jest.rn-setup.cjs"],
  setupFilesAfterEnv: ["./jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/ios/", "/android/"],
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(react-native|@react-native\\+[^@]+|@testing-library\\+react-native|react-native-webview|lucide-react-native|expo|@expo\\+[^@]+|nostr-tools|@noble\\+[^@]+|@scure\\+[^@]+|nip06|zod)@)",
    "node_modules/(?!(.pnpm|((jest-)?react-native|@react-native(-community)?|@testing-library/react-native)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-webview|lucide-react-native|@noble|@scure|nostr-tools|nip06|zod))",
  ],
};
