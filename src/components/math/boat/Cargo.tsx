import React from 'react'
import { Box } from '@mui/material'

// Fyld Båden's two learning objects (Harbour PRD-01 §4.4): ONE crate, and ONE pallet that visibly
// carries TEN crates as a 2×5 ten-frame — the same shape as the deck's crate bay, so "a pallet is a full
// crate bay" reads without words. A pallet that does not LOOK like ten teaches nothing.
//
// Both are sized by the `--s` slot unit their bay sets (see BoatDeck), so one value scales the whole
// deck. The CSS drawing is the art-free stand-in; the owner's Gemini renders replace it in W3.

const WOOD = '#C98B4B'
const WOOD_DARK = '#8A5527'
const WOOD_LIGHT = '#E3AE72'

export const CrateView: React.FC<{ size?: string }> = ({ size = 'calc(var(--s) * 0.86)' }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      height: size,
      borderRadius: '18%',
      background: `linear-gradient(160deg, ${WOOD_LIGHT} 0%, ${WOOD} 55%, ${WOOD_DARK} 100%)`,
      boxShadow: `inset 0 0 0 calc(${size} * 0.07) ${WOOD_DARK}, 0 calc(${size} * 0.06) calc(${size} * 0.12) rgba(60,30,10,0.35)`,
      position: 'relative',
      // The cross brace — what makes it read as a crate rather than a brown square at 30px.
      '&::before, &::after': {
        content: '""',
        position: 'absolute',
        left: '12%',
        right: '12%',
        top: '50%',
        height: '9%',
        borderRadius: 2,
        background: WOOD_DARK,
        opacity: 0.75,
      },
      '&::before': { transform: 'translateY(-50%) rotate(45deg)' },
      '&::after': { transform: 'translateY(-50%) rotate(-45deg)' },
    }}
  />
)

export const PalletView: React.FC<{ size?: string }> = ({ size = 'var(--s)' }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      height: size,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      filter: 'drop-shadow(0 2px 3px rgba(60,30,10,0.35))',
    }}
  >
    {/* The ten: 2 rows × 5, every unit separate (a visible seam), so ten is SEEN, not counted. */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '6%',
        aspectRatio: '5 / 2.1',
        width: '100%',
        px: '3%',
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Box
          key={i}
          sx={{
            borderRadius: '22%',
            background: `linear-gradient(160deg, ${WOOD_LIGHT}, ${WOOD} 60%, ${WOOD_DARK})`,
            boxShadow: `inset 0 0 0 1px ${WOOD_DARK}`,
          }}
        />
      ))}
    </Box>
    {/* The pallet base. */}
    <Box
      sx={{
        height: '16%',
        mt: '3%',
        borderRadius: '3px',
        background: `repeating-linear-gradient(90deg, ${WOOD_DARK} 0 12%, ${WOOD} 12% 22%)`,
      }}
    />
  </Box>
)
