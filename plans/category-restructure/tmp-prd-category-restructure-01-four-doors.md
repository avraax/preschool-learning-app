# PRD — Category restructure 01: four front-page doors

Status: authored 2026-10-17. **NOT implemented.** Owner decision session; every question in §2 was
answered by the owner before this was written.

**Reverses / supersedes, by name:**
- Krea PRD-01 (`plans/krea/tmp-prd-krea-01-section-and-drawing.md`) **§2.5 / §4.1** — Krea stops being a
  6th home object. Its four games, their routes, gameIds, difficulty tables and the Krea release gate
  survive unchanged; the gate now also carries this restructure (§2 D8).
- The krea easel icon's reason for existing (`src/assets/themes/icons/index.ts`: *"deliberately NOT a
  palette, which is Farver's icon"*) — with one door there is nothing to distinguish, so the easel retires.
- The 5/6-section home layout of every skin (`homeAnchors` / `homeAnchorsKrea`) and HomePage's
  `seatSix` portrait rule.

**Survives unchanged:** every game, every gameId (`<section>.<game>`), every `SectionId`, progress schema
v4, the reward economy, difficulty tables, tap/drag parity, the transition system.

Art prompts: `plans/category-restructure/door-art-prompts.md` (one render).

---

## 1. Why

The front page has **6 doors for 25 games** (5 on production; Krea is the 6th on staging), and they are
uneven: Ordleg holds **2** games, Engelsk 3, while Tal og Regning holds 7–8 and already wraps 7+1 on an
iPad. Ordleg is the next step after Alfabetet (letters → words), so a child has to know that "reading a
word" lives behind a different door from "letters". Farver doesn't map to a school subject at all, but
it shares its core act (choosing, mixing and shading colour) with Krea.

The audience is **5–7-year-olds, most of whom cannot read the labels yet.** They pick a door from its
**picture**, and the picture has to show both what the title says and what's behind the door.

Research (2026-10-17; app survey + NN/G, sources below):

- **Subject doors are what parents recognise.** Khan Academy Kids' Library is sorted by subject
  (Letters, Reading, Math, Logic, Create). Starfall uses two top-level subjects (Reading, Math).
  ABCmouse and Homer give art its own tile. **DR Ramasjang** (the closest local model) split into three
  apps, LÆR / LEG / KREA, with **creative play kept apart from learning**. Every app surveyed keeps
  creative free play separate, so Krea gets its own door here, shared with Farver.
- **Pictures carry the meaning for pre-readers.** NN/G: real-world metaphors are "very helpful for
  pre-readers", and children "mine-sweep", tapping everything they can see. Khan and PBS Kids put a
  character or place behind each choice. None of the apps uses words alone.
- **Repeating the same choice in several places is "very confusing"** (NN/G). A door must not show a
  tile whose art repeats the door icon.
- **Children react badly to content even one grade below them** (NN/G; ages 3–5 and 6–8 are designed
  for separately). Our 5–7 range spans both bands, so with fewer doors the home must not turn more
  toy-like, which is why the objects keep their size (D11).
- **No published study gives a menu-breadth number for pre-readers.** Four doors is a judgement call,
  set by the content (four clean subject groupings), not by research.
- **Danish 0. klasse** is dominated by dansk and matematik; Engelsk is light (~30 h in the 2019
  timetable). The daycare læreplan's 6 themes aren't subjects, so they offer no menu structure.

Sources: nngroup.com/articles/childrens-websites-usability-issues · nngroup.com/reports/children-on-the-web
· apps.apple.com/us/app/khan-academy-kids/id1378467217 · support.abcmouse.com/hc/articles/34386350739735
· mobilsiden.dk (DR's three Ramasjang apps) · uvm.dk 190913-timetalsskema · commonsensemedia.org (Duolingo
ABC, Moose Math) · playpokpok.com/faqs. Not found (UNKNOWN, not "absent"): Lingokids' section names (403),
Mini Mo, Bogstavlege, Alinea Bogstavjagt.

---

## 2. Decisions — owner, 2026-10-17. Do not re-litigate.

- **D1 Four doors**, in this home order (left → right):
  1. **Bogstaver og Ord**: Alfabetet + Ordleg (5 games)
  2. **Tal**: all of today's Tal og Regning (7, or 8 with Fyld Båden), **renamed from "Tal og Regning"**
  3. **Engelsk**: unchanged (3)
  4. **Farver og Krea**: Farver + Krea (9)

  Rejected: three doors (Sprog / Tal / Skab), because putting English beside Danish letters confuses a
  child who can't read; doors by purpose (Lær / Leg / Skab), because a parent can't find "the minus
  game"; and Farver inside Tal (Khan's Logic+), which would make a 12–13-game door.
- **D2 Plain grid inside a door, no group headings.** The order alone keeps the subjects clustered.
  Rows are balanced, **never 7+2**: 9 → 5+4, 8 → 4+4, 5 → one row (or 3+2 where one row doesn't fit).
- **D3 Game order inside the merged doors** (it carries the clustering, so it is part of the decision):
  - Bogstaver og Ord, letters → words: Lær Alfabetet · Bogstav Quiz · Hukommelse · Læs Ordet · Stav Ordet
  - Farver og Krea, colour learning then Krea: Lær Farver · Hvilken Farve? · Farvejagt · Nuancer ·
    Ram Farven · Fri Tegning · Tegn med Mig · Farvelæg · Perleplade
  - Tal and Engelsk keep their current order (Fyld Båden stays first in Tal, per the owner 2026-10-16).
- **D4 Hukommelse stays one per subject**: letter memory in Bogstaver og Ord, number memory in Tal. Once
  the doors are subject doors this isn't a repeated choice.
- **D5 No guided "just play" door** (the Khan Kids / ABCmouse path). It would be a separate PRD; it
  touches pacing and the no-adaptivity rule.
- **D6 Labels stay under the icons**, on home and in the menus, exactly as today.
- **D7 The icon must show both the title and what's behind the door.**
  - **Farver og Krea reuses the palette** (`colors.webp`): the six paint blobs say *Farver*, the brush
    says *Krea*. No tile inside that menu uses a palette, so nothing repeats.
  - **Bogstaver og Ord gets ONE new render**: today's book stack plus three chunky clay letters
    (A, B, Æ) leaning against it. The books say *Ord* and the letters say *Bogstaver*. This
    **deliberately breaks** the house "no text or letters" art rule. **If Gemini garbles the glyphs,
    fall back to the plain book stack** (`alphabet.webp`) rather than re-rendering forever.
  - **Retired:** the speech bubble (`ordleg.webp`, which dates from the removed mic game and now reads
    as "talking", something nothing in the app does) and the easel (`krea.webp`, whose rainbow scribble
    repeats the Fri Tegning tile and whose rainbow repeats the Lær Farver tile).
  - Tal (abacus) and Engelsk (globe) are unchanged.
  - The owner first picked "new art for both", then chose reuse after the icon-by-icon analysis, then
    added the title-and-contents test, which only the book stack failed. The decision above is the
    final one.
- **D8 Ships in v1.3, together with Krea and everything else since 1.2.** Production keeps today's
  five doors, byte-identical, until release. The restructure rides the **existing Krea gate**
  (`kreaShown()`), so there is one gate. The 4-door shape always contains Krea, and the owner wants one
  release. Release = deleting the gate (§6 R).
- **D9 The door says its name when its menu opens, only when the child arrives from home.** Returning
  to the menu from a game is silent. Four new prebaked lines. The spoken text equals the label:
  "Bogstaver og ord", "Tal", "Engelsk", "Farver og krea".
- **D10 Indstillinger shows 4 difficulty rows, one per door.** A door row writes **every member
  section** (setting Bogstaver og Ord to Svær sets both `alphabet` and `ordleg`). Accepted cost: words
  at Let with letters at Svær can no longer be set.
- **D11 Home objects keep today's size**, with the freed space becoming air between them (2×2 in
  portrait). **No door, and no door label, may ever collide with the mascot on any screen**: the owner's
  958×714 screenshot (Dinosaurer skin, staging 6-door home) shows the dino over the "Alfabetet" label.

### Assumptions stated by the planner (owner not asked; he would not care)

- **A1 Internal ids don't change.** `SectionId`, gameIds, `SECTION_IDS`, the ledger, the practice ledger,
  usage-event route names and the difficulty tables keep `alphabet`/`ordleg`/`colors`/`krea`. A door is
  a **view** over sections, defined once in a new pure module (§3). Renaming ids would mean a schema
  migration for nothing the child sees.
- **A2 Routes.** Door menus live at `/alphabet` (Bogstaver og Ord), `/math`, `/english` and `/farver`
  (Farver og Krea). `/ordleg` and `/krea` **menu** routes redirect (`replace`) to their door. **Game URLs
  are unchanged** (`/ordleg/read`, `/krea/perler`, …), for bookmarks and usage-event names.
- **A3 Colour and world follow the door's primary section**: `alphabet` for Bogstaver og Ord, `colors`
  for Farver og Krea. With the gate on, Ordleg and Krea games take the primary section's accent, motif
  and scene framing, so a door looks like one place. A door's world bloom is the sum of its members'
  bloom XP.
- **A4** Each skin's existing `homeAnchorsKrea` slot becomes the **4-door** anchors (the gated layout),
  and `homeAnchors` (5) stays the production layout until release.
- **A5** The spoken name fires after the wipe reveals the menu (the transition phase returns to `idle`),
  not on mount. The navigation cleanup would otherwise cancel it.

---

## 3. What changes in code

| File | Change | Kind |
|---|---|---|
| `src/config/doors.ts` | **The one source.** `DoorId = 'letters' \| 'math' \| 'english' \| 'colors'`; per door: label, menu route, primary section, member sections, **ordered `gameId` list** (D3), spoken-name key. Pure helpers: `doorFor(section)`, `menuRouteFor(section, restructured)`, `doorsFor(restructured)` (returns today's 5 sections-as-doors when false, the 4 doors when true), `primarySectionFor(section, restructured)`. No imports beyond `progressSchema.ts` types. | new |
| `src/config/doors.test.ts` | Every shipped gameId (from `categoryThemes`) belongs to exactly one door; order pinned literally (D3); the 4 labels pinned; `restructured=false` reproduces today's 5 exactly; `/ordleg`,`/krea` map to `/alphabet`,`/farver`. | new |
| `src/config/categoryThemes.ts` | `math.name` → `'Tal'` (gated; see trap T9). Door content (name/description/game list) assembled from `doors.ts`, not hand-duplicated. | edited |
| `src/components/home/HomePage.tsx` | Render `doorsFor(kreaShown())`. `HomeCardId`/`SECTION_ROUTES`/`allHomeCards` go; the `seatSix` portrait 3+3 rule becomes 2×2 for four. Labels from the door. **Mascot-reserved seating field** (T4). | edited |
| `src/components/common/scene/SceneObjectField.tsx` | Anchors are percentages of a field box that **excludes the mascot column**, not of the viewport (T4). | edited |
| `src/theme/tokens/{kidTheme,ocean,space,dino}.tokens.ts` | `homeAnchorsKrea` → 4 anchors (keyed by primary section); `sectionFocus` for the 2 merged doors uses the primary section's focus. | edited |
| `src/theme/tokens/helpers.ts` | `homeAnchorsFor`/`defaultHomeAnchorsKrea` → 4-door default. | edited |
| `src/theme/tokens/types.ts` | `HomeAnchor.section` comment (5 → 4 doors). | edited |
| `src/components/common/GameSelectionLayout.tsx` | Accept a door: tiles carry **their own section** for `GameTileIcon`/`gameIconImages` (T2); landmark icon + title from the door; balanced-row rule (D2) replaces the `games.length <= 4` / 7-per-row logic. | edited |
| `src/components/alphabet/AlphabetSelection.tsx`, `farver/FarverSelection.tsx` | Render the door (gated). | edited |
| `src/components/ordleg/OrdlegSelection.tsx`, `krea/KreaSelection.tsx` | Gated: `<Navigate to={door menu} replace/>`; ungated: unchanged. | edited |
| `src/App.tsx` | `/krea` route: on production stays → `/` (gate off); staging → `/farver`. `/ordleg` → `/alphabet` when gated on. | edited |
| **Every game's `backRoute`** — `SpellingGame.tsx:498`, `LaesOrdetGame` (via `UnifiedQuizGame` config), all four `krea/*Game.tsx` (6 call sites), `UnifiedMemoryGame` `config.backPath`, plus the alphabet/math/farver/english ones for uniformity | `backRoute={menuRouteFor(section, kreaShown())}` instead of a literal. **This is the call site nobody would look for** (T1). | edited |
| `src/config/routeDepth.ts` | `sectionForPath` unchanged (ids), but callers that frame the world go through `primarySectionFor` (A3). | edited |
| `src/components/common/scene/PersistentWorld.tsx` | World framing/tint via `primarySectionFor`. | edited |
| `src/components/common/GameShell.tsx`, `GameMotif.tsx`, `UnifiedQuizGame.tsx`, `RepeatButton.tsx` | Accent via `getCategoryTheme(primarySectionFor(categoryId, kreaShown()))` (A3). | edited |
| `src/config/adultSectionLabels.ts`, `adult/panes/LaeringPane.tsx`, `adult/panes/konto/BoernSection.tsx` | Gated: 4 door rows; a door row's write fans out to all member sections; "har spillet" summary grouped by door. | edited |
| `src/assets/themes/icons/index.ts` + `icons/letters.webp` (new render) | Door icon map: `letters` → new render (placeholder = `alphabet.webp` until delivered), `colors` → palette. Delete `ordleg.webp`, `krea.webp` **at release** (production still shows the speech bubble until then; the easel is staging-only, so it can go as soon as the gated home stops using it). | edited/new |
| `scripts/optimize-theme-art.mjs` | Key + trim the new render (green path). | edited |
| `src/config/gamePhrases.ts` (+ test), `shared-narration-clips.js`, `public/sounds/tts/*`, `prebakedTts.ts`, `docs/audit/*` | 4 door-name lines, 8-step protocol (D9). | edited |
| `src/config/referenceViewports.ts` | Add `{ name: 'owner window 958x714', w: 958, h: 714 }` (the collision screenshot). | edited |
| `.claude/skills/ui-screenshot/sweep.mjs` | Layout phase: home door-vs-mascot intersection check (§7). | edited |
| `CLAUDE.md` (Routes line: "6 sections"), `.claude/rules/games-catalog.md`, `theming.md` ("6 sections" → doors), `scene-and-world.md`, `docs/ui-reference/` | Docs + re-shot screenshots. | edited |

---

## 4. The traps — read this before you write any of it

- **T1 Back routes are hard-coded literals in ~20 game components.** Merge the menus without touching
  them and Stav Ordet's back arrow lands on `/ordleg`. That route now redirects, so a back tap becomes
  two transitions, or on production a bounce home. `grep -rn 'backRoute=' src/components` plus
  `backPath` in `UnifiedMemoryGame`. Route them all through `menuRouteFor`. Add a test that greps
  (comments stripped) for a literal `backRoute="/` and fails.
- **T2 Tile art is keyed by the MENU's `categoryId`**: `gameIconImages[\`${categoryId}.${game.id}\`] ??
  sectionIconImages[categoryId]` (`GameSelectionLayout.tsx:78`) and `<GameTileIcon section={categoryId}>`
  (`:354`). In a merged menu, `alphabet.read` doesn't exist, so the `??` **silently** falls back to the
  section icon. All five tiles still "have art", and every one of them is wrong. Each tile carries its
  own section. `gameIcons.test.ts` can't see this, because the files all exist; the guard has to
  resolve a door's tiles through the same function the menu uses.
- **T3 Two game ids collide across sections**: `alphabet.learn` / `english.learn` and `alphabet.memory`
  / `math.memory`. Inside a door, always key by the full gameId, never the bare `id` (React keys, attract
  index, icons).
- **T4 The home anchors are tuned percentages of the whole viewport, which is the pattern this repo
  banned** (`layout-contract.md`, "reserve the space, don't tune a percentage"). The dino over
  "Alfabetet" at 958×714 is that bug, and "4 doors means more air" will **not** fix it at a short
  viewport. Reserve the `ThemeMascot` footprint (HomePage sizes it 128/156/184, 64 on `PHONE_ANY`)
  as a real box. The seating field is a flex sibling of that column, and anchor `xPct` is a
  percentage of the field. Then measure (§7). Don't nudge `xPct` until one screenshot looks right.
  **The label counts, not just the object**: the collision in the screenshot is the label pill.
  Flow mode (phones/portrait) needs the same check.
- **T5 `categoryThemes[id]` is the default-skin map** (`theming.md`). Any new door code reads
  `getCategoryTheme(primarySection)`. HomePage's flat-grid branch already uses `categoryThemes[card.id]`
  for content, which is fine for names but not for colours.
- **T6 The gate must keep production byte-identical** (D8). Every gated branch reads `kreaShown()`, which
  is true on staging, dev and the harness and false on production. **`BL_TIER` defaults to `'production'`
  under `npm run dev`**, which is why the gate also takes `isDev`. Verify production by building with
  the production tier and screenshotting home and the 5 old menus, rather than by reasoning about it.
- **T7 Spoken name timing** (D9, A5). Speak once the transition phase is `idle` **and** the navigation
  came from depth 0 (`routeDepth(from) === 0`, `TransitionProvider` already computes `directionFor`).
  Mount alone also fires on back-from-game, and speaking during the wipe gets cancelled by the
  navigation cleanup (`audio-system.md` "Navigation cleanup"). Never `await` it, and it must cancel
  nothing important (the menu has no other narration). The strings live in `gamePhrases.ts`, never
  inline, or they reach live Azure, **which for a guest is silent** (`canCallPaidApis: false`).
- **T8 "krea" through Azure da-DK is UNKNOWN** until heard. If it comes out as English "creer", fix it
  with the PLS lexicon (`public/da-DK.pls`), not by misspelling the label.
- **T9 Renaming Tal og Regning → Tal is visible on production** unless it is gated too. `categoryThemes`
  is a static module, so the name has to be resolved where it is rendered, via `doorsFor(kreaShown())`.
- **T10 The new render deliberately contains letters.** Check the glyphs at **home size (~90 px)** and as
  the **menu landmark**. An A that reads as a 4, or an Æ that comes out as Œ, fails, and the fallback
  is the plain book stack (D7). Key it with `optimize-theme-art.mjs` (green path) and read the WebP.
  The palette is reused **as-is** (already keyed and trimmed), so never re-key it.
- **T11 Guards that will react, and must be updated rather than silenced**: `rewardSurfaces.test.ts`
  (one door to Min Bog, so no new book entrance in a door menu), `gameIcons.test.ts` (orphans once
  `ordleg.webp`/`krea.webp` go), `kreaGate.test.ts`, `noEmoji.test.ts` (empty allowlist, so labels stay
  text and icons stay art), `contextBudget.test.ts` if a rule file grows.
- **T12 Balanced rows are a layout rule, not a column count.** At 1024×768 and on phones a 5-wide row
  may not fit. The rule is "no orphan row of 1–2". Sweep it at every reference viewport, including
  844×390 and the 678×992 Split View.
- **T13 Another session may share this tree** and Krea work is still landing (see `git log`). Commit
  each stage promptly, and don't push: master is the production deploy, and D8 needs the gate honoured.

---

## 5. What must NOT change

- gameIds, `SectionId`s, `SECTION_IDS`, progress schema v4 (**no bump**), the practice ledger.
- XP independent of difficulty; a door row writing several sections changes **levels only**.
- The ring is the **only** door to Min Bog (`rewardSurfaces.test.ts`); `rewardNumber()`, never
  `globalLevel()`.
- No emoji; door art is baked WebP.
- One audio at a time; no narration awaited in a handler; the spoken name is prebaked.
- Læs Ordet never reads its prompt word aloud. Moving it into Bogstaver og Ord changes nothing in the game.
- Navigation only through `useTransitionNav()`; redirects are router `<Navigate replace>`, never a raw
  `navigate()` inside a game.
- Production, **byte-identical to today**, until the 1.3 release deletes the gate.
- Tap/drag parity, `kidCollision`, every game's own behaviour.

---

## 6. Work stages — one commit each, each green on its own

- **W0 `doors.ts` + its tests.** Pure, no UI consumer yet. Everything else renders against it.
- **W1 Plumbing, invisible on production**: all `backRoute`s through `menuRouteFor` (T1, plus its grep
  guard); tile art keyed by each tile's own section (T2/T3); `primarySectionFor` in GameShell, Motif,
  PersistentWorld and the quiz accent (A3). On staging, Ordleg/Krea games now wear the door colour.
- **W2 Door menus**: `GameSelectionLayout` takes a door; balanced rows (D2, T12); Bogstaver og Ord at
  `/alphabet` and Farver og Krea at `/farver` (gated); `/ordleg` and `/krea` menus redirect.
- **W3 Home**: `doorsFor(kreaShown())`, 4 anchors per skin in `homeAnchorsKrea`, mascot-reserved
  field (T4), 2×2 portrait, labels from the door, `Tal` (T9). Add the 958×714 reference viewport and
  the sweep's door-vs-mascot check **in this stage**, and run it on the **5-door production layout
  too**, since the collision may already ship there (UNKNOWN; the owner's screenshot was the staging
  6-door home).
- **W4 Art**: hand the owner `door-art-prompts.md` first. Wire `colors` → palette now and `letters` →
  `alphabet.webp` as a placeholder. When the render arrives: key it, check it per T10, wire it, add it
  to the coverage guard. The stage can ship on the placeholder; the render is a follow-up commit.
- **W5 Spoken door names**: the 8-step protocol (`audio-system.md`), arrive-from-home-only (T7),
  `npm run tts:prebake`, `npm run audit:approve-all` (the owner's standing blanket approval; say they
  are approved-but-unheard).
- **W6 Indstillinger**: 4 difficulty rows with fan-out writes (D10); "har spillet" grouped by door.
- **W7 Docs**: CLAUDE.md Routes line, `games-catalog.md`, `theming.md`, `scene-and-world.md`;
  `docs/ui-reference/` re-shot (home + the 4 door menus, 4 skins, iPad + phone).
- **R Release (at 1.3, owner-triggered, not part of this implementation)**: delete the Krea gate
  (`kreaGate.ts`, `kreaShown`), the 5-door `homeAnchors`, the ungated branches, `ordleg.webp`/`krea.webp`
  and the `ordleg`/`krea` entries in the door-less code paths. Ride it with whatever else 1.3 releases.

---

## 7. Verification

**Rung 1–2** (`ui-screenshot` skill; name the rung for every claim):
- `sweep.mjs --phase layout --engine both --theme <each of kid|ocean|space|dino>` on home and all 4
  door menus, at every `REFERENCE_VIEWPORTS` entry **plus the new 958×714**. Rung 2 (WebKit, iPad UA)
  settles layout; rung 1 doesn't, because the two engines size flex differently.
- **New sweep check:** on home, no door object's rect **or its label's rect** intersects the mascot's
  rect; each door's centre hit-tests to that door (`elementFromPoint`). Run it on production (gate off)
  as well as staging.
- Menus: no orphan row of 1–2 tiles, every tile's `<img>` src resolves to `icons/games/<its own
  section>.<id>`, nothing overflows (`scrollHeight <= innerHeight`).
- Back arrow from all 25 games lands on its door menu in **one** transition.
- `--audio-report`: arriving from home on each door produces sound; back-from-game produces none.
- **Production build check (T6):** build with the production tier; home shows the 5 doors as today,
  "Tal og Regning" is unchanged, and `/krea` → `/`.

**New guards, each to be re-broken with `/re-break`** (break what the guard measures):
- `doors.test.ts`: every gameId in exactly one door (break: drop `ordleg.spelling` from the door);
  order pinned (break: swap two); `restructured=false` equals today's 5 (break: leak `letters`).
- Back-route grep guard (break: restore one `backRoute="/ordleg"`; the guard must strip comments first).
- Door-tile art resolution guard (break: key tiles by the door id again, reproducing T2's silent fallback).
- Door-icon coverage/orphan guard (break: delete the new render; separately, re-add `krea.webp` unused
  after release).
- Door-name phrase pin + enumeration (break: change one string in `gamePhrases.ts` only).
- Sweep door-vs-mascot check (break: put the dino skin's first anchor back at viewport `xPct: 15` without
  the reserve and confirm the check goes red at 958×714).

**Rung 3, the owner's iPad (UNKNOWN until then):** the four spoken names sound right ("krea"
especially); the child picks the right door from the picture alone; the new book-and-letters render
reads at a glance; safe-area insets around the mascot on the real device.

---

## 8. Out of scope

- A guided "just play" door (D5): a separate PRD.
- Renaming internal ids or routes of games (A1/A2).
- The Fyld Båden gate (`boatGate.ts`): its own release decision.
- Any game logic, difficulty values, the reward economy, sticker art.
- New art beyond the one door render.

---

## 9. Kickoff prompt for a fresh session

> Implement `plans/category-restructure/tmp-prd-category-restructure-01-four-doors.md`. Read
> `.claude/rules/layout-contract.md`, `theming.md`, `scene-assets.md` and `audio-system.md` ("PROTOCOL")
> first. Start with W0 (`src/config/doors.ts`): every later stage renders against it, and W1's back
> routes (T1) and tile-art keys (T2) are the silent failures. Keep production byte-identical behind
> `kreaShown()`. Commit per stage and don't push. Re-break every guard in §7 with `/re-break`, and name
> the rung (1/2/3) for every verification claim.
