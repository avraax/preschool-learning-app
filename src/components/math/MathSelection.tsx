import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const MathSelection: React.FC = () => {
  return (
    <GameSelectionLayout 
      categoryId="math"
      games={categoryThemes.math.games}
    />
  )
}

export default MathSelection