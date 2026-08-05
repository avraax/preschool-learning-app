# PRD — Performance 01: making the app smooth on the child's iPad without changing how it looks

Status: **authored 2026-08-05; W1-W9 IMPLEMENTED 2026-08-05** (commits `1997aff`..`b30a7d9` on `master`,
one per work item). Results, the gates that were NOT met and why, and the three findings this PRD got
wrong are in **§7**. Awaiting the owner's iPad play-test (§12). Measured on the harness build with a new probe
(`.claude/skills/ui-screenshot/perf.mjs`, committed with this PRD — it is the instrument every
acceptance gate below is written against).

Owner constraints, given in the session that produced this doc:

- **Nothing is removed and nothing looks different.** The parallax world, the ambient drift, the
  mascot, the wipes, the tactile tiles all stay exactly as they are. This PRD only changes *how* they
  are drawn and animated.
- Scope: the **targeted fixes plus the scene/compositing rework**. Converting the app off MUI/Emotion's
  runtime `sx` is explicitly OUT (§9).
- Cold-launch cost is in scope as the **last, lowest-priority** phase.
- All phases land in **one session**, then one play-test on the iPad.
- There is **no Mac**, so there is no Safari Web Inspector timeline from the real device. Everything
  below is rung 1 + the owner's verdict.
- The app runs as a **standalone PWA from the home screen** on that device.

---

## 1. The problem

The child plays on an **iPad Pro 12.9" 2nd generation (A10X Fusion, 2017) on iPadOS 17.7.11** — the
compatibility floor in CLAUDE.md, and its terminal OS. Owner report: it "barely works and stutters so
much." Named surfaces, worst first:

1. **Home + the five section menus** — the parallax world screens.
2. **Inside games.**
3. **The transition wipes** between menu and game.

Celebrations and Min Bog have not been seen on that device yet, so they are unranked — note that
`/album` was the historical worst case in the older load measurements (`docs/device-testing.md`), and
this PRD's own numbers do **not** reproduce that: at 6× CPU throttle `/album` is the *least* busy of the
seven screens measured. Treat the old note as superseded for steady-state, not for load.

## 2. The instrument — `perf.mjs`

`cdp.mjs --perf` measures **load** (FCP/LCP/long tasks) and its frame times are a software-raster
artifact, so it cannot see this bug at all. What stutters here is the app **sitting still**. The new
probe measures a settled steady-state window and reports GPU-independent counters:

```
npm run build:harness
npm run preview -- --port 4173 --strictPort          # in a second shell
node .claude/skills/ui-screenshot/perf.mjs \
  --url "http://127.0.0.1:4173/?nogate=1" --label home --cpu-throttle 6
```

Defaults are the target device: **1366×992 @ dpr 2** (iPad Pro 12.9" PWA landscape).

| field | meaning |
|---|---|
| `recalcPerSec` / `recalcMsPerSec` | style recalculations per second and their cost. **The headline.** |
| `taskMsPerSec` / `busyPct` | main-thread saturation. Above ~60% at 6× the device has nothing left for touch. |
| `layers` / `layerMB` | compositing layers that draw content, and their texture footprint at the given dpr. |
| `animated` / `willChange` / `filtered` | computed-style census: elements with a running CSS animation, a `will-change`, a `filter`/`backdrop-filter`. |
| `frameMed` / `frameP95` / `jank` | rAF frame times. **Read with suspicion** — headless raster; kept only as a change detector. |

Attribution knobs, which are the whole point (a subtraction, not a number):

- `--reduce-motion` — emulates `prefers-reduced-motion: reduce`, i.e. the app's own gate: parallax rAF
  off, `AmbientField` renders nothing, framer idle loops inert. **This is the floor.**
- `--inject-css '*{animation:none !important}'` — strips only the CSS keyframe animations, leaving
  every JS loop running.
- `--no-parallax-vars` — no-ops just the `--parallax-x/y` custom-property writes, before app scripts
  run. Everything else keeps running.
- `--eval '<js>'`, `--inject-js-pre '<js>'`, `--click`, `--wait-for` for anything else.

**What this instrument is not.** It is rung 1. `--cpu-throttle` scales CPU only — the A10X's GPU, memory
bandwidth, image decode and JIT are untouched, and its frame rate is not predicted here. Every number
below is a **relative** signal: it ranks screens and proves a change moved the cost. The owner's iPad
remains the oracle for "does it feel smooth."

## 3. The measured baseline (2026-08-05, harness build)

**At 6× CPU throttle — the stutter regime:**

| screen | busy% | recalc/s | recalcMs/s | layers | layerMB | filtered | willChange |
|---|---|---|---|---|---|---|---|
| home | **81–85** | 50–53 | **385–438** | 34 | 41.7 | 22 | 23 |
| /alphabet (menu) | 70 | 56 | 311 | 35 | 41.3 | 19 | 21 |
| /alphabet/learn (browse) | 78 | 55 | 105 | **84** | 53.3 | **68** | 17 |
| /alphabet/quiz | 69–78 | 48–56 | 158–193 | 35 | 51.1 | 19 | 17 |
| /farver/ram-farven | 74 | 58 | 171 | 27 | 50.6 | — | — |
| /math/addition | 62 | 58 | 147 | 35 | 51.1 | — | — |
| /album | 49 | 59 | 167 | 31 | 53.6 | 5 | 17 |

**Unthrottled (1×), same build, same viewport:** `recalcPerSec` is **60.0 on every screen** —
home 55.7 ms/s, menu 71.3, quiz 26.9, album 34.3, browse 16.5; busy 9–17%.

Decoded-bitmap census: home **10.2 MB** across 11 `<img>` (plus 17 elements with a CSS
`background-image`); menu 9.9 MB; album 5.1 MB.

## 4. Findings

### F1 — The app performs exactly 60 style recalculations per second while completely idle, and they are JS-driven

Three runs on home, 6× throttle, everything else identical:

| run | busy% | recalc/s | recalcMs/s | layers | willChange |
|---|---|---|---|---|---|
| A baseline | 84.5 | 53.1 | 417.6 | 34 | 23 |
| B `*{animation:none}` | 85.9 | 49.2 | 393.0 | 34 | 23 |
| C `--reduce-motion` | **7.7** | **0** | **0** | **10** | **4** |

That is the entire bug in one table. **Home spends ~40% of every second recalculating style while
nothing is happening**, at a 6× handicap that is a fair stand-in for an A10X, leaving ~15% of the main
thread for touch handling, React, audio and the game itself. Under reduced motion the same screen sits
at 7.7% busy with **zero** recalculations — so **roughly 90% of the steady-state main-thread cost is
removable, and reduced motion proves it can be removed without touching a single pixel of layout.**

The quiz board reproduces it with parallax already disabled: 78% busy / 193 ms/s of recalc at baseline,
**10.8% / 0** under reduced motion.

### F2 — NEGATIVE RESULT: the parallax custom-property driver is not the cause

The obvious suspect was `useParallax` writing `--parallax-x/y` on the `PersistentWorld` root every
frame — Motion's own performance tier list says CSS variables "always trigger paint" and global ones
"cause cascading style recalculations across entire DOM trees — potentially catastrophic." Measured
with `--no-parallax-vars` (verified effective: the property reads `19.86px` with the patch off and `[]`
with it on):

| run (home, 1×) | recalcMs/s | busy% |
|---|---|---|
| vars written | 59.9 | 14.3 |
| vars neutered | 53.2 | 12.3 |

**~7 ms/s of ~57 — about 11%.** Real but small, and at 6× throttle the difference vanished into noise
(437.6 vs 417.6 ms/s, i.e. the neutered run measured *worse*). **Do not spend the budget here, and do
not restructure the parallax driver.** Recorded because it is the hypothesis anyone would reach for
first, including a future session reading Motion's docs.

### F3 — NEGATIVE RESULT: the ambient field's CSS animations are free. They are the pattern to copy

Home runs 19 CSS keyframe animations (the `AmbientField` sprites plus the shooting stars). Killing all
19 changed nothing measurable (run B above). They are compositor-driven: declared once, then animated
without the main thread. **The ambient drift is not a performance problem and must not be trimmed.**

### F4 — The cost is 25 infinite Framer Motion loops, and the app already has the right pattern

`grep -rn "repeat: Infinity" src` finds 25 sites. Every one is a JavaScript animation on the main
thread: framer's frameloop ticks each rAF, writes inline styles on each animating element, and the
browser recalculates style once per frame. That is the 60/s.

Most of them are **idle ambience with no state and no interaction** — exactly what a CSS keyframe
animation does for free:

| site | what it is |
|---|---|
| `theme/motion.ts:46` `idleFloat` | `y: [0,-4,0]`, 3.2 s — consumed by `PromptFocus` on **two nested** `motion.div`s, so every game board pays twice |
| `common/Mascot.tsx:67` · `ThemeMascot.tsx:163` | mascot idle bob, 3.2 s / 3.4 s |
| `GameSelectionLayout.tsx:219` | the section-menu landmark's 5.5 s float |
| `TactileTile.tsx:176` | the hint pulse, 1.1 s — **per tile**, so a 6-answer board runs 6 |
| `ListenHero.tsx:63,102` | speaker pulse + equalizer bars |
| `StickerAlbum.tsx:457`, `HvadManglerGame.tsx:233`, `SpeakWordGame.tsx:163`, `FarvejagtGame.tsx:599,613,763`, `FarveQuizGame.tsx:396,463,465`, `NuancerGame.tsx:397,542`, `RamFarvenGame.tsx:680,761,879`, `SimplifiedAudioPermission.tsx:159`, `TransitionOverlay.tsx:164,197,226` | per-game idle pulses, slot hints, the wipe's own decorations |

**The codebase already solved this once.** `useLivingCard` returns a `breatheSx` — a CSS idle-breathe —
and keeps framer only for the tap squash, on separate nested layers so the transforms don't fight
(CLAUDE.md's menu-liveliness bullet). `TactileTile` takes the same `breathe` prop as CSS. W1 is
generalising the pattern that is already the house style, not inventing one.

### F5 — The compositor budget is the second half of the problem

- **31–84 layers that draw content, 41–54 MB of layer texture** at dpr 2. `AmbientField` sets
  `willChange: 'transform, opacity'` on **every** sprite — `count` is 12–16 per skin plus `bloomExtra`
  up to ~12, so up to **28 promoted layers whose animation would promote them anyway.**
- **All three parallax layers are promoted and animated.** Depths are 0.14 / 0.44 / 0.82
  (`kidTheme.tokens.ts:117`). Each is a full-bleed `background-image` div with `will-change: transform`,
  overscanned past every edge — a full-screen texture at dpr 2 is ~22 MB. The far layer at depth 0.14
  travels at most `PARALLAX_MAX_X × 0.14 ≈ 6 px`.
- **Each scene layer WebP is 2048×1274 → 10.4 MB decoded**, so a 3-layer skin holds ~31 MB of decoded
  bitmap resident for the life of the session, on top of the layer textures.
- **19–68 elements per screen carry a `filter` or `backdrop-filter`.** `/alphabet/learn` is the extreme
  at 68 — one `softShadow()` (a *pair* of chained `drop-shadow`s) per letter tile plus contact-shadow
  ellipses each with their own `blur()`.
- Context: a web page's memory budget on iOS lands in the **300–450 MB** range, and Apple's Jetsam
  subsystem is more aggressive than WebKit's own handler and can take the page out. The app is not near
  that ceiling, but the A10X's GPU shares system memory and the 12.9" backing store is 2048×2732.

### F6 — `filter: drop-shadow` is the wrong material for a rectangle in Safari

`softShadow()` returns **two chained `drop-shadow()`s** and is applied on `TactileTile`,
`TactilePill`, `PromptArt`, `SceneObject`, `GameSelectionLayout`'s tile art, `EnglishLearning`,
`farverArt`. Chained `drop-shadow` needs two input paths, channel swizzling, blur and blend per element,
and is documented as both slow and visually buggy on mobile Safari (shadows left behind on move,
first-render errors, flicker). For a rectangle or a rounded rectangle, `box-shadow` is the same picture
at a fraction of the cost. `drop-shadow` is only *needed* where the shadow must hug an alpha cut-out —
the baked art. `UnifiedMemoryGame.tsx:516` already notes it "stands in" a layered box-shadow for
exactly this reason.

### F7 — NEGATIVE RESULT: the scene art is not oversized. Do not shrink it

2048 px wide against **2732 device px** of PWA landscape at dpr 2 — the art is already being *upscaled*
1.33×. There is no free decode saving here, and a "downscale the backgrounds" pass would visibly soften
the world. The lever is how many of them are promoted and animated, not their resolution.

### F8 — Cold launch parses ~1.19 MB of eager JavaScript

`dist/index.html` `modulepreload`s the entry plus: `mui-vendor` 288 KB, `react-vendor` 227 KB,
**`prebakedTts` 170 KB**, `motion-vendor` 134 KB, **`dnd-vendor` 50 KB**, entry 157 KB, plus ten small
config chunks. Two of those have no business being at first paint:

- **`prebakedTts` (170 KB)** is the narration manifest — a lookup table `ttsClient` consults on the
  first spoken line, not during mount.
- **`dnd-vendor` (50 KB)** is `@dnd-kit`. Every importer under `src/components/common/dnd/` is a lazy
  route component or the lazy `AdultSettings`; **nothing in `App.tsx`'s static graph touches it.** So
  its preload is most likely a `manualChunks` artifact under Vite 8 / Rolldown, not a real dependency.
  Verify, don't assume:
  ```bash
  npm run build && node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');
    console.log([...h.matchAll(/modulepreload[^>]*assets\/([^\"]+)/g)].map(m=>m[1]+' '+
    (fs.statSync('dist/assets/'+m[1]).size/1024).toFixed(0)+'KB').join('\n'))"
  ```

### F9 — Two API facts to respect

- **`content-visibility` is Safari 18+. It is OFF THE TABLE on the 17.7 floor.** This is the Ogg-audio
  shape of mistake and the single most tempting wrong answer to F5. `contain` and
  `contain-intrinsic-size` **did** ship in Safari 17.0 and are safe.
- Motion's own docs: its individual-transform syntax (`x: 100`, `scale: 2`) is implemented with **CSS
  variables, which are not hardware accelerated even though they end up in a transform.** Anything kept
  on framer for a continuous animation should animate an explicit `transform` string.

---

## 5. The rules this PRD adopts

1. **A continuous, stateless animation is a CSS keyframe animation. Never a JS loop.** Framer keeps what
   it is good at: one-shot event feedback (pop, shake, charge-in), gestures, `AnimatePresence`, layout
   animations. Measured in F3: CSS costs nothing; measured in F1/F4: JS costs 60 recalcs a second.
2. **`will-change` is spent, not sprinkled.** An element already running a `transform`/`opacity`
   keyframe animation is promoted by that animation — adding `will-change` buys nothing and costs a
   texture. Budget it per screen and guard the budget.
3. **Only promote what actually moves.** A layer whose maximum travel is a few pixels does not need to
   be a live compositing layer.
4. **`box-shadow` for boxes, `drop-shadow` only for alpha cut-outs.**
5. **The picture does not change.** Every work item is verified by a screenshot A/B against
   `docs/ui-reference/`, across all 4 skins, plus reduced-motion, phone landscape and Split View.
6. **Safari 17 is the API floor** (F9). Check every property against Safari 17, not "latest Safari".
7. **One branch point.** The perf profile of W6 is read from one pure module, never re-derived inline.

---

## 6. Work items

### W1 — Move every idle Framer loop to CSS keyframes *(the fix; ~90% of the win)*

Create `src/theme/idleMotion.ts`: the CSS counterparts of the current framer idle loops, as `sx`
fragments with named `@keyframes`, one per motion shape — `idleFloatSx(reduce)`, `idlePulseSx(...)`,
`hintPulseSx(...)`, `equalizerBarSx(i)` — matching the **existing durations, easings and amplitudes
exactly** (`idleFloat`: `y: [0,-4,0]`, 3.2 s, `easeInOut` → `translateY(0/-4px/0)`,
`animation: 3.2s ease-in-out infinite`). Keep `theme/motion.ts`'s `idleFloat` exported but have it
delegate, or delete it once every call site has moved — do not leave two vocabularies.

Then convert the 25 sites in F4's table. Rules while converting:

- **Reduced motion still wins.** Every helper takes the `reduce` flag and returns no animation.
- **Never put the CSS animation on the same element as a framer transform.** They both write
  `transform` and the last writer wins — that is why `useLivingCard` uses nested layers. Follow it:
  outer element = CSS idle, inner element = framer feedback.
- **`PromptFocus` pays twice** (two nested `motion.div`s, `PromptFocus.tsx:128` and `:145`). The inner
  one exists only for the idle float; once that is CSS, it should become a plain `Box`.
- **Do not convert** `TransitionOverlay`'s loops (`:164,197,226`) in this work item — the wipe is
  W5 and has its own constraint set.
- **`SimplifiedAudioPermission.tsx:159`** is a blocking modal with the tap-through rule in
  `.claude/rules/audio-system.md`. Convert the animation only; do not touch the dismiss path.

Acceptance: `recalcPerSec` ≤ 5 on home, `/alphabet`, `/alphabet/quiz` and `/alphabet/learn` at 6×
throttle, `busyPct` ≤ 25 on all four, and the `animated` census *rises* by roughly the number of loops
converted (a conversion that lowers both numbers has deleted an animation instead of moving it).

### W2 — Scene & compositing discipline

`src/components/common/scene/` — all of it look-preserving:

1. **Drop `willChange` from `AmbientField`'s sprites and shooting stars** (`AmbientField.tsx:182,200`).
   Their own `transform`/`opacity` keyframes already promote them. Expect `layers` and `layerMB` to
   fall with no visual change.
2. **Stop promoting and translating the far layer.** In `ParallaxLayer`, when
   `parallaxTravelX(depth) + parallaxTravelY(depth)` is below a small threshold (the far layer at depth
   0.14 moves ≤ ~6 px), emit no `transform` and no `will-change` at all. Guard the threshold in
   `src/config/parallax.ts` next to the existing bounds so the overscan derivation stays honest, and
   keep the overscan itself — the box is unchanged, only the promotion goes.
3. **`contain: layout paint` on the scene root** (`ThemeScene`'s outer `Box`) so an invalidation inside
   the world cannot escape into the page. Safari 17-safe (F9).
4. **Cap the promoted ambient count.** `count + bloomExtra` can reach 28. Keep the *sprite count*
   exactly as it is — it is the visible bloom and F3 says it is free — but assert a ceiling in a test so
   a future bloom curve cannot quietly double it.

Acceptance: `layers` ≤ 18 and `layerMB` ≤ 32 on home and `/alphabet` at dpr 2, with a pixel-identical
screenshot on all 4 skins.

### W3 — The in-game readability blur

`PersistentWorld.tsx:109` puts `filter: blur(2.5px)` on the whole scene on every game route. At dpr 2
that is a ~2732×1984 blur pass, taken on entry to **every** game — a strong candidate for the wipe
stutter (§1 item 3) landing exactly where the child is watching.

The look must survive, so the fix is raster area, not the effect: render the blurred subtree at a
fraction of device resolution and scale it back up (`transform: scale()` on a proportionally smaller
box), which cuts the blurred pixel count by the square of the factor and *adds* softness rather than
removing it. Measure the A/B — a half-scale raster of an already-blurred backdrop should be
indistinguishable, and `--measure`/screenshot must prove it before this ships.

Second, `filter` and `transform` are on the **same element** there (`:109` and `:114`), which forces one
combined render surface per state change; splitting them onto nested boxes lets the scale stay a
compositor transform.

Acceptance: entering a game costs no long task > 100 ms at 6× (measure with `--click` into a game and
a short `--window`), and the in-game screenshot is unchanged on all 4 skins.

### W4 — Shadow material: `box-shadow` for boxes, `drop-shadow` for cut-outs

Add `boxSoftShadow(elevation)` to `src/theme/depth.ts` — the `box-shadow` equivalent of
`softShadow()`'s two layers, tuned to match by eye against a side-by-side screenshot — and switch the
**rectangular/rounded** consumers to it: `TactileTile`'s surface (`:248`), `TactilePill` (`:55,67`),
and the tile-art wrappers where the shadow is cast by a box rather than by alpha.

Keep `softShadow()` (`filter: drop-shadow`) only where the shadow must follow a cut-out silhouette:
`SceneObject.tsx:179`, `PromptArt.tsx:48,75`, `GameSelectionLayout.tsx:235`, `farverArt`,
`EnglishLearning.tsx:276`. `fieldShadow()` already exists for dense grids and its measurement
(`depth.ts:19-28`) must not be undone.

`/alphabet/learn` is the acceptance screen: **68 filtered elements → under 20**, `busyPct` down, and
the letter tiles indistinguishable in a zoomed screenshot A/B.

### W5 — The transition wipe

`TransitionOverlay` runs three infinite framer loops (`:164,197,226`) *during* the wipe, i.e. during the
single most timing-sensitive moment in the app, while a route is mounting and lazy chunks are
resolving. Convert them to CSS keyframes (same rules as W1) so the wipe's own decoration cannot
compete with the mount it is covering. The wipe's existing discipline is non-negotiable and already
documented in `.claude/rules/scene-and-world.md`: opaque paint, `transform`/`clip-path` only, **no
`backdrop-filter`**, `will-change` cleared at idle, `absolute` not `fixed`.

Acceptance: navigate menu → game under `--cpu-throttle 6` and show the worst long task during the wipe
falling; the wipe looks identical per skin (iris/wave/zoom/leaves + the flat `fade` default).

### W6 — "Flydende grafik": one PERMANENT adult toggle

The owner asked for this twice, and the reason is sound: **you cannot type a query parameter into a
standalone PWA**, so without a persisted switch there is no way to A/B old-vs-new on the actual device,
and no way to back out without a redeploy. Both matter more here than usual because there is no Mac and
no profiler on that device.

**It is permanent — owner's call, 2026-08-05, stated twice.** An earlier draft of this PRD had it
sunsetting once the iPad confirmed the fast path; that was rejected in favour of keeping a standing
escape hatch that can be flipped on production, on the device, without a deploy. Do not re-litigate it,
and do not quietly delete the legacy path in a later tidy-up. §10 carries the cost this accepts.

Design:

- **One pure module** — `src/config/perfProfile.ts` — exporting the branch (`useCssIdleMotion`,
  `promoteFarLayer`, `blurRasterScale`, …). Every W1–W5 site reads it from there. **One branch point**
  (rule 7): a second inline `if` anywhere is the failure mode this is meant to prevent.
- Persisted in `progressStore.settings` (schema bump; the store is per-child and INERT until
  `profileStore.attach()`).
- Surfaced in **"Til de voksne" → Udseende** as a plain switch. The group/item structure is DATA in
  `src/config/adultSettingsIa.ts` and is **guarded** — add the entry there, not in the pane.
- **Default is the FAST path.** The toggle exists to fall *back*, never to opt in. A guard test must
  pin that default, or this becomes a way to ship the slow app.
- It changes **rendering only**. It must not touch XP, difficulty, narration, or any game logic — a
  test should assert `taskXp`/round outcomes are identical under both settings.
- **Because it is permanent, the dual path has to be affordable to verify.** Two rendering paths × 4
  skins × reduced-motion × 4 viewports is the whole matrix and nobody will run it twice. So bound it by
  construction:
  - **The legacy branch is a switch on the animation MECHANISM, never a second layout.** `perfProfile`
    may only choose *how* a thing animates or whether an element is promoted — never its size,
    position, count or existence. Then the screenshot sweep is only owed on the default (fast) path,
    because the other path cannot move a box. Guard it: no `perfProfile` read may appear inside a
    layout-affecting `sx` key (width/height/gap/padding/position/grid) — a source guard, comments
    stripped (W8.1's rule).
  - Reduced motion **overrides both paths** and stays the single calmest branch, so it is one extra
    state, not two.
  - The Danish label is adult-facing copy in the Udseende pane; "Flydende grafik" is a suggestion, not
    a requirement — the owner picks the wording.

### W7 — Cold launch (lowest priority)

1. **Make `prebakedTts` (170 KB) lazy.** It is a manifest `ttsClient` reads on the first spoken line.
   `import()` it there and await it inside the existing prebaked lookup, which already fails soft to
   live Azure — so a not-yet-resolved manifest degrades to a slower first clip, never to silence. Do
   **not** change the cache-key derivation (`shared-tts-key.js` is the single source, and
   `.claude/rules/audio-system.md` owns that contract).
2. **Get `dnd-vendor` (50 KB) out of the eager preload.** Run F8's command first to confirm the real
   importer. If it is a `manualChunks` artifact, fix the chunking; if something eager genuinely imports
   `@dnd-kit`, move that import behind the lazy game components.
3. Re-run F8's command and record the eager list in `docs/device-testing.md` next to the existing FCP
   numbers.

Acceptance: eager `modulepreload` total under 1.0 MB, `?nogate=1` cold FCP at 6× no worse than today,
and `npm test` green — the audio tests are the ones that matter here.

### W8 — Guards, so the win cannot rot

The repo's rule is that a fix ships with a test that would have caught the bug, and that the test is
**re-broken to prove it fails** (`/re-break`). Four guards:

1. **No new infinite JS loop.** A source guard asserting the `repeat: Infinity` count in
   `src/components/**` does not exceed the post-W1/W5 allowlist, with a reason per entry. **It must
   strip comments before matching** — three guards in this repo already do (`noEmoji`, `authOverlayZ`,
   `rewardArtCoverage`), and a plain `includes()` was once satisfied by the prose comment explaining
   the fix, so deleting the fix left it green.
2. **`will-change` budget.** Assert no `willChange` in `AmbientField`/`ParallaxLayer` beyond the
   allowlist, and pin the promoted-ambient ceiling from W2.4.
3. **Safari 17 floor.** Assert `content-visibility` appears nowhere in `src/` (F9). Cheap, and it
   closes the most tempting wrong answer permanently.
4. **The perf toggle defaults fast** and does not alter game outcomes (W6).

Re-break each one: the specific test must be the one that flips. Breaking something adjacent and
watching the suite stay green proves nothing — two vacuous tests survived a re-break pass in the
accounts session that way.

### W9 — Re-measure and accept

Re-run the §3 baseline, same commands, same viewport, and paste the before/after table into this PRD
and into `docs/device-testing.md`. Then the screenshot sweep: `sweep.mjs --selftest` first (it proves
the guards fire), then all 4 skins × home/menu/quiz/browse/album × 1366×992, 678×992 (Split View),
844×390 and 375×667, plus `webkit.mjs --device ipad-pro` for the real Safari engine. **A claim must
name the rung it came from.**

---

## 7. Acceptance gates

Measured with `perf.mjs`, harness build, `--cpu-throttle 6`, 1366×992 @ dpr 2:

| gate | today | target |
|---|---|---|
| `recalcPerSec`, every screen | 48–59 | **≤ 5** |
| `busyPct`, home | 84.5 | **≤ 25** |
| `busyPct`, every other screen | 49–78 | **≤ 25** |
| `layers`, home / `/alphabet` | 34 / 35 | **≤ 18** |
| `layerMB`, home / `/alphabet` | 41.7 / 41.3 | **≤ 32** |
| `filtered`, `/alphabet/learn` | 68 | **< 20** |
| eager `modulepreload` JS | ~1.19 MB | **< 1.0 MB** |
| screenshot diff vs `docs/ui-reference/` | — | **no visible change, 4 skins** |


### Measured RESULT (2026-08-05, after W1-W7)

Same instrument, same commands, harness build, `--cpu-throttle 6`, 1366x992 @ dpr 2. Ranges are the
spread over two full sweep runs — **these numbers are noisy on the menu routes (up to ~10 points
run-to-run), so a single run must not be quoted as a result.** Every row was verified to have actually
rendered its own Danish title, so none of the good numbers is vacuous.

| screen | busy% before → after | recalcMs/s before → after | layers | layerMB | filtered | willChange |
|---|---|---|---|---|---|---|
| home | 81–92 → **77–85** | 385–458 → 354–403 | 34 → 33 | 41.7 → **35.1** | 22 → 22 | 23 → **7** |
| `/alphabet` (menu) | 70–87 → **67–75** | 311–383 → 243–311 | 33–35 → 36 | 41.3 → 40.5 | 19 → 19 | 21 → **5** |
| `/alphabet/learn` | 78–81 → **16–24** | 96–105 → 51–82 | 84 → 84 | 53.3 → **42.7** | 68 → 67 | 17 → **3** |
| `/alphabet/quiz` | 50–78 → **14–23** | 99–193 → 39–65 | 35–37 → 35 | 51.1 → **39.7** | 19 → 18 | 17 → **3** |
| `/farver/ram-farven` | 63–74 → **21–33** | 147–171 → 53–88 | 27 → 28 | 50.6 → **39.3** | 8 → 7 | 17 → **3** |
| `/math/addition` | 53–62 → **21–25** | 117–147 → 64–81 | 35 → 35 | 51.1 → **39.9** | 22 → 21 | 17 → **3** |
| `/album` | 49–50 → **22–31** | 148–167 → 56–83 | 31 → 29 | 53.6 → **41.8** | 5 → 5 | 17 → **3** |

Eager `modulepreload` + entry JS: **1.138 MB → 0.916 MB** across 20 → 18 chunks (W7).

### Gate verdicts — four of eight met, and the four misses are not close

| gate | target | result | verdict |
|---|---|---|---|
| `recalcPerSec`, every screen | ≤ 5 | 47–60 | **UNREACHABLE AS WRITTEN** |
| `busyPct`, home | ≤ 25 | 77–85 | **NOT MET** |
| `busyPct`, every other screen | ≤ 25 | menu 67–75; all five game screens 14–33 | **PARTLY MET** |
| `layers`, home / `/alphabet` | ≤ 18 | 33 / 36 | **NOT MET** |
| `layerMB`, home / `/alphabet` | ≤ 32 | 35.1 / 40.5 | **NOT MET** (close) |
| `filtered`, `/alphabet/learn` | < 20 | 67 | **NOT MET** |
| eager `modulepreload` JS | < 1.0 MB | 0.916 MB | **MET** |
| screenshot diff vs 4 skins | no visible change | ≤ 1.22/255 mean, at/below the same-load noise floor | **MET** |

**Why `recalcPerSec ≤ 5` cannot be met while the app animates at all.** Blink counts one style
recalculation per FRAME on which anything is animating, whatever the mechanism. Measured on home at 6x:
stripping every CSS keyframe animation leaves it at **60.1**; neutering the parallax driver leaves it at
**59.3**; only `--reduce-motion`, which removes ALL animation, reaches **0**. The §3 target was read off
run C of F1's table, which is the reduced-motion run — i.e. it is the number for an app with no
animation, not a target for one that keeps its ambient world. **`recalcMsPerSec` is the number that
actually moved** (e.g. ram-farven 171 → 53, quiz 193 → 39) and is what a future session should gate on.

**Why home and `/alphabet` cannot reach `busyPct ≤ 25`.** After W1 and W2 the entire remaining cost on a
menu route is the ambient field's own animation. Measured on home at 6x, everything else held constant:

| home, 6x | busy% | recalcMs/s |
|---|---|---|
| after W1–W7 | 78–85 | 354–403 |
| parallax layers pinned still | 78.3 | 491 |
| **ambient animations PAUSED** | **39.7** | **63** |
| reduced motion (the floor) | 10.6 | 0 |

Two hypotheses were tested and REJECTED: it is not rasterisation (dpr 1 and dpr 2 measure the same, 84.7
vs 85.7) and `translate3d` in the keyframes changes nothing (85.6). So **F3 is superseded too** — "the
ambient field's CSS animations are free" was a subtraction taken while 25 framer loops saturated the
thread. CSS is still ~5–10x cheaper per element than a JS loop, but 14 sprites are not free.
The only remaining lever is the sprite COUNT, and §9 explicitly forbids touching it. **That is the
owner's call, not the implementer's** — see §12.4.

**Why `layers` ≤ 18 and `layerMB` ≤ 32 cannot be met.** A `transform`/`opacity` keyframe animation
promotes its element by itself — that is exactly why W2.1 could delete the `will-change` hints. So the
14–17 ambient sprites are 14–17 layers by construction, and the floor for a screen with a live ambient
field is roughly `9 + count`. The `will-change` CENSUS is the number that moved as intended (23 → 7 on
home, 17 → 3 everywhere else) and `layerMB` fell 6–12 MB per screen.

**Why `filtered` on `/alphabet/learn` stays at 67.** W4's premise is incomplete: `box-shadow` is the same
picture as `drop-shadow` only for an OPAQUE box, and every tile surface here is translucent toward the
bottom (`tileSurface` ends at `rgba(accent, 0.08)`), so the drop-shadow shows THROUGH the tile's own face
and is load-bearing for the material. Measured: converting lifted a tile face from rgb(208,210,219) to
rgb(228,230,240) and lightened the shadow band beneath it by 11 RGB, with DOM rects byte-identical. Of
the 68, 30 were those chained drop-shadows and 35 were `blur()` on contact-shadow ellipses, which were
never drop-shadows and never in W4's scope — the gate looks like it was computed assuming all 68 were.
The full conversion is worth **layers 84 → 59 and busy 25.9% → 22.6%** on that screen and is available
whenever the owner accepts the material change.

`busyPct ≤ 25` is chosen against the measured floor: reduced motion sits at 7.7–12.6%, so 25% leaves
real headroom for the animation the app is keeping. The reduced-motion run **is** the target, minus the
things reduced motion removes.

**Keep the assertions tight enough to fail.** `xpAfter > xpBefore` once passed on a build with `taskXp`
zeroed; `recalcPerSec ≤ 5` passes vacuously if the probe never settled on the right screen, so W9 must
also assert the screen it measured actually rendered (a mounted board, not the error boundary's "Prøv
igen" — a crashed route satisfies a `--wait-for` and makes every later number vacuously good).

## 8. Sequencing

One session, one play-test. Commit per work item so a bisect is possible: W1 → W2 → W4 → W3 → W5 → W8 →
W6 → W7 → W9. W1 first because it is ~90% of the win and the cheapest to judge; W3 and W5 after the
shadow work because both change what the compositor has to blur.

## 9. Explicitly NOT in scope

- **The MUI/Emotion runtime.** MUI's own benchmark puts 1000 `sx` elements at ~200 ms of extra render,
  and one team measured a 48% render-time drop moving off Emotion — so this is real, and it is still
  out: the diff would touch the entire component tree, it is a *mount-time* cost while this bug is a
  *steady-state* one, and F1 says the steady-state cost is removable without it. Revisit only if the
  iPad still feels slow **after** W9.
- **`content-visibility`** — Safari 18 (F9).
- **Shrinking the scene art** — F7 says it is already upscaled.
- **Trimming the ambient sprite count, the bloom density, or any animation the child can see.** F3 says
  they are free; the owner's constraint says they stay.
- **Restructuring the parallax driver** — F2 measured it at ~11%.
- **A service worker / offline caching.** The app is deliberately network-only
  (`.claude/rules/pwa-and-device.md`); do not reach for one as a load fix.
- **Adaptive/automatic device tiering.** The owner's answer was "identical everywhere". W6's toggle is a
  permanent adult-set escape hatch, not a device tier — nothing detects hardware and nothing branches on
  it by itself.

## 10. Risks

| risk | why it is real here | mitigation |
|---|---|---|
| A CSS idle animation fights a framer transform on the same element | both write `transform`; last writer wins, silently | nested-layer rule (W1), copied from `useLivingCard`; screenshot A/B per skin |
| The conversion changes timing/amplitude by a hair and the app feels different | 25 sites, hand-converted | one shared `idleMotion.ts`, values copied not re-derived; owner play-test is the oracle |
| Removing `will-change` de-promotes something that then repaints per frame | the point of `will-change` for non-animated elements | `layerMB` must fall while `recalcMs/s` does **not** rise — check both, per screen |
| W3's scaled raster softens the game boards visibly | it is a real trade | A/B screenshot at 1366×992 and 375×667 before shipping; back out if visible |
| The perf toggle doubles the verification surface, permanently | 2 paths × 4 skins × reduced-motion × 4 viewports, and it is not going away | the toggle may switch only the animation MECHANISM, never a layout — guarded — so the sweep is owed on the fast path alone (W6); default pinned fast by a guard |
| The legacy path rots unnoticed because nobody plays it | it is off by default and only reached by an adult switch | it is mechanism-only, so "rots" means an animation stops, not a broken board; W8.4 asserts round outcomes are identical under both |
| Making `prebakedTts` lazy leaves the first clip on live Azure | it already fails soft that way | keep the soft fallback; assert the manifest resolves before the first game welcome |
| A parallel session is mid-refactor in this tree | it has happened repeatedly | `git status` **and** `git log` before touching anything; never report a sibling's red build as your own |

## 11. Verification plan

- **Rung 1 — `perf.mjs`** (this PRD's instrument) for every gate in §7, plus `cdp.mjs --perf` for load
  and `sweep.mjs --phase layout` for geometry. Both on the **harness build**, never the dev server
  (unbundled dev ESM overstates load ~10×).
- **Rung 2 — `webkit.mjs --device ipad-pro`** for the real Safari engine and the app's iOS branches. It
  renders and cannot play audio at all; it is also the only rung that would catch a Safari-17 property
  gap before the device does.
- **Rung 3 — the owner's iPad**, as a **standalone PWA from the home screen** (the reported
  configuration). What only rung 3 can answer: whether it feels smooth, whether taps land promptly,
  whether anything looks different. Two things to check while there, both cheap and both currently
  unknown: **is Low Power Mode on** (iPadOS throttles CPU/GPU in it), and **how many Safari tabs are
  open** (page memory is shared and Jetsam is aggressive).
- **Unverified is not broken — say UNKNOWN.** Across the sweep sessions the probes' own defects
  outnumbered the app's about five to one.

## 12. Owner steps

1. Play-test after W9 on the child's iPad, in the PWA, on the three surfaces he named: home + a section
   menu, one game of each kind, and the wipe between them.
2. **Flip "Flydende grafik" off and on while standing there** and compare. That is what W6 is for, and it
   is the only A/B this project can run on the real device — the toggle survives a PWA relaunch where a
   `?param` cannot be typed at all. It is also the revert: if a build ever regresses, off is a working
   app without waiting for a deploy.
3. Check Low Power Mode and open-tab count once while there (§11).
4. If it still stutters with the toggle ON (fast): that is the signal to open the MUI/Emotion question
   (§9), and the measurement to bring back is *which* of the three surfaces still does it.

---

## Kick-off prompt for the implementation session

> Implement `plans/performance/tmp-prd-performance-01-ipad-a10x-smoothness.md` — W1 through W9, in the
> §8 order, one commit per work item on `master`.
> Re-measure with `.claude/skills/ui-screenshot/perf.mjs` against the harness build and fill in §7's
> before/after table; the look must not change on any of the 4 skins.
