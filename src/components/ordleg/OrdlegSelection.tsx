import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'

const OrdlegSelection: React.FC = () => (
  <GameSelectionLayout categoryId="ordleg" games={categoryThemes.ordleg.games} />
)

export default OrdlegSelection
