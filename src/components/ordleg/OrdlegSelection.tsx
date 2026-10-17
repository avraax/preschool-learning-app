import React from 'react'
import { Navigate } from 'react-router-dom'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { menuRouteFor } from '../../config/doors'
import { fourDoorsShown } from '../../utils/fourDoors'

// With four doors Ordleg has no menu of its own — its games stand in "Bogstaver og Ord" at /alphabet,
// and an old link here lands there (Category restructure PRD-01 A2). A router redirect, never a raw
// navigate().
const OrdlegSelection: React.FC = () =>
  fourDoorsShown() ? <Navigate to={menuRouteFor('ordleg', true)} replace /> : <GameSelectionLayout categoryId="ordleg" />

export default OrdlegSelection
