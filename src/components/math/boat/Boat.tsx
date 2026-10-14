import React from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import { hintPulse } from '../../../theme/idleMotion'
/**
 * A landing overshoot as a cubic-bezier (the same curve `draggableStyle` uses for its lift). Springs
 * compile to `linear()` easing, which Safari 17 refuses to run on the compositor (WebKit 7618
 * `KeyframeEffect::canBeAccelerated`); a bezier keeps every one-shot here on the GPU.
 */
const LAND_EASE = [0.34, 1.56, 0.64, 1] as const
import { BAY_SLOTS, type CargoKind, type DeckState } from './boatDeck'
import { FishBoxView, FishView } from './Cargo'
import { BOAT_LOOKS } from './boatLooks'

// The boat: a sail (the numeral is painted on it only after a correct send), a deck with TWO 2×5 bays —
// boxes of ten fish on the left, single fish on the right — and the hull. Everything is sized from the
// `--s` slot unit the stage sets, so the deck scales as one piece (Harbour PRD-01 §4.4/§4.5).
//
// The deck is ONE droppable (`deck`); each loaded item is a draggable whose tap UNLOADS it, and the
// quay is the drop target for a drag back. The resolve functions live in the game — this only renders.

const SAIL = '#FFF6E0'
const DECK = '#E8C38E'
const DECK_DARK = '#B88A52'

export interface BundleFx {
  key: number
  /** The box slot the ten fish were packed into. */
  box: number
}

interface BoatProps {
  look: number
  deck: DeckState
  /** The never-fail hint: exactly the target load, outlined in the slots (§2.1.7). */
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
}

const slotSx = {
  width: 'var(--s)',
  height: 'var(--s)',
  borderRadius: 'calc(var(--s) * 0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
} as const

const Bay: React.FC<{
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
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, var(--s))',
        gridTemplateRows: 'repeat(2, var(--s))',
        gap: 'calc(var(--s) * 0.14)',
        position: 'relative',
      }}
    >
      {Array.from({ length: BAY_SLOTS }, (_, i) => {
        const filled = i < count
        const ghosted = ghostCount !== null && i < ghostCount && !filled
        const extra = ghostCount !== null && filled && i >= ghostCount
        const isNewBox = kind === 'box' && bundle !== null && bundle.box === i
        return (
          <Box
            key={i}
            sx={{
              ...slotSx,
              background: 'rgba(120,80,40,0.18)',
              boxShadow: 'inset 0 calc(var(--s) * 0.05) calc(var(--s) * 0.1) rgba(80,50,20,0.28)',
            }}
          >
            {ghosted && (
              <Box {...pulse.props} sx={[{ position: 'absolute', inset: '6%', borderRadius: 'inherit', border: '3px dashed #FFFFFF', background: 'rgba(255,255,255,0.35)', boxShadow: '0 0 12px rgba(255,255,255,0.9)' }, pulse.sx]} />
            )}
            {filled && (
              // The slot's item mounts once per fill; `initial` is read only at mount, so clearing the
              // bundle afterwards never replays the drop.
              <motion.div
                // Both ends carry the SAME function list. Motion interpolates toward `'none'` by zeroing
                // every function, so `scale(0.7) → none` landed on scale(0) and every item vanished.
                initial={reduce ? false : { transform: isNewBox ? 'translateY(0px) scale(0)' : 'translateY(-18px) scale(0.7)', opacity: 0 }}
                animate={{ transform: 'translateY(0px) scale(1)', opacity: 1 }}
                // An overshooting cubic-bezier, not a spring: Motion compiles springs to `linear()`,
                // which Safari 17 will not run on the compositor.
                transition={{ duration: isNewBox ? 0.34 : 0.24, ease: LAND_EASE, delay: isNewBox ? 0.38 : 0 }}
              >
                <Box {...(extra ? pulse.props : {})} sx={extra ? [pulse.sx] : undefined}>
                  <DraggableItem
                    id={`deck-${kind}-${i}`}
                    inline
                    disabled={!interactive}
                    data={{ kind, from: 'deck' }}
                    lift={{ scale: 1.1, rotate: 4 }}
                    onActivate={() => onUnload(kind)}
                  >
                    <Box sx={{ cursor: interactive ? 'grab' : 'default', display: 'flex' }}>
                      {kind === 'box' ? <FishBoxView /> : <FishView />}
                    </Box>
                  </DraggableItem>
                </Box>
              </motion.div>
            )}
          </Box>
        )
      })}
      {/* The packing show: ten fish gather and swim off to the left bay, where they pop up as one box. */}
      {kind === 'fish' && bundle && !reduce && (
        <Box key={bundle.key} sx={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(5, var(--s))', gridTemplateRows: 'repeat(2, var(--s))', gap: 'calc(var(--s) * 0.14)', pointerEvents: 'none' }}>
          {Array.from({ length: BAY_SLOTS }, (_, i) => (
            <Box key={i} sx={{ ...slotSx }}>
              <motion.div
                initial={{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }}
                animate={{
                  transform: ['translate(0px, 0px) scale(1)', 'translate(0px, -8px) scale(1.12)', `translate(${-40 - (i % 5) * 18}px, -30px) scale(0.2)`],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 0.6, delay: i * 0.025, ease: 'easeIn', times: [0, 0.35, 1] }}
              >
                <FishView />
              </motion.div>
            </Box>
          ))}
        </Box>
      )}
    </Box>
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
}) => {
  const L = BOAT_LOOKS[look % BOAT_LOOKS.length]
  return (
    <motion.div
      key={shakeKey}
      // Transform strings + tween, ending on an explicit identity (never `'none'`): GPU-composited in
      // Safari 17, where framer's `x` shorthand would run on the main thread.
      animate={
        shakeKey > 0 && !reduce
          ? { transform: ['translateX(0px)', 'translateX(-14px)', 'translateX(10px)', 'translateX(-6px)', 'translateX(0px)'] }
          : { transform: 'translateX(0px)' }
      }
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ position: 'relative', width: 'calc(var(--s) * 13)', height: 'calc(var(--s) * 7.6)' }}
    >
      {/* Mast + pennant. */}
      <Box sx={{ position: 'absolute', left: 'calc(var(--s) * 6.4)', top: 0, width: 'calc(var(--s) * 0.18)', height: 'calc(var(--s) * 4.4)', background: '#7A5230', borderRadius: 4 }} />
      <Box sx={{ position: 'absolute', left: 'calc(var(--s) * 6.55)', top: 'calc(var(--s) * 0.05)', width: 'calc(var(--s) * 0.9)', height: 'calc(var(--s) * 0.45)', background: L.stripe === '#FFFFFF' ? L.hull : L.stripe, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
      {/* Sail — blank until a correct send paints the number on it (the reveal IS the lesson). */}
      <Box
        sx={{
          position: 'absolute',
          left: 'calc(var(--s) * 3.4)',
          top: 'calc(var(--s) * 0.5)',
          width: 'calc(var(--s) * 2.95)',
          height: 'calc(var(--s) * 3.2)',
          background: `linear-gradient(135deg, #FFFFFF, ${SAIL} 60%, #EADFC4)`,
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 18% 10%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
        }}
      >
        {sailNumber !== null && (
          <motion.div
            initial={reduce ? false : { transform: 'scale(0.3) rotate(-12deg)', opacity: 0 }}
            animate={{ transform: 'scale(1) rotate(0deg)', opacity: 1 }}
            transition={{ duration: 0.4, ease: LAND_EASE }}
          >
            <Typography
              component="span"
              sx={{ fontFamily: '"Comic Sans MS", "Comic Neue", cursive', fontWeight: 800, fontSize: 'calc(var(--s) * 1.55)', lineHeight: 1, color: L.trim, pl: 'calc(var(--s) * 0.35)', pt: 'calc(var(--s) * 0.4)' }}
            >
              {sailNumber}
            </Typography>
          </motion.div>
        )}
      </Box>

      {/* Deck — ONE drop target for both bays. */}
      <Box sx={{ position: 'absolute', left: 'calc(var(--s) * 0.5)', top: 'calc(var(--s) * 3.7)', width: 'calc(var(--s) * 12)', height: 'calc(var(--s) * 2.6)' }}>
        <DroppableZone
          id="deck"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'calc(var(--s) * 0.3)',
            background: `repeating-linear-gradient(90deg, ${DECK} 0 calc(var(--s) * 0.9), ${DECK_DARK} calc(var(--s) * 0.9) calc(var(--s) * 0.95))`,
            boxShadow: overDeck ? '0 0 0 5px rgba(255,255,255,0.85), 0 0 24px rgba(255,255,255,0.8)' : 'inset 0 -6px 0 rgba(0,0,0,0.12)',
            transition: 'box-shadow 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
          }}
        >
          <Bay kind="box" count={deck.boxes} ghostCount={ghost ? ghost.boxes : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} />
          <Bay kind="fish" count={deck.fish} ghostCount={ghost ? ghost.fish : null} bundle={bundle} interactive={interactive} reduce={reduce} onUnload={onUnload} />
        </DroppableZone>
      </Box>

      {/* Hull — bow to the right. */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 'calc(var(--s) * 6.1)',
          width: '100%',
          height: 'calc(var(--s) * 1.5)',
          background: `linear-gradient(180deg, ${L.stripe} 0 22%, ${L.hull} 22% 100%)`,
          clipPath: 'polygon(0 0, 100% 0, 92% 100%, 6% 100%)',
          boxShadow: `inset 0 -10px 0 ${L.trim}`,
          pointerEvents: 'none',
        }}
      />

      {/* The horn — tap-only: it CONFIRMS, it doesn't answer (§4.4). */}
      <Box
        component="button"
        type="button"
        aria-label="Send båden"
        disabled={!hornEnabled}
        onClick={onHorn}
        sx={{
          position: 'absolute',
          right: 'calc(var(--s) * -0.4)',
          top: 'calc(var(--s) * 2.0)',
          width: 'max(56px, calc(var(--s) * 1.5))',
          height: 'max(56px, calc(var(--s) * 1.5))',
          borderRadius: '50%',
          border: '4px solid #FFFFFF',
          background: hornEnabled ? 'radial-gradient(circle at 35% 30%, #FFD86B, #E39B1B 70%)' : 'radial-gradient(circle at 35% 30%, #E6E6E6, #A8A8A8 70%)',
          boxShadow: hornEnabled ? '0 6px 14px rgba(0,0,0,0.3), inset 0 -4px 0 rgba(0,0,0,0.18)' : '0 3px 6px rgba(0,0,0,0.18)',
          cursor: hornEnabled ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          transition: 'background 0.2s ease, transform 0.12s ease',
          '&:active': hornEnabled ? { transform: 'scale(0.92)' } : {},
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* A horn bell, drawn — the art render replaces it (W3). */}
        <Box aria-hidden sx={{ width: '58%', height: '42%', background: hornEnabled ? '#8C5A12' : '#6E6E6E', clipPath: 'polygon(0 35%, 45% 35%, 100% 0, 100% 100%, 45% 65%, 0 65%)' }} />
      </Box>
    </motion.div>
  )
}

export default Boat
