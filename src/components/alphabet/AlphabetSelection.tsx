import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const AlphabetSelection: React.FC = () => {
  return (
    <GameSelectionLayout 
      categoryId="alphabet"
      games={categoryThemes.alphabet.games}
    />
  )
}

export default AlphabetSelection