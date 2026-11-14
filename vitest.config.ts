import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const resolve = {
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
};
export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "backend",
          environment: "node",
          include: [
            "src/contracts/**/*.test.ts",
            "src/modules/**/*.test.ts",
            "tests/backend/**/*.test.ts",
          ],
          restoreMocks: true,
          testTimeout: 15000,
        },
      },
      {
        plugins: [react()],
        resolve,
        test: {
          name: "frontend",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "src/app/**/*.test.{ts,tsx}",
            "src/screens/**/*.test.{ts,tsx}",
            "src/ui/**/*.test.{ts,tsx}",
            "src/mocks/**/*.test.ts",
            "src/workspaces/**/*.test.{ts,tsx}",
          ],
          restoreMocks: true,
        },
      },
    ],
  },
});
