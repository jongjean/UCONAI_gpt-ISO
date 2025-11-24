import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: "/iso/",   // ★ 중요: 하위 경로에 맞춰줌
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4400",
        changeOrigin: true
      }
    }
  }
});
