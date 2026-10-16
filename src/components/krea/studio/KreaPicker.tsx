import React from 'react'
import { Box, ButtonBase } from '@mui/material'
import { pressHandlers } from './StudioControls'
import { CRAYON_HEX } from '../canvas/brushes'
import { PAPER_H, PAPER_W, type Drawing } from '../canvas/strokeModel'

// The picture grid of Tegn med Mig and Farvelæg (Krea PRD-01 §2.2.7–8, §2.5): twelve sheets of paper
// lying on the studio table. A card costs no art — a guided card draws its own steps as a finished line
// drawing, a colour-in card is its line art — and a piece in progress shows the child's own work on it,
// so switching subjects never needs a confirm.
//
// ENDLESS (§4.10): no "3 of 12 done", and a finished subject is NOT marked on its card — that would
// turn the grid into a checklist, a contingent-reward cue.
//
// The grid takes the RESERVED space it is given (the stage's flex remainder): 4 × 3 on a wide screen,
// 3 × 4 on a tall one, each card the largest square its cell allows — never a scroll.

export interface PickerItem {
  id: string
  label: string
  /** The card's picture, drawn to fill a square. */
  picture: React.ReactNode
}

export const KreaPicker: React.FC<{ items: PickerItem[]; onPick: (id: string) => void }> = ({ items, onPick }) => (
  <Box
    data-krea-picker
    sx={{
      flex: 1,
      minHeight: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gridAutoRows: 'minmax(0, 1fr)',
      gap: 'clamp(8px, 2.2vmin, 22px)',
      px: 'clamp(4px, 2vmin, 24px)',
      pb: 'calc(env(safe-area-inset-bottom) + clamp(6px, 1.5vmin, 16px))',
      '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
    }}
  >
    {items.map((it, i) => (
      <Box key={it.id} sx={{ minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
        <ButtonBase
          aria-label={it.label}
          data-krea-card={it.id}
          {...pressHandlers(() => onPick(it.id))}
          sx={{
            width: 'min(100cqw, 100cqh)',
            height: 'min(100cqw, 100cqh)',
            minWidth: '56px',
            minHeight: '56px',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#FFFEFB',
            boxShadow: '0 6px 14px rgba(80,50,20,0.26), 0 1px 3px rgba(80,50,20,0.2)',
            // Sheets tipped out on the table, not a tidy toolbar: a small, fixed tilt per card.
            transform: `rotate(${[-1.6, 1.2, -0.8, 1.8, -1.2, 0.9][i % 6]}deg)`,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1)',
            '&:active': { transform: 'rotate(0deg) scale(0.95)' },
          }}
        >
          {it.picture}
        </ButtonBase>
      </Box>
    ))}
  </Box>
)

/** Rainbow strokes on a thumbnail: one gradient, not the per-segment hue of the real brush. */
const RAINBOW_ID = 'kreaThumbRainbow'

/**
 * A drawing as SVG polylines — the child's ink on a picker card. Cheap and crisp at any size; the crayon
 * grain is not worth reproducing at thumbnail scale. Mirror strokes are drawn reflected too.
 */
export const InkThumb: React.FC<{ drawing: Drawing | null; viewBox?: string }> = ({ drawing, viewBox = `0 0 ${PAPER_W} ${PAPER_H}` }) => {
  if (!drawing?.strokes.length) return null
  const lines: React.ReactNode[] = []
  drawing.strokes.forEach((s, i) => {
    if (s.tool === 'stamp' || s.tool === 'eraser') return
    const color = s.tool === 'crayon' && s.color ? CRAYON_HEX[s.color] : s.tool === 'rainbow' ? `url(#${RAINBOW_ID})` : '#F6DC8F'
    const pts = s.points.length === 2 ? [...s.points, s.points[0] + 0.5, s.points[1]] : s.points
    const sets = [pts]
    if (s.mirror !== undefined) sets.push(pts.map((v, j) => (j % 2 === 0 ? 2 * s.mirror! - v : v)))
    sets.forEach((p, m) => lines.push(<polyline key={`${i}-${m}`} points={p.join(' ')} stroke={color} />))
  })
  return (
    <svg viewBox={viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id={RAINBOW_ID} x1="0" x2="1">
          <stop offset="0" stopColor="#E53935" />
          <stop offset="0.33" stopColor="#FDD835" />
          <stop offset="0.66" stopColor="#47AD2E" />
          <stop offset="1" stopColor="#1E63D6" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round">
        {lines}
      </g>
    </svg>
  )
}
