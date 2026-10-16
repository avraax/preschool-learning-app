import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import { hintPulse } from '../../../theme/idleMotion'
import { BAY_SLOTS, type CargoKind, type DeckState } from './boatDeck'
import { BOX_ASPECT, FishBoxView, FishView } from './Cargo'
import { BOAT_ASPECT, BOAT_GEOMETRY as G, BOAT_LOOKS, BOX_DRAW } from './boatLooks'
import hornArt from '../../../assets/games/boat/horn.webp'
import puffArt from '../../../assets/games/boat/puff.webp'
import splashArt from '../../../assets/games/boat/splash.webp'

// The boat (Harbour PRD-01): the owner's fishing-boat render with the cargo standing ON its deck between
// the mast and the bow — single fish as a 2 × 5 ten-frame in front, boxes of ten in a row of five behind
// (stacked two high past five). The numeral is painted on the blank sail only after a correct send.
//
// Every position is a fraction of the boat image's box (`BOAT_GEOMETRY`, measured on the art), so the
// cargo stays on the deck at every size. The deck is ONE droppable; each loaded item is a draggable whose
// tap UNLOADS it. The resolve functions live in the game — this only renders.
//
// Motion: transform/opacity strings with cubic-bezier easing only (gpuMotion.test.ts) — GPU-composited in
// Safari 17, where framer shorthands run on the main thread and springs become uncomposited `linear()`.

/** Static counter-rotation that levels the batch-G boat renders (see the image below). */
const BOAT_LEVEL_DEG = -1.8

/** Landing overshoot as a cubic-bezier (the curve `draggableStyle` uses for its lift). */
const LAND_EASE = [0.34, 1.56, 0.64, 1] as const

export interface BundleFx {
  key: number
  /** The box slot the ten fish were packed into. */
  box: number
}

interface BoatProps {
  look: number
  deck: DeckState
  /** The never-fail hint: exactly the target load, shown as faint silhouettes in the slots (§2.1.7). */
  ghost: DeckState | null
  /** The numeral on the sail — null until a correct send (or in no-sound degraded mode). */
  sailNumber: number | null
  bundle: BundleFx | null
  interactive: boolean
  reduce: boolean
  overDeck: boolean
  onUnload: (kind: CargoKind) => void
  /** Wrong-send nudge: increments to replay a short shake. */
  shakeKey: number
  /** The boat is setting off — a bow splash plays once. */
  departing: boolean
  /** A correct send: the horn blows (the sound plays in the game) — it swells and sends out rings. */
  tooting: boolean
  /** The green ✓, seated centred right above the horn (owner, 2026-10-15). */
  sendSlot?: React.ReactNode
  /** The horn was tapped: play its sound. */
  onHorn: () => void
  /** Something is being dragged — the deck shows where the slots are. */
  dragging: boolean
  /** Box columns for the level (`boxColumns`). */
  boxCols: number
}

// ── Slot geometry (fractions of the boat box) ────────────────────────────────────────────────────────
// Fish: a 2 × 5 ten-frame. Boxes: `cols` columns, stacking up a tier per `cols` boxes.
const FISH_COLS = 5
const slotW = (kind: CargoKind, cols: number): number =>
  kind === 'fish' ? (G.rows.fishRight - G.rows.fishLeft) / FISH_COLS : (G.rows.boxRight - G.rows.boxLeft) / cols
const slotLeft = (kind: CargoKind, i: number, cols: number): number =>
  kind === 'fish' ? G.rows.fishLeft + (i % FISH_COLS) * slotW('fish', cols) : G.rows.boxLeft + (i % cols) * slotW('box', cols)
/** A slot's height as a fraction of the boat box's height (items are drawn by width). */
const slotH = (kind: CargoKind, cols: number): number =>
  (kind === 'box' ? (slotW('box', cols) * BOX_DRAW) / BOX_ASPECT : slotW('fish', cols)) * BOAT_ASPECT
/** Slot centre line: fish 0–4 back row, 5–9 front row; a box tier sits 80% of a box higher. */
const slotY = (kind: CargoKind, i: number, cols: number): number => {
  if (kind === 'fish') return i < FISH_COLS ? G.rows.fishBack : G.rows.fishFront
  const h = slotH('box', cols)
  return G.rows.boxBase - h / 2 - Math.floor(i / cols) * h * 0.8
}
const pct = (f: number): string => `${(f * 100).toFixed(3)}%`

const Slot: React.FC<{
  kind: CargoKind
  i: number
  cols: number
  children?: React.ReactNode
}> = ({ kind, i, cols, children }) => (
  <Box
    sx={{
      position: 'absolute',
      left: pct(slotLeft(kind, i, cols)),
      top: pct(slotY(kind, i, cols) - slotH(kind, cols) / 2),
      width: pct(slotW(kind, cols)),
      height: pct(slotH(kind, cols)),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </Box>
)

// A box is drawn a little wider than its slot (boxes nest edge to edge like a real deck load); a fish
// keeps its slot so the ten-frame stays countable.
const Cargo: React.FC<{ kind: CargoKind }> = ({ kind }) =>
  kind === 'box' ? (
    <Box sx={{ width: `${BOX_DRAW * 100}%`, ml: `${(BOX_DRAW - 1) * -50}%`, flex: '0 0 auto' }}>
      <FishBoxView />
    </Box>
  ) : (
    <FishView />
  )

const Row: React.FC<{
  kind: CargoKind
  count: number
  ghostCount: number | null
  bundle: BundleFx | null
  interactive: boolean
  reduce: boolean
  onUnload: (kind: CargoKind) => void
  showSlots: boolean
  cols: number
}> = ({ kind, count, ghostCount, bundle, interactive, reduce, onUnload, showSlots, cols }) => {
  const pulse = hintPulse(reduce)
  return (
    <>
      {Array.from({ length: BAY_SLOTS }, (_, i) => {
        const filled = i < count
        const ghosted = ghostCount !== null && i < ghostCount && !filled
        const extra = ghostCount !== null && filled && i >= ghostCount
        const isNewBox = kind === 'box' && bundle !== null && bundle.box === i
        return (
          <Slot key={i} kind={kind} i={i} cols={cols}>
            {/* Where this slot is — shown only while something is being dragged (as resting marks they read
                as stains on the deck, owner 2026-10-14). The ten-frame's two rows of five carry the structure the rest of the time. */}
            {showSlots && (
              <Box aria-hidden sx={{ position: 'absolute', left: '8%', right: '8%', bottom: '-6%', height: '22%', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', boxShadow: '0 0 6px rgba(255,255,255,0.6)' }} />
            )}
            {ghosted && (
              // The hint: a faint silhouette of exactly what goes here, breathing.
              <Box {...pulse.props} sx={[{ position: 'absolute', inset: 0, opacity: 0.45, filter: 'grayscale(0.4) brightness(1.4)', display: 'flex', alignItems: 'center' }, pulse.sx]}>
                <Cargo kind={kind} />
              </Box>
            )}
            {filled && (
              // Mounts once per fill; `initial` is read only at mount, so clearing the bundle never replays it.
              <motion.div
                // Both ends carry the SAME function list: Motion interpolates toward `'none'` by zeroing
                // every function, so `scale(0.7) → none` landed on scale(0) and every item vanished.
                initial={reduce ? false : { transform: isNewBox ? 'translateY(0px) scale(0)' : 'translateY(-40%) scale(0.7)', opacity: 0 }}
                animate={{ transform: 'translateY(0px) scale(1)', opacity: 1 }}
                transition={{ duration: isNewBox ? 0.34 : 0.24, ease: LAND_EASE, delay: isNewBox ? 0.38 : 0 }}
                style={{ position: 'absolute', inset: 0 }}
              >
                {/* A soft contact shadow on the deck, so the item STANDS there instead of floating (owner,
                    2026-10-14). Static paint, outside the draggable: a lifted item leaves its shadow behind
                    only for the drag, and nothing animates it. Seated at the ink's bottom edge (fish ink ends
                    at 88% of its square canvas; a box fills its slot's height). */}
                <Box aria-hidden sx={{ position: 'absolute', left: kind === 'box' ? '-2%' : '12%', right: kind === 'box' ? '-2%' : '12%', bottom: kind === 'box' ? '-9%' : '4%', height: kind === 'box' ? '20%' : '16%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(70,35,10,0.5), rgba(70,35,10,0) 70%)', pointerEvents: 'none' }} />
                <Box {...(extra ? pulse.props : {})} sx={[{ width: '100%', height: '100%' }, extra ? pulse.sx : {}]}>
                  <DraggableItem
                    id={`deck-${kind}-${i}`}
                    inline
                    fill
                    disabled={!interactive}
                    data={{ kind, from: 'deck' }}
                    lift={{ scale: 1.15, rotate: 4 }}
                    onActivate={() => onUnload(kind)}
                  >
                    {/* A hit area a little larger than the art, cancelled so nothing moves. */}
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', cursor: interactive ? 'grab' : 'default', p: '6px', m: '-6px', boxSizing: 'content-box' }}>
                      <Cargo kind={kind} />
                    </Box>
                  </DraggableItem>
                </Box>
              </motion.div>
            )}
          </Slot>
        )
      })}
    </>
  )
}

/** The packing show: the ten fish fly up into the new box's slot and vanish as it pops in with a puff. */
const PackingShow: React.FC<{ bundle: BundleFx; cols: number }> = ({ bundle, cols }) => {
  // Centre to centre: the slots of the two kinds now differ in width.
  const fw = slotW('fish', cols)
  const toX = slotLeft('box', bundle.box, cols) + slotW('box', cols) / 2 - fw / 2
  const toY = slotY('box', bundle.box, cols)
  return (
    <>
      {Array.from({ length: BAY_SLOTS }, (_, i) => {
        // translate() percentages are relative to the fish's own box (one fish slot wide, square).
        const dxPct = ((toX - slotLeft('fish', i, cols)) / fw) * 100
        const dyPct = ((toY - slotY('fish', i, cols)) / (fw * BOAT_ASPECT)) * 100
        return (
          <Slot key={`${bundle.key}-${i}`} kind="fish" i={i} cols={cols}>
            <motion.div
              initial={{ transform: 'translate(0%, 0%) scale(1)', opacity: 1 }}
              animate={{
                transform: ['translate(0%, 0%) scale(1)', 'translate(0%, -25%) scale(1.1)', `translate(${dxPct.toFixed(1)}%, ${dyPct.toFixed(1)}%) scale(0.3)`],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.55, delay: i * 0.02, ease: 'easeIn', times: [0, 0.3, 1] }}
              style={{ width: '100%', pointerEvents: 'none' }}
            >
              <FishView />
            </motion.div>
          </Slot>
        )
      })}
      <Slot key={`puff-${bundle.key}`} kind="box" i={bundle.box} cols={cols}>
        <motion.div
          initial={{ transform: 'scale(0.4)', opacity: 0 }}
          animate={{ transform: ['scale(0.4)', 'scale(1.6)', 'scale(2)'], opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.7, delay: 0.32, ease: 'easeOut', times: [0, 0.4, 1] }}
          style={{ width: '120%', pointerEvents: 'none' }}
        >
          <Box component="img" src={puffArt} alt="" sx={{ width: '100%', display: 'block' }} />
        </motion.div>
      </Slot>
    </>
  )
}

const Boat: React.FC<BoatProps> = ({
  look,
  deck,
  ghost,
  sailNumber,
  bundle,
  interactive,
  reduce,
  overDeck,
  onUnload,
  shakeKey,
  departing,
  tooting,
  sendSlot,
  dragging,
  boxCols,
  onHorn,
}) => {
  const L = BOAT_LOOKS[look % BOAT_LOOKS.length]
  // Every blast — a tap, or the correct send (`tooting` turning on) — bumps one counter, and the counter
  // keys the animation, so each blast plays once (React's adjust-state-on-prop-change pattern).
  const [blows, setBlows] = useState(0)
  const [wasTooting, setWasTooting] = useState(tooting)
  if (tooting !== wasTooting) {
    setWasTooting(tooting)
    if (tooting) setBlows((b) => b + 1)
  }
  const blowing = blows > 0
  const blowKey = blows
  return (
    <motion.div
      key={shakeKey}
      animate={
        shakeKey > 0 && !reduce
          ? { transform: ['translateX(0px)', 'translateX(-14px)', 'translateX(10px)', 'translateX(-6px)', 'translateX(0px)'] }
          : { transform: 'translateX(0px)' }
      }
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      // `--bw` is the boat's width; every size inside derives from it.
      style={{ position: 'relative', width: 'var(--bw)', aspectRatio: String(BOAT_ASPECT) }}
    >
      {/* The render leans ~2° nose-down (keel measured 0.971 → 0.996 of its height from x 0.3 → 0.7), which
          with a tall wheelhouse read as "about to tip over" (owner). Only the IMAGE is counter-rotated —
          rotating the container would bend every drag offset of the cargo inside it. */}
      <Box component="img" src={L.art} alt="" draggable={false} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none', transform: `rotate(${BOAT_LEVEL_DEG}deg)`, transformOrigin: '50% 80%' }} />

      {/* The sail — blank until a correct send paints the number on it (the reveal IS the lesson). */}
      <Box sx={{ position: 'absolute', left: pct(G.sail.left), top: pct(G.sail.top), width: pct(G.sail.width), height: pct(G.sail.height), display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {sailNumber !== null && (
          <motion.div
            initial={reduce ? false : { transform: 'scale(0.3) rotate(-12deg)', opacity: 0 }}
            animate={{ transform: 'scale(1) rotate(0deg)', opacity: 1 }}
            transition={{ duration: 0.4, ease: LAND_EASE }}
          >
            <Typography component="span" sx={{ fontFamily: '"Comic Sans MS", "Comic Neue", cursive', fontWeight: 800, fontSize: 'calc(var(--bw) * 0.062)', lineHeight: 1, whiteSpace: 'nowrap', color: L.ink, textShadow: '0 2px 0 rgba(255,255,255,0.6)' }}>
              {sailNumber}
            </Typography>
          </motion.div>
        )}
      </Box>

      {/* The deck — ONE drop target, with the two cargo rows standing on it. */}
      <Box sx={{ position: 'absolute', left: pct(G.deck.left), top: pct(G.deck.top), width: pct(G.deck.width), height: pct(G.deck.height) }}>
        <DroppableZone
          id="deck"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: overDeck ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)' : 'transparent',
            transition: 'background 0.2s ease',
          }}
        />
      </Box>
      <Row kind="box" count={deck.boxes} ghostCount={ghost ? ghost.boxes : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} showSlots={dragging} cols={boxCols} />
      <Row kind="fish" count={deck.fish} ghostCount={ghost ? ghost.fish : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} showSlots={dragging} cols={boxCols} />
      {bundle && !reduce && <PackingShow bundle={bundle} cols={boxCols} />}

      {/* The send-off: a wake splash at the STERN as the boat sets off (a delight AFTER the answer, never
          during it). At the bow it was already off-screen — the boat leaves to the right. */}
      {departing && !reduce && (
        <Box sx={{ position: 'absolute', left: '-12%', top: '52%', width: '28%', pointerEvents: 'none' }}>
          <motion.div
            initial={{ transform: 'translateY(20%) scale(0.3)', opacity: 0 }}
            animate={{ transform: ['translateY(20%) scale(0.3)', 'translateY(0%) scale(1.05)', 'translateY(-10%) scale(1.2)'], opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.35, 1] }}
          >
            <Box component="img" src={splashArt} alt="" sx={{ width: '100%', display: 'block' }} />
          </motion.div>
        </Box>
      )}

      {/* The ✓ sits centred over the horn, measured from the horn's own box — so it is above the horn at
          every size, rather than tuned against the stage. */}
      {sendSlot && (
        <Box sx={{ position: 'absolute', zIndex: 3, left: pct(G.horn.left + G.horn.width / 2), bottom: pct(1 - G.horn.top + 0.02), transform: 'translateX(-50%)' }}>
          {sendSlot}
        </Box>
      )}

      {/* The horn: sending is the big green ✓ (owner, 2026-10-15), so the horn is a TOY — tap it any time and
          it blows (owner, 2026-10-16). On a correct send it blows by itself. Either way it swells twice
          with the blast and sound rings roll out of its bell, so the child sees where the sound comes
          from. The sound itself is the game's (`onHorn`); this only draws the blast. */}
      <Box
        component="button"
        type="button"
        aria-label="Tut med hornet"
        onClick={() => {
          setBlows((b) => b + 1)
          onHorn()
        }}
        sx={{ position: 'absolute', left: pct(G.horn.left), top: pct(G.horn.top), width: `calc(var(--bw) * ${G.horn.width})`, aspectRatio: '1', p: 0, border: 0, background: 'transparent', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        {blowing && !reduce && (
          <React.Fragment key={`rings-${blowKey}`}>
            {[0, 1, 2].map((i) => (
              // The bell opens up and to the right (x ~0.78, y ~0.3 of the horn art).
              <Box key={i} sx={{ position: 'absolute', left: '78%', top: '30%', width: '90%', aspectRatio: '1', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                <motion.div
                  initial={{ transform: 'scale(0.3)', opacity: 0 }}
                  animate={{ transform: ['scale(0.3)', 'scale(1.1)', 'scale(1.9)'], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.9, delay: i * 0.22, ease: 'easeOut', times: [0, 0.3, 1] }}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.95)', boxShadow: '0 0 8px rgba(255,255,255,0.6)', clipPath: 'polygon(50% 50%, 100% 0%, 100% 100%)' }}
                />
              </Box>
            ))}
          </React.Fragment>
        )}
        <motion.div
          key={blowKey}
          initial={false}
          animate={
            blowing && !reduce
              ? { transform: ['scale(1) rotate(0deg)', 'scale(1.3) rotate(-6deg)', 'scale(1.15) rotate(-3deg)', 'scale(1.3) rotate(-6deg)', 'scale(1) rotate(0deg)'] }
              : { transform: 'scale(1) rotate(0deg)' }
          }
          transition={{ duration: 1.1, ease: 'easeInOut', times: [0, 0.15, 0.5, 0.75, 1] }}
          style={{ width: '100%', height: '100%', transformOrigin: '50% 90%', pointerEvents: 'none' }}
        >
          <Box component="img" src={hornArt} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </motion.div>
      </Box>
    </motion.div>
  )
}

export default Boat
