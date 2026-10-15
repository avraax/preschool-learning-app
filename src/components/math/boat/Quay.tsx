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
import { deckItemWidth } from './boatLooks'
import Mascot from '../../common/Mascot'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../../theme/phoneMedia'

// The jetty (owner's Gemini render, batch I): a long wooden jetty coming in from the left edge of the
// screen — from the shore, off-picture — with the mascot as harbour master, two endless supply piles on
// its planks (a stack of fish boxes and a little heap of fish) and a seagull on the bollard at its end.
// A pile is the child's SOURCE: tap it to load one onto the next free slot, or drag its top unit onto the
// deck. Both call the game's one `load(kind)` (Harbour PRD-01 §4.4). The jetty is also where a
// dragged-back item is unloaded.
//
// The render is wider than the quay column and bleeds off the left edge. Everything on it is sized from
// the stage's slot unit (`--s`) and the boat's width (`--bw`), so a pile's top unit is the size of the
// same unit on the deck in BOTH orientations. Vertical placement is a fraction of the jetty image's box,
// measured on jetty.webp (966 × 298) after levelling it by `JETTY_LEVEL_DEG`: the planks run from y ~0.20
// (back edge) to ~0.45 (front edge), the bollard cap tops out at x ~0.93, y ~0.13, the posts end ~0.95.

const JETTY_ASPECT = 966 / 298
/** The jetty's width in slot units; most of what exceeds the column runs off the left edge. */
const JETTY_W = 11
/** The render rises ~3° to the right; the image is counter-rotated so the planks read level. */
const JETTY_LEVEL_DEG = 3
/** Where things stand, as `bottom` (fraction of the jetty box from its bottom edge): the harbour master
 *  at the back of the planks, the piles mid-plank — well clear of the front edge (owner, 2026-10-15: the
 *  fish looked about to fall into the water). */
const STAND = { master: '73%', box: '65%', fish: '67%' }
/** Where each post meets the water (centre x, waterline y, ripple width) — measured on the levelled
 *  jetty: the three front posts end ~0.9, the back-right one ~0.72. The mask fades everything below. */
const JETTY_POSTS = [
  { x: 0.115, y: 0.84, w: 0.075 },
  { x: 0.43, y: 0.84, w: 0.075 },
  { x: 0.725, y: 0.84, w: 0.075 },
  { x: 0.94, y: 0.7, w: 0.06 },
]
// The fade starts AT the waterline, so below the ring the post is under water.
const POST_FADE = 'linear-gradient(to bottom, #000 0%, #000 84%, transparent 93%)'
const RING_COLOUR = 'rgba(255,255,255,0.5)'
const RING_SX = (p: { x: number; y: number; w: number }) =>
  ({ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, aspectRatio: '4', transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '2px solid transparent', pointerEvents: 'none' }) as const
/** The piles' right edges, measured from the jetty's right end: clear of the bollard (x 0.90+). */
const PILE_RIGHT = 0.12

/** A pile's width such that its top unit is drawn at deck size (top box 92% of its pile, top fish 47%). */
const pileWidth = (kind: CargoKind, cols: number): string =>
  `calc(var(--bw) * ${(deckItemWidth(kind, cols) / (kind === 'box' ? 0.92 : 0.47)).toFixed(4)})`

const imgSx = { display: 'block', userSelect: 'none', pointerEvents: 'none' } as const

/** The price-tag colours — the harbour's own art palette (warm paper, the boxes' honey wood), one on every skin. */
const TAG = { paper: '#FFF6E2', edge: '#B7843F', ink: '#5B3A1A' } as const

const Pile: React.FC<{
  kind: CargoKind
  right: string
  width: string
  interactive: boolean
  onLoad: (kind: CargoKind) => void
  refill: number
  reduce: boolean
}> = ({ kind, right, width, interactive, onLoad, refill, reduce }) => {
  const isBox = kind === 'box'
  return (
    <Box sx={{ position: 'absolute', right, width, bottom: STAND[kind] }}>
      {/* Contact shadow on the planks — the same grounding the deck cargo gets. */}
      <Box aria-hidden sx={{ position: 'absolute', left: '0%', right: '0%', bottom: 0, aspectRatio: '5', transform: 'translateY(40%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(50,25,10,0.75), rgba(50,25,10,0) 70%)', pointerEvents: 'none' }} />
      {/* The pile's VALUE, as a little market price tag leaning on it: a box is worth 10, a fish 1 (owner,
          2026-10-15: "10 fish in a box" wasn't obvious). It names the unit, never the boat's number. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: isBox ? '-10%' : '-6%',
          bottom: '-6%',
          zIndex: 2,
          minWidth: 'calc(var(--s) * 0.8)',
          px: 'calc(var(--s) * 0.12)',
          py: 'calc(var(--s) * 0.04)',
          borderRadius: 'calc(var(--s) * 0.16)',
          background: TAG.paper,
          border: `calc(var(--s) * 0.05) solid ${TAG.edge}`,
          boxShadow: '0 2px 4px rgba(50,25,10,0.35)',
          transform: `rotate(${isBox ? -7 : 6}deg)`,
          fontFamily: '"Comic Sans MS", "Comic Neue", cursive',
          fontWeight: 800,
          fontSize: 'calc(var(--s) * 0.5)',
          lineHeight: 1.1,
          textAlign: 'center',
          color: TAG.ink,
          pointerEvents: 'none',
        }}
      >
        {isBox ? 10 : 1}
      </Box>
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
  refills: Record<CargoKind, number>
  reduce: boolean
  /** True from a correct send until the next boat — the gull has flown off. */
  gullAway: boolean
  /** The level's box columns, so the top box matches a deck box. */
  boxCols: number
}> = ({ interactive, overQuay, onLoad, refills, reduce, gullAway, boxCols }) => {
  // Right to left from the bollard: fish heap, box stack, then the harbour master behind them.
  const fishW = pileWidth('fish', boxCols)
  const boxW = pileWidth('box', boxCols)
  const fishRight = `${PILE_RIGHT * 100}%`
  const boxRight = `calc(${PILE_RIGHT * 100}% + ${fishW} + var(--s) * 0.25)`
  const masterW = 'calc(var(--s) * 1.9)'
  const masterRight = `calc(${PILE_RIGHT * 100}% + ${fishW} + ${boxW} + var(--s) * 0.35)`
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minHeight: 0 }}>
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
          {/* `--jetty-reach`: how far the bollard end reaches past the column (set by the game per
              orientation — alongside the boat's stern in landscape). */}
          <Box sx={{ position: 'relative', width: `calc(var(--s) * ${JETTY_W})`, ml: `calc(100% + var(--jetty-reach, 0px) - var(--s) * ${JETTY_W})`, aspectRatio: String(JETTY_ASPECT) }}>
            {/* The posts must GO INTO the water, not hover over it (owner, 2026-10-15): their lower ends
                fade out (a mask — the sea behind shows through, as if submerged) and a soft ripple rings
                each one at the waterline. Works over open water in portrait, where no wave band is near. */}
            {/* Each waterline ring is TWO arcs: the far half BEHIND the post, the near half in front — a
                flat ring drawn over the post read as a hoop floating in front of it (owner, 2026-10-15). */}
            {JETTY_POSTS.map((p) => (
              <Box key={`far-${p.x}`} aria-hidden sx={[RING_SX(p), { borderTopColor: RING_COLOUR }]} />
            ))}
            <Box component="img" src={jettyArt} alt="" draggable={false} sx={{ ...imgSx, position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `rotate(${JETTY_LEVEL_DEG}deg)`, WebkitMaskImage: POST_FADE, maskImage: POST_FADE }} />
            {JETTY_POSTS.map((p) => (
              <Box key={`near-${p.x}`} aria-hidden sx={[RING_SX(p), { borderBottomColor: RING_COLOUR }]} />
            ))}
            {/* The harbour master: the theme mascot stands at the back of the planks, grounded (no idle
                hover), and greets each boat. GameShell's corner companion is off here (FyldBaadenGame);
                mascotBus reactions still reach this one. */}
            <Mascot
              grounded
              sx={{
                position: 'absolute',
                left: 'auto',
                right: masterRight,
                bottom: STAND.master,
                width: masterW,
                height: 'auto',
                aspectRatio: '1',
                zIndex: 0,
                [PHONE_LANDSCAPE]: { display: 'block' },
                [PHONE_PORTRAIT]: { width: masterW, height: 'auto' },
              }}
            />
            {/* A seagull standing still on the bollard cap (x ~0.93, top y ~0.13) — calm decor, it never
                asks for anything. On a correct send it takes off and flies away (the send-off); it is back
                on the next boat. */}
            <Box aria-hidden sx={{ position: 'absolute', left: '93%', width: 'calc(var(--s) * 0.95)', bottom: '86%', transform: 'translateX(-50%)' }}>
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
                  <Box component="img" src={gullStandArt} alt="" draggable={false} sx={{ ...imgSx, width: '100%', height: 'auto' }} />
                </motion.div>
              ) : null}
            </Box>
            {/* Piles at DECK scale: a box on the stack and a fish in the heap are the size of the cargo
                they become on the boat, so the child sees the same thing move rather than a shrink. */}
            <Pile kind="box" right={boxRight} width={boxW} interactive={interactive} onLoad={onLoad} refill={refills.box} reduce={reduce} />
            <Pile kind="fish" right={fishRight} width={fishW} interactive={interactive} onLoad={onLoad} refill={refills.fish} reduce={reduce} />
          </Box>
        </DroppableZone>
      </Box>
    </Box>
  )
}

export default Quay
