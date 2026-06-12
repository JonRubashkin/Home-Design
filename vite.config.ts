/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project page is served from /Home-Design/. Use the repo base in
// production builds only; dev/test run from root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Home-Design/" : "/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
