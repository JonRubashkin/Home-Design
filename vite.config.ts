/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project page is served from /Home-Design/. Use the repo base in
// production builds only; dev/test run from root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Home-Design/" : "/",
  plugins: [react()],
  // three.js makes the bundle inherently large; raise the warning threshold
  // rather than chase noisy chunk-size warnings on a single-page app.
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
