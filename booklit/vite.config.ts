import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    proxy: {
      // Local backend (server/goodreads-server.mjs): /api = Goodreads + local
      // catalog, /files = local book files streamed from L:\Media\Text\Books.
      // /books + /data are served statically from public/.
      '/api': 'http://localhost:8765',
      '/files': 'http://localhost:8765',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
