import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev and preview share one port so a single redirect URL
// (http://localhost:5173/callback) works for both.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
