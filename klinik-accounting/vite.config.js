import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          // Charts
          'vendor-charts':   ['recharts'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Export libs (large — split together)
          'vendor-export':   ['jspdf', 'jspdf-autotable', 'xlsx'],
          // UI utils
          'vendor-ui':       ['lucide-react', 'react-hot-toast', 'clsx'],
          // Utilities
          'vendor-utils':    ['date-fns', 'uuid'],
        },
      },
    },
  },
})
