import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        "**/release/**",
        "**/.tools/**",
        "**/original-mvp/**",
        "**/test-results/**",
      ],
    },
  },
});
