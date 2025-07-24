import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script',
      // Use our custom manifest.json from public folder
      manifest: {
        name: "Børnelæring - Alfabetet og Tal",
        short_name: "Børnelæring",
        description: "Lær alfabetet og tal på dansk for børn 3-7 år. Interaktive spil med dansk lyd og animationer.",
        start_url: "/",
        display: "standalone",
        background_color: "#8B5CF6",
        theme_color: "#8B5CF6",
        orientation: "portrait-primary",
        categories: ["education", "kids", "games"],
        lang: "da",
        scope: "/",
        icons: [
          {
            src: "icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "apple-touch-icon-180x180.svg",
            sizes: "180x180",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icon-192x192-maskable.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "maskable"
          },
          {
            src: "icon-512x512-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ],
        prefer_related_applications: false,
        dir: "ltr",
        display_override: ["standalone", "minimal-ui"]
      },
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
        // Don't cache anything - ensures latest code
        globPatterns: [],
        // Force immediate update check
        cleanupOutdatedCaches: true,
        // Enhanced update detection
        maximumFileSizeToCacheInBytes: 0 // Disable file caching completely
      },
      // Enhanced development and update detection
      devOptions: {
        enabled: true,
        type: 'module'
      },
      // Immediate service worker activation
      selfDestroying: false
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