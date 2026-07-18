// Memory card-back emblems (Liveliness PRD-12 §4). One soft-3D WebP per registered skin, replacing the
// `WORLD_MOTIF` emoji drawn on every memory card back (`UnifiedMemoryGame`). Keyed by the active skin's
// ambient MOTION (the same signal that flavors Mascot/CelebrationEffect), NOT the section — a reskin is
// what changes the card back. Generated on a `#00FF00` green screen and keyed with the `sharp` pipeline
// (`.claude/rules/scene-assets.md`); ≤40 KB, square, transparent.
//
// motion → emblem: twinkle→rocket (Rummet), rise→shell (Havet), fall→dino (Dinosaurer),
// drift→rainbow (Regnbue/kid). Filenames are the emblem id (`rocket.webp` …).

import type { AmbientMotion } from '../../../theme/tokens/types'

// Statically-bundled URLs for every WebP in this folder (Vite rewrites each to its hashed asset URL).
const modules = import.meta.glob('./*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byId: Record<string, string> = {}
for (const [path, url] of Object.entries(modules)) {
  const stem = path.split('/').pop()!.replace(/\.webp$/i, '')
  byId[stem] = url
}

// Ambient-motion → emblem id (one per registered skin — see the token files' `scene.ambient.motion`).
const MOTION_EMBLEM: Record<AmbientMotion, string> = {
  twinkle: 'rocket',
  rise: 'shell',
  fall: 'dino',
  drift: 'rainbow',
}

// The baked card-back emblem WebP URL for a skin's ambient motion.
export const memoryBackArt = (motion: AmbientMotion): string | undefined => byId[MOTION_EMBLEM[motion]]

export default byId
