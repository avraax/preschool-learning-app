import React from 'react'
import { Navigate } from 'react-router-dom'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { menuRouteFor } from '../../config/doors'
import { fourDoorsShown } from '../../utils/fourDoors'

// With four doors Krea has no menu of its own — its games stand in "Farver og Krea" at /farver, and an
// old link here lands there (Category restructure PRD-01 A2). A router redirect, never a raw navigate().
const KreaSelection: React.FC = () =>
  fourDoorsShown() ? <Navigate to={menuRouteFor('krea', true)} replace /> : <GameSelectionLayout categoryId="krea" />

export default KreaSelection
