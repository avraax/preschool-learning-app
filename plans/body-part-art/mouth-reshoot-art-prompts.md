# Gemini prompts — the body-part re-shoot (`mouth`, and optionally `foot` / `leg`)

Owner-facing. Generate these in Gemini, save them as described, drop the folder path back to a session.

## Why this exists

The owner's son answered **"mouth"** in Lyt og Find with the tile showing a girl — and he was right to.
The mapping is correct (`mouth` → `src/assets/games/shared/mouth.webp`); the **picture** is wrong for the
job. Verified by rendering all 18 files in that folder as one labelled contact sheet:

- **The convention that works is "a child POINTING at the part."** `ear`, `eye`, `nose`, `hair`, `arm`
  and `hand` all do it: an index finger on the feature, head-and-shoulders bust, soft-3D clay look.
- **The children are DELIBERATELY DIFFERENT from each other.** `ear` and `eye` share one brown-haired
  child in a green top; `nose` is a dark-curly-haired child with darker skin; `hair` is a third with big
  curly brown hair in teal. An earlier draft of this doc claimed a single recurring character and asked
  for `mouth` to match it — that was wrong, and following it would have made the set *less* diverse.
  **Match the STYLE, not the child.**
- **So `mouth.webp` has exactly one defect: nothing points at the mouth.** It is a blonde child's face
  with an open smile and no gesture, which at answer-tile size is not distinguishable from `girl.webp`
  in the same shared pool. The blonde hair was never the problem.
- `tooth` is the clearest of the whole set, because the part is the entire subject.

**Nothing existing can be re-pointed to** — there is no other mouth render in the repo. This needs one
new image. `foot` and `leg` are weak by the same standard (a standing boy, no gesture indicating the
part) and are included as optional, since Gemini returns four images per message anyway.

## Upload the style reference

Attach **`STYLE-REFERENCE-existing-body-parts.png`** (next to this file) to the Gemini message. It is
`ear` · `eye` · `nose` · `hair` side by side — the four that already work — so the model matches the
lighting, the clay finish, the bust crop and the pointing gesture without a paragraph of adjectives.

**It is NOT a content reference** (Gemini knows what a mouth is) and it is flattened onto **white**, so
the prompt has to override that explicitly or the render comes back on white instead of green.

## The prompt — paste this, with the reference attached

Only `mouth` is required, so render it **alone at full resolution** rather than as a grid quadrant —
better detail, and there is nothing to split.

> Using the attached image only as a STYLE reference, create one new illustration in exactly that
> style: the same soft-3D matte clay/vinyl toy look, same gentle top-left key light with soft rim
> light, same head-and-shoulders bust crop with the rounded cut-off at the shoulders, same friendly
> calm expression.
>
> **Subject: a young child pointing at their own MOUTH.** Facing forward in a slight 3/4 view, mouth
> **open in a clear happy smile** so the mouth is unmistakably the subject of the picture, one index
> finger raised and touching the corner of their open mouth — the same gesture the reference uses for
> the ear, the eye and the nose. The mouth must be the most salient feature in the frame.
>
> Give the child their own look rather than copying the reference child — the set is deliberately
> diverse. Single centred subject, no other objects, no text or letters anywhere, warm and child-safe.
>
> **Background: flat solid `#00FF00` green, edge to edge, behind the whole image. Not white, not a
> gradient, not a scene** — the reference is on white only because it has already been cut out.
>
> Square 1:1, highest resolution.

## Optional, same session: `foot` and `leg`

Both show a standing boy with no gesture indicating the part, so they are weak by the same standard —
though **unlike `mouth` neither has been reported as actually confusing anyone**, so this is polish.
If you want them, run a second message with the same reference attached and the same style paragraph:

> …**Subject: a young child pointing at their own FOOT** — seated on the floor, one bare foot lifted
> toward the viewer, one index finger pointing at that foot, the foot the largest element in frame.
> (and, as a separate image) **a young child pointing at their own LEG** — standing, one hand pointing
> at their own thigh, that leg turned slightly toward the viewer.
>
> Same style, same diversity note, same flat solid `#00FF00` background edge to edge, square 1:1.

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
