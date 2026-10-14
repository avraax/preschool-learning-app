import React from 'react'
import { Box } from '@mui/material'
import fishArt from '../../../assets/games/math/fish.webp'
import boxArt from '../../../assets/games/boat/box.webp'

// Fyld Båden's two learning objects (Harbour PRD-01 §2.1, fish decision 2026-10-14): ONE fish, and ONE
// fish box that visibly holds TEN of that same fish (5 + 5).
//
// The fish is the app's existing clay fish (the counting games' `fish.webp`) and the box is the owner's
// Gemini render made WITH that fish as its reference (validated 2026-10-14: exactly 5 + 5, all facing
// right). The research rules they were chosen under: simple and identical, all facing the same way,
// lively — never caught.

/** Box render aspect (width / height), measured on `box.webp` (512 × 411). */
export const BOX_ASPECT = 512 / 411

const imgSx = { display: 'block', userSelect: 'none', pointerEvents: 'none', objectFit: 'contain' } as const

/** One fish. `size` is its width. */
export const FishView: React.FC<{ size?: string }> = ({ size = '100%' }) => (
  <Box aria-hidden component="img" src={fishArt} alt="" draggable={false} sx={{ ...imgSx, width: size, height: 'auto' }} />
)

/** One box of ten fish. `size` is its width; the height follows the render's aspect. */
export const FishBoxView: React.FC<{ size?: string }> = ({ size = '100%' }) => (
  <Box aria-hidden component="img" src={boxArt} alt="" draggable={false} sx={{ ...imgSx, width: size, height: 'auto' }} />
)
