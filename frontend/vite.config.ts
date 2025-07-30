import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages deployment configuration
export default defineConfig({
  plugins: [react()],
  base: '/bjjNeuralCursor/',
  build: {
    outDir: 'dist',
  },
})
