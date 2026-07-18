import React from 'react'
import TactileTile from './TactileTile'

// AnswerTile — the quiz answer surface. As of Liveliness PRD-06 F1 it is a thin wrapper over the
// shared `TactileTile` clay primitive (soft matte surface + grounded contact shadow + press-travel,
// NO keyboard lip / heavy border). Its public props are UNCHANGED so no quiz config needs editing:
// `UnifiedQuizGame` and every hand-rolled game that renders <AnswerTile> upgrade to the tactile
// material at once. The content glyph (letter/number/word/emoji) is still passed as children.
//
// Feedback states map 1:1 to TactileTile:
//   correct  → soft scale pop + a few sparkles + success ring/contact-tint  (+ the game's sfx)
//   wrong    → gentle x-shake + error tint
//   selected → raised/outlined accent (hear-before-commit audition; PRD-14 W7) — a second tap commits
//   hint     → slow breathe + accent glow ring (never-fail hint; reduced-motion → static ring)
// The DOM contract (`data-answer-tile` / `data-tile-state`) is preserved for the screenshot harness.

export type AnswerTileState = 'idle' | 'correct' | 'wrong' | 'selected'

interface AnswerTileProps {
  onClick: () => void
  accent: string
  state?: AnswerTileState
  disabled?: boolean
  // Pulse this (correct) tile as a never-fail hint. Ignored unless state === 'idle'.
  hint?: boolean
  children: React.ReactNode
}

const AnswerTile: React.FC<AnswerTileProps> = ({
  onClick,
  accent,
  state = 'idle',
  disabled = false,
  hint = false,
  children,
}) => (
  <TactileTile
    onActivate={onClick}
    accent={accent}
    state={state}
    hint={hint}
    disabled={disabled}
    variant="tile"
    domProps={{ 'data-answer-tile': '', 'data-tile-state': state }}
  >
    {children}
  </TactileTile>
)

export default AnswerTile
