import React from 'react'
import { Box } from '@mui/material'
import { softShadow } from '../../theme/depth'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Shared focal-subject renderers for the in-world PromptFocus zone (Liveliness PRD-06 F2 / PRD-07).
// Extracted from the retired frosted `PromptStage` card (PRD-12 Phase A) — the card itself is gone;
// only these material-neutral hero/tile renderers survive, consumed by the quiz engine + the
// hand-rolled Ordleg/English games. They render a subject at a canonical size; PromptFocus supplies
// the light-pool + contact shadow around them.

// A convenience hero-emoji renderer at the canonical hero size. Kept ONLY as the art-gated fallback
// for the pictorial subjects still awaiting baked art (PRD-12 Phase B: English body/family/greetings
// + the Ordleg abstract words); every concrete subject renders <HeroArt> instead.
export const HeroEmoji: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      fontSize: 'clamp(3.5rem, 14vh, 7rem)',
      lineHeight: 1,
      userSelect: 'none',
      [PHONE_LANDSCAPE]: { fontSize: 'clamp(2.2rem, 18vh, 3.2rem)' },
    }}
  >
    {children}
  </Box>
)

// The baked-art counterpart of HeroEmoji (Liveliness PRD-06 F2 / PRD-07): a soft-3D WebP subject
// rendered at the hero size, resting in PromptFocus's light-pool. A gentle layered drop-shadow gives
// it the same "cut-out object resting in the world" read as a SceneObject; the light-pool + contact
// shadow come from PromptFocus around it. Decorative (the letter/answer is the content) → aria-hidden.
export const HeroArt: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    aria-hidden={alt === '' ? true : undefined}
    draggable={false}
    sx={{
      height: 'clamp(4.5rem, 20vh, 11rem)',
      width: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      userSelect: 'none',
      pointerEvents: 'none',
      filter: softShadow(1.4),
      [PHONE_LANDSCAPE]: { height: 'clamp(3rem, 26vh, 5rem)' },
    }}
  />
)

// The tile-scaled sibling of HeroArt (Liveliness PRD-10 §3.1): a soft-3D WebP subject sized to fill
// a quiz ANSWER tile with padding. Used by Læs Ordet, where the prompt is the WORD (glyph) and the
// *answers* are the pictures — the inverse of every other quiz, whose answers are glyphs. It rests
// inside the TactileTile clay surface as the tile's content (the tile is the grounded pressable; this
// is just what sits on it), so it carries only a gentle softShadow, no light-pool/contact of its own.
// Decorative (the picture is the choice, spoken on tap) → aria-hidden + non-interactive.
export const TileArt: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    aria-hidden={alt === '' ? true : undefined}
    draggable={false}
    sx={{
      height: 'clamp(2.6rem, 12vh, 5rem)',
      width: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      userSelect: 'none',
      pointerEvents: 'none',
      filter: softShadow(1),
      [PHONE_LANDSCAPE]: { height: 'clamp(2rem, 20vh, 3.2rem)' },
    }}
  />
)
