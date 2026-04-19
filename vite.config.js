import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/rinri-nanbu/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
