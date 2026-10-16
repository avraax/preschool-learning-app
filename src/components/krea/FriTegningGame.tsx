import React from 'react'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { StudioBackdrop, Paper } from './studio/StudioScene'

// Fri Tegning (Krea PRD-01) — an EMPTY studio until W3. The route exists so the menu, the gate and
// the usage events are real now; the game itself is built on the canvas engine in W3.
const FriTegningGame: React.FC = () => {
  useOccludeWorld()
  return (
    <GameShell categoryId="krea" title="Fri Tegning" backRoute="/krea" dense guide={false}>
      <StudioBackdrop />
      <Paper />
    </GameShell>
  )
}

export default FriTegningGame
