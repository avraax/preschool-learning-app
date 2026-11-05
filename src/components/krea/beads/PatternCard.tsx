import React, { useLayoutEffect, useRef, useState } from 'react'
import { Box, ButtonBase, Typography, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { pressHandlers } from '../studio/StudioControls'
import { KREA_COLOR_NAME } from '../../../config/kreaPhrases'
import { Bead } from './Bead'
import { PlacedBeads } from './Pegboard'
import { finishedPattern, type BeadColor } from './beadBoard'

// The pattern card (Krea PRD-02 §2.3, §2.7): the finished picture to copy, and under it a colour LEGEND
// with numerals — "● 12" — rendered as Typography, never baked. Tapping a chip SPEAKS the number (the
// prebaked bare-number clips 0–100) and makes the board's beads of that colour glow: counting, as the
// game action. The game itself never counts beads aloud while placing them (silent, like Fyld Båden).
//
// A white card in code, like the picker's sheets — the baked card frame is landscape and the card is a
// tall column beside the board, so stretching it would distort the clay.
//
// IT FILLS THE BOX IT IS GIVEN (owner, 2026-11-04, from an iPhone: "the Santa part is too small",
// "beads … fall outside the plate"). The card used to be a flex item that could SHRINK below its own
// content (the legend's last row hung out of its bottom in WebKit), with the picture a fixed 64–120 px.
// Now the OUTER box is the room the layout reserves (the side column's remainder, or the portrait row's
// card cell) and the card is laid out INSIDE it, absolutely, so it never feeds back into the layout:
//   - the legend is measured first — its columns from the room it has (column: as many as fit across,
//     each as wide as the widest chip, "100" included; row: as few as fit the height), its rows packed
//     tight (chips keep their 44 px hit box but overlap it by `--bead-chip-pull`, so the 14 px phone
//     beads no longer stand 46 px apart);
//   - the picture is then the biggest square the rest of the box holds.
// The card therefore can't overflow its box, and its picture is as big as the room allows (2.4× on a
// landscape phone, measured).

/**
 * Room kept free for the card's -1° tilt (px). Centred, the tilt pushes each corner out ~0.9 % of the
 * other side (2 px for a 250 px card); the box sits between 16 px gaps, so this is all it needs — and
 * every px counts in a portrait phone's 100 px cell, where 6 px cost the legend its second column.
 */
const TILT_SLACK = 2

export const PatternCard: React.FC<{
  id: string
  n: number
  target: readonly (BeadColor | null)[]
  legend: Array<[BeadColor, number]>
  /** Column: the picture over the legend (the landscape side column, a phone). Row: picture beside it. */
  direction: 'column' | 'row'
  disabled: boolean
  onChip: (c: BeadColor, count: number) => void
  /** Places the OUTER box — the room the card fills. */
  sx?: SxProps<Theme>
}> = ({ id, n, target, legend, direction, disabled, onChip, sx = {} }) => {
  const theme = useTheme()
  const fitRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ pic: number; cols: number } | null>(null)

  useLayoutEffect(() => {
    const box = fitRef.current
    const card = cardRef.current
    const leg = legendRef.current
    if (!box || !card || !leg) return
    const measure = () => {
      const cs = getComputedStyle(card)
      const pad = parseFloat(cs.paddingLeft) || 0
      const gap = parseFloat(cs.rowGap) || 0
      const ls = getComputedStyle(leg)
      const colGap = parseFloat(ls.columnGap) || 0
      const W = box.clientWidth - 2 * pad - TILT_SLACK
      const H = box.clientHeight - 2 * pad - TILT_SLACK
      const chips = [...leg.children] as HTMLElement[]
      if (!chips.length || W <= 0 || H <= 0) return
      const chipW = Math.max(...chips.map((c) => c.offsetWidth))
      // One row's height, as laid out (the hit box less the pull on both sides, plus the row gap).
      const rowPitch = chips[0].getBoundingClientRect().height + parseFloat(getComputedStyle(chips[0]).marginTop) * 2 + (parseFloat(ls.rowGap) || 0)
      let cols: number
      let pic: number
      if (direction === 'column') {
        cols = Math.max(1, Math.min(legend.length, Math.floor((W + colGap) / (chipW + colGap))))
        const rows = Math.ceil(legend.length / cols)
        pic = Math.min(W, H - gap - rows * rowPitch)
      } else {
        const rowsFit = Math.max(1, Math.floor(H / rowPitch))
        cols = Math.ceil(legend.length / rowsFit)
        pic = Math.min(H, W - gap - cols * chipW - (cols - 1) * colGap)
      }
      const next = { pic: Math.max(0, Math.floor(pic)), cols }
      setFit((f) => (f && f.pic === next.pic && f.cols === next.cols ? f : next))
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(box)
    ro?.observe(leg)
    return () => ro?.disconnect()
  }, [direction, legend.length])

  const cols = fit?.cols ?? 2
  return (
    <Box ref={fitRef} sx={[{ position: 'relative', minWidth: 0, minHeight: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box
        ref={cardRef}
        data-krea-pattern-card={id}
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(-1deg)',
          display: 'flex',
          flexDirection: direction,
          alignItems: 'center',
          gap: 'clamp(4px, 1.2vmin, 10px)',
          p: 'clamp(6px, 1.4vmin, 12px)',
          background: '#FFFEFB',
          borderRadius: '14px',
          boxShadow: '0 6px 14px rgba(80,50,20,0.26), 0 1px 3px rgba(80,50,20,0.2)',
          // Column: the card spans its box, so the legend's columns have the whole width.
          width: direction === 'column' ? `calc(100% - ${TILT_SLACK}px)` : 'max-content',
          boxSizing: 'border-box',
          // Hidden for the one frame before the first measure, so the card never flashes at the wrong size.
          visibility: fit ? 'visible' : 'hidden',
        }}
      >
        <Box aria-hidden data-krea-pattern-pic sx={{ position: 'relative', flex: '0 0 auto', width: `${fit?.pic ?? 0}px`, height: `${fit?.pic ?? 0}px` }}>
          <PlacedBeads board={finishedPattern(n, target)} size={0.94} />
        </Box>
        <Box
          ref={legendRef}
          sx={{
            display: 'grid',
            gridTemplateColumns: direction === 'column' ? `repeat(${cols}, minmax(0, 1fr))` : `repeat(${cols}, auto)`,
            width: direction === 'column' ? '100%' : 'auto',
            columnGap: 'var(--bead-legend-gap, 4px)',
            rowGap: '0px',
            alignContent: 'center',
            justifyItems: 'start',
          }}
        >
          {legend.map(([c, count]) => (
            <ButtonBase
              key={c}
              data-krea-legend={c}
              data-krea-legend-count={count}
              aria-label={`${count} ${KREA_COLOR_NAME[c]}`}
              disabled={disabled}
              {...pressHandlers(() => onChip(c, count))}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 'var(--bead-chip-gap, 4px)',
                // The hit box stays 44 px tall; the pull lets neighbouring rows' boxes overlap so the
                // beads sit closer ("same size but take less space", owner 2026-11-04).
                minHeight: '44px',
                my: 'var(--bead-chip-pull, 0px)',
                minWidth: 'var(--bead-chip-min, 40px)',
                px: 'var(--bead-chip-px, 2px)',
                borderRadius: '10px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                whiteSpace: 'nowrap',
                '&:active': { background: 'rgba(255,210,80,0.25)' },
              }}
            >
              <Bead colour={c} style={{ width: 'var(--bead-chip)', height: 'var(--bead-chip)', flex: '0 0 auto' }} />
              <Typography sx={{ fontFamily: theme.titleFontFamily, fontWeight: 700, fontSize: 'var(--bead-chip-font)', lineHeight: 1, color: '#4A3420' }}>{count}</Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
