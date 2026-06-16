import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { buildTheme } from './buildTheme'
import { defaultThemeId, getThemeTokens, themeOptions, type ThemeOption } from './themes'
import { loadTitleFont } from './titleFonts'

// Runtime theme switching. Holds the selected theme id (persisted to localStorage),
// rebuilds the MUI theme on change, and exposes the selection via `useThemeSwitch()`.
//
// `buildTheme()` also calls `setActiveTokens()`, so non-React helpers (getCategoryTheme)
// reflect the active skin. The selector lives on the home page (which consumes the theme),
// so it re-renders on switch; other screens re-mount with the new skin on next navigation.

const STORAGE_KEY = 'bornelaering-theme'

interface ThemeSwitchContextValue {
  themeId: string
  setThemeId: (id: string) => void
  availableThemes: ThemeOption[]
}

const ThemeSwitchContext = createContext<ThemeSwitchContextValue | null>(null)

export const useThemeSwitch = (): ThemeSwitchContextValue => {
  const ctx = useContext(ThemeSwitchContext)
  if (!ctx) throw new Error('useThemeSwitch must be used within <AppThemeProvider>')
  return ctx
}

const readStoredThemeId = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || defaultThemeId
  } catch {
    return defaultThemeId
  }
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<string>(readStoredThemeId)

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Ignore storage failures (private mode etc.) — selection still applies for the session.
    }
  }, [])

  const theme = useMemo(() => buildTheme(getThemeTokens(themeId)), [themeId])

  // Load only the active theme's bundled title font (latin subset). No-op for Comic-Neue themes.
  useEffect(() => {
    loadTitleFont(themeId)
  }, [themeId])

  // Paint the document canvas (html/body) with the active scene's base colour. The whole app is
  // sized to `calc(var(--vh) * 100)` (= window.innerHeight); on an iOS home-screen PWA innerHeight
  // can come back a hair short of the real screen and isn't corrected, so a thin strip below the
  // app would otherwise show the browser's default (light) canvas as a white gap at the bottom.
  // Matching the canvas to the scene base (#070B1A for the dark immersive worlds) makes any such
  // gap invisible. Flat/light skins keep their normal background.default.
  useEffect(() => {
    const base = theme.scene.dark ? '#070B1A' : theme.palette.background.default
    document.documentElement.style.backgroundColor = base
    document.body.style.backgroundColor = base
  }, [theme])

  const value = useMemo<ThemeSwitchContextValue>(
    () => ({ themeId, setThemeId, availableThemes: themeOptions }),
    [themeId, setThemeId]
  )

  return (
    <ThemeSwitchContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeSwitchContext.Provider>
  )
}

export default AppThemeProvider
