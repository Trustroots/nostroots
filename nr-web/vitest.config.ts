import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // Use jsdom as the test environment
    environment: "jsdom",

    // Global test setup file
    setupFiles: ["./src/test/setup.ts"],

    // Enable globals like describe, it, expect without importing
    globals: true,

    // Include patterns for test files
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**/*",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },

    // Reporter configuration
    reporters: ["default"],

    // Type checking
    typecheck: {
      enabled: false,
    },
  },
});
