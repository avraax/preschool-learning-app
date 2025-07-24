import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the existing manifest.json file
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.svg', 'apple-touch-icon-*.svg', 'icon-*.svg'],
      workbox: {
        // Network-only strategy - no caching
        runtimeCaching: [
          {
            urlPattern: ({ request }) => true, // Match all requests
            handler: 'NetworkOnly' // Always go to network, no caching
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        // Don't cache anything
        globPatterns: []
      }
    })
  ],
  server: {
    // Note: API functions are Vercel serverless functions
    // For local development with API testing, use: vercel dev
    // Or visit production URL for full functionality
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    // Ensure unique filenames for cache busting
    rollupOptions: {
      output: {
        // Use content hash in filenames
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Generate source maps for better debugging
    sourcemap: true,
    // Clear the output directory before building
    emptyOutDir: true
  }
})