import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const backendProxy = {
  // Local backend (server/goodreads-server.mjs): /api = Goodreads + local
  // catalog + EPUB covers, /files = local book files streamed from disk.
  // /books + /data are served statically from public/ (copied into dist).
  '/api': 'http://localhost:8765',
  '/files': 'http://localhost:8765',
  // /models = GLB book meshes, streamed from the sibling cards/ project.
  '/models': 'http://localhost:8765',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5199, proxy: backendProxy },
  preview: { port: 5199, proxy: backendProxy },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
