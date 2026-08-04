import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // Inside Docker: VITE_PROXY_TARGET=http://server:5000
        // Locally: defaults to http://localhost:5000
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
