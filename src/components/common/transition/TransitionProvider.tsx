import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import type { TransitionTokens } from '../../../theme/tokens/types'
import { useThemeSwitch } from '../../../theme/ThemeProvider'
import { loadSceneAssets } from '../../../theme/sceneAssets'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { directionFor, routeDepth, type TravelDirection } from '../../../config/routeDepth'
import { routeKind } from '../scene/routeKind'
import { sfx } from '../../../services/sfxClient'
import { mascotBus } from '../../../services/mascotBus'

// Route-transition orchestrator (Liveliness PRD-02 §1). A tiny state machine that drives a
// full-screen OPAQUE "wipe" overlay so the flicker-prone page mount/unmount happens WHILE fully
// covered — the persistent world is never touched (no AnimatePresence page-exit, no transparent
// cross-fade, no backdrop-filter). See TransitionOverlay for the paint; this file owns the timing:
//
//   idle ──navigateWithTransition(to)──▶ covering ──cover done──▶ (navigate) ──▶ revealing ──▶ idle
//
// Wiring points (the ONLY places that should route through this): HomePage cards + Min Bog,
// GameSelectionLayout, and GameShell's back button. Any raw navigate() bypasses the wipe.

export type TransitionPhase = 'idle' | 'covering' | 'revealing'

interface TransitionContextValue {
  // Public API (via useTransitionNav)
  navigateWithTransition: (to: string, opts?: { replace?: boolean }) => void
  goBack: (to: string) => void
  // Internal (consumed by TransitionOverlay)
  phase: TransitionPhase
  direction: TravelDirection
  descriptor: TransitionTokens
  reducedFade: boolean
  withUsher: boolean
  usherUrl: string
  onCoverComplete: () => void
  onRevealComplete: () => void
}

const TransitionContext = createContext<TransitionContextValue | null>(null)

export const useTransitionContext = (): TransitionContextValue | null => useContext(TransitionContext)

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const reduce = useReducedMotion()
  const descriptor = theme.transition

  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const [direction, setDirection] = useState<TravelDirection>('forward')
  const [withUsher, setWithUsher] = useState(false)
  const [reducedFade, setReducedFade] = useState(false)
  const [usherUrl, setUsherUrl] = useState('')

  // Live refs so the framer onAnimationComplete callbacks (async) always read fresh values with
  // stable identities (they never need to change between renders).
  const pendingRef = useRef<{ to: string; replace?: boolean } | null>(null)
  const phaseRef = useRef<TransitionPhase>('idle')
  phaseRef.current = phase
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  // The usher reuses the active theme's cached mascot sprite (same buddy as the menu mascot).
  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive) setUsherUrl(a?.mascot ?? '')
    })
    return () => {
      alive = false
    }
  }, [themeId])

  const start = useCallback(
    (to: string, forcedDir: TravelDirection | undefined, opts?: { replace?: boolean }) => {
      if (!to || to === pathnameRef.current) return // same-path → no-op (never dead-end)
      if (phaseRef.current !== 'idle') return // ignore re-entrant taps mid-wipe
      const dir = forcedDir ?? directionFor(pathnameRef.current, to)
      // Travel cue at cover start (per-skin forward whoosh, or the softer reverse on back).
      sfx.play(dir === 'back' ? 'back' : descriptor.sfx)
      // Reduced motion, `none` fallback → plain navigate, no overlay at all.
      if (reduce && descriptor.reduced === 'none') {
        navigate(to, opts?.replace ? { replace: true } : undefined)
        return
      }
      pendingRef.current = { to, replace: opts?.replace }
      setDirection(dir)
      // Full usher only forward-into-a-game (depth 2); home→section stays light.
      setWithUsher(!reduce && dir === 'forward' && routeDepth(to) === 2)
      setReducedFade(reduce) // reduced + `fade` → fast opaque swap, no motif/usher
      setPhase('covering')
    },
    [descriptor, reduce, navigate],
  )

  const navigateWithTransition = useCallback(
    (to: string, opts?: { replace?: boolean }) => start(to, undefined, opts),
    [start],
  )
  const goBack = useCallback((to: string) => start(to, 'back'), [start])

  // Cover finished → commit the route swap (new page mounts under the fully opaque cover) → reveal.
  const onCoverComplete = useCallback(() => {
    const pending = pendingRef.current
    if (pending) navigate(pending.to, pending.replace ? { replace: true } : undefined)
    setPhase('revealing')
  }, [navigate])

  // Reveal finished → back to idle. Fire the arrive cue: a soft chime onto a menu, or the in-game
  // mascot's welcome onto a game (menu-open/welcome fire AFTER NavigationAudioCleanup's stopAll, so
  // they survive — the travel cue at cover start mostly finishes during cover).
  const onRevealComplete = useCallback(() => {
    setPhase('idle')
    setWithUsher(false)
    setReducedFade(false)
    pendingRef.current = null
    if (routeKind(pathnameRef.current) === 'menu') sfx.play('menu-open')
    else mascotBus.emit('welcome')
  }, [])

  const value: TransitionContextValue = {
    navigateWithTransition,
    goBack,
    phase,
    direction,
    descriptor,
    reducedFade,
    withUsher,
    usherUrl,
    onCoverComplete,
    onRevealComplete,
  }

  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>
}

export default TransitionProvider
