import React from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import type { CargoKind } from './boatDeck'
import { FishBoxView, FishView } from './Cargo'
import jettyArt from '../../../assets/games/boat/jetty.webp'
import boxStackArt from '../../../assets/games/boat/box-stack.webp'
import gullStandArt from '../../../assets/games/boat/gull-stand.webp'
import gullFlyArt from '../../../assets/games/boat/gull-fly.webp'
import { idleFloat } from '../../../theme/idleMotion'
import { BOAT_PER_QUAY, deckItemWidth } from './boatLooks'
import Mascot from '../../common/Mascot'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../../theme/phoneMedia'

// The jetty (owner's Gemini render, batch I): a long wooden jetty coming in from the left edge of the
// screen — from the shore, off-picture — with the mascot as harbour master, two endless supply piles on
// its planks (a stack of fish boxes and a little heap of fish) and a seagull on the bollard at its end.
// A pile is the child's SOURCE: tap it to load one onto the next free slot, or drag its top unit onto the
// deck. Both call the game's one `load(kind)` (Harbour PRD-01 §4.4). The jetty is also where a
// dragged-back item is unloaded.
//
// The render is wider than the quay column and bleeds off the left edge (`JETTY_SPAN`). Placement is a
// fraction of the jetty image's box (measured on jetty.webp, 966 × 298, after levelling it by
// `JETTY_LEVEL_DEG`): the plank surface runs ~y 0.2–0.45, the bollard stands at x ~0.87–0.95.

const JETTY_ASPECT = 966 / 298
/** The jetty image is this many quay-columns wide; most of the extra runs off the left edge of the screen. */
const JETTY_SPAN = 2
/** …and its bollard end reaches this far (in quay-columns) past the column, alongside the moored boat's
 *  stern — the quay column alone is too narrow for the harbour master and both piles. */
const JETTY_OVERHANG = 0.23
/** The render rises ~3° to the right; the image is counter-rotated so the planks read level. */
const JETTY_LEVEL_DEG = 3
/** Piles stand on the planks: their bottom edge sits this far up from the image's bottom. */
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
      {/* Contact shadow on the planks — the same grounding the deck cargo gets. */}
      <Box aria-hidden sx={{ position: 'absolute', left: '4%', right: '4%', bottom: 0, aspectRatio: '6', transform: 'translateY(45%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(50,25,10,0.4), rgba(50,25,10,0) 70%)', pointerEvents: 'none' }} />
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
  /** The level's box columns, so the top box matches a deck box. */
  boxCols: number
}> = ({ interactive, overQuay, onLoad, repeat, refills, reduce, gullAway, boxCols }) => {
  // Pile widths (fractions of the jetty image) at which the top unit is drawn at its DECK size: the top
  // box is 92% of its pile, the top fish 47%.
  const boxPile = (deckItemWidth('box', boxCols) * BOAT_PER_QUAY) / JETTY_SPAN / 0.92
  const fishPile = (deckItemWidth('fish', boxCols) * BOAT_PER_QUAY) / JETTY_SPAN / 0.47
  const pc = (f: number) => `${(f * 100).toFixed(1)}%`
  // Right to left from the bollard: fish heap, box stack, then the harbour master on the visible end.
  const fishLeft = 0.86 - fishPile
  const boxLeft = fishLeft - boxPile + 0.01
  const masterW = 0.2
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
            // Extends the drop area up over the piles, which stand above the jetty image.
            paddingTop: '40%',
            borderRadius: 24,
            background: overQuay ? 'radial-gradient(ellipse at center 60%, rgba(255,255,255,0.4), rgba(255,255,255,0) 70%)' : 'transparent',
            transition: 'background 0.2s ease',
          }}
        >
          <Box sx={{ position: 'relative', width: `${JETTY_SPAN * 100}%`, ml: `${(1 + JETTY_OVERHANG - JETTY_SPAN) * 100}%`, aspectRatio: String(JETTY_ASPECT) }}>
            <Box component="img" src={jettyArt} alt="" draggable={false} sx={{ ...imgSx, position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `rotate(${JETTY_LEVEL_DEG}deg)` }} />
            {/* The harbour master: the theme mascot stands at the back of the planks, grounded (no idle
                hover), and greets each boat. GameShell's corner companion is off here (FyldBaadenGame);
                mascotBus reactions still reach this one. */}
            <Mascot
              grounded
              sx={{
                position: 'absolute',
                left: pc(boxLeft - masterW + 0.05),
                bottom: '64%',
                width: pc(masterW),
                height: 'auto',
                aspectRatio: '1',
                zIndex: 0,
                [PHONE_LANDSCAPE]: { display: 'block' },
                [PHONE_PORTRAIT]: { width: pc(masterW), height: 'auto' },
              }}
            />
            {/* A seagull resting on the bollard — calm decor, it never asks for anything. On a correct
                send it takes off and flies away (the send-off); it is back on the next boat. */}
            <Box aria-hidden sx={{ position: 'absolute', left: '85.5%', width: '9%', bottom: '86%' }}>
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
            {/* Piles at DECK scale: a box on the stack and a fish in the heap are the size of the cargo
                they become on the boat, so the child sees the same thing move rather than a shrink. */}
            <Pile kind="box" left={pc(boxLeft)} width={pc(boxPile)} interactive={interactive} onLoad={onLoad} refill={refills.box} reduce={reduce} />
            <Pile kind="fish" left={pc(fishLeft)} width={pc(fishPile)} interactive={interactive} onLoad={onLoad} refill={refills.fish} reduce={reduce} />
          </Box>
        </DroppableZone>
      </Box>
    </Box>
  )
}

export default Quay
