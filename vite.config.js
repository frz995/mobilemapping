import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to './' for relative paths (simpler for GitHub Pages)
  // Or use '/<REPO_NAME>/' if you prefer absolute paths
  base: './',
  resolve: {
    alias: {
      'mapbox-gl': 'maplibre-gl'
    }
  }
})
