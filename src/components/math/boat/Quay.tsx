import React from 'react'
import { Box } from '@mui/material'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'
import type { CargoKind } from './boatDeck'
import { CrateView, PalletView } from './Cargo'

// The quay: two endless supply piles — pallets of ten and single crates. A pile is the child's SOURCE:
// tap it to load one onto the next free slot, or drag its top unit onto the deck. Both call the game's
// one `load(kind)` (Harbour PRD-01 §4.4). The quay is also where a dragged-back item is unloaded.

const PLANK = '#B07A45'
const PLANK_DARK = '#7E5228'
const POST = '#6B4522'

const Pile: React.FC<{ kind: CargoKind; interactive: boolean; onLoad: (kind: CargoKind) => void }> = ({ kind, interactive, onLoad }) => {
  const pallet = kind === 'pallet'
  const Unit = pallet ? PalletView : CrateView
  // A pallet's ink is its lower ~55% (2×5 crates + base), so a pallet pile STACKS straight up; a crate
  // pile is two side by side with the third on top.
  const unit = pallet ? 'calc(var(--s) * 1.75)' : 'calc(var(--s) * 1.2)'
  return (
    <Box
      sx={{
        position: 'relative',
        width: pallet ? 'calc(var(--s) * 1.95)' : 'calc(var(--s) * 2.5)',
        height: pallet ? 'calc(var(--s) * 2.6)' : 'calc(var(--s) * 2.3)',
      }}
    >
      {/* The pile behind — static, it never runs out. */}
      {pallet ? (
        <>
          <Box aria-hidden sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}><Unit size={unit} /></Box>
          <Box aria-hidden sx={{ position: 'absolute', bottom: 'calc(var(--s) * 0.42)', left: '50%', transform: 'translateX(-50%)' }}><Unit size={unit} /></Box>
        </>
      ) : (
        <>
          <Box aria-hidden sx={{ position: 'absolute', bottom: 0, left: 0 }}><Unit size={unit} /></Box>
          <Box aria-hidden sx={{ position: 'absolute', bottom: 0, right: 0 }}><Unit size={unit} /></Box>
        </>
      )}
      {/* The top unit — the thing the child picks up. */}
      <Box sx={{ position: 'absolute', bottom: pallet ? 'calc(var(--s) * 0.84)' : 'calc(var(--s) * 1.02)', left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
        <DraggableItem
          id={`src-${kind}`}
          inline
          disabled={!interactive}
          data={{ kind, from: 'quay' }}
          lift={{ scale: 1.12, rotate: -5 }}
          onActivate={() => onLoad(kind)}
        >
          <Box
            data-boat-source={kind}
            sx={{
              // A generous hit area around the art (≥ 44px everywhere), cancelled by a negative margin so
              // nothing on the quay moves (layout-contract.md, touch targets).
              p: '14px',
              m: '-14px',
              cursor: interactive ? 'grab' : 'default',
              display: 'flex',
            }}
          >
            <Unit size={unit} />
          </Box>
        </DraggableItem>
      </Box>
    </Box>
  )
}

const Quay: React.FC<{
  interactive: boolean
  overQuay: boolean
  onLoad: (kind: CargoKind) => void
  repeat: React.ReactNode
}> = ({ interactive, overQuay, onLoad, repeat }) => (
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
        <Pile kind="pallet" interactive={interactive} onLoad={onLoad} />
        <Pile kind="crate" interactive={interactive} onLoad={onLoad} />
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
