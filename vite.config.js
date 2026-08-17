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
          // Data & state management
          'vendor-query': ['@tanstack/react-query'],
          // UI icons — used across many pages
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // Raise warning limit for PDF vendor chunk (loaded only on CV page)
    chunkSizeWarningLimit: 600,
  },
}))
