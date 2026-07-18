// Shared baked-art manifest (Liveliness PRD-12 §4). Soft-3D WebP subjects that are reused across
// MORE than one section — the body parts (hand/arm/leg/foot/eye/ear/nose/mouth/tooth/hair) and
// people (mom/dad/baby/girl/boy/grandma/grandpa/family) that appear in BOTH the English section
// (Krop/Familie themes) and Ordleg (arm/ben/fod/mor/far). Generated once on a `#00FF00` green screen
// and keyed with the `sharp` pipeline (`.claude/rules/scene-assets.md`); keyed by a stable ASCII id
// (the English word / Ordleg art id), theme-CONSTANT (one set across all 4 skins, like section icons).
//
// Depicting body parts as a friendly whole cartoon child emphasizing the part (not a disembodied limb)
// is what let PRD-12 reverse the area PRDs' "isolated clay limb reads uncanny → keep emoji" decision.
//
// Consumers don't import this directly — `englishArt()` and `ordlegArt()` fall back through here, so a
// word resolves its picture from its own section first, then this shared pool. Filenames are the id,
// e.g. `hand.webp`, `mom.webp`, `family.webp`. One image per id; ≤40 KB, square, transparent.

// Statically-bundled URLs for every WebP in this folder (Vite rewrites each to its hashed asset URL).
const modules = import.meta.glob('./*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// art id → ready-to-render WebP URL.
export const sharedArtMap: Record<string, string> = {}
for (const [path, url] of Object.entries(modules)) {
  const stem = path.split('/').pop()!.replace(/\.webp$/i, '')
  sharedArtMap[stem] = url
}

// The shared baked subject for an art id, or `undefined`.
export const sharedArt = (id: string | undefined): string | undefined =>
  id ? sharedArtMap[id] : undefined

export default sharedArtMap
