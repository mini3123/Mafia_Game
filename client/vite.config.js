import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 개발 중에는 소켓만 서버(3000)로 넘긴다.
  server: { proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.js',
    include: ['test/**/*.test.{js,jsx}'],
  },
});
