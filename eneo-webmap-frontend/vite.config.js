/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── Configuration Vitest ─────────────────────────────────────
  test: {
    globals: true,           // vi, describe, it, expect disponibles sans import
    environment: 'jsdom',    // simule le DOM navigateur
    setupFiles: './src/__tests__/setup.js',
    css: false,              // ignore les imports CSS pour la vitesse
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/__tests__/**'],
    },
  },

  server: {
    port: 3000,
    proxy: {
      // Proxy vers GeoDjango backend (nom de service Docker)
      '/api': {
        target: 'http://backend:8001',
        changeOrigin: true,
        secure: false,
      },
      // Proxy vers GeoServer (nom de service Docker, port interne 8080)
      '/geoserver': {
        target: 'http://geoserver:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
