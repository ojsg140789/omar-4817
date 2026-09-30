import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo mantiene /api relativo y evita configurar CORS para el servidor de Vite.
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
