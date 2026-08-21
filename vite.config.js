import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      'mapbox-gl': 'maplibre-gl'
    }
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'] // Prevents Vite from creating corrupted .mjs worker files
  }
})