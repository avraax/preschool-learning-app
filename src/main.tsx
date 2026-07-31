// Always-on diagnostics ring buffers (console/network/breadcrumbs for bug reports).
// MUST be the very first import: `import App` below transitively pulls in remoteConsole,
// which also patches console/fetch — this layer has to install underneath it.
import './services/diagnosticsBuffer'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline } from '@mui/material'
import App from './App.tsx'
import { AppThemeProvider } from './theme/ThemeProvider'
import AppErrorBoundary from './components/common/AppErrorBoundary'
// The hard auth gate (accounts PRD D5/W4). NOT lazy: a blocking gate must not wait on a chunk.
import AuthGate from './components/auth/AuthGate'
// Self-hosted kid-friendly font (bundled, identical on every OS/device)
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import './index.css'

// Initialize remote console for error logging
import './utils/remoteConsole'

// Network-only app: unregister any leftover service worker from an earlier build era (PRD-08 §P3).
import { sweepLegacyServiceWorkers } from './utils/swCleanup'
sweepLegacyServiceWorkers()

// DEV screenshot harness: seed Math.random when ?seed=<n> is present (deterministic questions).
import { installDevSeed, installDevRewards } from './utils/devHarness'
installDevSeed()
// DEV ?rewards=<n>: seed the Reward Book so its surfaces are capturable at any point on the path.
// Fire-and-forget (dynamic imports) — the store commits synchronously and notifies subscribers, so a
// render that already happened just re-renders.
void installDevRewards()

// Initialize viewport height before React renders
const setInitialViewportHeight = () => {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
  document.documentElement.style.setProperty('--full-vh', `${window.innerHeight}px`)
}
setInitialViewportHeight()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppThemeProvider>
        <CssBaseline />
        <AppErrorBoundary>
          {/* Between the boundary and App: a gate crash must still be caught, and while the gate
              blocks, <App /> (and therefore the audio-permission modal) never mounts — so only one
              blocking overlay is ever on screen. */}
          <AuthGate>
            <App />
          </AuthGate>
        </AppErrorBoundary>
      </AppThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)