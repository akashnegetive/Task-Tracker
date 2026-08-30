import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev we proxy /api to the backend so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
