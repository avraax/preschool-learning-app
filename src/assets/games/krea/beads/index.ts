// Perleplade's props (Krea PRD-02 W0) — the owner's renders, keyed by
// `node scripts/optimize-theme-art.mjs krea` from art-src/krea/beads/. The beads and the pegboard are
// drawn in code (PRD-02 §2.1); these are the clay things around them. Static imports, so a missing
// render is a build error.
import bowl from './bowl.webp'
import tweezers from './tweezers.webp'
import cardFrame from './card-frame.webp'

export const BEAD_ART = { bowl, tweezers, cardFrame }
