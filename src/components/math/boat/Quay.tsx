import React from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import type { CargoKind } from './boatDeck'
import { BOX_ASPECT, FishBoxView, FishView } from './Cargo'
import jettyArt from '../../../assets/games/boat/jetty.webp'
import { deckItemWidth } from './boatLooks'

// The jetty (owner's Gemini render, batch I): a long wooden jetty coming in from the left edge of the
// screen — from the shore, off-picture — with two supply piles on its planks: a stack of fish boxes and a
// heap of single fish. NOTHING else stands on it (owner, 2026-10-15: the focus is the fish and the boxes —
// the mascot and the seagull were removed). Each pile RUNS DOWN as it is loaded and fills back up as cargo
// comes off the boat. A pile is the child's SOURCE: tap it to load one onto the next free slot, or drag its top unit onto the
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
/** Where the piles stand, as `bottom` (fraction of the jetty box from its bottom edge): mid-plank, well
 *  clear of the front edge (owner, 2026-10-15: the fish looked about to fall into the water). */
const STAND = { box: '65%', fish: '67%' }
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
const PILE_RIGHT = 0.08

const imgSx = { display: 'block', userSelect: 'none', pointerEvents: 'none' } as const

/** The price-tag colours — the harbour's own art palette (warm paper, the boxes' honey wood), one on every skin. */
const TAG = { paper: '#FFF6E2', edge: '#B7843F', ink: '#5B3A1A' } as const

/** Boxes stand in columns of up to five, each a half-box higher than the one below — crates stacked. */
const BOXES_PER_COLUMN = 5
const BOX_COLUMN_STEP = 1.04
const BOX_TIER_STEP = 0.5
/** The fish heap is a 4-3-2-1 pyramid — exactly ten, the most the jetty ever holds. */
const FISH_ROWS = [4, 3, 2, 1]
const FISH_STEP_X = 0.82
const FISH_STEP_Y = 0.4

/**
 * Where each unit of a pile sits, in fractions of the pile's box (all units share one width). Item 0 is
 * the bottom-left; the LAST shown item is the one the child takes, so the pile visibly runs down (owner,
 * 2026-10-15: "it keeps restacking"). The pile's box is sized for the level's full stock, so it never
 * jumps as it empties.
 */
const pileLayout = (kind: CargoKind, stock: number) => {
  if (kind === 'box') {
    const cols = Math.max(1, Math.ceil(stock / BOXES_PER_COLUMN))
    const rows = Math.min(Math.max(stock, 1), BOXES_PER_COLUMN)
    const h = 1 / BOX_ASPECT
    const W = (cols - 1) * BOX_COLUMN_STEP + 1
    const H = h + (rows - 1) * BOX_TIER_STEP * h
    return {
      W,
      H,
      at: (i: number) => ({
        left: (Math.floor(i / BOXES_PER_COLUMN) * BOX_COLUMN_STEP) / W,
        bottom: ((i % BOXES_PER_COLUMN) * BOX_TIER_STEP * h) / H,
      }),
    }
  }
  const W = (FISH_ROWS[0] - 1) * FISH_STEP_X + 1
  const H = 1 + (FISH_ROWS.length - 1) * FISH_STEP_Y
  const slots: { left: number; bottom: number }[] = []
  FISH_ROWS.forEach((n, r) => {
    for (let k = 0; k < n; k++) slots.push({ left: (r * FISH_STEP_X * 0.5 + k * FISH_STEP_X) / W, bottom: (r * FISH_STEP_Y) / H })
  })
  return { W, H, at: (i: number) => slots[i] }
}

const Pile: React.FC<{
  kind: CargoKind
  right: string
  /** How many are on the jetty now, and the most it holds for this level. */
  count: number
  stock: number
  boxCols: number
  interactive: boolean
  onLoad: (kind: CargoKind) => void
  refill: number
}> = ({ kind, right, count, stock, boxCols, interactive, onLoad, refill }) => {
  const isBox = kind === 'box'
  const L = pileLayout(kind, stock)
  const unitW = 1 / L.W
  const shown = Math.min(count, stock)
  const top = shown > 0 ? L.at(shown - 1) : null
  const pct = (f: number) => `${(f * 100).toFixed(3)}%`
  const Unit = isBox ? FishBoxView : FishView
  return (
    // One unit is drawn at its DECK size (`deckItemWidth` × the boat's width), so the box the child picks
    // up is the box that lands on the boat.
    <Box sx={{ position: 'absolute', right, bottom: STAND[kind], width: `calc(var(--bw) * ${(deckItemWidth(kind, boxCols) * L.W).toFixed(4)})`, aspectRatio: String(L.W / L.H) }}>
      {/* Contact shadow on the planks — the same grounding the deck cargo gets. */}
      <Box aria-hidden sx={{ position: 'absolute', left: '0%', right: '0%', bottom: 0, height: 'calc(var(--s) * 0.5)', transform: 'translateY(45%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(50,25,10,0.75), rgba(50,25,10,0) 70%)', pointerEvents: 'none' }} />
      {/* What is left on the jetty, minus the top unit (drawn by the draggable below). */}
      {Array.from({ length: Math.max(0, shown - 1) }, (_, i) => {
        const p = L.at(i)
        return (
          <Box key={i} aria-hidden sx={{ position: 'absolute', left: pct(p.left), bottom: pct(p.bottom), width: pct(unitW), pointerEvents: 'none' }}>
            <Unit />
          </Box>
        )
      })}
      {/* The pile's VALUE, as a little market price tag leaning on it: a box is worth 10, a fish 1 (owner,
          2026-10-15: "10 fish in a box" wasn't obvious). It names the unit, never the boat's number. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: isBox ? '-14%' : '-8%',
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
      {/* The WHOLE PILE is the grab area (owner, 2026-10-14: pressing the lower fish did nothing). The
          draggable is a transparent box over the entire pile, padded 10px past it; only the top unit is
          drawn inside it, so a drag carries that one unit away. An empty pile has nothing to take. */}
      <Box sx={{ position: 'absolute', inset: '-10px', zIndex: 1 }}>
        {/* A successful load REMOUNTS the top unit (`refill` is the key) so the dropped unit stays on the
            deck instead of gliding back. No fade: the next unit was already on view as part of the pile. */}
        <motion.div key={refill} initial={false} style={{ width: '100%', height: '100%' }}>
          <DraggableItem
            id={`src-${kind}`}
            inline
            fill
            disabled={!interactive || !top}
            data={{ kind, from: 'quay' }}
            lift={{ scale: 1.06, rotate: -3 }}
            onActivate={() => onLoad(kind)}
          >
            <Box data-boat-source={kind} sx={{ position: 'relative', width: '100%', height: '100%', cursor: interactive && top ? 'grab' : 'default' }}>
              {top && (
                <Box sx={{ position: 'absolute', left: `calc(10px + (100% - 20px) * ${top.left.toFixed(4)})`, bottom: `calc(10px + (100% - 20px) * ${top.bottom.toFixed(4)})`, width: `calc((100% - 20px) * ${unitW.toFixed(4)})` }}>
                  <Unit />
                </Box>
              )}
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
  /** On the jetty now, and the most each pile holds for this level. */
  counts: Record<CargoKind, number>
  stock: Record<CargoKind, number>
  /** The level's box columns on the deck, so a jetty box is the size of a deck box. */
  boxCols: number
}> = ({ interactive, overQuay, onLoad, refills, counts, stock, boxCols }) => {
  // Right to left from the bollard: the fish heap, then the box stack.
  const fishL = pileLayout('fish', stock.fish)
  const fishW = `calc(var(--bw) * ${(deckItemWidth('fish', boxCols) * fishL.W).toFixed(4)})`
  const fishRight = `${PILE_RIGHT * 100}%`
  const boxRight = `calc(${PILE_RIGHT * 100}% + ${fishW} + var(--s) * 0.45)`
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
              orientation — toward the boat's stern in landscape). */}
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
            <Pile kind="box" right={boxRight} count={counts.box} stock={stock.box} boxCols={boxCols} interactive={interactive} onLoad={onLoad} refill={refills.box} />
            <Pile kind="fish" right={fishRight} count={counts.fish} stock={stock.fish} boxCols={boxCols} interactive={interactive} onLoad={onLoad} refill={refills.fish} />
          </Box>
        </DroppableZone>
      </Box>
    </Box>
  )
}

export default Quay
