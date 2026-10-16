import React from 'react'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { StudioBackdrop, Paper } from './studio/StudioScene'

// Tegn med Mig (Krea PRD-01) — an EMPTY studio until W4. The route exists so the menu, the gate and
// the usage events are real now; the game itself is built on the canvas engine in W4.
const TegnMedMigGame: React.FC = () => {
  useOccludeWorld()
  return (
    <GameShell categoryId="krea" title="Tegn med Mig" backRoute="/krea" dense guide={false} lightScene>
      <StudioBackdrop />
      <Paper />
    </GameShell>
  )
}

export default TegnMedMigGame
