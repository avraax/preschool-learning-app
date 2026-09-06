# Gemini prompts — the body-part re-shoot (`mouth`, and optionally `foot` / `leg`)

Owner-facing. Generate these in Gemini, save them as described, drop the folder path back to a session.

## Why this exists

The owner's son answered **"mouth"** in Lyt og Find with the tile showing a girl — and he was right to.
The mapping is correct (`mouth` → `src/assets/games/shared/mouth.webp`); the **picture** is wrong for the
job. Verified by rendering all 18 files in that folder as one labelled contact sheet:

- **The convention that works is "a child POINTING at the part."** `ear`, `eye`, `nose`, `hair`, `arm` and
  `hand` all do it, and all use the same recurring brown-haired child in a green top.
- **`mouth.webp` breaks it twice**: there is no pointing gesture at all, and the face is a *different
  character* — a blonde child. So it reads as a person, not a body part, and at answer-tile size it is
  not distinguishable from `girl.webp`, which is in the same shared pool.
- `tooth` is the clearest of the whole set, because the part is the entire subject.

**Nothing existing can be re-pointed to** — there is no other mouth render in the repo. This needs one
new image. `foot` and `leg` are weak by the same standard (a standing boy, no gesture indicating the
part) and are included as optional, since Gemini returns four images per message anyway.

## The batch — ONE message, 2×2 grid

Paste this as a single prompt. Gemini returns four full-resolution images from one message; render as a
2×2 grid on **one** green background and split into quadrants before keying (1024 ÷ 2 = 512 per subject,
which clears the ≤40 KB square-WebP target comfortably).

> A 2×2 grid of four separate soft-3D cartoon illustrations of **the same** friendly young child —
> short brown hair, light skin, plain green t-shirt, warm and child-safe — each clearly indicating one
> body part with a pointing finger, matte clay/vinyl toy look, gentle top-left key light with soft rim
> light, soft contact shadow, slight 3/4 top-down angle, single centred subject per quadrant, cheerful
> and calm expression, **no text or letters anywhere**, flat solid `#00FF00` background edge to edge
> behind all four, square 1:1, highest resolution.
>
> 1. **mouth** — head and shoulders, facing forward, mouth **open in a clear happy smile** so the mouth
>    is unmistakably the subject, one index finger pointing directly at their own open mouth. The mouth
>    must be the most salient thing in the frame. *Remember: flat solid `#00FF00` behind it.*
> 2. **foot** — seated on the floor, one bare foot lifted toward the viewer, one index finger pointing
>    at that foot. The foot is the largest element in frame.
> 3. **leg** — standing, one hand pointing at their own thigh/shin, that leg turned slightly toward the
>    viewer so it reads as the subject.
> 4. **tooth-check (reference only, do not save)** — the same child smiling with teeth visible, so the
>    mouth render in quadrant 1 can be compared against it for consistency.

**Only quadrant 1 is required.** Quadrants 2 and 3 are the optional improvements; quadrant 4 exists to
give the model the same character twice so quadrant 1 stays on-style, and is thrown away.

## Saving

- **Right-click → "Save image as…" — NEVER the download button on the image.** The embedded button
  exports a processed/branded copy that stamps the ✦ sparkle marker and can composite in stray extra
  elements. This is the "elements got added on download" mystery.
- Gemini's in-chat preview **crops** — check the render full size before accepting it.
- PNG, `#00FF00`, square, highest resolution. Name the split files by their content id: `mouth.png`,
  and if you keep them, `foot.png` / `leg.png`.

## What a session does with them

Drop the folder path. The session splits the grid, keys out the green with the `sharp` pipeline, writes
`src/assets/games/shared/<id>.webp` **in place** (there is no clean source to re-key from later, so the
keyed WebP is the master), and re-renders the contact sheet to confirm the swap.

**No code change is needed** — `sharedArtMap` globs the directory, so a replaced file auto-registers
under the same key. The existing coverage guard already fails the build if a file goes missing, and
there is no emoji fallback that could silently reappear.

## The check that decides whether it worked

Not "does it look nice": **cover the label and ask whether the picture could only be a mouth.** That is
the test the current render fails, and it is the same test `ear`/`eye`/`nose` pass. Then put it in front
of the 5-year-old with `girl` as one of the distractors — the pair that produced the original report.
