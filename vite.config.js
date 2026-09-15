import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(({ command }) => ({
  logLevel: 'info',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  esbuild: {
    // Drop console/debugger only in production builds
    ...(command === 'build' ? { drop: ['console', 'debugger'] } : {}),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework chunk
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation library — only used on some pages
          'vendor-framer': ['framer-motion'],
          // UI icons — used across many pages
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // The largest chunk is the lazily-loaded opportunity editor, so the limit is
    // raised rather than splitting it further.
    chunkSizeWarningLimit: 600,
  },
}))
