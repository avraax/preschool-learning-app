import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const KreaSelection: React.FC = () => (
  <GameSelectionLayout categoryId="krea" games={categoryThemes.krea.games} />
)

export default KreaSelection
