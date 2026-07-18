# PRD-18 — Theme-World Scene Fixes (keying, stray objects, composition)

**Status:** ready to implement (fresh session)
**Branch:** `feat/scene-fixes` off `master`
**Owner context:** the four registered theme worlds (`kid` Regnbue, `ocean` Havet, `space` Rummet,
`dino` Dinosaurer) were rebuilt in the Liveliness PRD-05 "Structured World" pass with Gemini-rendered,
green-screen-keyed, multi-layer parallax art. They look good overall but carry a set of rendering /
keying defects and two composition weaknesses. This PRD fixes all of them so every scene is clean
(no stray objects, no un-keyed dark blobs, no leftover watermarks) and well-composed on every
surface and aspect ratio.

**Read first:** `.claude/rules/scene-assets.md` (the green-screen keying pipeline, the "put the
temp `sharp` `.mjs` in the repo root and delete it after" rule, and the "verify over magenta"
discipline). Also CLAUDE.md's "Scene & mascot" bullet for runtime behavior.

**Reference captures (do not delete — the audit baseline):** `tmp/scene-audit/`
- `<theme>-home.png` / `-home-phone.png`, `<theme>-{alphabet,math,farver,english,ordleg}.png`,
  `<theme>-album.png`, `<theme>-game-quiz.png` — rendered surfaces, tablet-landscape 1194×834
  (phone = 540×960).
- `_mag-<theme>-scene-{mid,near}.png`, `_far-<theme>.png` — raw layers over magenta / far backdrops.
- `_poc-space-mid.png` (real alpha) + `_poc-space-mid-mag.png` — the **proven** space-mid isolate.
- `FINDINGS.md` — the audit write-up.

## How the scene renders (essential background)

- Art per world lives in `src/assets/themes/<id>/`: `scene-far.webp` (opaque backdrop, no alpha),
  `scene-mid.webp` + `scene-near.webp` (transparent parallax layers), `mascot*.webp`,
  `bloom-*.webp`, `companion-*.webp`, `ambient-*.webp`, `thumb.webp`. Index-aligned to the non-asset
  config in `src/theme/tokens/<id>.tokens.ts` under `scene:` (`layers[]`, `ambient`, `homeAnchors`,
  `sectionFocus`, `bloomScenery`). Wiring is in `src/assets/themes/<id>/index.ts`.
- **There are NO per-layer green-screen source PNGs.** `art-src/<id>/` holds only a single combined
  `scene.png` + `mascot.png` + `thumb.png`; the shipped far/mid/near WebPs are the only per-layer
  artifacts. **Therefore all keying fixes operate on the shipped `.webp` files in place** (re-encode
  back to WebP, keep alpha, stay within the per-theme budget noted in scene-assets.md).
- All processing is one-off `sharp` scripts placed in the **repo root** (so `import 'sharp'`
  resolves `node_modules/sharp`) and **deleted after** (a failed `node x.mjs && rm x.mjs` leaves the
  script behind — check `git status` for stray `*.mjs` before committing).
- `sharp` is available (used throughout the audit). Node 22+, global fetch/WebSocket.

## Verification harness (used at every checkpoint)

1. **Offline (fastest):** composite the reprocessed WebP over magenta and eyeball for leftover green,
   stray objects, or hard edges — reuse the audit's recipe:
   ```js
   // _v.mjs (repo root, delete after)
   import sharp from 'sharp'
   const p='src/assets/themes/space/scene-mid.webp', m=await sharp(p).metadata()
   const bg={create:{width:m.width,height:m.height,channels:4,background:{r:255,g:0,b:255,alpha:1}}}
   await sharp(bg).composite([{input:p}]).png().toFile('tmp/scene-audit/_check.png')
   ```
   Then Read the PNG.
2. **In-app (the real test):** dev servers must run in **Windows PowerShell, not WSL** (memory
   `project_dev-server-windows-not-wsl`): `node --env-file=.env.local dev-server.js` (3001) +
   `node node_modules/vite/bin/vite.js --host 127.0.0.1` (5173). Vite HMR picks up the new WebP
   on reload. Re-capture with the `ui-screenshot` skill across **all 4 skins** and both aspects,
   e.g.:
   ```
   node .claude/skills/ui-screenshot/cdp.mjs --port 9333 \
     --url "http://127.0.0.1:5173/?theme=space&nogate=1" --w 1194 --h 834 \
     --wait-for '#root > *' --settle 1400 --out tmp/scene-audit/verify-space-home.png
   ```
   Surfaces that matter per theme: `/` (home, landscape + phone `--w 540 --h 960`), the 5 section
   menus, `/album`, and one game route (`/alphabet/quiz`). The scene is only dimmed (not hidden) on
   game routes, so artifacts must be gone there too.
3. Always check the driver's printed "console errors / page exceptions" — 0 expected.

---

## Workstream A — Keying / stray-object / watermark fixes (MANDATORY, art-free)

### A1. Space `scene-mid.webp` — isolate the central planet (THE headline bug)

**Defect:** the mid layer should contain ONLY the central blue ringed planet. Instead its lower
third is an un-keyed **dark-space band** (dark, not green → green-excess keying left it opaque)
containing a **second ringed Earth-globe + a moon + a duplicate rocket + baked stars**. Consequences
seen across home/menus/album/games: the "dark smudge" upper-right (the band, scaled by parallax), a
"partial second planet in the lower-left" (the Earth-globe), and stray blue-streak / rainbow-arc
fragments between the asteroids. See `_mag-space-scene-mid.png`.

**Fix (proven — see `_poc-space-mid-mag.png`):** keep only the central planet+ring via a feathered
**elliptical `dest-in` mask**, dropping everything else to transparent. Measured on the 2048×1143
`scene-mid.webp`: ellipse center **(1010, 530)**, radii **rx 400, ry 205**, soft edge ramp
**0.28** (alpha ramps 255→0 between normalized distance d=1 and d=1.28). Script:
```js
// _fix-space-mid.mjs (repo root, delete after)
import sharp from 'sharp'
const p='src/assets/themes/space/scene-mid.webp'
const m=await sharp(p).metadata(); const W=m.width,H=m.height
const cx=1010, cy=530, rx=400, ry=205, soft=0.28
const mask=Buffer.alloc(W*H*4)
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-cx)/rx, dy=(y-cy)/ry, d=Math.sqrt(dx*dx+dy*dy)
  let a=255; if(d>=1+soft)a=0; else if(d>1)a=Math.round(255*(1-(d-1)/soft))
  const i=(y*W+x)*4; mask[i+3]=a
}
const maskPng=await sharp(mask,{raw:{width:W,height:H,channels:4}}).png().toBuffer()
await sharp(p).ensureAlpha().composite([{input:maskPng,blend:'dest-in'}])
  .webp({quality:88}).toFile('src/assets/themes/space/scene-mid.webp') // overwrite in place
```
**Acceptance:** over magenta, ONLY the Saturn planet + full ring remain; no globe/moon/rocket/band/
stray stars. In-app across all 4 skins + phone + `/album` + a game: lower-left is clean nebula, no
dark smudge, no colored fragments. **Guard:** confirm the gold ring's outermost tips aren't clipped
— if they are, widen `rx`/`ry` by ~15 and re-verify. The faint pink seen on the ring edge in the POC
is a magenta-composite artifact only (the ring edge is semi-transparent); against the dark nebula
in-app it is invisible — do NOT chase it, but if paranoid, run a `g−r` spill-neutralize on edge
pixels only.
**Token check:** space `homeAnchors`/`sectionFocus` already sit in the upper-middle arc and were
authored "clear of the ringed planet (lower-left)" — that planet is now gone, so the lower-left
simply becomes clean nebula+asteroids. No token change required; re-verify object placement looks
intentional.

### A2. Kid `scene-near.webp` — green fringe on the cloud-bank top edge

**Defect:** a faint green rim along the top edge of the cloud bank (spill not neutralized). See
`_mag-kid-scene-near.png` (green halo on the cloud shoulders).
**Fix:** neutralize green spill on partially-transparent edge pixels — clamp `g` to `max(r,b)` where
alpha is between ~1 and ~254 (or globally on the RGB, since the subject is white clouds with no true
green). Because softening a hard alpha edge can reveal the cut-out RGB as a fringe, **edge-extend the
cloud RGB outward before any feather** (scene-assets.md gotcha — a naive alpha blur here previously
produced a black band). Re-encode WebP in place.
**Acceptance:** over magenta, the cloud-bank top edge is clean white→transparent with no green/teal
rim and no dark fringe. In-app kid home + section menus: no colored line above the bottom clouds.

### A3. ✦ sparkle watermark removal — ALL far layers + 3 near layers

**Defect:** a small white 4-point "✦" Gemini watermark sits **bottom-right** in every far backdrop
(`_far-kid/ocean/space/dino.png`) and in `ocean-near`, `dino-near`, `kid-near`
(`_mag-*-scene-near.png`). scene-assets.md explicitly calls this a watermark to despeckle.
**Fix per file:** locate the ✦ precisely (crop the bottom-right quadrant with `sharp .extract` and
Read it), then patch it out by cloning adjacent background texture over it (feathered patch). Far
backdrops are opaque and sit on near-uniform sky/water/nebula → a small sampled-neighborhood overpaint
is invisible. Near layers: patch with surrounding subject/transparent as appropriate, then re-verify
over magenta. Re-encode each in place (far = opaque WebP, near = alpha WebP).
**Acceptance:** no ✦ remains in any of the 8 files (4 far + 3 near; note kid-near, ocean-near,
dino-near — space-near also had a faint ✦, include it → check all 4 near too). Verify over magenta
and in-app (bottom-right of home for each skin).

> A-series definition of done: re-run the FULL audit capture matrix (4 themes × home+phone + 5
> menus + album + 1 game) and diff against the `tmp/scene-audit/` baseline — every stray object,
> smudge, fringe, and watermark gone; nothing else changed.

---

## Workstream B — Composition polish (token-tuning FIRST; renders only if tuning falls short)

Both worlds below are fixed **primarily by editing `scene:` values in the token file** (no art). A
conditional re-render path is specified for each; author its art-prompt doc and hand it to the owner
**only after** the token pass is captured and judged insufficient (owner reviews the screenshots).

### B1. Dino — section objects float ungrounded in the sky

**Defect:** on `dino` home/menus the section objects (books/abacus/palette/globe/ordleg-bubble)
hover in open sky **above** the mountain line, looking pasted-on (vs `ocean`, where objects rest on
the reef). Cause: `homeAnchors` yPct places them above the far mountains; the mid layer was
intentionally dropped so there's nothing under them.
**Current dino `homeAnchors` yPct:** alphabet 60, math 57, colors 47, english 57, ordleg 60
(xPct 15/33/50/68/85, scales/rotates as-is).
**Token fix (primary):** lower the flanking objects so they nestle onto the mountain ridge line and
read as resting on the slopes; keep the centre (colors) lifted so it clears the volcano peak.
Proposed starting values (tune against screenshots, all 4… well, dino only, but check phone too):
- alphabet yPct 60→**70**, math 57→**66**, colors 47→**52**, english 57→**66**, ordleg 60→**70**.
Nudge ±3 until each object visually sits on a slope, not in the air. Mirror the shift into
`sectionFocus` yPct (currently 58/56/48/56/58) so the push-in still frames each object.
**Conditional render (only if grounding still reads thin / mid-ground too empty):** reintroduce a
**mid layer** = a soft rolling green-foothills / jungle-canopy band that sits between the far
mountains and the near ridge, giving objects a real ledge and filling the mid-ground. This is a NEW
green-screen render (the previous mid was dropped for being a thin floating strip — the replacement
must be a full-width band with a believable top contour, NOT a thin strip). If pursued:
- Add the layer back to `dino/index.ts` (`layers: [sceneFar, sceneMid, sceneNear]`) and to the token
  `layers[]` at depth ~0.44 (index-aligned!), key it (foliage is green → **border flood-fill on
  green-excess + skip the faint-green grow**, per scene-assets.md, so the subject greens survive),
  verify over magenta, then re-seat `homeAnchors` onto it.
- Art-prompt (single subject, soft-3D claymation, `#00FF00` full-bleed, 1:1, per PRD-05 §8.2 style
  block in scene-assets.md): *"A gentle full-width band of rounded rolling green jungle foothills /
  moss-covered canopy humps, soft matte clay, seen slightly from above, filling the lower third,
  with a soft uneven top ridge line; nothing sharp; flat solid #00FF00 everywhere else."* Save as
  `plans/scene-fixes/dino-mid-art-prompt.md` with the full style block inlined.

### B2. Kid — sterile / empty world (vast pale sky, low object cluster)

**Defect:** in landscape the `kid` world reads empty — the far backdrop's rainbow sits only at the
very top, the near cloud bank only at the very bottom, leaving a large flat pale-blue gradient in the
middle where the objects float in a low cluster with low-contrast labels. It's the weakest of the
four worlds (compare `kid-home.png` to the full-looking `ocean-home.png`).
**Current kid `scene`:** near layer depth 0.82 no offset; `ambient` = 1 cloud sprite, count 7,
size [22,44]; `homeAnchors` yPct 65/61/59/61/65; `bloomScenery` as listed.
**Token fix (primary), in order of impact:**
1. **Raise & grow the near cloud bank** to reclaim the empty lower-middle: add `offsetY: -6` (note
   scene-assets.md CSS gotcha — a negative offset renders as `calc(x - N%)`; the code already handles
   this, just set the number) to the near layer, so the bank rises into frame. Verify it doesn't
   swallow the corner mascot or the "Min Bog" pill.
2. **Denser ambient clouds** to fill the mid sky: `ambient.count` 7→**14**, and widen size to
   `[24,60]`. Two sprite entries if a second cloud puff asset reads better (only `ambient-2.webp`
   exists today — fine to reuse).
3. **Bloom presence:** the kid `bloomScenery` cloud/flower/star already scale with progress; bump
   their `scale` ~+0.15 and spread them (one higher in the mid sky) so an progressing profile fills
   more of the frame.
4. **Label contrast:** the section labels are low-contrast on pale sky — this is rendered by the
   home `SceneObject`/label component, not the token. Confirm the label pill has enough
   background/opacity on the light `kid` skin; if not, that's a component tweak (shared with all
   light skins — verify ocean/dino labels don't regress).
**Conditional render (only if the middle still reads empty after token tuning — likely for kid):**
re-render the kid **far backdrop** so the rainbow is larger / arcs lower through more of the frame
and the middle carries soft cloud interest instead of a flat gradient. Far layers are opaque
(rendered full-bleed, NOT on green — resize + WebP, no keying). If pursued, save
`plans/scene-fixes/kid-far-art-prompt.md`; art-prompt: *"Soft pastel daytime sky filling a 16:9
frame, a large gentle rainbow arcing from lower-left to lower-right through the upper-middle, wispy
soft-3D clay clouds scattered across the middle so no large area is empty, warm and dreamy,
child-safe, no text."* (opaque, full-bleed, highest res). Keep `theme_color`/look consistent.

### B3. Ocean — "Farver" palette floats slightly detached (minor)

**Defect:** on `ocean` home the centre `colors` object (palette) hovers in the mid-water reef valley
looking a touch detached. Current ocean `homeAnchors.colors` yPct 64.
**Fix:** nudge `colors` yPct 64→**68** (and its `sectionFocus.colors` yPct 46→~49) so it settles onto
the centre reef. Token-only. Verify it still clears the reef peaks and isn't clipped by the "Min Bog"
pill.

---

## Out of scope / non-goals
- Educational color content is NOT themeable — do not touch Farvejagt/RamFarven color data.
- No engine/behavior changes (parallax, freeze, mascot bus, transitions all stay).
- Jungle/Candy tokens remain unregistered (no world art) — untouched.
- No changes to game boards, HUD, or non-scene UI beyond the B2.4 label-contrast check.

## Suggested implementation order
1. WS-A (A1 → A2 → A3) — the mandatory clean-up; commit after magenta + in-app verify.
2. WS-B token passes (B1 primary, B3, B2 primary) — commit; capture all 4 skins.
3. Show the owner the captures; author + hand off any conditional art-prompt docs (B1/B2 renders)
   only if the owner green-lights. Key/wire returned art, re-verify, commit.

## Definition of done
- Every defect in `FINDINGS.md` §A resolved; no stray objects, dark bands, green fringes, or ✦
  watermarks in any layer (proven over magenta) or any in-app surface across all 4 skins, phone +
  tablet, menus + album + a game route.
- Dino objects read grounded; kid world no longer reads empty; ocean palette seated.
- `npm run build` + `npm run lint` clean; no stray `*.mjs` in repo root; WebPs within budget.
- Fresh full audit capture matrix taken and diffed against the `tmp/scene-audit/` baseline.
