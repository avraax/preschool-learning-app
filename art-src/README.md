# Raw world art (pre-optimization)

Source AI-generated art for the Theme Worlds feature, **before** optimization. These raw
PNGs are NOT bundled — the build pipeline optimizes them (sharp → WebP, resized, keyed) into
`src/assets/themes/<id>/`, which is what actually ships.

## What's actually archived per theme — `art-src/<id>/`

Only the whole-scene composite and the mascot/thumb are kept here:

| filename      | purpose                                    | transparent? |
|---------------|--------------------------------------------|--------------|
| `scene.png`   | combined whole-world render (reference)    | no           |
| `mascot.png`  | per-world mascot (single character)        | **yes**      |
| `thumb.png`   | theme-selector thumbnail (~3:2 scene)      | no           |

**The per-layer parallax art is NOT archived here.** The shipped, keyed
`src/assets/themes/<id>/scene-{far,mid,near}.webp` are the **only** per-layer artifacts — there is
no clean green-screen `far.png`/`mid.png`/`near.png` source to re-key from. So any fix/re-key of a
layer operates **in place on the shipped WebP** (see `.claude/rules/scene-assets.md` → "Where the
art lives" for the technique, e.g. a `dest-in` region mask to excise a stray baked object).

Theme ids: `kid` (Regnbue), `ocean` (Havet), `space` (Rummet), `dino` (Dinosaurer). `jungle`
(Junglen) + `candy` (Slikland) token files exist but are not registered (no shipped world art).
