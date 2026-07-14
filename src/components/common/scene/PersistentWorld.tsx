import React, { useRef } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { useParallax } from './useParallax'
import { routeKind } from './routeKind'
import ThemeScene from './ThemeScene'

// The ONE persistent SCENE for the whole app (App-wide UI Uplift / Theme Worlds). Rendered once
// in App, behind the router, so the parallax scene + drifting ambient NEVER unmount on
// navigation — they keep living while only the foreground page content swaps on top. This is
// what removes the "background restarts/flickers" when moving between home → section → game.
//
//   • Menu routes: bright live scene.
//   • Game routes: the same scene KEEPS drifting underneath, but blurs + dims so nothing competes
//     with the answers.
//
// The MASCOT is intentionally NOT here. It's rendered inside each page instead (home/section
// menus render <ThemeMascot/>, games render GameShell's in-game <Mascot/>). A persistent mascot living in
// THIS separate, z-interleaved layer over the transparent pages made Chrome thrash the scene's
// compositing (white/not-white flicker on hover); the same mascot inside the page subtree is
// rock-solid. The cost is the mascot re-mounts on navigation instead of gliding — worth it.
//
// Flat skins (no authored world) have nothing to persist → this renders null and pages keep
// their own per-section backgrounds exactly as before.
//
// Layering: scene + dim are ABSOLUTE (not fixed — Chrome blanks fixed layers during touch pan
// gestures) at z-index 0, behind the foreground page wrapper (z-index 1, transparent so the
// world shows through). Parallax vars are written on this root; the scene's layers inherit them.

const PersistentWorld: React.FC = () => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { pathname } = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const immersive = theme.scene.layers.length > 0
  const dark = theme.scene.dark
  const inGame = routeKind(pathname) === 'game'
  const ease = reduce ? '0s' : '0.4s'

  // Freeze the scene during gameplay (PRD-08 §P4): the world is blurred + dimmed behind a game
  // anyway, so stop the parallax rAF and pause the ambient CSS animations — no continuous GPU /
  // battery cost behind blurred content. It resumes on returning to a menu route. `prefers-reduced-
  // motion` remains an independent gate (already disables both); this is an ADDITIONAL freeze.
  useParallax(rootRef, { disabled: reduce || inGame })

  // Flat skin → no world to keep alive; pages render their own backgrounds unchanged.
  if (!immersive) return null

  return (
    <Box ref={rootRef}>
      {/* Scene + ambient — behind the page content (transparent immersive pages show it through).
          On game routes it blurs (and scales up to hide the blur's soft edges) while KEEPING its
          parallax/ambient drift, so the world stays alive but quiet. */}
      <Box
        aria-hidden
        sx={{
          // ABSOLUTE, not fixed: the host is a full-viewport no-scroll container, and Chrome blanks
          // `position: fixed` layers during touch pan gestures (press-hold → white until release).
          position: 'absolute',
          // Bleed a few px past every edge (clipped by the parent's overflow). At fractional
          // device-pixel ratios — e.g. Chrome's iPad emulation — 100dvh rounds to a sub-pixel and
          // would leave a 1px seam of the transparent base (a flickering white line) at the bottom.
          inset: '-4px',
          zIndex: 0, // behind the foreground wrapper (z-index:1)
          overflow: 'hidden',
          pointerEvents: 'none',
          // Dark worlds paint their base immediately so there's no light flash before art loads.
          backgroundColor: dark ? '#070B1A' : 'transparent',
          filter: inGame ? 'blur(7px)' : 'none',
          transform: inGame ? 'scale(1.06)' : 'none',
          transition: `filter ${ease} ease, transform ${ease} ease`,
        }}
      >
        <ThemeScene paused={inGame} />
      </Box>

      {/* Dim overlay — a plain tint that fades in on game routes so nothing competes with the
          answers. Behind page content, above the scene. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: inGame ? 1 : 0,
          transition: `opacity ${ease} ease`,
          background: dark
            ? 'radial-gradient(115% 90% at 50% 48%, rgba(7,11,26,0.58) 0%, rgba(7,11,26,0.34) 60%, rgba(7,11,26,0.46) 100%)'
            : 'radial-gradient(115% 90% at 50% 48%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.30) 60%, rgba(255,255,255,0.40) 100%)',
        }}
      />
    </Box>
  )
}

export default PersistentWorld
