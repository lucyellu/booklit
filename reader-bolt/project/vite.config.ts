import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Served from Booklit's public/reader/ when embedded as an iframe.
  base: '/reader/',
  plugins: [react()],
  server: {
    port: 5188,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
