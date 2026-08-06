import React from 'react'
import GameSelectionLayout from '../common/GameSelectionLayout'
import { categoryThemes } from '../../config/categoryThemes'
import { micConsentGiven } from '../../utils/micConsent'

const OrdlegSelection: React.FC = () => {
  // "Sig et Ord" is HIDDEN, not disabled, until an adult has consented to the microphone (App Store
  // PRD §3.6 / A3). Hidden rather than greyed because a locked tile on a 5-year-old's menu is a tile he
  // taps repeatedly and cannot open — the adult surface is where the switch lives, and this is where its
  // absence has to be silent.
  //
  // This is only HALF the gate: the routes here are deep-linkable by design, so `SpeakWordGame` refuses
  // on its own too. Removing a tile is not a gate.
  const games = micConsentGiven()
    ? categoryThemes.ordleg.games
    : categoryThemes.ordleg.games.filter((g) => g.id !== 'mic')

  return <GameSelectionLayout categoryId="ordleg" games={games} />
}

export default OrdlegSelection
