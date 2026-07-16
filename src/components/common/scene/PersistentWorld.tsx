import React, { useRef } from 'react'
import { Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { useProgress } from '../../../hooks/useProgress'
import { sectionForPath } from '../../../config/routeDepth'
import { getCategoryTheme } from '../../../config/categoryThemes'
import type { SectionId } from '../../../services/progressStore'
import { useParallax } from './useParallax'
import { routeKind, isHomeRoute } from './routeKind'
import ThemeScene from './ThemeScene'

const BLOOM_SECTIONS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

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
  const { bloomFor } = useProgress()
  const rootRef = useRef<HTMLDivElement>(null)
  const immersive = theme.scene.layers.length > 0
  const dark = theme.scene.dark
  const inGame = routeKind(pathname) === 'game'
  const ease = reduce ? '0s' : '0.4s'

  // Visible bloom (Liveliness PRD-02 §9): the more a section is played, the more alive its world.
  // A section route reflects THAT section's bloom; home reflects the child's best across sections.
  // Bloom multiplies the scene's existing ambient knob (extra drifting objects) — monotonic and
  // persisted, so the child returns to a world they made grow.
  const section = sectionForPath(pathname)
  let stage = 0
  let fill = 0
  if (section) {
    const b = bloomFor(section)
    stage = b.stage
    fill = b.fill
  } else {
    for (const s of BLOOM_SECTIONS) {
      const b = bloomFor(s)
      stage = Math.max(stage, b.stage)
      fill = Math.max(fill, b.fill)
    }
  }
  const bloomExtra = Math.round(stage * 2 + fill * 4) // 0 (fresh) → ~12 (fully bloomed)

  // Section framing (Liveliness PRD-05 W4/W5): on a section MENU (not home, not a game) the same
  // world re-centres/zooms onto that section's locale (theme.scene.sectionFocus) and takes on the
  // section's accent tint — so /alphabet feels like a different place than /math WITHOUT bespoke
  // backdrops. Transform-only (flicker-safe); the 0.4s transition gives the "reframe" beat and, on
  // arrival from a push-in, agrees with the destination framing. Reduced-motion → snaps (ease 0s).
  const isMenu = routeKind(pathname) === 'menu'
  const framing =
    immersive && isMenu && !isHomeRoute(pathname) && section ? theme.scene.sectionFocus?.[section] : null
  const accent = framing && section ? getCategoryTheme(section).accentColor : null

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
          On game routes (PRD-06 F3 "calm-present") it takes only a LIGHT readability veil — a gentle
          blur + a slight scale to hide the blur's soft edges — while FROZEN (ambient paused, parallax
          off), so the *place* stays felt and the game's own tiles/subject read as resting IN it. */}
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
          filter: inGame ? 'blur(2.5px)' : 'none',
          // Game routes: light veil scale (just enough to hide the soft blur edge). Section menus:
          // push-in toward the section's focal locale. Home / no framing: neutral. (Mutually
          // exclusive states — a game is never framed.)
          transformOrigin: framing ? `${framing.xPct}% ${framing.yPct}%` : 'center',
          transform: inGame ? 'scale(1.03)' : framing ? `scale(${framing.zoom})` : 'none',
          transition: `filter ${ease} ease, transform ${ease} ease`,
        }}
      >
        <ThemeScene paused={inGame} bloomExtra={bloomExtra} bloomStage={stage} bloomSection={section} />
      </Box>

      {/* Section accent tint (PRD-05 W4) — a gentle wash in the section's colour, fading in on the
          section menu so each locale reads distinctly. Behind page content, above the scene. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: accent ? 1 : 0,
          transition: `opacity ${ease} ease`,
          background: accent
            ? `linear-gradient(180deg, ${alpha(accent, 0.10)} 0%, ${alpha(accent, 0.20)} 100%)`
            : 'none',
        }}
      />

      {/* Readability veil (PRD-06 F3) — a LIGHT static tint that fades in on game routes so the
          content pops while the world stays felt (softer than the old heavy dim). Static during play
          (the world is frozen) → no moving-layer backdrop-filter concern. Behind page content. */}
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
            ? 'radial-gradient(115% 90% at 50% 48%, rgba(7,11,26,0.40) 0%, rgba(7,11,26,0.22) 60%, rgba(7,11,26,0.30) 100%)'
            : 'radial-gradient(115% 90% at 50% 48%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.14) 60%, rgba(255,255,255,0.20) 100%)',
        }}
      />
    </Box>
  )
}

export default PersistentWorld
