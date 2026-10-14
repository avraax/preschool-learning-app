import React from 'react'
import { Box } from '@mui/material'
import fishArt from '../../../assets/games/math/fish.webp'

// Fyld Båden's two learning objects (Harbour PRD-01 §2.1, fish decision 2026-10-14): ONE fish, and ONE
// fish box that visibly holds TEN fish as a 2×5 ten-frame — the same shape as the deck's fish bay, so
// "a box is a full fish bay" reads without words. A box that does not LOOK like ten teaches nothing.
//
// The research behind the shape (docs/research …, 2026-10-14) sets three rules, kept here so a re-skin
// can't drift from them:
//   1. SIMPLE and IDENTICAL — one colour, one pose, no scales or patterns. Perceptual detail gets
//      counted instead of the unit (Kaminski & Sloutsky 2013; the LEGO-studs study).
//   2. ALL FACING THE SAME WAY, two rows of five, so ten is seen at a glance.
//   3. LIVELY, NEVER CAUGHT — an open eye and a smile; no hooks, nets or limp fish. We LOAD fish.
//
// Both are sized by the `--s` slot unit their bay sets, so one value scales the whole deck. This SVG is
// the art-free stand-in; the owner's Gemini renders replace it in W3 under the same three rules.

// The fish — single AND inside every box — IS the app's existing clay fish (the counting games'
// `fish.webp`): house style by construction, and the content reference for the owner's box renders.
const WOOD = '#C98B4B'
const WOOD_DARK = '#8A5527'

export const FishView: React.FC<{ size?: string }> = ({ size = 'calc(var(--s) * 0.92)' }) => (
  <Box
    aria-hidden
    component="img"
    src={fishArt}
    alt=""
    draggable={false}
    sx={{ width: size, height: size, objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
  />
)

/** `size` is the box's WIDTH; it is landscape (2 rows × 5), so its height follows from that. */
export const FishBoxView: React.FC<{ size?: string }> = ({ size = 'calc(var(--s) * 1.42)' }) => (
  <Box
    aria-hidden
    sx={{
      width: size,
      display: 'flex',
      alignItems: 'center',
      filter: 'drop-shadow(0 2px 3px rgba(60,30,10,0.35))',
    }}
  >
    {/* An open wooden box holding the app's OWN clay fish ×10, 2 rows × 5 (a ten-frame), all facing the
        same way. The box is landscape so the round clay fish get as much size as the slot allows. */}
    <Box
      sx={{
        width: '100%',
        aspectRatio: '1 / 0.66',
        borderRadius: '14%',
        background: `linear-gradient(180deg, #D9A066, ${WOOD})`,
        boxShadow: `inset 0 0 0 calc(${size} * 0.05) ${WOOD_DARK}`,
        p: `calc(${size} * 0.06) calc(${size} * 0.05)`,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '2%',
        alignItems: 'center',
        justifyItems: 'center',
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Box
          key={i}
          component="img"
          src={fishArt}
          alt=""
          draggable={false}
          // Slightly larger than its cell: the clay render has transparent margin around the ink.
          sx={{ width: '125%', maxWidth: 'none', height: 'auto', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
        />
      ))}
    </Box>
  </Box>
)
