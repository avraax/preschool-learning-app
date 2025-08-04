import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// Version generation plugin
function generateVersionPlugin() {
  let versionInfo: any
  
  return {
    name: 'generate-version',
    buildStart() {
      const buildTime = Date.now()
      const versionPath = path.resolve(__dirname, 'src/config/version.ts')
      
      // Read version from package.json
      let packageVersion = '1.0.0'
      try {
        const packageJsonPath = path.resolve(__dirname, 'package.json')
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        packageVersion = packageJson.version
      } catch (error) {
        console.log('Could not read version from package.json, using default "1.0.0"')
      }
      
      // Try to get git commit hash
      let commitHash = 'dev'
      try {
        const { execSync } = require('child_process')
        commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
      } catch (error) {
        console.log('Could not get git commit hash, using "dev"')
      }
      
      versionInfo = {
        buildTime,
        version: packageVersion,
        commitHash
      }
      
      const versionContent = `// Auto-generated build information
// This file is updated automatically during the build process

export const BUILD_INFO = {
  buildTime: ${buildTime},
  version: '${packageVersion}',
  commitHash: '${commitHash}'
}

export default BUILD_INFO`
      
      fs.writeFileSync(versionPath, versionContent)
      console.log(`📦 Generated version info: v${packageVersion}, ${new Date(buildTime).toISOString()}, commit: ${commitHash}`)
    },
    generateBundle() {
      // Also generate version.json for the API endpoint
      if (versionInfo) {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(versionInfo, null, 2)
        })
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    generateVersionPlugin(),
    react(),
    VitePWA({
      // Generate manifest only, disable service worker completely
      disable: false,
      injectRegister: null,
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
            src: "icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512x512.png",
            sizes: "512x512", 
            type: "image/png",
            purpose: "any"
          },
          {
            src: "apple-touch-icon-180x180.png",
            sizes: "180x180",
            type: "image/png", 
            purpose: "any"
          },
          {
            src: "icon-192x192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icon-512x512-maskable.png", 
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        prefer_related_applications: false,
        dir: "ltr",
        display_override: ["standalone", "minimal-ui"]
      },
      workbox: {
        // Disable service worker generation completely
        mode: 'development',
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
        // Better error handling for proxy
        onError: (err, req, res) => {
          console.log('🔴 Proxy error:', err.message)
          console.log('💡 Make sure the TTS server is running on port 3001')
        },
        // Add timeout and retry logic
        timeout: 10000,
        // Log successful proxy requests
        onProxyReq: (proxyReq, req, res) => {
          console.log('🔄 Proxying:', req.method, req.url, '→', proxyReq.getHeader('host') + proxyReq.path)
        }
      }
    }
  },
  build: {
    // TEMPORARY: Disable minification for production debugging
    // This makes error line numbers match exactly with local development
    // TODO: Re-enable minification once debugging phase is complete
    minify: false,
    
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