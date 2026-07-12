import React from 'react'
import ThemeMascot, { type GuideReaction } from './ThemeMascot'
import { PHONE_ANY } from '../../theme/phoneMedia'

// In-game companion (Game-Page Rework PRD §D). Reuses the per-theme world mascot as a small
// bottom-LEFT corner buddy (the version chip lives bottom-right) that reacts to answers:
// `cheer` on correct, `think` on wrong, and speaks an encouragement line on tap (handled by
// ThemeMascot, via the single audio channel). No parallax on game pages (parallaxDepth = 0 →
// the shared --parallax-x/y vars resolve to 0 and it stays put). Renders nothing for themes
// without a mascot; reduced motion → static.

interface GameGuideProps {
  reaction?: GuideReaction
}

const GameGuide: React.FC<GameGuideProps> = ({ reaction = null }) => (
  <ThemeMascot
    reaction={reaction}
    parallaxDepth={0}
    sx={{
      zIndex: 4,
      left: 'calc(env(safe-area-inset-left) + 6px)',
      bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
      // Smaller than the home mascot so it reads as a companion, not the star of the screen.
      width: { xs: 80, sm: 96, md: 112 },
      height: { xs: 80, sm: 96, md: 112 },
      // Phones: shrink hard so the buddy never covers tiles/droplets (sweep: it overlapped
      // answer tiles in landscape and Ram Farven's first droplet in portrait).
      [PHONE_ANY]: { width: 52, height: 52 },
    }}
  />
)

export default GameGuide
