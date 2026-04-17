import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/api/mbagweather': {
        target: 'https://mbagweather.ca',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/mbagweather/, ''),
      },
    },
  },
})
