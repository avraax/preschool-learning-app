# Gemini prompts — child-profile avatars (12 portraits)

> **STATUS: DONE (2026-08-01).** All 12 renders landed, were keyed by
> `node scripts/optimize-theme-art.mjs avatars`, and are wired. Kept as the record of the batch —
> re-run the prompts below if a subject ever needs regenerating. What the wiring actually took is at
> the bottom, in *Implementer notes*, corrected against what was found.

**Date:** 2026-07-31 · **For:** de-emoji PRD-01, the last child-facing emoji surface
(`src/components/auth/CreateProfileDialog.tsx`, the 12 `AVATARS` glyphs).
**Owner decisions (locked 2026-07-31):** 12 **new dedicated portrait renders** · **today's 12 animals**,
unchanged · **6×2 grid**, unchanged.

Copy **one prompt at a time** into Gemini. Each is complete on its own — no prompt depends on having
read another. Style, background and output rules are inlined in every one deliberately.

---

## Before you start — read once

**Attach 2–3 style references to EVERY generation.** Use existing app art so the batch matches:
`src/assets/themes/icons/alphabet.webp`, `.../colors.webp`, `.../english.webp` (or the higher-res
`art-src/icons/*.png`). Then **re-use your first good render as an extra reference on all the rest** so
the 12 read as one set — this matters more here than anywhere else in the app, because all 12 sit in a
single grid at the same size, where any drift in head scale or eye style is immediately visible.

**No content reference photos needed.** All 12 are common animals; Gemini renders them fine from text.

**Why portraits and not the usual 3/4 full-body subject.** These render inside a **44–64px circular
badge**, much smaller than a game tile. A full-body animal at that size becomes an unreadable blob, so
this batch is framed as **head-and-shoulders, facing the viewer** — the face fills the frame and stays
legible when the circle crops the corners away.

**Download gotcha — this one has bitten us repeatedly.** Save each render with **right-click → "Save
image as…"**, NEVER the download button drawn on the image itself. That button exports a
*processed/branded* copy which stamps a ✦ sparkle marker and can composite in stray extra elements
(a floating bar, a frame) that were not in the render. Also: Gemini's in-chat preview crops — open each
render **full size** before deciding it's good, don't judge from the thumbnail.

**Naming.** Save each file as the id given in its prompt heading (`fox.png`, `bear.png`, …), then hand
over the folder path. Filenames from Gemini are random hashes, so the ids are how they get matched up.

---

## The 12 prompts

### 1 · `fox`

> A friendly red fox, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D claymation
> style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle rim light,
> a soft contact shadow beneath. Warm, cheerful and completely child-safe — big friendly eyes, a
> soft closed smile, no visible teeth, nothing sharp or scary. Slight 3/4 top-down angle. The head
> fills most of the frame. Single subject, no props, no text or letters. Flat solid #00FF00
> background, edge to edge. Square 1:1, highest resolution.

### 2 · `bear`

> A friendly brown bear cub, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D
> claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle
> rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — round soft
> ears, big friendly eyes, a soft closed smile, no visible teeth or claws. Slight 3/4 top-down
> angle. The head fills most of the frame. Single subject, no props, no text or letters. Flat solid
> #00FF00 background, edge to edge. Square 1:1, highest resolution.

### 3 · `rabbit`

> A friendly white-and-grey rabbit, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D
> claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle
> rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — long soft
> upright ears kept INSIDE the frame, big friendly eyes, a soft closed smile. Slight 3/4 top-down
> angle. The head fills most of the frame. Single subject, no props, no text or letters. Flat solid
> #00FF00 background, edge to edge. Square 1:1, highest resolution.

### 4 · `owl`

> A friendly little owl, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D claymation
> style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle rim light, a
> soft contact shadow beneath. Warm, cheerful and completely child-safe — big round friendly eyes,
> soft rounded feathers, a small blunt beak, no sharp talons. Slight 3/4 top-down angle. The head
> fills most of the frame. Single subject, no props, no text or letters. Flat solid #00FF00
> background, edge to edge. Square 1:1, highest resolution.

### 5 · `cat`

> A friendly orange tabby cat, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D
> claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle
> rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — big friendly
> eyes, soft rounded ears, a soft closed smile, no visible teeth or claws. Slight 3/4 top-down
> angle. The head fills most of the frame. Single subject, no props, no text or letters. Flat solid
> #00FF00 background, edge to edge. Square 1:1, highest resolution.

### 6 · `dog`

> A friendly puppy with soft floppy ears, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered.
> Soft-3D claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a
> gentle rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — big
> friendly eyes, a soft happy expression, no visible teeth. Slight 3/4 top-down angle. The head
> fills most of the frame. Single subject, no props, no collar, no text or letters. Flat solid
> #00FF00 background, edge to edge. Square 1:1, highest resolution.

### 7 · `unicorn`

> A friendly pastel unicorn, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D
> claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle
> rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — a short BLUNT
> rounded horn (not a sharp spike), a soft pastel rainbow mane, big friendly eyes, a soft closed
> smile. Slight 3/4 top-down angle. The head fills most of the frame, horn kept inside the frame.
> Single subject, no props, no text or letters. Flat solid #00FF00 background, edge to edge.
> Square 1:1, highest resolution.

### 8 · `frog`

> A friendly green frog, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D claymation
> style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle rim light, a
> soft contact shadow beneath. Warm, cheerful and completely child-safe — big round friendly eyes, a
> wide soft closed smile, smooth rounded skin, no slime. Slight 3/4 top-down angle. The head fills
> most of the frame. Single subject, no props, no text or letters. Flat solid #00FF00 background,
> edge to edge. Square 1:1, highest resolution.
>
> *(Keep the green clearly MUTED — a soft sage/olive green, never vivid. The frog is the one subject
> in this batch that shares the background's hue, and a vivid green frog is much harder to key out.)*

### 9 · `penguin`

> A friendly little penguin chick, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D
> claymation style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle
> rim light, a soft contact shadow beneath. Warm, cheerful and completely child-safe — big friendly
> eyes, a small blunt orange beak, soft rounded body. Slight 3/4 top-down angle. The head and chest
> fill most of the frame. Single subject, no props, no text or letters. Flat solid #00FF00
> background, edge to edge. Square 1:1, highest resolution.

### 10 · `butterfly`

> A friendly butterfly seen FROM THE FRONT with its wings spread symmetrically, centered, filling
> the frame like a portrait. Soft-3D claymation style, Pixar-lite: rounded matte clay surfaces, soft
> top-left key light with a gentle rim light, a soft contact shadow beneath. Warm, cheerful and
> completely child-safe — a soft rounded body, a small friendly face with big eyes, gently curled
> antennae, wings in warm blue and orange patterns. Slight top-down angle. Wingtips kept inside the
> frame. Single subject, no flowers, no text or letters. Flat solid #00FF00 background, edge to
> edge. Square 1:1, highest resolution.
>
> *(This is the one subject that can't be a head-and-shoulders shot — wings spread front-on is the
> equivalent framing, and it's what makes a butterfly readable at badge size.)*

### 11 · `turtle`

> A friendly little turtle, HEAD AND SHOULDERS PORTRAIT facing the viewer with its head and the
> front of its shell visible, centered. Soft-3D claymation style, Pixar-lite: rounded matte clay
> surfaces, soft top-left key light with a gentle rim light, a soft contact shadow beneath. Warm,
> cheerful and completely child-safe — big friendly eyes, a soft closed smile, a rounded patterned
> shell. Slight 3/4 top-down angle. The head fills most of the frame. Single subject, no props, no
> text or letters. Flat solid #00FF00 background, edge to edge. Square 1:1, highest resolution.
>
> *(Keep the shell and skin in warm browns/olive-tan rather than a vivid green, so the key is clean.)*

### 12 · `lion`

> A friendly lion cub, HEAD AND SHOULDERS PORTRAIT facing the viewer, centered. Soft-3D claymation
> style, Pixar-lite: rounded matte clay surfaces, soft top-left key light with a gentle rim light, a
> soft contact shadow beneath. Warm, cheerful and completely child-safe — a soft fluffy golden mane,
> big friendly eyes, a soft closed smile, NO bared teeth, no roaring, nothing fierce. Slight 3/4
> top-down angle. The head fills most of the frame. Single subject, no props, no text or letters.
> Flat solid #00FF00 background, edge to edge. Square 1:1, highest resolution.

---

## Implementer notes — what the wiring actually took (2026-08-01)

**Keying.** `node scripts/optimize-theme-art.mjs avatars` (192px, 0.94 fill). The W3 `optimizeUi` pass
was generalised into a shared `greenKeySprite()` + `optimizeGreenBatch()` — the UI outputs came back
byte-identical, so the refactor is a proven no-op.

The faint-grow skip anticipated for `frog`/`turtle` turned out to be **unnecessary**: the measured
green-excess gap is huge (subject max **16** and **2** vs screen **134** and **141**), so the shared
hysteresis clears them untouched. Worst residual green-excess across all 12 after keying is 18. Verified
over magenta — no fringe, no stray ✦.

**Landing spot.** `src/assets/avatars/` (glob manifest, `avatarArt(id)`), ids + labels + the legacy map
in `src/config/avatars.ts` — PURE and Node-importable, so `api/profiles.ts` and `dev-server.js`
validate against the SAME list as the client.

**The schema change was smaller than expected — no DB migration.** The wire/TS field is now `avatarId`
carrying `'fox'`, but the Postgres **column keeps its `avatarEmoji` name**: renaming it would mean a
migration against the owner's live Neon DB (which `.claude/rules/auth.md` says never to touch for
verification) for zero behavioural gain. The mapping happens in `publicShape`/`cleanAvatar`, the only
code that touches the row shape.

`cleanAvatar` was **inverted**, not widened: the old rule was "reject ASCII letters/digits, an avatar is
a pictograph" — exactly backwards once avatars ARE ascii ids. It is now an **allow-list** over the 12,
still accepting a known legacy glyph (so a client running older JS mid-deploy isn't rejected) but
refusing an unrecognised one rather than silently defaulting to a fox.

Corrections to the plan above:
- **Three render sites, not four** — `AdoptLegacyDialog` was deleted by the accounts clean-sheet commit.
  The live set is `CreateProfileDialog` · `ProfilePicker` · `ProfilesPanel`.
- **`dev-server.js` also had to change** (`.claude/rules/api-endpoints.md`: every endpoint is mirrored).
  Missing that shows up as a 404/400 only in dev.
- **`src/config/avatars.ts` needs no `noEmoji` allowlist entry**: the legacy glyph table is written as
  `\u{…}` escapes, so the file carries no literal emoji.

**Sizing.** Measured, not eyeballed: tiles are 59×59 on iPad, 60×60 phone-landscape, 44×44 phone-portrait
(the `minHeight: 44` floor holds), all inside the dialog bounds, and the dialog's own height is unchanged
from the emoji version.
