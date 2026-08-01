import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REWARD_CHAPTERS, REWARD_PATH } from './stickers.ts'

// De-emoji PRD-01 W6, D5 made enforceable. `Reward.emoji` is GONE, so every surface that shows a
// reward — the corner RewardRing silhouette, Min Bog's slots and chapter tabs, the ceremony's
// StickerReveal, the result-screen meter, the home shelf — renders `rewardArt(id)` unconditionally.
// A missing render would therefore draw an empty box in the middle of the ceremony. This is the test
// that makes that impossible.
//
// `src/assets/rewards/index.ts` globs `./*.webp` and is Vite-only, so coverage is checked against the
// DIRECTORY. (stickers.ts itself must stay Node-importable — see its header — which is exactly why
// the art is a lookup rather than a field on `Reward`.)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ART_DIR = path.join(ROOT, 'src', 'assets', 'rewards')
const artPath = (id: string): string => path.join(ART_DIR, `${id}.webp`)

test('every one of the 45 rewards has baked art', () => {
  const missing = REWARD_PATH.filter((r) => !existsSync(artPath(r.id))).map((r) => `${r.id} (${r.label})`)
  assert.deepEqual(missing, [], 'key the render into src/assets/rewards/ — there is no emoji fallback left')
})

test('every chapter tab resolves art via its first reward', () => {
  // StickerAlbum draws the tab icon from `chapter.rewards[0]`, so that specific slot must resolve
  // even though the assertion above already covers all 45 — this is the coupling, stated.
  const missing = REWARD_CHAPTERS
    .filter((c) => !existsSync(artPath(c.rewards[0].id)))
    .map((c) => `${c.title} → ${c.rewards[0].id}`)
  assert.deepEqual(missing, [])
})

test('no orphan reward art', () => {
  const known = new Set(REWARD_PATH.map((r) => r.id))
  const orphans = readdirSync(ART_DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/\.webp$/, ''))
    .filter((id) => !known.has(id))
  assert.deepEqual(orphans, [], 'a render whose reward left the path — delete it or restore the reward')
})

test('reward art stays within its size budget', () => {
  // The book renders up to 9 slots at once and the ring sits on the game HUD, so these ride the
  // first interaction. The PRD budgets ~20 KB each; flag anything that drifts well past it.
  const heavy = REWARD_PATH
    .map((r) => ({ id: r.id, kb: Math.round(statSync(artPath(r.id)).size / 1024) }))
    .filter((r) => r.kb > 20)
    .map((r) => `${r.id} is ${r.kb} KB`)
  assert.deepEqual(heavy, [], 'lower the WebP quality or simplify the render')
})
