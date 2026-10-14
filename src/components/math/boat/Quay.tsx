import React from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import type { CargoKind } from './boatDeck'
import { FishBoxView, FishView } from './Cargo'

// The quay: two endless supply piles — boxes of ten fish and single fish. A pile is the child's SOURCE:
// tap it to load one onto the next free slot, or drag its top unit onto the deck. Both call the game's
// one `load(kind)` (Harbour PRD-01 §4.4). The quay is also where a dragged-back item is unloaded.

const PLANK = '#B07A45'
const PLANK_DARK = '#7E5228'
const POST = '#6B4522'

const Pile: React.FC<{ kind: CargoKind; interactive: boolean; onLoad: (kind: CargoKind) => void; refill: number; reduce: boolean }> = ({
  kind,
  interactive,
  onLoad,
  refill,
  reduce,
}) => {
  const isBox = kind === 'box'
  const Unit = isBox ? FishBoxView : FishView
  // Both piles are two side by side with the top unit resting on them.
  const unit = isBox ? 'calc(var(--s) * 1.3)' : 'calc(var(--s) * 1.2)'
  return (
    <Box sx={{ position: 'relative', width: 'calc(var(--s) * 2.6)', height: 'calc(var(--s) * 2.3)' }}>
      {/* The pile behind — static, it never runs out. */}
      <Box aria-hidden sx={{ position: 'absolute', bottom: 0, left: 0 }}><Unit size={unit} /></Box>
      <Box aria-hidden sx={{ position: 'absolute', bottom: 0, right: 0 }}><Unit size={unit} /></Box>
      {/* The WHOLE PILE is the grab area, not just the top unit (owner, 2026-10-14: pressing the fish
          underneath did nothing). The draggable is a transparent box over the entire pile, padded a
          little past it; only the top unit is drawn inside it, so a drag carries that one unit away
          while the rest of the pile stays put. */}
      <Box sx={{ position: 'absolute', inset: '-10px', zIndex: 1 }}>
        {/* A successful load REMOUNTS the top unit (`refill` is the key): the one the child dropped stays
            on the deck, and a fresh one appears on the pile — instead of the dropped unit gliding back
            across the board, which read as "it didn't take". (WebKit gesture probe, 2026-10-13.)
            OPACITY only: a scale/translate on an ancestor of a draggable multiplies its drag offset
            (drag-and-drop.md, "track the finger 1:1"), and a child may grab it mid-fade. */}
        <motion.div key={refill} initial={reduce || refill === 0 ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }} style={{ width: '100%', height: '100%' }}>
          <DraggableItem
            id={`src-${kind}`}
            inline
            fill
            disabled={!interactive}
            data={{ kind, from: 'quay' }}
            lift={{ scale: 1.05, rotate: -3 }}
            onActivate={() => onLoad(kind)}
          >
            <Box data-boat-source={kind} sx={{ position: 'relative', width: '100%', height: '100%', cursor: interactive ? 'grab' : 'default' }}>
              <Box
                sx={{
                  position: 'absolute',
                  // +10px: this box is padded 10px past the pile on every side.
                  bottom: isBox ? 'calc(var(--s) * 0.95 + 10px)' : 'calc(var(--s) * 0.7 + 10px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                <Unit size={unit} />
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
}> = ({ interactive, overQuay, onLoad, repeat, refills, reduce }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 0 }}>
    <Box sx={{ pt: 1 }}>{repeat}</Box>
    <Box sx={{ width: '100%', position: 'relative' }}>
      <DroppableZone
        id="quay"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 'calc(var(--s) * 0.2)',
          paddingBottom: 'calc(var(--s) * 0.1)',
          borderRadius: 16,
          boxShadow: overQuay ? '0 0 0 4px rgba(255,255,255,0.8)' : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <Pile kind="box" interactive={interactive} onLoad={onLoad} refill={refills.box} reduce={reduce} />
        <Pile kind="fish" interactive={interactive} onLoad={onLoad} refill={refills.fish} reduce={reduce} />
      </DroppableZone>
      {/* Planks + posts down into the water (the front wave band covers their feet). */}
      <Box aria-hidden sx={{ height: 'calc(var(--s) * 0.45)', background: `linear-gradient(180deg, ${PLANK}, ${PLANK_DARK})`, borderRadius: '6px', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }} />
      <Box aria-hidden sx={{ display: 'flex', justifyContent: 'space-around', px: '8%' }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ width: 'calc(var(--s) * 0.42)', height: 'calc(var(--s) * 1.7)', background: `linear-gradient(90deg, ${POST}, ${PLANK_DARK})`, borderRadius: '0 0 6px 6px' }} />
        ))}
      </Box>
    </Box>
  </Box>
)

export default Quay
