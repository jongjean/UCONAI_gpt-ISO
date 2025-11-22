import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 프론트에서 /api 로 시작하는 요청은
      // 백엔드 http://localhost:4400 으로 전달
      '/api': 'http://localhost:4400',
    },
  },
});
