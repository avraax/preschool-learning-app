import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { sfx } from '../../services/sfxClient'

// Shared ten-frame counting aid (Math Overhaul PRD §0). A reusable, on-demand manipulative that
// makes quantity visible: the canonical early-math representation (5-wise grouping → subitizing +
// a bridge to place value, 37 = 3 tens + 7). It is a *scaffold when stuck*, never the answer:
// callers reveal it behind a "Tæl med mig" button so the game stays a recognition test first.
//
// Modes:
//   value (default) — N dots across ceil(N/10) ten-frames. Top row of each frame = accent, bottom
//                     row = a darker accent shade ("five and two" subitizing).
//   add             — a+b dots: the first `a` in accent, the next `b` in a second colour, so the
//                     child counts the total ("a and b more").
//   sub             — `a` dots drawn, the last `b` crossed-out/faded, leaving a−b solid.
//
// Depth language echoes AnswerTile: top-light dot gradient + soft shadow; empty cells are faint
// outlines. All colours from theme tokens; readable on dark immersive scenes. Dots pop in
// staggered (spring); reduced-motion → instant. Sized with clamp() and frames wrap so the aid
// never forces scroll in portrait or landscape.

export type CountingAidMode = 'value' | 'add' | 'sub'

interface CountingAidProps {
  accent: string
  mode?: CountingAidMode
  value?: number // 'value' mode
  a?: number // 'add' | 'sub' modes
  b?: number // 'add' | 'sub' modes
  open: boolean // controlled visibility (caller toggles via TaelMedMigButton)
  secondColor?: string // 'add' mode: colour of the `b` group (default theme secondary)
}

interface Cell {
  fill: boolean
  color: string
  crossed: boolean
  order: number // index among filled cells (for the staggered pop-in delay); -1 when empty
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const CountingAid: React.FC<CountingAidProps> = ({
  accent,
  mode = 'value',
  value = 0,
  a = 0,
  b = 0,
  open,
  secondColor,
}) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const darkAccent = darken(accent, 0.32)
  const second = secondColor ?? theme.palette.secondary.main

  // Build the flat cell model (length = full frames * 10) for the active mode.
  const cells = React.useMemo(() => {
    // Dots actually drawn (filled).
    const total =
      mode === 'value'
        ? Math.max(0, Math.min(100, Math.round(value)))
        : mode === 'add'
          ? Math.max(0, a) + Math.max(0, b)
          : Math.max(0, a) // sub: `a` dots drawn

    const frames = Math.max(1, Math.ceil(total / 10))
    const out: Cell[] = []
    let order = 0
    for (let g = 0; g < frames * 10; g++) {
      if (g >= total) {
        out.push({ fill: false, color: accent, crossed: false, order: -1 })
        continue
      }
      if (mode === 'value') {
        const local = g % 10
        out.push({ fill: true, color: local < 5 ? accent : darkAccent, crossed: false, order: order++ })
      } else if (mode === 'add') {
        out.push({ fill: true, color: g < a ? accent : second, crossed: false, order: order++ })
      } else {
        // sub: the last `b` of the `a` drawn dots are crossed out
        out.push({ fill: true, color: accent, crossed: g >= a - b, order: order++ })
      }
    }
    return out
  }, [mode, value, a, b, accent, darkAccent, second])

  if (!open) return null

  // Scale dots down as the quantity grows so big numbers (up to 100) still fit without scroll.
  const frameCount = cells.length / 10
  const dotSize =
    frameCount > 6
      ? 'clamp(9px, 2vw, 15px)'
      : frameCount > 3
        ? 'clamp(11px, 2.4vw, 19px)'
        : 'clamp(14px, 3.2vw, 24px)'
  // Shorter viewports (landscape) get smaller dots so the aid never forces scroll.
  const dotSizeLandscape =
    frameCount > 6
      ? 'clamp(7px, 1.5vh, 12px)'
      : frameCount > 3
        ? 'clamp(8px, 1.9vh, 15px)'
        : 'clamp(10px, 2.4vh, 18px)'

  const emptyBorder = hexToRgba(dark ? '#FFFFFF' : accent, 0.32)

  return (
    <Box
      data-counting-aid
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: { xs: 1, md: 1.5 },
        maxWidth: '100%',
        '@media (orientation: landscape)': { gap: { xs: 0.75, md: 1 } },
      }}
    >
      {chunk(cells, 10).map((frame, fi) => (
        <Box
          key={fi}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, auto)',
            gridTemplateRows: 'repeat(2, auto)',
            gap: 'clamp(3px, 0.7vw, 6px)',
            p: 'clamp(4px, 1vw, 8px)',
            borderRadius: '12px',
            background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
            boxShadow: dark
              ? 'inset 0 0 0 1px rgba(255,255,255,0.12)'
              : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          {frame.map((cell, ci) => {
            // CSS-staggered pop-in (reliable + light vs many simultaneous springs). The resting
            // state is always visible; reduced-motion skips the entrance entirely.
            const restOpacity = cell.crossed ? 0.45 : 1
            const animate = cell.fill && !reduce
            return (
              <Box
                key={ci}
                sx={{
                  position: 'relative',
                  width: dotSize,
                  height: dotSize,
                  '@media (orientation: landscape)': { width: dotSizeLandscape, height: dotSizeLandscape },
                  borderRadius: '50%',
                  opacity: restOpacity,
                  ...(cell.fill
                    ? {
                        // Solid coloured disc with a small top-left specular highlight (the
                        // gradient layer paints over the solid colour base) — tactile but clearly
                        // readable, unlike a white-dominant fill that washes out at small sizes.
                        background: `radial-gradient(circle at 36% 30%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 34%), ${cell.color}`,
                        boxShadow: dark
                          ? `0 2px 5px rgba(0,0,0,0.45), inset 0 -2px 3px ${hexToRgba(darken(cell.color, 0.4), 0.6)}`
                          : `0 2px 4px rgba(0,0,0,0.22), inset 0 -2px 3px ${hexToRgba(darken(cell.color, 0.4), 0.5)}`,
                      }
                    : {
                        background: 'transparent',
                        boxShadow: `inset 0 0 0 2px ${emptyBorder}`,
                      }),
                  ...(animate
                    ? {
                        animation: 'countingDotPop 0.34s cubic-bezier(0.34,1.56,0.64,1) both',
                        animationDelay: `${Math.min(cell.order * 0.04, 0.8)}s`,
                        '@keyframes countingDotPop': {
                          '0%': { transform: 'scale(0)', opacity: 0 },
                          '100%': { transform: 'scale(1)', opacity: restOpacity },
                        },
                      }
                    : {}),
                }}
              >
                {/* Subtraction: a diagonal strike over the "taken away" dots. */}
                {cell.crossed && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '-10%',
                      width: '120%',
                      height: '12%',
                      minHeight: 2,
                      transform: 'translateY(-50%) rotate(-45deg)',
                      borderRadius: 2,
                      background: dark ? '#FFFFFF' : darken(accent, 0.5),
                      boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                    }}
                  />
                )}
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export default CountingAid

// The "Tæl med mig" reveal pill. A themed, ≥44px Comic-Sans button, visually distinct from the
// purple MathRepeatButton ("Hør igen") so the two don't compete. Fires a soft `tap` SFX on toggle.
interface TaelMedMigButtonProps {
  open: boolean
  onToggle: () => void
  accent: string
}

export const TaelMedMigButton: React.FC<TaelMedMigButtonProps> = ({ open, onToggle, accent }) => {
  const theme = useTheme()
  const dark = theme.scene.dark
  const lip = darken(accent, 0.3)

  const handleClick = () => {
    sfx.play('tap')
    onToggle()
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={handleClick}
      data-aid-toggle
      aria-pressed={open}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        minHeight: 44,
        px: { xs: 2, md: 2.5 },
        py: 0.5,
        borderRadius: '999px',
        cursor: 'pointer',
        fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
        fontWeight: 700,
        fontSize: 'clamp(0.85rem, 2.6vw, 1.05rem)',
        color: open ? '#FFFFFF' : accent,
        background: open
          ? `linear-gradient(180deg, ${accent} 0%, ${lip} 100%)`
          : dark
            ? 'rgba(255,255,255,0.92)'
            : '#FFFFFF',
        border: '3px solid',
        borderColor: accent,
        boxShadow: open
          ? `0 4px 0 ${lip}, 0 8px 16px ${hexToRgba(accent, 0.4)}`
          : `0 4px 0 ${hexToRgba(accent, 0.45)}, 0 6px 14px rgba(0,0,0,0.16)`,
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        transition: 'box-shadow 0.18s ease, transform 0.08s ease',
        '&:focus-visible': { outline: '3px solid', outlineColor: accent, outlineOffset: '2px' },
        '&:active': { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${lip}` },
      }}
    >
      {open ? 'Skjul 🔢' : 'Tæl med mig 🔢'}
    </Box>
  )
}
