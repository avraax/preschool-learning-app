import React from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import type { CargoKind } from './boatDeck'
import { FishBoxView, FishView } from './Cargo'
import quayArt from '../../../assets/games/boat/quay.webp'
import boxStackArt from '../../../assets/games/boat/box-stack.webp'
import gullStandArt from '../../../assets/games/boat/gull-stand.webp'
import gullFlyArt from '../../../assets/games/boat/gull-fly.webp'
import { idleFloat } from '../../../theme/idleMotion'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../../theme/phoneMedia'
import Mascot from '../../common/Mascot'

// The quay (owner's Gemini render): two endless supply piles standing on its planks — a stack of fish
// boxes and a little heap of fish — and a seagull on the bollard. A pile is the child's SOURCE: tap it to
// load one onto the next free slot, or drag its top unit onto the deck. Both call the game's one
// `load(kind)` (Harbour PRD-01 §4.4). The quay is also where a dragged-back item is unloaded.
//
// Placement is a fraction of the quay image's box (measured on quay.webp, 850 × 527): the plank top runs
// at ~38% from the top, the bollard sits at the right end.

const QUAY_ASPECT = 850 / 527
/** Piles stand on the plank top: their bottom edge sits this far up from the image's bottom. */
const PLANK_TOP_FROM_BOTTOM = '60%'

const imgSx = { display: 'block', userSelect: 'none', pointerEvents: 'none' } as const

const Pile: React.FC<{
  kind: CargoKind
  left: string
  width: string
  interactive: boolean
  onLoad: (kind: CargoKind) => void
  refill: number
  reduce: boolean
}> = ({ kind, left, width, interactive, onLoad, refill, reduce }) => {
  const isBox = kind === 'box'
  return (
    <Box sx={{ position: 'absolute', left, width, bottom: PLANK_TOP_FROM_BOTTOM }}>
      {/* The pile itself — static, it never runs out. */}
      {isBox ? (
        <Box component="img" src={boxStackArt} alt="" draggable={false} sx={{ ...imgSx, width: '100%', height: 'auto' }} />
      ) : (
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', pt: '24%' }}>
          <Box sx={{ width: '47%', mr: '-3%' }}><FishView /></Box>
          <Box sx={{ width: '47%', ml: '-3%' }}><FishView /></Box>
        </Box>
      )}
      {/* The WHOLE PILE is the grab area (owner, 2026-10-14: pressing the lower fish did nothing). The
          draggable is a transparent box over the entire pile, padded past it; only the top unit is drawn
          inside it, so a drag carries that one unit away while the pile stays put. */}
      <Box sx={{ position: 'absolute', inset: '-10px', zIndex: 1 }}>
        {/* A successful load REMOUNTS the top unit (`refill` is the key) so the dropped unit stays on the
            deck and a fresh one appears — instead of gliding back. OPACITY only: a scale/translate on an
            ancestor of a draggable multiplies its drag offset (drag-and-drop.md). */}
        <motion.div key={refill} initial={reduce || refill === 0 ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }} style={{ width: '100%', height: '100%' }}>
          <DraggableItem
            id={`src-${kind}`}
            inline
            fill
            disabled={!interactive}
            data={{ kind, from: 'quay' }}
            lift={{ scale: 1.06, rotate: -3 }}
            onActivate={() => onLoad(kind)}
          >
            <Box data-boat-source={kind} sx={{ position: 'relative', width: '100%', height: '100%', cursor: interactive ? 'grab' : 'default' }}>
              {/* The top unit: a box resting on the stack / a fish on top of the heap. This box is padded
                  10px past the pile on every side, so sizes are taken from the PILE's width (100% − 20px) —
                  the same size as the units below it, which match the cargo on the deck. */}
              <Box sx={{ position: 'absolute', left: '50%', top: '10px', width: isBox ? 'calc((100% - 20px) * 0.92)' : 'calc((100% - 20px) * 0.47)', transform: isBox ? 'translate(-50%, -34%)' : 'translate(-50%, 0%)' }}>
                {isBox ? <FishBoxView /> : <FishView />}
              </Box>
            </Box>
          </DraggableItem>
        </motion.div>
      </Box>
    </Box>
  )
}

const Quay: React.FC<{
  interactive: boolean
  overQuay: boolean
  onLoad: (kind: CargoKind) => void
  repeat: React.ReactNode
  refills: Record<CargoKind, number>
  reduce: boolean
  /** True from a correct send until the next boat — the gull has flown off. */
  gullAway: boolean
}> = ({ interactive, overQuay, onLoad, repeat, refills, reduce, gullAway }) => {
  const gullBob = idleFloat(reduce, { distance: 3, durationS: 2.8 })
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 0 }}>
      <Box sx={{ pt: 1 }}>{repeat}</Box>
      <Box sx={{ width: '100%' }}>
        <DroppableZone
          id="quay"
          style={{
            position: 'relative',
            width: '100%',
            // Extends the drop area up over the piles, which stand above the quay image.
            paddingTop: '46%',
            borderRadius: 24,
            background: overQuay ? 'radial-gradient(ellipse at center 60%, rgba(255,255,255,0.4), rgba(255,255,255,0) 70%)' : 'transparent',
            transition: 'background 0.2s ease',
          }}
        >
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: String(QUAY_ASPECT) }}>
            <Box component="img" src={quayArt} alt="" draggable={false} sx={{ ...imgSx, position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {/* A seagull resting on the bollard — calm decor, it never asks for anything. On a correct
                send it takes off and flies away (the send-off); it is back on the next boat. */}
            <Box aria-hidden sx={{ position: 'absolute', left: '77%', width: '15%', bottom: '74%' }}>
              {gullAway && !reduce ? (
                <motion.div
                  initial={{ transform: 'translate(0%, 0%) scale(1)', opacity: 1 }}
                  animate={{ transform: ['translate(0%, 0%) scale(1)', 'translate(60%, -120%) scale(1.1)', 'translate(260%, -420%) scale(0.8)'], opacity: [1, 1, 0] }}
                  transition={{ duration: 1.7, ease: 'easeIn', times: [0, 0.3, 1] }}
                  style={{ width: '130%' }}
                >
                  <Box component="img" src={gullFlyArt} alt="" draggable={false} sx={{ ...imgSx, width: '100%', height: 'auto' }} />
                </motion.div>
              ) : !gullAway ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                  <Box {...gullBob.props} sx={[{ width: '100%' }, gullBob.sx]}>
                    <Box component="img" src={gullStandArt} alt="" draggable={false} sx={{ ...imgSx, width: '100%', height: 'auto' }} />
                  </Box>
                </motion.div>
              ) : null}
            </Box>
            {/* The mascot stands on the planks at the left end, beside the cargo — GameShell's corner
                companion would stand in the sea here (owner, 2026-10-14), so the game turns it off and
                seats its own. mascotBus reactions still reach it. */}
            <Mascot
              sx={{
                position: 'absolute',
                left: '-4%',
                bottom: PLANK_TOP_FROM_BOTTOM,
                width: '26%',
                height: 'auto',
                aspectRatio: '1',
                zIndex: 1,
                [PHONE_LANDSCAPE]: { display: 'block' },
                [PHONE_PORTRAIT]: { width: '26%', height: 'auto' },
              }}
            />
            {/* Piles at DECK scale: a box on the stack and a fish in the heap are the size of the cargo
                they become on the boat, so the child sees the same thing move rather than a shrink. */}
            <Pile kind="box" left="22%" width="22%" interactive={interactive} onLoad={onLoad} refill={refills.box} reduce={reduce} />
            <Pile kind="fish" left="45%" width="34%" interactive={interactive} onLoad={onLoad} refill={refills.fish} reduce={reduce} />
          </Box>
        </DroppableZone>
      </Box>
    </Box>
  )
}

export default Quay
