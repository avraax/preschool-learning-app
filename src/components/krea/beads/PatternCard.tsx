import React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
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

export const PatternCard: React.FC<{
  id: string
  n: number
  target: readonly (BeadColor | null)[]
  legend: Array<[BeadColor, number]>
  /** Landscape: a tall column (picture over legend). Portrait: picture beside the legend. */
  direction: 'column' | 'row'
  disabled: boolean
  onChip: (c: BeadColor, count: number) => void
}> = ({ id, n, target, legend, direction, disabled, onChip }) => {
  const theme = useTheme()
  return (
    <Box
      data-krea-pattern-card={id}
      sx={{
        display: 'flex',
        flexDirection: direction,
        alignItems: 'center',
        gap: 'clamp(4px, 1.2vmin, 10px)',
        p: 'clamp(6px, 1.4vmin, 12px)',
        background: '#FFFEFB',
        borderRadius: '14px',
        boxShadow: '0 6px 14px rgba(80,50,20,0.26), 0 1px 3px rgba(80,50,20,0.2)',
        transform: 'rotate(-1deg)',
        width: direction === 'column' ? '100%' : 'auto',
        boxSizing: 'border-box',
        minHeight: 0,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'relative',
          flex: '0 0 auto',
          width: direction === 'column' ? 'min(100%, var(--bead-card-pic-col, 100%))' : 'var(--bead-card-pic)',
          aspectRatio: '1',
        }}
      >
        <PlacedBeads board={finishedPattern(n, target)} size={0.94} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(var(--bead-legend-cols, 2), auto)', columnGap: '4px', rowGap: '2px', alignContent: 'center' }}>
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
              gap: '4px',
              minHeight: '44px',
              minWidth: '44px',
              px: '2px',
              borderRadius: '10px',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              '&:active': { background: 'rgba(255,210,80,0.25)' },
            }}
          >
            <Bead colour={c} style={{ width: 'var(--bead-chip)', height: 'var(--bead-chip)', flex: '0 0 auto' }} />
            <Typography sx={{ fontFamily: theme.titleFontFamily, fontWeight: 700, fontSize: 'var(--bead-chip-font)', lineHeight: 1, color: '#4A3420' }}>{count}</Typography>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  )
}
