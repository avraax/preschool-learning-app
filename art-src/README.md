# Raw world art (pre-optimization)

Source AI-generated art for the Theme Worlds feature, **before** optimization. These raw
PNGs are NOT bundled. The build pipeline optimizes them (sharp → AVIF/WebP, resized, ≤700KB
per theme) into `src/assets/themes/<id>/`, which is what actually ships.

## Expected files per theme — `art-src/<id>/`

| filename      | purpose                                   | transparent? |
|---------------|-------------------------------------------|--------------|
| `far.png`     | back parallax layer (full-bleed backdrop) | no           |
| `mid.png`     | mid parallax layer (bottom third)         | **yes**      |
| `near.png`    | near/foreground parallax layer (bottom)   | **yes**      |
| `mascot.png`  | per-world mascot (single character)       | **yes**      |
| `bubble.png`  | ambient sprite A                          | **yes**      |
| `fish.png`    | ambient sprite B                          | **yes**      |
| `thumb.png`   | theme-selector thumbnail (~3:2 scene)     | no           |

(Sprite names vary per world — e.g. jungle uses `leaf`/`butterfly`. The far/mid/near/mascot/
thumb roles are constant.)

Theme ids: `ocean` (Havet), `space` (Rummet), `jungle` (Junglen), `candy` (Slikland),
`dino` (Dinosaurer), `kid` (Regnbue).
