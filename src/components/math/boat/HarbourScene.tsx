import React from 'react'
import { Box } from '@mui/material'
import { idleDrift } from '../../../theme/idleMotion'

// Fyld Båden's own full-bleed harbour (Harbour PRD-01 §2.2.11) — the first game to paint its own scene
// instead of the blurred world. ONE harbour on every skin, like all game art.
//
// Two pieces, because the boat must sit IN the water rather than on top of it:
//   - `HarbourBackdrop` (z -1, behind everything): sky, the distant town, the open water.
//   - `HarbourFrontWater` (above the boat, pointer-events none): a low wave band that covers the hull's
//     waterline and the quay's posts.
// Both are `position: absolute` against GameShell's full-viewport, isolated root (the same trick
// `GameMotif` uses) — NOT `fixed`: Chrome blanks fixed layers during touch pans (PersistentWorld's note).
//
// Continuous motion is CSS keyframes only (`idleDrift`), transform-only, and nothing moves under reduced
// motion. The CSS drawing is the art-free stand-in; the owner's backdrop + wave renders replace it (W3).

const SKY_TOP = '#9ED8F5'
const SKY_LOW = '#E4F5FD'
const SEA_FAR = '#4FB3C8'
const SEA_NEAR = '#2E8FA8'
const SEA_DEEP = '#1F6F88'

/** Height of the near-water band, as a share of the viewport — the boat's waterline sits inside it. */
export const NEAR_WATER_DVH = 30

// A soft clay wave crest, tiled horizontally. Wider than the viewport by the drift distance, so the
// ping-pong drift never shows an edge.
const waveSvg = (fill: string, crest: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='40' viewBox='0 0 160 40'>` +
      `<path d='M0 18 Q20 6 40 18 T80 18 T120 18 T160 18 V40 H0Z' fill='${fill}'/>` +
      `<path d='M0 18 Q20 6 40 18 T80 18 T120 18 T160 18' fill='none' stroke='${crest}' stroke-width='4' stroke-linecap='round'/>` +
      `</svg>`,
  )}")`

// A row of gabled houses for the far shore — fixed shapes, not a percentage layout against content.
const HOUSES = ['#F2C14E', '#E86A5B', '#F7E3B5', '#D9894C', '#FFFFFF', '#E86A5B', '#F2C14E', '#B9D7EA']

export const HarbourBackdrop: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  const farDrift = idleDrift(reduce, { distance: 18, durationS: 9 })
  return (
    <Box
      aria-hidden
      sx={{
        // The horizon: half-way in landscape; high in portrait, where the quay is a pier above the boat
        // and must stand in the water rather than in the sky.
        '--horizon': '52%',
        '@media (orientation: portrait)': { '--horizon': '24%' },
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_LOW} var(--horizon), ${SEA_FAR} var(--horizon), ${SEA_NEAR} 100%)`,
      }}
    >
      {/* Far shore: a small town on the horizon. */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, top: 'calc(var(--horizon) - 5.5vh)', height: '5.5vh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.6vw', opacity: 0.9 }}>
        {HOUSES.map((c, i) => (
          <Box
            key={i}
            sx={{
              width: `${3.2 + (i % 3) * 0.8}vw`,
              height: `${3.2 + ((i * 7) % 4) * 0.5}vh`,
              background: c,
              clipPath: 'polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%)',
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.08)',
            }}
          />
        ))}
      </Box>
      {/* Far water: a gentle drifting crest line at the horizon. */}
      <Box sx={{ position: 'absolute', left: 0, right: '-40px', top: 'calc(var(--horizon) - 6px)', height: '22px' }}>
        <Box {...farDrift.props} sx={[{ width: '100%', height: '100%', backgroundImage: waveSvg(SEA_FAR, '#BFE9F2'), backgroundSize: '120px 22px', backgroundRepeat: 'repeat-x', opacity: 0.8 }, farDrift.sx]} />
      </Box>
      {/* Near water band, behind the boat. */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${NEAR_WATER_DVH}dvh`, background: `linear-gradient(180deg, ${SEA_NEAR}, ${SEA_DEEP})` }} />
    </Box>
  )
}

export const HarbourFrontWater: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  const back = idleDrift(reduce, { distance: 40, durationS: 6.5 })
  const front = idleDrift(reduce, { distance: 56, durationS: 5, delayS: -2 })
  return (
    <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '9dvh', zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', left: 0, right: '-60px', top: 0, height: '60%' }}>
        <Box {...back.props} sx={[{ width: '100%', height: '100%', backgroundImage: waveSvg(SEA_NEAR, '#9FDCEA'), backgroundSize: '160px 100%', backgroundRepeat: 'repeat-x', opacity: 0.9 }, back.sx]} />
      </Box>
      <Box sx={{ position: 'absolute', left: '-30px', right: '-60px', bottom: 0, height: '70%' }}>
        <Box {...front.props} sx={[{ width: '100%', height: '100%', backgroundImage: waveSvg(SEA_DEEP, '#CFEFF6'), backgroundSize: '200px 100%', backgroundRepeat: 'repeat-x' }, front.sx]} />
      </Box>
    </Box>
  )
}
