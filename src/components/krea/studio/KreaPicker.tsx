import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { CRAYON_HEX } from '../canvas/brushes'
import { PAPER_H, PAPER_W, type Drawing } from '../canvas/strokeModel'

// The picture grid of Tegn med Mig, Farvelæg and Perleplade (Krea PRD-01 §2.2.7–8, §2.5): sheets of
// paper lying on the studio table (36 / 36 / 39 of them since 2026-11-04). A card costs no art — a guided card draws its own steps as a finished line
// drawing, a colour-in card is its line art — and a piece in progress shows the child's own work on it,
// so switching subjects never needs a confirm.
//
// ENDLESS (§4.10): no "3 of 12 done", and a finished subject is NOT marked on its card — that would
// turn the grid into a checklist, a contingent-reward cue.
//
// The grid takes the RESERVED space it is given (the stage's flex remainder): 4 across on a wide
// screen, 3 on a tall one, and each ROW is the height a 3-row (landscape) / 4-row (portrait) grid would
// give it — the card size the owner signed off with twelve cards. Past that it SCROLLS vertically
// (owner, 2026-11-04: three times as many pictures, "just make it scrollable", "the size is fine").
//
// A scrolling grid changes how a card is picked: on the PRESS (`pressHandlers`) a finger that lands on
// a card to scroll would open it. So a card opens on the CLICK, which the browser withholds when the
// touch became a scroll. The scroll position is kept per game for the session, so coming back from a
// picture lands where the child left the grid. While more cards lie below, the bottom edge fades — a
// pre-reader's cue that the table goes on.

export interface PickerItem {
  id: string
  label: string
  /** The card's picture, drawn to fill a square. */
  picture: React.ReactNode
}

/** Where each game's grid was scrolled to, for this session (module state: one per game id). */
const scrollMemory = new Map<string, number>()

const GAP = 'clamp(8px, 2.2vmin, 22px)'

export const KreaPicker: React.FC<{ items: PickerItem[]; onPick: (id: string) => void; scrollKey: string }> = ({ items, onPick, scrollKey }) => {
  const scroller = useRef<HTMLDivElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const measure = useCallback(() => {
    const el = scroller.current
    if (el) setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = scrollMemory.get(scrollKey) ?? 0
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [scrollKey, measure])
  const onScroll = () => {
    if (scroller.current) scrollMemory.set(scrollKey, scroller.current.scrollTop)
    measure()
  }
  return (
  // The outer box is the SIZE container: `cqh` below is the height the old fixed grid had, so a row
  // is exactly the cell it used to be.
  <Box sx={{ flex: 1, minHeight: 0, containerType: 'size', '--krea-gap': GAP, '--krea-pt': '6px', '--krea-px': 'clamp(4px, 2vmin, 24px)', '--krea-pb': 'calc(env(safe-area-inset-bottom) + clamp(6px, 1.5vmin, 16px))' }}>
  <Box
    ref={scroller}
    data-krea-picker
    data-krea-picker-more={moreBelow ? '' : undefined}
    onScroll={onScroll}
    sx={{
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
      // Pan only vertically, so a sideways wobble never fights the scroll.
      touchAction: 'pan-y',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      // A row is the cell the old fixed grid had — but never taller than a column is wide, or a tall
      // phone gets a band of empty table between rows (the card is a square of the smaller side).
      gridAutoRows: 'min(calc((100cqh - var(--krea-pt) - var(--krea-pb) - 3 * var(--krea-gap)) / 4), calc((100cqw - 2 * var(--krea-px) - 2 * var(--krea-gap)) / 3))',
      gap: 'var(--krea-gap)',
      px: 'var(--krea-px)',
      // Room for the card tilt/shadow at the top, and the home indicator at the bottom.
      pt: 'var(--krea-pt)',
      pb: 'var(--krea-pb)',
      boxSizing: 'border-box',
      '@media (orientation: landscape)': {
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gridAutoRows: 'min(calc((100cqh - var(--krea-pt) - var(--krea-pb) - 2 * var(--krea-gap)) / 3), calc((100cqw - 2 * var(--krea-px) - 3 * var(--krea-gap)) / 4))',
      },
      WebkitMaskImage: moreBelow ? 'linear-gradient(to bottom, #000 calc(100% - 44px), transparent)' : 'none',
      maskImage: moreBelow ? 'linear-gradient(to bottom, #000 calc(100% - 44px), transparent)' : 'none',
    }}
  >
    {items.map((it, i) => (
      <Box key={it.id} sx={{ minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
        <ButtonBase
          aria-label={it.label}
          data-krea-card={it.id}
          onClick={() => onPick(it.id)}
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
  </Box>
  )
}

/** Rainbow strokes on a thumbnail: one gradient, not the per-segment hue of the real brush. */
const RAINBOW_ID = 'kreaThumbRainbow'

/**
 * A drawing as SVG polylines — the child's ink on a picker card. Cheap and crisp at any size; the crayon
 * grain is not worth reproducing at thumbnail scale. Mirror strokes are drawn reflected too.
 */
export const InkThumb: React.FC<{
  drawing: Drawing | null
  viewBox?: string
  /** Fri Tegning's pictures: a stamp's image by id. Without it stamps are left out. */
  stampSrc?: (id: string) => string | undefined
}> = ({ drawing, viewBox = `0 0 ${PAPER_W} ${PAPER_H}`, stampSrc }) => {
  if (!drawing?.strokes.length) return null
  const lines: React.ReactNode[] = []
  drawing.strokes.forEach((s, i) => {
    if (s.tool === 'stamp') {
      const href = stampSrc?.(s.stamp)
      if (href) lines.push(<image key={i} href={href} x={s.x - s.size / 2} y={s.y - s.size / 2} width={s.size} height={s.size} />)
      return
    }
    if (s.tool === 'eraser') return
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
