import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

function generateVersionPlugin(): Plugin {
  let versionInfo: any

  return {
    name: 'generate-version',
    buildStart() {
      const buildTime = Date.now()
      const versionPath = path.resolve(__dirname, 'src/config/version.ts')

      let packageVersion = '1.0.0'
      try {
        const packageJsonPath = path.resolve(__dirname, 'package.json')
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        packageVersion = packageJson.version
      } catch {
        console.log('Could not read version from package.json, using default "1.0.0"')
      }

      let commitHash = 'dev'
      try {
        commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
      } catch {
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
      console.log(`Generated version info: v${packageVersion}, ${new Date(buildTime).toISOString()}, commit: ${commitHash}`)
    },
    generateBundle() {
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
// `--mode harness` builds a PRODUCTION-shaped bundle that still answers the dev query params, so the
// real bundle can be perf-measured and route-swept (see src/utils/devHarness.ts for why nothing else
// can). NODE_ENV is forced to production so React/minification match a real deploy — the mode name
// alone would otherwise make Vite treat this as a development build and the numbers would be useless.
// Any other mode statically defines __HARNESS__ = false, so the bypass is absent from deploy output.
export default defineConfig(({ mode }) => {
  const harness = mode === 'harness'
  return {
  define: {
    __HARNESS__: JSON.stringify(harness),
    ...(harness ? { 'process.env.NODE_ENV': '"production"' } : {}),
  },
  // NOTE (PRD-08 §P3): no vite-plugin-pwa. The app is deliberately network-only — there is no
  // service worker. The single PWA manifest is the hand-authored public/manifest.json (linked from
  // index.html); the plugin used to inject a SECOND manifest (/manifest.webmanifest) and emit a
  // dead, unregistered sw.js. main.tsx runs a one-time legacy-SW unregister sweep for clients that
  // still have a SW from an earlier build era.
  plugins: [
    generateVersionPlugin(),
    react()
  ],
  server: {
    // Bind explicitly. Without these, Vite 8 on Windows can print "ready" while
    // failing to actually open the listening socket (browser gets
    // ERR_CONNECTION_REFUSED). host:true binds all interfaces so both
    // localhost and 127.0.0.1 reach it; strictPort makes a bind failure loud
    // instead of silent.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // Use a literal IPv4 address, NOT "localhost". On Windows, Node resolves
        // "localhost" to ::1 (IPv6) first and the proxy agent's dual-stack
        // connection can be refused even though the API server is up — which
        // surfaces as ECONNREFUSED / 502 on every /api/* call. Pinning to
        // 127.0.0.1 removes the DNS/family ambiguity.
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // PIN THE SYNTAX FLOOR TO THE TARGET DEVICE. The child plays on an iPad Pro 12.9" 2nd gen on
    // iPadOS 17.7.11 — its terminal OS (CLAUDE.md's compatibility floor). Nothing used to pin this:
    // Vite 8's default `baseline-widely-available` happens to resolve to safari16.4/ios16.4, which is
    // safely below the floor, but it is a DEFAULT — a Vite upgrade could raise it past 17.7, and the
    // only symptom would be a blank screen on that one device while every newer iPad in the house
    // renders fine. That is the same shape as the Ogg-audio incident. Explicit beats lucky.
    target: ['safari17', 'ios17'],
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Split heavy vendor libraries out of the main chunk so the home screen
        // pulls only what it needs and per-route code loads on demand.
        // Rolldown (Vite 8) requires manualChunks to be a function.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('@mui')) return 'mui-vendor'
          if (id.includes('framer-motion')) return 'motion-vendor'
          if (id.includes('howler')) return 'media-vendor'
          // Auth (accounts PRD §4.1). Deliberately NOT co-bundled with `media-vendor`, which is
          // howler-only because sfxClient loads it EAGERLY — anything sharing that chunk would be
          // pulled into first paint.
          if (id.includes('@simplewebauthn')) return 'auth-vendor'
          if (id.includes('@dnd-kit')) return 'dnd-vendor'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('scheduler') || /node_modules[\\/]react[\\/]/.test(id)) return 'react-vendor'
        }
      }
    },
    sourcemap: false,
    emptyOutDir: true
  }
  }
})
