# PRD — Krea 01: the creative section + three drawing games

Status: authored 2026-10-16. **NOT implemented.** Owner decision session; every question in §2 was
answered by the owner before this was written.

Supersedes nothing. Adds a **6th main section, "Krea"**, with four tiles; this PRD builds the section
and the three drawing tiles (**Fri Tegning, Tegn med Mig, Farvelæg**). The fourth tile, **Perleplade**,
is `tmp-prd-krea-02-perleplade.md` and is built *after* this one, on top of it. Art prompts:
`plans/krea/krea-art-prompts.md`.

---

## 1. Why

**The app has no open-ended play at all.** Every one of its 24 games has a right answer. A creative
section gives the child a place to make something of their own, and done right it still teaches:
colour names, shapes, following a spoken instruction, symmetry, and counting.

Research (2026-10-16; app survey + literature, sources in the planning session):

- **What the best kids' creative apps share:** Toca Boca builds "digital toys", with no score, no timer
  and no wrong. The standout moment across the field is **the drawing comes alive**: Sago Mini Monsters
  grows features on what the child painted, Bimi Boo animates the finished page, Labo Lado turns a
  drawn car into a toy you drive, and Crayola Color Alive animates a scanned page. Kids Doodle's
  favourites are **magic brushes** (rainbow, glitter). Daniel Tiger's easel hangs pictures on a washing
  line in the world. Every tap in the good ones makes a sound (NN/g: young children expect feedback
  on every action).
- **Guided drawing done badly judges the child:** "Draw In" gives stars for staying on the outline.
  Tracing skill grows mostly **after age 6–8** (Perceptual & Motor Skills 2021), and on a tablet
  5-year-olds draw faster but rougher than on paper (Gerth 2016). So guidance must be **very forgiving
  and never say "outside the line"**.
- **Rewards and drawing — the central tension.** Lepper, Greene & Nisbett 1973 ran this *on
  preschoolers drawing with markers*: children promised a "Good Player" award drew **less** in free play
  one to two weeks later, and their drawings were rated worse (2.18 vs 2.85). An unexpected award did no
  harm. Deci, Koestner & Ryan 1999 (128 studies) found completion-contingent rewards lower free-choice
  motivation (d = −0.36). Amabile 1982: competing for prizes made less creative collages. **The owner's
  answer (§2.1): XP only for finished guided pieces, never for free drawing; the free reward is the
  picture coming alive.** The narration *describes* and never grades: "Du har brugt fire farver", never
  "Sikke en flot tegning" (inflated praise backfires on low-self-esteem children; Brummelman 2016).
- **Pre-readers pick colour by sight:** big crayons, no words. Saying the colour's Danish name on pick
  turns every choice into a Farver lesson for free.
- **Danish pedagogy:** the læreplan makes play and a playful approach the starting point. Resnick's
  "low floor, wide walls" model: free canvas, guided drawing and colour-in are three doors to the same
  table, not a ladder.

**The bar is Fyld Båden** (`plans/harbour-game/tmp-prd-harbour-game-01-fyld-baaden.md` §1): a
full-bleed painted scene, rich sound, and it must look and feel better than the other games on the
iPad, not merely work.

## 2. Decisions — dated 2026-10-16, do not re-litigate

### 2.1 Section, rewards, persistence
1. **Section "Krea"**, SectionId `krea`, **last** on the home screen (the five existing sections keep
   their order). Four tiles: **Fri Tegning · Tegn med Mig · Farvelæg · Perleplade**. Each tile is its
   own gameId (`krea.draw`, `krea.guide`, `krea.color`, `krea.beads`). This PRD ships the first three.
2. **Rewards:** **finished guided pieces earn task XP** (Tegn med Mig, Farvelæg, and in PRD-02 the bead
   patterns). **Fri Tegning (and in PRD-02 the free board) earns nothing.** Its reward is that the
   picture comes alive.
3. **Nothing is saved.** No gallery, no IndexedDB, no sync, **no change to the privacy text**. A piece in
   progress survives **for the session only**: navigating away and back, or an accidental reload,
   resumes it. When the session ends (the app is force-closed, or the tab or PWA is killed), it is gone.
   Implementation: `sessionStorage` (§4.6).
4. **Discarding unfinished work asks first**, as spoken words plus picture buttons (a 5-year-old can't
   read "Er du sikker?"). Title **"Nyt papir?"**, spoken **"Vil du have et nyt papir? Din tegning
   forsvinder."**, with a fresh-sheet button (Ja) and a my-picture button (Nej, keep it).

### 2.2 The drawing games
5. **Fri Tegning** tools: **crayon** (thick, textured; the default), **rainbow** (hue cycles along the
   stroke), **glitter** (twinkling stars along the stroke), **stamps** (tap to stamp existing baked art;
   the stamp tray opens only when stamps are picked), plus **eraser** and **undo**, and "Nyt papir" (with
   the confirm). That is **6 tool buttons in one row, the same at every level**, with no size toggle. The
   owner asked to be told honestly whether to cut tools by level: hiding the fun tools at Let would take
   the best part away from the youngest, and too much choice is a layout problem, not a level problem.
   **Only the palette changes with level.**
6. **Palette:** **8 colours at Let, 12 at Normal and Svær.** The 12 are rød, orange, gul, lysegrøn,
   grøn, lyseblå, blå, lilla, lyserød, brun, sort, hvid. Let's 8 are rød, orange, gul, grøn, blå, lilla,
   brun, sort. **Picking a colour speaks its Danish name.** Rainbow and glitter are brushes, not colours.
7. **Tegn med Mig** (guided): the child picks a subject from a **picture grid**, then draws it **one
   step at a time** on a thick dotted guide. Each step is spoken and named as a shape ("Tegn en stor
   cirkel til hovedet"). **A step counts when the child has drawn roughly along the guide**, with a
   lenient coverage rule (§4.3). The child's own wobbly line is kept and never redrawn or snapped. There
   is no "outside the line" feedback, ever. **Symmetric subjects have a mirror step**: the child draws
   one side and it appears on the other. This is the only place symmetry lives in drawing; there is no
   mirror tool in Fri Tegning (owner, 2026-10-16).
8. **Farvelæg** (colour-in): pick a page from a picture grid, then **tap a region to fill it** with the
   chosen colour. It never leaks.
9. **Finishing:**
   - **Guided and colour-in pieces finish when all steps or all regions are done** (any colour counts).
     At that point a **"done" button** (a check icon, no words) appears. Before it, only "Nyt papir"
     exists.
   - **Fri Tegning's done button** is available as soon as there is ink.
   - **Done → the picture comes alive** with a sound and **one describing line** (§2.3). XP follows for
     guided pieces.
   - **The picture then stays on screen** to admire, and a big **"next" button** is the way on: it
     returns to the picture grid, or gives a new paper in Fri Tegning. After done, "next" needs no
     confirm (the child said they were finished). The confirm only guards *unfinished* work.
10. **Content v1: 3 subjects per family, 4 families**, to grow later as data (§3). Families: Animals ·
    Landscapes & places · Vehicles & things · Fantasy. That gives 12 guided subjects and 12 colour-in
    pages (lists in §2.4).
11. **Learning tie-ins (all four chosen):**
    - colour names spoken on pick
    - shapes named in guided steps
    - symmetry, through the mirror steps here and the patterns in PRD-02
    - counting in PRD-02, plus the free-drawing done line "Du har brugt {n} farver"
12. **Apple Pencil** draws exactly like a finger. **Palm guard:** once a `pen` pointer is seen on the
    canvas, `touch` pointers on the canvas are ignored for the rest of the session. There is no pressure
    effect.

### 2.3 Look and sound
13. **A painted art-studio scene**, full-bleed like Fyld Båden's harbour, hiding the world
    (`useOccludeWorld`):
    - a wooden table with a window of daylight behind it
    - the paper on the table
    - crayons, tool props and stamps as baked claymation art
14. **No ambience loop.** It is quiet while creating; only tool sounds play (crayon scratch, rainbow
    shimmer, glitter twinkle, stamp thunk, fill bloop, undo whoosh, paper rustle, a done "ta-da").
15. **Narration: guiding, not chatty.** The child hears:
    - the welcome line
    - each guided step
    - the colour name on pick
    - one describing line on done
    - the "Nyt papir?" confirm

    It is **silent while drawing**. Every line is prebaked. The describing lines:
    - Fri Tegning: **"Du har brugt {n} farver!"** (n = distinct palette colours inked; rainbow and
      glitter don't count; n = 1 → "Du har brugt én farve!")
    - Guided and colour-in: **one per subject, describing the alive motion**, e.g. "Se, fisken svømmer!",
      "Se, raketten flyver!", "Se, katten hopper!"

### 2.4 Subjects v1 (the implementer may swap within a family if a subject's guide doesn't simplify to ≤ 6 steps)

| Family | Tegn med Mig (guided) | Farvelæg (pages) |
|---|---|---|
| Animals | kat · fisk · sommerfugl *(mirror)* | hund · ugle · frø |
| Landscapes & places | hus med sol · bjerge · havet med båd | strand · skov med svampe · byen om natten |
| Vehicles & things | raket · bil · blomst | tog · sejlbåd · is |
| Fantasy | drage · robot *(mirror)* · slot *(mirror)* | enhjørning · rumskib · dragen ved slottet |

### 2.5 Decided by the author, stated as assumptions (the owner would not care; change freely)
- **XP size:** `tasksInRound: 2`, so one finished piece is about half a round (≈ 21 XP). A piece takes
  1–3 minutes, about a quiz round, so this is a slight damp on purpose (§1, Lepper). It is one number
  to tune.
- **Resume is per item:** the session keeps every in-progress subject/page separately. The picker card
  shows the child's partial work, so switching subjects never needs a confirm.
- **Colour-in line art is Gemini line art turned into a region map by a build script** (§4.4), not
  hand-authored SVG: it looks better. **Guided subjects are authored as vector step paths**, because
  their parts *are* simple shapes, which is the lesson.
- **Picker thumbnails cost no art.** A guided card renders its own step paths as a finished line drawing.
  A colour-in card is its line art, with the child's fills if in progress.
- **Free-drawing "alive" = a gentle sway/bounce** of the whole picture. Guided and colour-in subjects
  each name one preset from a small set (§4.5).
- **The release gate:** like `boatGate.ts`, Krea (home object, menu, routes) is visible on staging, dev
  and the harness only, until the owner releases it by deleting the gate.

## 3. What changes in code

| Path | Change | |
|---|---|---|
| `src/config/kreaGate.ts` (+test) | `showsKrea(tier, isDev, isHarness)`, the `boatGate.ts` shape, truth-tabled | new |
| `src/config/progressSchema.ts` | `SectionId` + `SECTION_IDS` += `'krea'`. **`SCHEMA_VERSION` stays 4** | edit |
| `src/config/progressMerge.ts`, `api/progress.ts` | follow `SECTION_IDS`. Verify an old client's push without `krea` keys doesn't erase them (§4.1) | edit/verify |
| `src/services/progressStore.ts` `sectionForGameId` | already maps by head once `krea` is in `SECTION_IDS`. **Add a test** that `krea.*` → `'krea'`, not the silent `'alphabet'` fallback | test |
| `src/theme/tokens/types.ts`, `helpers.ts`, every `*.tokens.ts` (incl. `jungle`, `candy`) | `CategoryTokens.krea`, `SCENE_SECTION_ORDER`, `defaultHomeAnchors` (6), `defaultSectionFocus`, per-skin `homeAnchors`/`sectionFocus` | edit |
| `src/config/categoryThemes.ts` | `categoryContent.krea`: name "Krea", 4 games (`title` directly above `route`, sweep.mjs regex) | edit |
| `src/App.tsx` | lazy routes `/krea`, `/krea/tegn`, `/krea/tegnmedmig`, `/krea/farvelaeg` (+ `/krea/perler` in PRD-02), all gated | edit |
| `src/components/krea/KreaSelection.tsx` | menu, like `OrdlegSelection.tsx`. Perleplade's tile is hidden until PRD-02 | new |
| `GameSelectionLayout.tsx`, `GameShell.tsx`, `RepeatButton.tsx` | `categoryId` unions += `krea` (+ `KreaRepeatButton` if a game uses Hør igen) | edit |
| `src/components/home/HomePage.tsx` | `HomeCardId`, `SECTION_ROUTES`, `homeCards`, gated. **Flat grid with 6 objects** (§4.1) | edit |
| `src/utils/menuPaths.ts`, `src/config/routeDepth.ts`, `scene/PersistentWorld.tsx` `BLOOM_SECTIONS` | add `krea` | edit |
| `src/assets/themes/icons/index.ts` + `krea.webp`, `games/index.ts` + 4 game icons, `scripts/optimize-theme-art.mjs` `ICON_ROLES`, `scripts/app-store-header.mjs` | section and tile icons | edit/new |
| `src/assets/games/index.ts` `GameSection` + `src/assets/games/krea/` | studio art, crayons, tool props, line art, region maps | new |
| `src/config/difficulty.ts` | `TUNING`/`EXEMPT` entries (§4.7) | edit |
| `LaeringPane.tsx` `SECTIONS`, `BoernSection.tsx`, `adultSectionLabels.ts` | Krea row / label | edit |
| `src/config/usageEvents.ts` `ROUTE_EVENTS` | events for the new routes (`usageEvents.test.ts` fails otherwise) | edit |
| `src/config/gamePhrases.ts` (or `kreaPhrases.ts`) | colour names (reuse `spokenColor` if forms match), step lines, describing lines, confirm line, welcome titles | edit/new |
| `shared-narration-clips.js`, `SimplifiedAudioController.ts` `GAME_WELCOME_MESSAGES`, `auditClips.ts` (new `AuditGroup` 'krea') | enumerate + welcome + audit group | edit |
| `src/services/sfxClient.ts` + `public/sounds/ui/*.mp3` | new cues (§2.3.14) | edit/new |
| **`src/components/krea/canvas/`** | the shared drawing engine: `strokeModel.ts` (pure: strokes, undo, serialise, colour count) + test, `brushes.ts` (crayon/rainbow/glitter/eraser/stamp renderers, deterministic), `DrawingSurface.tsx` (pointer handling, palm guard, layered canvases), `regionFill.ts` (pure: label-map → fill) + test, `guideMatch.ts` (pure: coverage rule) + test | new |
| `src/components/krea/studio/` | `StudioScene.tsx` (backdrop + table + paper rect, reserved layout), `ToolRow.tsx`, `CrayonPalette.tsx`, `StampTray.tsx`, `NewPaperConfirm.tsx`, `DoneButton.tsx`, `NextButton.tsx`, `KreaPicker.tsx` (picture grid), `alive.ts` (presets) | new |
| `src/components/krea/FriTegningGame.tsx`, `TegnMedMigGame.tsx`, `FarvelaegGame.tsx` | the three games | new |
| `src/config/kreaSubjects.ts` (+test) | guided subjects as data: steps (SVG path, spoken line id, `mirror?`), alive preset, family | new |
| `src/config/kreaPages.ts` (+test) | colour-in pages: asset ids, region count, alive preset | new |
| `scripts/krea-regions.mjs` | Gemini line-art PNG → transparent line layer WebP + region label-map PNG + regions json (§4.4) | new |
| `src/services/kreaSession.ts` (+test) | sessionStorage per profile × game × item, with the lifecycle of §4.6 | new |
| `src/components/promptDraw.test.ts`, `src/config/hintLines.test.ts`, `rewardSurfaces.test.ts` `SEAM_GAMES` | add `krea/` / the XP games to the hand lists | edit |
| `.claude/skills/ui-screenshot/sweep.mjs` (`sectionRoutes`), `music-fade.mjs` (`MENU`) | add Krea | edit |
| `.claude/rules/games-krea.md` (≤ ~5 KB, §4.8), `CLAUDE.md` "5 sections" + `theming.md`/`scene-and-world.md`/`scene-assets.md` counts | net-zero | new/edit |

## 4. The traps — read this before you write any of it

### 4.1 Registering a 6th section
- **`sectionForGameId` silently falls back to `'alphabet'`.** Until `krea` is in `SECTION_IDS`, every
  `krea.*` XP lands in Alphabet with no error. Pin it with a test, and re-break it.
- **gameIds are letters only** (`hintLines.test.ts` parses `'([a-z]+\.[a-z]+)'`): `krea.draw`,
  `krea.guide`, `krea.color`, `krea.beads`.
- **Client and server ship together.** `api/progress.ts` drops unknown section keys. Before release,
  **verify the merge**: an old open iPad PWA (no service worker, but a long-lived tab) pushes a doc
  without `krea` keys. The G-counter/LWW merge must keep the server's `krea` entries, not zero them.
  Write that as a `progressMerge` test. **`SCHEMA_VERSION` stays 4**: a bump wipes every child's book.
- **The gate must cover the home object, the menu and every route**, and must use the `boatGate` shape
  (`BL_TIER` defaults to `production` under `npm run dev`). A deep link on production redirects home.
- **The home layout must work with 5 AND 6 objects**: production shows 5 until release, staging shows 6.
  - Immersive skins seat section objects on a hand-authored arc (`scene-and-world.md`). Every skin's arc
    needs a 6-object version and the 5-object one must stay pixel-identical. Krea goes **last**; don't
    reorder.
  - The flat skin's phone-landscape grid is `repeat(5,…)`, so 6 gives an orphan 5+1. Use 3+3 there.
  - Measure with the `data-bl-landmark` probe on all four skins, portrait and landscape.
- `getCategoryTheme('krea')`, never `categoryThemes.krea`. An unknown id falls back to alphabet
  *silently*, so a missing token looks "fine".
- Section icons are on the **legacy magenta** screen (`scene-assets.md`); game art is green.

### 4.2 The canvas on Safari 17 (nothing in this repo draws on a canvas yet)
- **`getCoalescedEvents()` only exists from Safari 18.2.** Feature-detect it and fall back to plain
  `pointermove`. Smooth with **quadratic curves through midpoints**, or fast strokes come out as
  polygons. iOS delivers about 60 Hz, so batch drawing into one rAF per frame.
- **Gestures:**
  - Put `touch-action: none` on the drawing surface.
  - Call `preventDefault` on `gesturestart`/`gesturechange`, and on a non-passive `touchmove` scoped to
    the surface.
  - Set `user-select: none` and `-webkit-touch-callout: none`.
  - Use `setPointerCapture` so a stroke that leaves the paper keeps drawing to the edge.
  - **Only one active pointer per surface**: the first pointer wins and others are ignored. A second
    finger is usually a palm or a sibling.
- **Palm guard:** after any `pointerType === 'pen'` on the surface, ignore `'touch'` there for the
  session. Buttons outside the surface are unaffected.
- **Scribble** (iPadOS handwriting) can eat fast Pencil strokes on web canvases. There is no known code
  fix. It's a rung-3 residue, so note it and don't chase it.
- **Canvas memory is capped** (WebKit total canvas memory, roughly 224–576 MB depending on device). A
  full-paper canvas at dpr 2 is about 20 MB.
  - **Cap the backing store at dpr 2.**
  - **Never keep bitmap snapshots for undo.** Undo replays a stroke list from **one** checkpoint canvas
    (bake strokes older than the last 30 into it).
  - Release any discarded canvas by setting it to 0×0.
  - Layers: paper (CSS background art, not a canvas) · ink canvas · live-stroke canvas. Colour-in adds
    a fill canvas under a line-art `<img>`.
- **`toDataURL('image/webp')` is not supported in Safari 17**; it silently returns PNG. The checkpoint
  in sessionStorage is PNG, which is fine. Check its size against the sessionStorage quota (~5 MB). If it
  exceeds that, drop the checkpoint and keep strokes only, so resume never throws.
- **Deterministic brushes:** glitter stars and crayon grain must be seeded per stroke (index-based PRNG).
  Otherwise an undo or a resume replay draws a *different* picture.
- **Crayon texture** = a small baked grain tile tinted per colour (`createPattern` from a tinted
  offscreen tile, cached per colour). Don't use a per-point random scatter, which is slow on the A10X.
- **Eraser** = `destination-out` on the ink layer. It must not erase stamps' underlying paper art, which
  is CSS, so it's safe by construction.
- **The bug-report screenshot** (`@zumer/snapdom`) may or may not capture canvas pixels. Check it once
  (rung 1). Whatever it does is acceptable; just know it.

### 4.3 Guided drawing (`guideMatch.ts`, pure)
- A step's guide is an SVG path in a **normalised 0–1000 subject box**, scaled into the paper's
  reserved rect. Sample it every ~8 units.
- **A step is done when ≥ 60% of the guide samples lie within the tolerance band of any ink drawn during
  this step, and the pointer is up.**
  - Tolerance (CSS px at paper scale): **Let 48 · Normal 36 · Svær 28**. All are forgiving; this is the
    level axis (§4.7).
  - **Never-fail:** after **3 strokes on a step that still don't pass**, the step is accepted anyway.
    There is no visible "miss", ever.
- The next step's guide fades in with its spoken line. **At Let each step first shows a pencil sprite
  tracing the guide once** (a one-shot demo, ~1.2 s, transform/opacity only).
- Stalled for 8 s → the guide pulses (`hintPulse`) and the step line repeats once, via
  `useNeverFailHint`-style tracked timers, cancelled on any pointerdown.
- **Mirror steps:** live-mirror each stroke across the subject's vertical axis onto the ink layer,
  while drawing, not after. Coverage counts the drawn side only.
- **The child's ink is the picture.** The dotted guides disappear on done. Nothing is snapped, smoothed
  beyond normal stroke smoothing, or replaced.
- **Never `await` a step line.** Advancing is driven by the coverage rule, and the line is
  fire-and-forget (house audio rule).

### 4.4 Colour-in regions (`scripts/krea-regions.mjs`, `regionFill.ts`)
- The art is Gemini **line art**: thick, closed, black outlines on white, no shading, no grey (the
  prompts are in `krea-art-prompts.md`).
- The script (sharp):
  1. threshold
  2. label the connected components of non-line pixels (4-connected)
  3. **merge components below a minimum area into the line layer** (a 5-year-old can't hit a pupil;
     ~1.5% of the page area is the start value, tune by eye)
  4. drop the outside-background component, or keep it as one "sky" region per the page's json flag
  5. emit `<page>.line.webp` (transparent, lines only), `<page>.regions.png` (region id in R+G,
     lossless) and `<page>.json` (region count, bboxes)
- **Never WebP the label map.** Lossy encoding corrupts ids.
- **Runtime:** decode the label map once into a `Uint16Array`. A tap looks up the id under the finger
  and paints that id's pixels inside its bbox on the fill canvas. Don't flood-fill at runtime, so it
  can't leak and costs nothing. Taps landing on line pixels resolve to the **nearest** region within
  ~20 px.
- "All regions done" means each region has a fill flag. White counts as a fill. The eraser (tap) clears
  a region.
- **The last-region problem:** with ≤ 3 regions left and 6 s idle, the unfilled regions pulse softly
  (a CSS mask overlay, no canvas animation).
- Gemini line art drifts toward grey shading and texture. The script must **reject** a page whose line
  layer has more than ~2% mid-grey pixels, rather than silently thresholding it into speckle regions.
  Re-render instead.

### 4.5 "Comes alive" (`alive.ts`)
- Presets: `hop`, `swim` (glide right + wobble), `fly-up`, `flap` (mirror subjects: the two halves of
  the ink scale on X around the axis), `sway`, `drive`, `glow`. Each is **a one-shot of 2–3 cycles,
  then rest**: not continuous, and not framer `repeat: Infinity`.
- Use **transform/opacity only**, full transform strings, cubic-bezier, no springs, no `'none'` target
  (memory: GPU animations; `gpuMotion.test.ts` pattern). Apply it to the **canvas element** (or a
  bitmap copy), never by redrawing the canvas per frame.
- `flap` needs the picture split into two halves: copy the ink to two half-width canvases for the
  duration, then restore.
- Under reduced motion it's a soft `glow` only.
- Order: done tap → `ta-da` sfx → alive motion + the describing line (fire-and-forget) →
  `completeTask(true)` → `run.thenContinue(showNext)`. The **ceremony plays at the seam after the
  alive moment**, before the "next" button appears.

### 4.6 Session resume (`kreaSession.ts`)
- Key `bl-krea:<profileId|guest>:<gameId>:<itemId>`. The value is a **stroke list** (quantised integer
  points), plus the checkpoint PNG for Fri Tegning, or the fill map for colour-in.
- Write on pointer-up, debounced ~500 ms. Resume on mount.
- **Clear:**
  - on "Nyt papir" → Ja
  - on "next" after done
  - on **profile switch** (`profileStore` detach), or a sibling sees the other child's drawing
  - on `progressStore.resetAll`
- Copy the `practiceLedger` attach/detach/clear wiring (`profileStore.ts` ~362–490).
- Wrap every read and write in try/catch. A quota error or a private-mode throw degrades to "no
  resume", never to a crash.
- The owner's definition (§2.1.3): "nothing is stored". sessionStorage ends with the session, so **the
  privacy text does not change**. Don't add localStorage or IndexedDB "for safety".
- **UNKNOWN until the iPad:** whether a home-screen PWA killed from the app switcher starts with an
  empty sessionStorage. Expected yes, and it's the owner's intended behaviour either way.

### 4.7 Difficulty
- `krea.draw` and `krea.color` respond **only through the palette (8 / 12 / 12)**, so Normal = Svær. The
  distinctness guard (`difficulty.test.ts` ~188–213) requires every non-`EXEMPT` game to differ at all
  three levels.
  - Register both in **`EXEMPT`** with a reason (e.g. *"creative tool — only the palette widens, 8 at
    Let, 12 above; nothing to grade"*).
  - Check whether `EXEMPT` also forbids having any `TUNING`. If it does, read the palette from a
    `KREA_PALETTE` table outside `TUNING`, not by inventing a fake Svær axis.
- `krea.guide`: tolerance 48/36/28 + palette 8/12/12 + the Let-only demo, so it differs at all three.
- **XP never depends on difficulty**: `tasksInRound: 2` at every level.
- **Audit by sampling, not by reading the table** (CLAUDE.md). Play one guided subject at each level
  and confirm the band feels forgiving at Svær.

### 4.8 Guardrail budget
- `npm run context:check` is at **~47,959 / 48,000** for the worst-case component edit.
  - `games-krea.md` loads *instead of* `games-math.md` (5,128 B) for a krea edit, so it must be
    **≤ ~5.1 KB**.
  - Adding `src/components/krea/**` to the `paths:` of `games-catalog.md`, `game-development.md` and
    `drag-and-drop.md` costs bytes in the math worst case. **Cut the same bytes in those files.**
    `contextBudget.test.ts` fails otherwise.
- `games-krea.md` holds the rules, not this PRD: no reward for free play, never grade, the canvas
  traps, session-only persistence, and the coverage rule.

### 4.9 Audio
- The **8-step protocol** in `audio-system.md` for every new line. New clips:
  - colour names (reuse the existing colour clips if their text is the bare name)
  - ~60 step lines
  - 12 + 12 describing lines
  - "Du har brugt {n} farver!" n = 1–12
  - the confirm line
  - 3 welcome titles
- `audit:approve-all`, then say the clips are "approved-but-unheard".
- A welcome needs **both** `GAME_WELCOME_MESSAGES` and `WELCOME_TITLES` (the match guard since Fyld
  Båden).
- Step lines are built from a closed template ("Tegn {size} {shape} til {part}"), but **the builder
  outputs whole sentences per subject and step**, so each is one prebaked clip, never stitched.
- The colour name on pick is fire-and-forget. A fast child picking 4 colours cancels the earlier names
  (one audio at a time), and that's correct.
- **Tool sounds:**
  - SFX on `sfx`, never `SimplifiedAudioController`.
  - MP3 only.
  - The crayon scratch is a **short loop started on pointerdown and stopped on pointerup**
    (`sfx.startLoop`/`stopLoop`). The gesture is in hand, so iOS allows it.
  - Bake levels with the LUFS scripts. Source the files as Fyld Båden's were.

### 4.10 Flow and shell
- **The header holds the ring alone.** Tools, palette, done, next and Nyt papir live in the studio
  scene.
- **Navigation only via `useTransitionNav()`.** The picker → piece → picker loop is in-game state, not
  routes. Deep link with a URL param (`?motiv=kat`, `src/utils/urlParams.ts`).
- Fri Tegning has no `useTaskRun` (no XP). Tegn med Mig and Farvelæg use
  `useTaskRun({ tasksInRound: 2, gameId })`, with **one task per finished piece**. `firstTry` is always
  true.
- **Endless:** no counter, no "Færdig!" screen, no stars, no bests, and no "3 of 12 done" on the picker.
  A finished subject is **not** marked done on the picker (that would be a checklist, and a
  contingent-reward cue).
- **No emoji** (`noEmoji.test.ts`): baked art on child surfaces.
- **Touch targets:** crayons and tools are ≥ 56 px (a 44 px floor, but these are hit constantly by
  5-year-olds).
- **Layout by reserved space:** the paper is the flex remainder after the tool row and the palette,
  never a tuned percentage. Measure in landscape, portrait and phone, and in **WebKit** (`webkit.mjs`),
  since flex sizing differs from Chrome.
- **Continuous motion is CSS keyframes only** (`idleMotion.ts`). Measure the studio at rest with
  `perf.mjs`; the floor is the A10X.

## 5. What must NOT change
- **Free play earns no XP**, and nothing in Krea grades, scores, stars or compares a drawing. Narration
  describes, never praises the product ("flot", "smuk" and "dygtig" are banned from Krea's lines).
- **XP never depends on difficulty**, and rewards are granted only by the ceremony, at the seam.
  `rewardNumber()`, never `globalLevel()`. **The ring is the only door to Min Bog.** No child artwork
  goes into Min Bog or the world.
- **Nothing persists beyond the session**, and the privacy text is unchanged.
- **One audio at a time, no queue. Never `await` narration to pace anything.**
- `SCHEMA_VERSION` stays 4. The five existing sections keep their home order and the 5-object layout
  on production.
- No `content-visibility`, no Ogg, no emoji, no framer infinite loops.

## 6. Work stages (one commit each, each green on its own)

- **W0 — Art doc and owner render** (parallel with W1–W3). `krea-art-prompts.md` is written. The owner
  renders, and the implementer keys/optimises and shows a contact sheet. Line-art pages go through
  `krea-regions.mjs` with the grey-pixel rejection.
- **W1 — Section registration behind the gate.** SectionId, tokens on every skin, theme, menu with
  three tiles (placeholder icons allowed until W0 lands), routes rendering an empty studio, home object
  (5/6 layouts), Indstillinger row, usage events, merge test, the `sectionForGameId` test, kreaGate +
  truth table. Green build, all section-enumerating tests updated.
- **W2 — The canvas engine.** `strokeModel` + `brushes` + `DrawingSurface` + `kreaSession`, pure parts
  unit-tested: undo replay = same pixels, seeded glitter is deterministic, colour count, serialise
  round-trip, quota failure degrades. Pointer handling, palm guard, one-pointer rule.
- **W3 — Fri Tegning end to end.** Studio scene, tool row, palette (8/12), stamps, confirm, done → alive
  (`sway`) → describing line, next. Tool SFX. Narration prebaked. **Stop for the owner's look and feel
  on the iPad**: this is the vertical slice and sets the bar for W4–W5.
- **W4 — Tegn med Mig.** `kreaSubjects` (12, with the mirror steps), `guideMatch`, picker, demo pencil
  at Let, hint pulse, alive presets, XP + seam. Narration prebaked.
- **W5 — Farvelæg.** `krea-regions.mjs` outputs for 12 pages, `regionFill`, picker, last-region pulse,
  alive, XP + seam.
- **W6 — Guards, rule file, docs, screenshots.** `games-krea.md` (net-zero budget), CLAUDE.md
  "6 sections", `docs/ui-reference/` shots, sweep/music-fade lists.

## 7. Verification

**Rungs 1–2** (`ui-screenshot`, `webkit.mjs` iPad UA, `perf.mjs`, `--audio-report`):
- The home screen with 5 and 6 objects on all four skins (portrait + landscape + phone), with no
  orphan or overlap.
- The Krea menu wrap.
- The studio at rest, with steady-state cost through `perf.mjs` on a `build:harness` bundle.
- A scripted stroke via synthetic pointer events: ink appears, undo removes it, reload resumes it,
  a profile switch clears it.
- The guided coverage pass/never-fail with synthetic strokes.
- A colour-in tap fills exactly one region (pixel check on the fill canvas).
- `--audio-report` on welcome, colour pick, step line and done line.
- Reduced motion. Dark/each skin's ring contrast over the studio.

**New guards, each re-broken with `/re-break`:**
- `sectionForGameId('krea.draw') === 'krea'` (break: remove `krea` from `SECTION_IDS`)
- the `progressMerge` test where an old client without `krea` keys doesn't erase them
- the `kreaGate` truth table
- `strokeModel` undo-replay determinism (break: unseeded glitter)
- the `guideMatch` thresholds and never-fail after 3
- `regionFill` touching only its region's pixels
- the `krea-regions.mjs` grey-pixel rejection
- the `kreaSession` clear-on-detach, and quota failure never throwing
- the narration enumeration of every Krea line (break: an un-enumerated step line)
- a test that Krea's line builders never contain "flot", "smuk" or "dygtig"
- a test that no Krea game calls `useTaskRun` for `krea.draw`
- the `difficulty` `EXEMPT` entries

**Rung 3, the owner's iPad (UNKNOWN until then):**
- finger feel and stroke smoothness on the A10X
- Apple Pencil + palm guard, and Scribble interference
- whether the crayon texture looks like crayon
- the Danish step lines sounding right
- whether a 5-year-old can pass guided steps at Let without help
- sessionStorage after killing the PWA
- the alive moments delighting

## 8. Out of scope
- **Perleplade** (PRD-02).
- Any gallery, saving, sharing, export to Photos, printing or sync.
- A mirror tool in Fri Tegning, brush sizes, a colour mixer, photo import.
- Voice recording ("draw and tell"); the app uses no mic (memory: mic game removed).
- More than 3 subjects per family (later, as data only).
- Removing the release gate (an owner decision after play-testing).

## 10. Progress log (read before continuing)

**2026-10-16 — W0, W1, W2, W3 done** (cd573d4, 2678c76, 5911ecf, 405f6d7; not pushed). Stopped for the
owner's iPad look-and-feel sign-off on Fri Tegning. Playable on DEV/staging at `/krea/tegn`.

- **W0:** art doc checked. The section icon was a clay palette — Farver's home icon already — so it is an
  easel now; green-on-green subjects (done button, rainbow stripe) darkened; batch G is paste blocks.
  **No art has been rendered yet**: every Krea picture is a placeholder (copied icons) or an SVG/CSS
  stand-in drawn in code (studio, crayons, tool buttons).
- **W1:** 6th section behind `kreaGate.ts`. Home: a SEPARATE 6-object arc per skin (`homeAnchorsKrea`,
  `homeAnchorsFor`), so the production 5-arc is byte-identical; in **portrait** six objects do not fit one
  arc (neighbours overlap at 768 wide) so they take the centred flow braked to 3+3. Læring row gated too.
- **W2 deviation from §4.6:** the session keeps the FULL stroke list and replays it, no checkpoint PNG.
  Deterministic brushes make the replay exact and it removes the quota risk; ~1 KB for a few strokes.
- **W3:** as §2.2; plus a 0-colour done line ("Se, din tegning danser!") for a picture of only rainbow,
  glitter or stamps, where "Du har brugt nul farver" would be wrong. `GameShell lightScene` — on Rummet the
  dark-world white title vanished on the cream wall. Tool SFX are SYNTHESISED (`scripts/bake-krea-sounds.mjs`),
  a first pass the owner judges on the iPad. Stamps are 8 existing game renders (`studio/stamps.ts`).
- Verified rung 1 + 2: see the W3 commit body. Rung 1 only: audio, reduced motion, idle cost.
- Known, not chased: an intermittent Howler HTML5-fallback `removeEventListener` error in headless WebKit
  only (no WebAudio there); the ring's grey track is faint on the cream wall on light skins.

**2026-10-16 (later) — art integrated + owner review of Fri Tegning** (5e4627a … this commit; pushed up to
64fb208). Supersedes parts of §2.2 for Fri Tegning — **do not re-litigate**:

- **ALL ART IS IN** `art-src/krea/` under readable names, keyed by `optimize-theme-art.mjs krea` (measured
  overrides for the green subjects; `pointDownLeft` turns the crayons). Line-art pages are in
  `art-src/krea/pages/*.jpg` (12, W5 input), Perleplade props in `art-src/krea/beads/`, the demo pencil is
  `src/assets/games/krea/pencil.webp` (W4). Validation history + prompts: `krea-art-prompts.md`.
- **Studio = a honey-wood table seen FROM ABOVE**; tools in a column beside the paper on a wide screen,
  rows under it on a tall one. Controls are clay objects on the table that act on the PRESS
  (`pressHandlers` — `click` lost fast taps); a blocking overlay's buttons act on the click.
- **House art rule:** what is held in the hand lies on the RIGHT, tip pointing DOWN-LEFT.
- **Fri Tegning has NO finish:** no ✓, no "comes alive", no ta-da, no "Du har brugt {n} farver", no
  "next". "Nyt papir" (with a + badge, done-sized) + the spoken confirm is the only way on, and the old
  sheet visibly slides away (`swapPaper`). **Tegn med Mig / Farvelæg still finish** (§2.2.9 applies to
  them; `alive.ts`, `done.webp`, `next.webp` and the `krea-tada` cue are kept for W4/W5).
- **Tools:** crayon (shows the crayon in hand), pictures (shows the chosen stamp — a rubber stamp was a
  poor identifier), eraser, undo. **No glitter brush** (a star is a stamp, one per tap); **rainbow is a
  crayon variant**, last in the crayon row, spoken "regnbue". The variant row is empty for the eraser.
- **Undo is unlimited** (it stopped at 30); the checkpoint follows and is reused inside the live window.
- Performance: strokes paint incrementally (`createPainter`); opaque brushes make live == committed.

**2026-10-16 (evening) — W4, W5, W6 done** (2355102 + the re-break fix + the W6 commit; not pushed).

- **W4 + W5 are ONE commit** — they share `studio/PieceStudio.tsx` (layout + the one way-on control:
  Nyt papir → ✓ → next), `studio/KreaPicker.tsx` and the phrase builder.
- **Deviation from §4.5's order:** XP is granted ON the ✓ press, not after the dance — leaving mid-dance
  must not lose the piece's reward. The ceremony still waits for the seam after the alive moment.
- **Guides are shapes** (`kreaShapes.ts`), not SVG paths; the mirror axis is stored per stroke.
- **Subjects swapped within §2.4:** the dragon is a long-necked profile with back spikes (a wing +
  round head read as "a pig in a party hat") and its line is "Se, dragen danser!".
- **Regions:** min area 0.35% (not 1.5% — that merged eyes and wheels a child can hit); every page's
  `outside` is `drop` (the largest border-touching area), so open scenes keep their sky only when the
  sky is enclosed. Counts 4–27; tog (27) is the busiest. Grey share measured 0.00% on all 12.
- Farvelæg has no rainbow crayon (a region takes one colour); the eraser is a tap-to-clear tool.
- New `krea-fill` cue (synthesised, `bake-krea-sounds.mjs krea-fill` bakes one cue).
- Context budget: the component-glob ceilings went 120 → 150 (Krea took the tree to 124 files).
- Verified rung 1 (Playwright, real mouse) and rung 2 (WebKit iPad UA, 5 viewports) — see the commit
  bodies. 23 guards re-broken; 2 were vacuous and fixed.

**Next:** the owner's iPad (rung 3) for all three games: finger feel and smoothness on the A10X, whether a
5-year-old passes Let's steps unaided, the step lines sounding right (84 clips approved-but-unheard), the
crayon texture, the synthesised sounds, Pencil + palm guard, Scribble, sessionStorage after killing the
PWA. Then PRD-02 (Perleplade), then the owner's release decision (delete the gate).

## 9. Kickoff prompt for a fresh session

> Implement `plans/krea/tmp-prd-krea-01-section-and-drawing.md` (new Krea section + Fri Tegning, Tegn
> med Mig, Farvelæg). Read §4 traps first, then `.claude/rules/game-development.md`,
> `scene-and-world.md`, `audio-system.md`, `scene-assets.md` and Fyld Båden's PRD §4 as the quality
> model. Start with W0 (art doc, so the owner can render in parallel) and W1 (registration behind the
> gate); stop after W3 for the owner's iPad look-and-feel sign-off. Re-break every guard in §7 and name
> the rung for every claim.
