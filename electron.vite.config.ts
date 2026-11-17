import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
          worker: resolve("src/compression/worker.ts"),
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
