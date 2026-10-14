import React from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import { hintPulse } from '../../../theme/idleMotion'
import { BAY_SLOTS, type CargoKind, type DeckState } from './boatDeck'
import { BOX_ASPECT, FishBoxView, FishView } from './Cargo'
import { BOAT_ASPECT, BOAT_GEOMETRY as G, BOAT_LOOKS } from './boatLooks'
import hornArt from '../../../assets/games/boat/horn.webp'
import puffArt from '../../../assets/games/boat/puff.webp'
import splashArt from '../../../assets/games/boat/splash.webp'

// The boat (Harbour PRD-01): the owner's fishing-boat render with the cargo standing ON its deck — boxes
// of ten in the back row, single fish in the front row, each row a 5 + 5 line with a gap in the middle so
// five is seen at a glance. The numeral is painted on the blank sail only after a correct send.
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
  hornEnabled: boolean
  onHorn: () => void
  /** Wrong-send nudge: increments to replay a short shake. */
  shakeKey: number
  /** The boat is setting off — a bow splash plays once. */
  departing: boolean
}

// ── Slot geometry (fractions of the boat box) ────────────────────────────────────────────────────────
const SPAN = G.rows.right - G.rows.left
/** Half a slot of air between the two fives. */
const SLOT_W = SPAN / (BAY_SLOTS + 0.5)
const GAP_W = SLOT_W * 0.5
const slotLeft = (i: number): number => G.rows.left + i * SLOT_W + (i >= 5 ? GAP_W : 0)
/** A slot's height as a fraction of the boat box's height (items are drawn by width). */
const slotH = (kind: CargoKind): number => (kind === 'box' ? SLOT_W / BOX_ASPECT : SLOT_W) * BOAT_ASPECT
const rowY = (kind: CargoKind): number => (kind === 'box' ? G.rows.boxes : G.rows.fish)
const pct = (f: number): string => `${(f * 100).toFixed(3)}%`

const Slot: React.FC<{
  kind: CargoKind
  i: number
  children?: React.ReactNode
}> = ({ kind, i, children }) => (
  <Box
    sx={{
      position: 'absolute',
      left: pct(slotLeft(i)),
      top: pct(rowY(kind) - slotH(kind) / 2),
      width: pct(SLOT_W),
      height: pct(slotH(kind)),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </Box>
)

// A box is drawn a little wider than its slot (boxes nest edge to edge like a real deck load); a fish
// keeps its slot so the 5 + 5 stays countable.
const Cargo: React.FC<{ kind: CargoKind }> = ({ kind }) =>
  kind === 'box' ? (
    <Box sx={{ width: '106%', ml: '-3%', flex: '0 0 auto' }}>
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
}> = ({ kind, count, ghostCount, bundle, interactive, reduce, onUnload }) => {
  const pulse = hintPulse(reduce)
  return (
    <>
      {Array.from({ length: BAY_SLOTS }, (_, i) => {
        const filled = i < count
        const ghosted = ghostCount !== null && i < ghostCount && !filled
        const extra = ghostCount !== null && filled && i >= ghostCount
        const isNewBox = kind === 'box' && bundle !== null && bundle.box === i
        return (
          <Slot key={i} kind={kind} i={i}>
            {/* A soft mark on the deck where this slot is — the 5 + 5 structure is visible even empty. */}
            <Box aria-hidden sx={{ position: 'absolute', left: '8%', right: '8%', bottom: '-6%', height: '22%', borderRadius: '50%', background: 'rgba(90,55,25,0.22)' }} />
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
const PackingShow: React.FC<{ bundle: BundleFx }> = ({ bundle }) => {
  const toX = slotLeft(bundle.box)
  // translate() percentages are relative to the fish's own box (SLOT_W wide, ~square).
  const dyPct = ((rowY('box') - rowY('fish')) / (SLOT_W * BOAT_ASPECT)) * 100
  return (
    <>
      {Array.from({ length: BAY_SLOTS }, (_, i) => {
        const dxPct = ((toX - slotLeft(i)) / SLOT_W) * 100
        return (
          <Slot key={`${bundle.key}-${i}`} kind="fish" i={i}>
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
      <Slot key={`puff-${bundle.key}`} kind="box" i={bundle.box}>
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
  hornEnabled,
  onHorn,
  shakeKey,
  departing,
}) => {
  const L = BOAT_LOOKS[look % BOAT_LOOKS.length]
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
      <Row kind="box" count={deck.boxes} ghostCount={ghost ? ghost.boxes : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} />
      <Row kind="fish" count={deck.fish} ghostCount={ghost ? ghost.fish : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} />
      {bundle && !reduce && <PackingShow bundle={bundle} />}

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

      {/* The horn — tap-only: it CONFIRMS, it doesn't answer (§4.4). */}
      <Box
        component="button"
        type="button"
        aria-label="Send båden"
        disabled={!hornEnabled}
        onClick={onHorn}
        sx={{
          position: 'absolute',
          left: pct(G.horn.left),
          top: pct(G.horn.top),
          width: `max(64px, calc(var(--bw) * ${G.horn.width}))`,
          aspectRatio: '1',
          border: 0,
          background: 'transparent',
          p: 0,
          cursor: hornEnabled ? 'pointer' : 'default',
          transition: 'transform 0.12s ease, opacity 0.2s ease, filter 0.2s ease',
          opacity: hornEnabled ? 1 : 0.55,
          filter: hornEnabled ? 'none' : 'grayscale(0.85)',
          '&:active': hornEnabled ? { transform: 'scale(0.9)' } : {},
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Box component="img" src={hornArt} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
      </Box>
    </motion.div>
  )
}

export default Boat
