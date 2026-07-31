# Gemini prompts — child-profile avatars (12 portraits)

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

## Implementer notes (for the session that keys and wires these)

Not owner-facing — this is the hand-off half.

**Keying.** Standard sprite path from `.claude/rules/scene-assets.md`: hysteresis flood-fill on
**green-EXCESS** (`g − max(r,b)`), then trim + square-contain (these are sprites, not scene layers), then
despeckle to drop any ✦ watermark. `frog` and `turtle` are the two subjects sharing the screen's hue —
run the green-excess histogram on those two and **skip the faint-green grow** for them, exactly as the
jungle-foliage sprites do. Verify all 12 composited over **magenta** before wiring.

**Landing spot.** `src/assets/avatars/` with the same glob-manifest shape as `src/assets/rewards/` and
`src/assets/ui/` — `avatarArt(id)` returning the WebP or `undefined`.

**This surface needs a SCHEMA change, not just a swap — it is the reason W4 left it allowlisted.**
`ChildProfile.avatarEmoji` is *persisted* (localStorage roster + the `childProfile` Postgres table via
`lib/auth-family-plugin.ts`) and *validated server-side*: `cleanAvatar` in `api/profiles.ts`
deliberately **rejects anything with ASCII letters or digits**, on the grounds that "an avatar is a
pictograph". So storing `'fox'` fails validation today. The wiring batch must:

1. Add an `avatarId` concept alongside `avatarEmoji` (don't repurpose the field — existing rows hold
   glyphs, and profiles sync across devices, so old and new clients coexist).
2. Widen or replace `cleanAvatar` to accept the closed id set, and keep rejecting free text/markup —
   an allow-LIST of the 12 ids is the right shape here, not a looser pattern.
3. Map the 12 legacy glyphs → the 12 new ids for existing profiles (1:1 by design — the owner kept the
   same 12 subjects precisely so nobody's avatar changes meaning).
4. Update all **four** render sites, not just the picker:
   `CreateProfileDialog` · `ProfilePicker` · `ProfilesPanel` · `AdoptLegacyDialog`.
5. Then drop the `CreateProfileDialog.tsx` entry from `ALLOWED_FILES` in `src/config/noEmoji.test.ts`
   and add an `avatarArt(id)` coverage assertion for all 12 (the D5 pattern used by
   `gameIcons.test.ts` / `themes.test.ts`).

**Sizing.** The current grid tiles are `aspectRatio: 1/1, minHeight: 44` with the glyph at
`fontSize: 1.6rem`. An `<img>` has different intrinsic sizing than a text glyph, so give it explicit
width/height (PRD-01 §10 — measure the rects, don't eyeball) and re-check `390×844` portrait, where the
6-column grid is tightest.
