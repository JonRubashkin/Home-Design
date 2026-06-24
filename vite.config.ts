/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel (the primary deploy) serves from the root, so the production build
// defaults to base "/". The legacy GitHub Pages project page is served from
// /Home-Design/; that build runs `vite build --mode pages` to restore the repo
// base. Dev/test always run from root.
export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/Home-Design/" : "/",
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
