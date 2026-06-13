import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const EnglishSelection: React.FC = () => {
  return (
    <GameSelectionLayout
      categoryId="english"
      games={categoryThemes.english.games}
    />
  )
}

export default EnglishSelection
