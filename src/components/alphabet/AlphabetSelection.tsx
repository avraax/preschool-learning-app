import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'

// With four doors this is "Bogstaver og Ord" (Alfabetet + Ordleg) — GameSelectionLayout reads the door.
const AlphabetSelection: React.FC = () => <GameSelectionLayout categoryId="alphabet" />

export default AlphabetSelection
