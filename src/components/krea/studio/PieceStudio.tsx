import React from 'react'
import { Box } from '@mui/material'
import { BTN, PICTURES, StudioButton } from './StudioControls'
import { gameIconImages } from '../../../assets/themes/icons/games'
import { idlePulse } from '../../../theme/idleMotion'
import { PHONE_PORTRAIT } from '../../../theme/phoneMedia'

// The studio layout Tegn med Mig and Farvelæg share (Krea PRD-01 §4.10) — Fri Tegning's table, with a
// piece's own controls. Reserved space, never a tuned percentage: the tool column, the side column and
// the crayon row take what they need and the paper is the remainder (layout-contract.md). On a wide
// screen the tools stand beside the paper; on a tall one they lie in rows under it.
//
// The side column holds the piece's way on, ONE at a time and always in the same spot:
//   - before the piece is finished: "Nyt papir" (with the spoken confirm) once there is ink;
//   - finished, not yet shown: the done ✓, gently pulsing — the child decides they are done;
//   - after done: the big "next" →, back to the picture grid (no confirm — they said they were done).

export const PieceStudio: React.FC<{
  landscape: boolean
  tools: React.ReactNode
  paper: React.ReactNode
  side: React.ReactNode
  palette: React.ReactNode
}> = ({ landscape, tools, paper, side, palette }) => (
  <Box
    data-krea-stage
    sx={{
      flex: 1,
      minHeight: 0,
      display: 'grid',
      gap: 'clamp(8px, 2vmin, 18px)',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gridTemplateRows: 'minmax(0, 1fr) auto auto',
      gridTemplateAreas: '"paper paper" "tools side" "pal pal"',
      '@media (orientation: landscape)': {
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        gridTemplateAreas: '"tools paper side" "pal pal pal"',
      },
      pb: 'env(safe-area-inset-bottom)',
    }}
  >
    <Box sx={{ gridArea: 'tools', display: 'flex', flexDirection: landscape ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 'clamp(6px, 1.4vmin, 12px)', minHeight: 0 }}>
      {tools}
    </Box>
    {paper}
    <Box
      sx={{
        gridArea: 'side',
        display: 'flex',
        flexDirection: landscape ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        minWidth: `calc(${BTN} * 1.7)`,
        [PHONE_PORTRAIT]: { minWidth: 0, px: 1 },
      }}
    >
      {side}
    </Box>
    <Box sx={{ gridArea: 'pal', display: 'grid', justifyItems: 'center', alignItems: 'end', '& > *': { gridArea: '1 / 1' } }}>{palette}</Box>
  </Box>
)

/** Back to the picture grid: the game's own tile picture ("the drawings"), so it needs no words. */
export const PickerButton: React.FC<{ gameId: 'krea.guide' | 'krea.color' | 'krea.beads'; disabled?: boolean; onPress: () => void }> = ({ gameId, disabled, onPress }) => (
  <StudioButton dataId="to-picker" label="Vælg en anden tegning" disabled={disabled} onPress={onPress}>
    <Box component="img" src={gameIconImages[gameId]} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
  </StudioButton>
)

export type PieceStage = 'drawing' | 'finished' | 'alive' | 'shown'

/** The side column's one control for the piece's stage (see the header). */
export const PieceWayOn: React.FC<{
  stage: PieceStage
  hasInk: boolean
  disabled: boolean
  reduce: boolean
  onNewPaper: () => void
  onDone: () => void
  onNext: () => void
}> = ({ stage, hasInk, disabled, reduce, onNewPaper, onDone, onNext }) => {
  const big = `calc(${BTN} * 1.55)`
  if (stage === 'finished') {
    const pulse = idlePulse(reduce, { peak: 1.07, durationS: 1.4 })
    return (
      <Box {...pulse.props} sx={[{ display: 'flex' }, pulse.sx]}>
        <StudioButton dataId="done" label="Færdig" size={big} disabled={disabled} onPress={onDone}>
          <PICTURES.Done />
        </StudioButton>
      </Box>
    )
  }
  if (stage === 'shown') {
    return (
      <StudioButton dataId="next" label="Næste" size={big} disabled={disabled} onPress={onNext}>
        <PICTURES.Next />
      </StudioButton>
    )
  }
  return (
    <Box sx={{ visibility: stage === 'drawing' && hasInk ? 'visible' : 'hidden' }}>
      <StudioButton dataId="new-paper" label="Nyt papir" size={`calc(${BTN} * 1.4)`} disabled={disabled || stage !== 'drawing' || !hasInk} onPress={onNewPaper}>
        <PICTURES.NewPaper />
      </StudioButton>
    </Box>
  )
}
