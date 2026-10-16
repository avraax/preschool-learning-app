import React from 'react'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { StudioBackdrop, Paper } from './studio/StudioScene'

// Farvelæg (Krea PRD-01) — an EMPTY studio until W5. The route exists so the menu, the gate and
// the usage events are real now; the game itself is built on the canvas engine in W5.
const FarvelaegGame: React.FC = () => {
  useOccludeWorld()
  return (
    <GameShell categoryId="krea" title="Farvelæg" backRoute="/krea" dense guide={false}>
      <StudioBackdrop />
      <Paper />
    </GameShell>
  )
}

export default FarvelaegGame
