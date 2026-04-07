import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/mbagweather': {
        target: 'https://mbagweather.ca',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/mbagweather/, ''),
      },
    },
  },
})
