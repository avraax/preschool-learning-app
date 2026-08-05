import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { buildTheme } from './buildTheme'
import { defaultThemeId, getThemeTokens, themeOptions, type ThemeOption } from './themes'
import { loadTitleFont } from './titleFonts'
import { devThemeId } from '../utils/devHarness'
import { musicClient } from '../services/musicClient'
import { progressStore } from '../services/progressStore'
import { setPerfProfileFromSetting } from '../config/perfProfile'

// Runtime theme switching. Holds the selected theme id (persisted to localStorage),
// rebuilds the MUI theme on change, and exposes the selection via `useThemeSwitch()`.
//
// `buildTheme()` also calls `setActiveTokens()`, so non-React helpers (getCategoryTheme)
// reflect the active skin. The selector lives on the home page (which consumes the theme),
// so it re-renders on switch; other screens re-mount with the new skin on next navigation.

// The DEVICE-level FIRST-PAINT HINT. The TRUTH moved to the profile's `settings.themeId`, which syncs
// across devices for free (accounts PRD §5.8) — but this key stays, and stays read SYNCHRONOUSLY in a
// useState initialiser, because replacing it with an async read flashes white on the dark immersive
// skins (§10.3). It is rewritten on every theme change, so it is always the last-used skin.
// bugReporter also reads it.
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
  // DEV screenshot harness: ?theme=<id> forces the skin without click-chaining the selector.
  const forced = devThemeId()
  if (forced) return forced
  try {
    return localStorage.getItem(STORAGE_KEY) || defaultThemeId
  } catch {
    return defaultThemeId
  }
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<string>(readStoredThemeId)
  // A ref, not the state value: the store subscription is registered once and must compare against the
  // CURRENT id without re-subscribing on every theme change.
  const themeIdRef = useRef(themeId)
  themeIdRef.current = themeId

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Ignore storage failures (private mode etc.) — selection still applies for the session.
    }
    // Truth: the skin belongs to the CHILD and follows them to another device. A no-op while the store
    // is detached, which is correct — nobody's preference to record yet.
    progressStore.setSetting('themeId', id)
  }, [])

  // "Flydende grafik" (Performance PRD-01 W6) lives in the same subscription as the skin, for the same
  // reason: both are per-child settings that can arrive on attach, on a profile switch, or on a sync
  // pull. `perfProfile` is a module value rather than a context because `idleMotion`'s helpers are plain
  // functions called from render bodies across the tree — threading a context to 20 call sites is the
  // "second branch point" that module exists to prevent. So this state bump exists ONLY to force a
  // re-render when the profile actually changes; nothing reads it.
  //
  // It matters that the flip is immediate: the adult menu is an overlay, so closing it does not remount
  // the page underneath, and the owner's whole reason for wanting this switch is to stand on the iPad
  // and compare the two paths back to back.
  const [, bumpPerfProfile] = useState(0)

  // Adopt the attached profile's skin. Fires on attach and on a profile switch (progressStore notifies
  // on both), and on a sync pull that brought a newer themeId from another device.
  useEffect(() => {
    const sync = () => {
      if (setPerfProfileFromSetting(progressStore.get().settings.smoothGraphics)) {
        bumpPerfProfile((n) => n + 1)
      }
      const stored = progressStore.get().settings.themeId
      if (stored && stored !== themeIdRef.current) {
        themeIdRef.current = stored
        setThemeIdState(stored)
        try {
          localStorage.setItem(STORAGE_KEY, stored)
        } catch {
          /* ignore */
        }
      }
    }
    sync()
    return progressStore.subscribe(sync)
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

  // Per-world ambient music: switch (cross-fade) the loop when the world changes. Only starts if
  // musicEnabled + a user gesture has unlocked audio (musicClient handles gating + gesture resume).
  useEffect(() => {
    musicClient.setWorld(themeId, theme.scene.music)
  }, [themeId, theme])

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
