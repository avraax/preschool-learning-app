# PRD-07 — Delivery performance & bundle

**Priority:** P1 (contains the single best value-for-effort fix in the whole audit — a one-line header)
**Scope:** Small–Medium
**Depends on:** none

---

## Context

iPad-first PWA on Vercel. Static assets live in `public/` (`sounds/music/*.mp3`, `sounds/ui/*.ogg`,
mascot packs, icons, `da-DK.pls`). Build is Vite 8; routes are lazy-loaded in `src/App.tsx`; theme art
and fonts are code-split per skin. Cache/headers are configured in `vercel.json`.

## Problems (with evidence)

### P1 — `/sounds/*` (and everything except `/assets/*`) is served `no-store` — re-downloaded every launch *(confirmed)*

`vercel.json` applies `Cache-Control: no-cache, no-store, must-revalidate` to `/(.*)` and grants
immutable caching only to `/assets/(.*)`. Everything in `public/` is therefore uncacheable, including:

| Asset | Size |
|-------|------|
| `sounds/music/ocean.mp3` | **8.0 MB** |
| `sounds/music/dino.mp3` | 4.8 MB |
| `sounds/music/space.mp3` | 3.9 MB |
| `sounds/music/kid.mp3` | 2.6 MB |
| `sounds/ui/flip.ogg` | 352 KB |
| `sounds/ui/round-complete.ogg` | 276 KB |
| `sounds/ui/*` (rest) | ~700 KB |

Every app open on the iPad re-streams the active world's multi-MB loop and re-fetches the whole SFX
palette (preloaded on the first gesture). This is the largest recurring performance/data cost in the
app.

### P2 — SFX files are oddly heavy

`flip.ogg` is 352 KB for a card-flip cue; `round-complete.ogg` 276 KB; `streak-up`/`page-complete`
~192 KB each. These are short UI sounds and should be a fraction of that.

### P3 — ~90 KB gz of dead Lottie/confetti loads on first paint

`src/components/common/LottieCharacter.tsx` `getAnimationData()` unconditionally returns `null`, so the
Lottie branch is unreachable — the component is an emoji with CSS keyframes. Yet `lottie-react` is
statically imported in `App.tsx` and chunked (`vite.config.ts` ~162) with **howler** (eager, via
`sfxClient`), so the whole `media-vendor` chunk — including lottie-web and react-confetti (whose only
consumer, `CelebrationEffect`, is lazy) — loads on first paint, plus `react-intersection-observer`.

### P4 — Adult stack loads eagerly

`AdultCorner` statically pulls `VoiceOverridePanel` (+ `voicelabData.ts`, ~282 lines),
`DifficultyPanel`, and `BugReportDialog` into the main chunk, though they're only needed when the adult
menu opens.

## Goals / Non-goals

**Goals:** cache static media so launches are cheap; trim dead/eager JS from first paint.

**Non-goals:** the audio runtime/TTS caching (PRD-06); the PWA service-worker story (PRD-08).

## Implementation plan

1. **Cache `/sounds/*` (do this first — one block).** Add a `vercel.json` header entry for
   `/sounds/(.*)` with e.g. `Cache-Control: public, max-age=86400` (a day) or longer with content
   hashing. Consider the same for `/icons/*`, the manifest, and `da-DK.pls`. Keep HTML uncached.
   Verify with `curl -I` against a deployed URL that the header is present.
2. **Re-encode the SFX (P2).** Recompress `public/sounds/ui/*.ogg` to appropriate bitrate/duration
   (they're short cues); target <50 KB each where possible. Keep the same filenames.
3. **Delete the Lottie stack (P3).** Replace `LottieCharacter` usages with the emoji/CSS component it
   already is (or inline the emoji states). Remove `lottie-react` and `react-intersection-observer`
   from `package.json`. Remove `lottie`/`react-confetti` from the eager `media-vendor` manualChunk so
   confetti lazy-loads with `CelebrationEffect`.
4. **Lazy-load the adult stack (P4).** `React.lazy` `VoiceOverridePanel`/`DifficultyPanel`/
   `BugReportDialog` behind the adult-menu open, so voicelab data + dialogs leave the main chunk.

## Acceptance criteria

- [ ] A production response for a `/sounds/*` file carries a cacheable `Cache-Control` (not
      `no-store`); a second launch does not re-download the music (verify in devtools Network / disk
      cache).
- [ ] SFX files are materially smaller with no audible regression.
- [ ] `lottie-react` / `react-intersection-observer` no longer in the dependency graph; first-paint
      JS is smaller (compare `vite build` chunk output before/after).
- [ ] Adult dialogs load on demand, not on first paint.
- [ ] App still runs cleanly (harness sweep, 0 console errors).

## How to verify

- `npm run build` and compare the reported chunk sizes before/after (record the numbers in the PR).
- `curl -I https://preschool-learning-app.vercel.app/sounds/music/kid.mp3` after deploy → confirm the
  new cache header (local dev won't show Vercel headers).
- `ui-screenshot` harness sweep across a few routes for regressions.

## Risks / notes

- HTML and the SW (if any — see PRD-08) must remain uncached so deploys are picked up; only cache
  fingerprinted/static media.
- Confirm nothing else imports `lottie-react` before removing it (`grep`).
