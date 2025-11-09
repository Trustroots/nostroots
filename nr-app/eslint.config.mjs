// @ts-check

import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".expo/",
      "node_modules/",
      "package.json",
      "pnpm-lock.yaml",
      "expo-env.d.ts",
      "babel.config.js",
      "metro.config.js",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts", "**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        __DEV__: "readonly",
        React: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "import/first": "error",
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn", // Set to warn instead of off to avoid leaving unused variables
    },
  },
  prettier,
];
