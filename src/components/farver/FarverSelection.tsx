import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'

// With four doors this is "Farver og Krea" (Farver + Krea) — GameSelectionLayout reads the door.
const FarverSelection: React.FC = () => <GameSelectionLayout categoryId="colors" />

export default FarverSelection
