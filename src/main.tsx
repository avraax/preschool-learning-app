import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import App from './App.tsx'
import { buildTheme } from './theme/buildTheme'
import { kidThemeTokens } from './theme/tokens/kidTheme.tokens'

// The active skin. Swap the tokens object here (or wire a switcher) to reskin the app.
const theme = buildTheme(kidThemeTokens)
// Self-hosted kid-friendly font (bundled, identical on every OS/device)
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import './index.css'

// Initialize remote console for error logging
import './utils/remoteConsole'

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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)