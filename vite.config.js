import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/DAIEF-frontend-demo/' : '/',
  css: {
    lightningcss: {
      errorRecovery: true,
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
