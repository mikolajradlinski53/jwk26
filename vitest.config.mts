import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", quiet: true });

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Testy dzielą jedną zdalną bazę — równoległość powodowałaby wyścigi.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
