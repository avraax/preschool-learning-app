import React from 'react'
import { Box } from '@mui/material'
import { idleDrift } from '../../../theme/idleMotion'
import backdropArt from '../../../assets/games/boat/backdrop.webp'
import waveNearArt from '../../../assets/games/boat/wave-near.webp'

// Fyld Båden's own full-bleed harbour (Harbour PRD-01 §2.2.11) — the first game to paint its own scene
// instead of the blurred world. ONE harbour on every skin, like all game art. Owner's Gemini renders.
//
// Two pieces, because the boat must sit IN the water rather than on top of it:
//   - `HarbourBackdrop` (z -1, behind everything): the painted harbour — sky, town, lighthouse, open sea.
//   - `HarbourFrontWater` (above the boat, pointer-events none): one clay wave band drifting across the
//     bottom, covering the hull's waterline and the quay's feet.
// Both are `position: absolute` against GameShell's full-viewport, isolated root (the same trick
// `GameMotif` uses) — NOT `fixed`: Chrome blanks fixed layers during touch pans (PersistentWorld's note).
//
// Continuous motion is CSS keyframes only (`idleDrift`), transform-only, nothing moves under reduced
// motion. The wave band is background-repeated and drifts less than one tile, so no seam ever shows.

/** Height of the near-water zone the boat's waterline sits in (kept for layout callers). */
export const NEAR_WATER_DVH = 30

export const HarbourBackdrop: React.FC<{ reduce: boolean }> = () => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      overflow: 'hidden',
      pointerEvents: 'none',
      backgroundColor: '#3E8FA6',
      backgroundImage: `url(${backdropArt})`,
      backgroundRepeat: 'no-repeat',
      // Landscape: cover the screen, keeping the horizon roughly mid-height.
      backgroundSize: 'cover',
      backgroundPosition: 'center 40%',
      // Portrait: the quay is a pier ABOVE the boat and must stand in the water, so the picture is
      // enlarged and anchored to the bottom — the horizon rides up near the top of the screen.
      '@media (orientation: portrait)': {
        backgroundSize: 'auto 170%',
        backgroundPosition: 'center bottom',
      },
    }}
  />
)

// The wave render is made PERIODIC in the art pipeline (`makePeriodicX`: cut at whole crest periods and
// blended one period over), so the band repeats at its NATURAL proportions. Stretching one render across the screen squashed it
// to a third of its height (owner: "stretched and distorted"); repeating the raw render showed seams.
const band = (src: string) => ({
  backgroundImage: `url(${src})`,
  backgroundRepeat: 'repeat-x',
  backgroundSize: 'auto 100%',
  backgroundPosition: 'left bottom',
})

// ONE wave band. There used to be a pale far band behind it; it showed through between the near crests
// and, with the blend ghosting of the time, read as "double vision" (owner, 2026-10-14). The open water
// of the backdrop already does the far sea's job.
export const HarbourFrontWater: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  const front = idleDrift(reduce, { distance: 56, durationS: 5.5 })
  return (
    <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '7dvh', zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', left: '-40px', right: '-80px', bottom: 0, height: '100%' }}>
        <Box {...front.props} sx={[{ width: '100%', height: '100%', ...band(waveNearArt) }, front.sx]} />
      </Box>
    </Box>
  )
}
