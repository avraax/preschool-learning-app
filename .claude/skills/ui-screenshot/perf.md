# Measuring steady-state cost with `perf.mjs`

Companion to `SKILL.md`'s "It stutters" section. The rules the app's own animation/rendering conventions
follow are in `.claude/rules/animation-and-performance.md`; results live in `docs/device-testing.md`.
This file is how to get a number you can believe.

Defaults are the TARGET DEVICE: 1366×992 @ dpr 2 (iPad Pro 12.9" PWA landscape). Always the harness build
(`npm run build:harness` + `vite preview`) with `?nogate=1`.

## The four traps, each of which produced a WRONG conclusion in the PRD-01 session

### 1. `recalcPerSec` is not a cost — gate on `recalcMsPerSec`

Blink counts one style recalculation per **animating frame**, whatever the mechanism. Measured on home at
6×: stripping every CSS keyframe animation leaves it at **60.1**; neutering the parallax driver leaves it
at **59.3**; only `--reduce-motion`, which removes ALL animation, reaches **0**. So a target derived from a
reduced-motion run is a target for an app with no animation, and "recalcPerSec ≤ 5" is unreachable by
construction. `recalcMsPerSec` is what responds to a real fix (one screen went 193 → 39).

### 2. An attribution measured under saturation is worthless

Two PRD-01 findings — "the parallax custom-property driver is not the cause (~11%)" and "the ambient
field's CSS animations are free" — were both **wrong**, because both subtractions were taken while 25
framer animation loops saturated the main thread. After the loops were removed, the same two subtractions
measured ~24 points of busy and ~39 points of busy respectively.

**So: re-measure every attribution after removing the dominant cost, and treat a subtraction that landed
"in the noise" as UNMEASURED rather than as zero.** Work down the list, re-deriving as you go.

### 3. A screenshot A/B needs its own noise floor first

Take **two captures of the identical build** and diff those before comparing two builds. Measured floors:

| what | meanAbs/255 | channels > 24 |
|---|---|---|
| same build, back-to-back capture | 0.048 | 0.02% |
| same build, two separate page loads (home) | 0.10–0.27 | ~0.02% |
| same build, two separate loads (**a quiz**) | **1.08–1.20** | **~1.3%** |

The quiz floor is that high because **the board draws a random prompt each load** — so on those screens a
before/after diff measures content, not the change. A real PRD-01 result came out *below* its own floor.
Home's floor is ambient drift phase and living-card breathe phase.

Amplify the diff ×6–10 and LOOK at it before concluding: faint edge outlines everywhere = subpixel raster
(e.g. an element that stopped being promoted), a few blobs = animation phase, a solid region = a real
change. Also confirm with **DOM rects** (`--eval` returning `getBoundingClientRect`) — identical rects plus
a visible pixel diff means rasterisation, not layout. That distinction is what stopped a shadow change
from shipping as "no visible difference".

### 4. `--dpr 1` vs `--dpr 2` separates raster from CPU

Raster cost scales with pixel count; style recalculation does not. If busy% is unchanged between dpr 1 and
dpr 2 (measured 84.7 vs 85.7 on home), the cost is **genuine main-thread CPU** and a "it's just headless
software raster" explanation is wrong. Cheap, and it kills a tempting excuse.

## Anti-vacuity: prove the screen actually rendered

`busyPct` and `recalcPerSec` are *low* on a page that never mounted the screen, and both the error
boundary's "Prøv igen" and NotFound's "Hjem" are real buttons that satisfy a `--wait-for`. **Assert the
route's own Danish title** (from `src/config/categoryThemes.ts`) via `--eval` and refuse to report a row
that fails it:

```bash
--eval '(()=>{const t=(document.body.innerText||"").replace(/\s+/g," ");
  return JSON.stringify({ok:t.includes("Bogstav Quiz")&&!/Noget gik galt|Ups!|Denne side findes ikke/.test(t)})})()'
```

Menu routes swing **~10 points run-to-run**. Run any sweep at least twice and report the range; never quote
a single run as a result.

## Isolating a NAVIGATION, not the page load

Long tasks accumulate from page load, which dominates and drowns the transition. Reset the log at the
moment of the click with `--inject-js-pre`, so what you measure is the wipe + route mount:

```bash
--inject-js-pre 'document.addEventListener("click",function(){if(window.__f){window.__f.long.length=0}},true)'
--click '[data-bl-tileflow] [role="button"]'
--eval 'JSON.stringify({worst:Math.max.apply(null,window.__f.long),over100:window.__f.long.filter(d=>d>100).length})'
```

## Driving a per-child SETTING headlessly

`?nogate=1` attaches a fixed dev child (`dev-local`), so a setting can be seeded into
`bornelaering-progress:dev-local` with `--inject-js-pre`. **Also pre-set the storage-sweep marker**
(`bornelaering-accounts-sweep`), or `utils/storageReset.ts` deletes the seeded document before the app
reads it — the failure looks exactly like the setting being ignored. Then confirm the RENDERING changed
(a computed `will-change`, an `animationName`), not just that the value round-tripped: that is how the
"Flydende grafik" toggle was caught doing nothing while its unit tests passed.
