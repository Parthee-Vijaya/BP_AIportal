import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Bag AI-portalens Traefik serveres appen under /barnepige-app/ — sættes
  // som build-arg i Dockerfilen. Lokalt (npm run dev) er base "/".
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
