import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api/mbagweather': {
        target: 'https://mbagweather.ca',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/mbagweather/, ''),
      },
    },
  },
})
