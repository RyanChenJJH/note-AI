// Vite 配置：React + Tailwind v4 插件、@→src 别名、/api 代理到本地后端。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 开发期同源代理：前端 /api/* → 阶段 2 的本地 API（默认 8787）。无需 CORS。
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
