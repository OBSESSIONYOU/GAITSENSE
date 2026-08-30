import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/GAITSENSE/' : '/',
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/_backend/health': {
        target: process.env.VITE_RADAR_API_BASE || 'http://127.0.0.1:18788',
        changeOrigin: true,
        rewrite: () => '/api/health'
      }
    }
  }
})
