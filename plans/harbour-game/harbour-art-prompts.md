# Fyld Båden — art inventory (to become paste-ready Gemini batches in W0)

Status: **inventory only**, authored 2026-10-13 with the PRD. W0 turns each group into 4-per-message
batches using the exact opener in `.claude/rules/scene-assets.md` ("Generate 4 SEPARATE images…"), with
per-subject keying notes inline. Owner generates; save with right-click (no ✦ watermark). Style: the
app's soft-3D clay, Pixar-lite, warm, child-safe. **No text, letters or numerals in any image** — the
sail numeral is Typography.

Bar (owner, 2026-10-13): this is the app's quality benchmark — generate extra variants and pick the best
on the contact sheet rather than accepting a first render.

## A. Harbour backdrop (scene convention, NOT the keyed 1:1 opener)
Wide, layered, for parallax-free full-bleed use; follow `scene-assets.md`'s scene-layer rules.
1. Sky + distant Danish harbour town (colourful gabled houses, a church spire, soft clouds) — far layer.
2. Mid layer: breakwater / lighthouse at the harbour mouth (no light beam).
3. Water: 2–3 horizontally tileable wave bands (front darker, back lighter) for CSS drift — a seam test
   is part of the contact sheet.

## B. Quay (keyed, 1:1)
4. Wooden quay section with bollards, viewed side-on, top surface flat enough to hold two piles.
5. Pile of single wooden crates (the "endless" crate source).
6. Pile of pallets-of-ten (the "endless" pallet source).
7. Rope coil + small crane hook (for the bundling show).

## C. Load units (keyed, 1:1) — the learning objects, highest priority
8. ONE single wooden crate, front view, chunky, instantly readable at 48px.
9. ONE pallet carrying exactly **ten** crates arranged **2×5**, every crate distinct — a 5-year-old
   must see "ten" without counting. Generate several; reject any that blurs the units.
10. Ghost/outline versions are produced in code (opacity/outline), not generated.

## D. Boats (keyed, each type in separate layers around ONE shared deck)
For each of fiskerbåd, færge, slæbebåd, fragtskib: (a) back layer — cabin/mast with a **blank** sail or
banner board; (b) front layer — hull, side-on, waterline flat. Plus:
11. The shared deck: a flat wooden deck plate with two 2×5 bays of shallow slots (pallet bay + crate bay).
12. A small pennant flag (flutter is CSS).
Keying: hulls in green paint need a per-file `*_KEY_OVERRIDES`; anything blue-green near water needs
"flat #00FF00, NOT a sky/sea" stated twice.

## E. Effects and props (keyed, 1:1)
13. Bow wake splash (2 frames: small, big).
14. Small dust/sawdust puff (bundling).
15. Two seagulls: standing on a bollard, wings up taking off.
16. Horn button: a chunky brass ship's horn on a round base.

## F. Menu icon
17. `math.boat` icon — a little loaded cargo boat, matching the existing game-icon set's framing.

## SFX / ambience (free, not Gemini) — licence logged per file
horn · bow splash · crate thud (wood on wood) · pallet clunk (heavier) · bundle (rope creak + puff) ·
boat arrive (small engine chug) · harbour ambience loop (soft waves, distant gulls, no voices/music).
Sources: Kenney (CC0), Sonniss GDC bundle (royalty-free, no attribution; no AI training/resale). MP3 via
`scripts/transcode-sfx.mjs`.
