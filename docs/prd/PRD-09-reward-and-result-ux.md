# PRD-09 — Reward & result-screen UX

**Priority:** P2
**Scope:** Small–Medium
**Depends on:** none (light overlap with PRD-06 on the audio-permission modal)

---

## Context

A round ends on `src/components/common/RoundResultScreen.tsx` (stars → "Ny rekord!" ribbon →
`StickerReveal` → replay/album/back buttons). Rewards come from a 36-emoji global pool
(`src/config/stickers.ts`): 1 sticker per round + 1 bonus on any new personal best, plus session-local
exploration-milestone stickers in the browse games. The sticker album is `/album`
(`src/components/hub/StickerAlbum.tsx`). Progress persists via `progressStore`. The audio permission
modal is `src/components/common/SimplifiedAudioPermission.tsx`; the update button is
`src/components/common/UpdateBanner.tsx` (+ `useUpdateChecker.ts`); the parent reset lives in the
"Til de voksne" menu (`src/components/adult/AdultCorner.tsx`) behind an `AdultGate`.

## Problems (with evidence)

### P1 — Result-screen buttons are tappable while invisible for ~3s

The actions row animates in with framer-motion `initial={{ opacity: 0 }}` at delay `buttonsAt` ≈
2.9–3.4s (`RoundResultScreen.tsx` ~66–69, 259–304). Opacity doesn't disable pointer events, so three
invisible buttons (Spil igen / Se bog / Tilbage) sit exactly where the child was tapping answer tiles —
an excited tap-burst can navigate away or replay before the sticker is even seen. There's also no
intentional tap-to-skip; ~3.4s of ceremony every round (~35s over a 10-round session), and the
timeline always allots 3 star-steps even for a 1-star result (dead air).

### P2 — "Nyt klistermærke!" is spoken for duplicates

Once all 36 stickers are owned, every award is a duplicate; the banner correctly switches to
"Skinnende! ✨" (`StickerReveal.tsx`) but the spoken summary still says "Du fik et nyt klistermærke: X"
(`RoundResultScreen.tsx` ~97–100), and the browse-game milestones speak "Nyt klistermærke!"
unconditionally. Audio contradicts the visual exactly when the album completes.

### P3 — Sticker economy has no long tail

36 stickers (4 sets × 9); 1–2 per round; while anything is uncollected every award is guaranteed-new,
and the first round of each of ~19 gameIds always sets a "best" (bonus sticker). A keen child completes
the album in ~20–30 rounds (a weekend), after which every reward forever is a duplicate and the
`pageCompleted` fanfare can never fire again.

### P4 — The update button is child-operable

`UpdateBanner` is a large ungated Fab that calls `window.location.reload()` and appears mid-game via
10-minute polling. `dismissUpdate` exists but is unwired (no dismiss affordance). When shown, the adult
corner button relocates on top of the bottom-left mascot, so mascot taps hit settings.

### P5 — Parent reset wipes more than it says

The gate text promises resetting "alle klistermærker, rekorder og stjerner", but
`progressStore.resetAll()` commits `defaultState()` — also wiping `sfxEnabled`, `musicEnabled`, and the
entire Let/Normal/Svær difficulty configuration.

### P6 — Small polish
- Album: tapping an uncollected sticker does nothing (silent) — confusing at 5. Add a wiggle + a soft
  "not yet" cue.
- `RestartButton` default label is "Ny spil" — should be **"Nyt spil"** (spil is neuter).
- The audio-permission modal is adult-worded and full-screen on every cold start (see PRD-06 for the
  iOS-priming fix; here, consider making it lighter / auto-dismiss on first interaction).

## Goals / Non-goals

**Goals:** the reward moment is seen before it can be dismissed, and can be fast-forwarded; audio
matches the visual; a longer collection tail; the update button is adult-gated; reset does what it
says.

**Non-goals:** the audio engine/iOS unlock internals (PRD-06); new game mechanics.

## Implementation plan

1. **Result screen (P1).** Gate `pointer-events` on the actions row until it's visible (tie to the
   same `buttonsAt` timing, or set `pointerEvents: 'none'` until the animation completes). Add
   **tap-anywhere-to-fast-forward** that jumps the timeline to the buttons state. Collapse the star
   timeline to the actual star count so a 1★ result doesn't wait through 3 star-steps.
2. **Duplicate wording (P2).** Branch the spoken summary on `isNew`: "Nyt klistermærke: X" vs
   "Skinnende X!" (or similar). Apply the same branch to the browse-game milestone lines.
3. **Economy (P3).** Add 2–3 more sticker sets (pure data in `stickers.ts`) and start passing
   `stickerSetId` per section (the plumbing already exists end-to-end through `useRound` →
   `progressStore`). This turns a weekend into a multi-week collection with per-section page payoffs.
4. **Update button (P4).** Route the update through the adult menu (or make it hold-to-apply / gated),
   wire `dismissUpdate`, and fix the corner/mascot z-index collision when the banner is shown.
5. **Reset scope (P5).** Either preserve `sfxEnabled`/`musicEnabled`/`difficulty` across
   `resetAll()`, or change the gate text to say settings are included. Preserving is the less
   surprising choice.
6. **Polish (P6).** Album: wiggle + soft cue on locked-sticker tap. Fix "Ny spil" → "Nyt spil".
   Consider a lighter audio-permission modal.

## Acceptance criteria

- [ ] Tapping where the answer tiles were, at the instant a round ends, does not navigate/replay; the
      buttons only respond once visible.
- [ ] A single tap on the result screen fast-forwards to the buttons.
- [ ] With a full album, the spoken line matches the "Skinnende" visual (no "nyt" for duplicates).
- [ ] More than 36 stickers exist and sections bias toward their own sets.
- [ ] The update button cannot be triggered by a child without the adult gate; it can be dismissed.
- [ ] After a parent reset, sound/music/difficulty settings are retained (or the text admits they
      aren't).
- [ ] "Nyt spil" label; locked album stickers give feedback on tap.

## How to verify

- Drive a full round in the `ui-screenshot` harness; at round end, immediately `--click` the tile
  coordinates and assert the route didn't change; then tap once and assert the buttons appear early.
- With a seeded full-album `progressStore` state, finish a round and read the `/api/tts-azure` POST
  body to confirm the spoken line says "Skinnende", not "nyt".
- Screenshot the album and the update banner; confirm gating and the corner/mascot layering.

## Risks / notes

- Keep the celebration feel — fast-forward should feel like "skip", not "cancel"; the sticker must
  still be recorded and shown.
- Coordinate the audio-permission modal changes with PRD-06 so the iOS-priming and the UX-lightening
  don't conflict.
