import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const FarverSelection: React.FC = () => {
  return (
    <GameSelectionLayout 
      categoryId="colors"
      games={categoryThemes.colors.games}
    />
  )
}

export default FarverSelection