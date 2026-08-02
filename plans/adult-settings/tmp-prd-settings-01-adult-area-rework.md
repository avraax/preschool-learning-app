# PRD — Settings 01: "Til de voksne" area rework

**Status:** authored 2026-08-02, NOT implemented.
**Scope:** the adult/settings surface only. No game, audio, progression or schema changes.
**Implement in a fresh session.** This document is self-contained — read it, not the conversation that produced it.

---

## 1. Why

The "Til de voksne" area grew by accretion. Every feature that needed a parent-facing control (bug
reporter, voice panel, difficulty, theme, accounts, sync, profiles, apply-update) added one more row
to the same list. Nobody ever re-designed the list.

It is now **13 flat, undifferentiated rows in a `maxWidth="xs"` MUI Dialog that scrolls** on a
1024×768 landscape iPad — the app's primary device. Confirmed against
`docs/ui-reference/overlays/adult-menu.jpg`: the scrollbar is visible in the committed reference
screenshot.

Concrete defects, all verified in the current tree:

1. **Past the grouping threshold with no grouping.** Material's rule is section titles above ~10
   items, subscreens at ~15. NN/g on long flat menus: users "may be overwhelmed by so many links,
   fail to read the whole list closely, and miss the best option."
2. **Three control types share one undivided list** — navigation rows, inline switches, and
   destructive actions. "Nulstil al fremgang" sits one row below "Log ud" with identical styling
   (`AdultCorner.tsx:291-309`).
3. **Back affordance is inconsistent.** `AdultBackHeader` (a real back arrow) is used by 3 of 6
   panels. `ProfilesPanel`, `SyncPanel` and `LoginSecurityPanel` offer only a "Luk" button that
   *actually behaves as back*. `AdultBackHeader.tsx:5-7` states the rule its own siblings break.
4. **"Luk" means three different things** depending on the surface: back to the menu
   (`ProfilesPanel.tsx:168-172`), close everything (`AdultCorner.tsx:330`), or close this dialog
   (`BugReportDialog` success phase).
5. **Replace-not-stack navigation.** `view` is a single string (`AdultCorner.tsx:75`), so opening a
   panel flips the menu's `open` to false — the menu visually unmounts and the panel fades in.
   Nothing carries over; there is no sense of place.
6. **Up to 5 stacked modal layers.** menu → panel → nested dialog → PIN pad, in the Profiler and
   Login branches. Apple HIG explicitly warns against a modal hierarchy that "feels like an app
   within your app… people forget how to retrace their steps."
7. **Related things split, unrelated things adjacent.** "Profiler" and "Skift barn" are separate
   rows. "Log ud" is top-level while "Log ud alle steder" and "Slet kontoen helt" are two levels
   down inside Login og sikkerhed. Sync and account are separate panels. `ProfilePicker` carries its
   own duplicate "Tilføj et barn" → `CreateProfileDialog` flow.
8. **No adult visual language.** Adult dialogs inherit the kid theme wholesale — Comic Sans, 16–20px
   radii, 48px buttons, pastel accents. `buildTheme` sets `typography.fontFamily` *and*
   `MuiCssBaseline.body.fontFamily` from the skin tokens, and there is no font override anywhere in
   `src/components/adult/`. `VoiceOverridePanel.tsx:29` even hardcodes Comic Sans on top.
   CLAUDE.md says "Comic Sans MS for child-facing typography" but nothing enforces the boundary.
9. **Zero phone/portrait coverage.** `docs/ui-reference/overlays/` is 1180×820 exclusively. No adult
   surface has ever been captured or verified at 844×390 or 667×375. `SyncPanel`,
   `LoginSecurityPanel`, `CreateProfileDialog`, `PinSetupDialog` and every confirm dialog have no
   reference capture at any size.
10. **Per-child settings look global.** `difficulty` and `themeId` live in `progressStore.settings`,
    which is per-profile — but nothing in the UI says so. A parent tuning difficulty has no idea it
    applies to one child.

**Intended outcome:** one calm, adult-looking, non-scrolling settings surface on iPad; five
mutually-exclusive groups plus an always-reachable support footer; one consistent way back;
destructive actions gathered and visually separated; max modal depth 3 instead of 5; and a compact
single-pane variant that is actually verified on phones.

---

## 2. Owner decisions (already made — do not re-litigate)

| Question | Decision |
|---|---|
| Surface shape | **Two-pane split** (macOS System Settings / Material list-detail) on iPad; collapses to single-pane push nav on phone/portrait |
| Visual language | **Yes — calm adult skin**: system font, tighter radii/density, neutral greys + one accent |
| "Stemme-test" | **Slim to a real setting** under Lyd (curated voice list + tempo + one example button). The full tool stays at `/voicelab` |
| Destructive zone | **Yes** — gather and separate |
| Profiler + Skift barn | **Merge** into one Barn pane |
| Child-progress summary | **Yes** — read-only block in the Barn pane |
| Phone layouts + screenshots | **Yes** — in scope, with re-capture |
| Udseende | **Its own pane**, even though it holds one control — the 4-thumbnail grid needs the room and it's a whim-change setting |
| Hjælp | **Not a pane** — "Rapportér et problem" + version live in a persistent **rail footer**, reachable from every pane. Support belongs at the moment something looks wrong, not one tap away |
| Log ud | **Moves into Konto's destructive strip**, reversing its recent promotion to top-level. The original complaint (`AdultCorner.tsx:287-290` — "only reachable two levels down, and nothing revealed which account") is solved by the rail plus the account email at the top of the Konto pane |

---

## 3. Information architecture — five groups + a support footer

Five single-word Danish nouns, mutually exclusive. No "Andet"/"Diverse"/"Øvrigt" (Material bans
ambiguous section names). Ordered by frequency of use; destructive last **within** each pane.

| # | Rail label | Contains | Absorbs today's |
|---|---|---|---|
| 1 | **Barn** | Active child card (avatar art, name) · "Sådan går det" read-only summary · other children (tap = switch) · rename / add / delete · destructive strip: reset progress | Profiler, Skift barn, Nulstil al fremgang |
| 2 | **Læring** | "Sværhedsgrad for {navn}" · global Let/Normal/Svær · explanation for the **selected** level only · "Tilpas pr. sektion" disclosure holding the 5 section rows | Sværhedsgrad |
| 3 | **Lyd** | Lydeffekter switch · Musik switch · Oplæsning: curated voice list + tempo slider + "Hør et eksempel" | Lydeffekter, Musik, Stemme-test |
| 4 | **Udseende** | Theme thumbnail grid (4 registered skins), labelled as the child's skin | Tema |
| 5 | **Konto** | Signed-in email · sync status + "Synkronisér nu" · Kode (PIN) · Face ID + passkey list · destructive strip: log out / log out everywhere / delete account | Synkronisering, Login og sikkerhed, Log ud |

### Rail footer — persistent, below the five group rows, visible from every pane

- **"Rapportér et problem"** → `BugReportDialog` (a nested task dialog, unchanged).
- **`v{BUILD_INFO.version} · {commitHash}`** as a tap-to-copy caption. Tapping copies the full
  `version · hash · date time` line — it gets read aloud over the phone during support.

On compact width the footer is pinned to the bottom of the root list. It does not need to follow the
user onto a pushed pane.

### Apply-update

App-wide, not group-scoped. When `updateAvailable`, render a slim highlighted strip across the **top
of the whole settings surface**, above the rail/detail split — not as a rail item. The
child-visible `UpdateBanner` pill (`src/components/common/UpdateBanner.tsx`) stays unchanged as the
discovery path.

```
┌────────────────────────────────────────────────┐
│  Til de voksne                            Luk  │
├──────────────────┬─────────────────────────────┤
│ ▸ Barn           │  Lyd                        │
│   Emil           │                             │
│ ▸ Læring         │  Lydeffekter         [ ●══] │
│ ▸ Lyd         ◀  │  Musik               [ ●══] │
│ ▸ Udseende       │                             │
│ ▸ Konto          │  OPLÆSNING                  │
│                  │   Stemme    Christel    ▸   │
│ ── ── ── ── ──   │   Tempo     ──●────────     │
│ Rapportér et…    │   ▷ Hør et eksempel         │
│ v1.0.45 · a3f2c  │                             │
└──────────────────┴─────────────────────────────┘
```

---

## 4. Surface and layout

One lazy `AdultSettings` component. MUI `<Dialog maxWidth="md">` at the **default modal z-index
(1300)** so `AUTH_Z.pin` (10003) still stacks above it.

**iPad / regular width**
- Persistent left rail, fixed ~200px; flexible detail pane.
- The active rail row is **persistently highlighted** — HIG names this as the thing that keeps
  people oriented across panes.
- No drill-in animation. No back arrow anywhere.

**Phone / portrait / compact**
- `fullScreen` dialog. The rail becomes the root list; selecting a group pushes its pane.
- The pushed pane's header title **matches the rail label exactly** (Material: the label of the
  setting that opens a group must match the subscreen title).
- Use `PHONE_ANY` / `PHONE_PORTRAIT` / `PHONE_LANDSCAPE` from `src/theme/phoneMedia.ts` as `sx`
  keys. Do not invent new breakpoints. Note that `PHONE_*` are height/width-based, not MUI
  breakpoints — a portrait iPad (768 wide) is NOT a phone and should keep the two-pane split if it
  fits, otherwise fall to single-pane at the `md` breakpoint.

**Both**
- **Restore the last-viewed pane** across opens (module-level variable or a ref; not persisted to
  storage). HIG: "people often adjust related settings more than once."
- The detail pane may scroll internally. The dialog itself must not exceed the viewport. Prove with
  `--measure`, not by eye.
- Touch targets stay ≥44px despite the tighter adult density — that is the accessibility floor, not
  a style choice.

---

## 5. Adult skin — `src/theme/adultTheme.ts`

New `buildAdultTheme(base: Theme): Theme`, plus an `AdultThemeProvider` wrapping the adult tree.

- **Build it with the two-arg merge form: `createTheme(base, { ...overrides })`.** A nested
  `MuiThemeProvider` given a theme created from scratch would drop `theme.categories`,
  `theme.decor`, `theme.customShadows`, `theme.scene`, `theme.materials`, `theme.transition` and
  `theme.titleFontFamily` — the module augmentations declared in `buildTheme.ts:327-353` — and
  crash anything reading them.
- `typography.fontFamily`: system stack —
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
  **Also set `fontFamily` on the Dialog paper root `sx`.** `buildTheme` applies the Comic font via
  `MuiCssBaseline.body`, and a nested provider does **not** re-apply CssBaseline — so raw text
  inside a `<Box>` would still inherit Comic from `body`.
- `shape.borderRadius: 10` (base is 16). `MuiPaper` / `MuiCard` 12. `MuiChip` height 28.
- `MuiButton`: `minHeight: 44` (base 48), `minWidth: 'auto'` (base 120), `padding: '8px 16px'`,
  `fontSize: '0.95rem'`, `textTransform: 'none'`.
- Palette: neutral greys for surfaces and text; **one accent = the active skin's
  `palette.primary`**, so the surface stays coherent with the chosen world without being pastel.
- Body 0.95rem, caption 0.8rem.

**Explicit non-goal: auth surfaces are not re-skinned.** `PinPad` deliberately uses `TactileTile`
plus `getCategoryTheme('math')` and is shared with `LockScreen`. `PinDialog`, `LockScreen`,
`ProfilePicker` and `CreateProfileDialog` keep their current look. If the `AdultThemeProvider` would
otherwise wrap a PIN pad raised from inside settings, make sure the pad renders in its own portal
under the app theme, not the adult one.

---

## 6. Navigation grammar (the consistency contract)

1. **One "Luk"**, top-right of the surface header, closes everything. No other control in the adult
   area uses that word.
2. On regular width there is **no back arrow** — the rail is the way back.
3. On compact width, exactly one back arrow per pushed pane, titled with the rail label.
4. **Nested task dialogs are the only stacked modals**: `BugReportDialog`, `CreateProfileDialog`,
   `PinSetupDialog`, and the destructive confirms. Each gets exactly two buttons — Annullér
   (leading) + the primary action (trailing). Never three (HIG: never Cancel + Back + Done).
5. **Max depth 3:** settings surface → one nested dialog → PIN pad. (Today: 5.)
6. Destructive confirms **name the target** — the child's name or the account email. Existing rule
   from `AdultCorner.tsx:409-411`; keep it.
7. Danish `du`-form, two-sentence copy on every confirm. Existing convention; keep it.

---

## 7. Destructive-actions zone

Two clearly-separated strips, each at the bottom of its owning pane behind a divider and a muted
heading, styled `color="error"`:

**Barn pane** — "Nulstil fremgang for {navn}". It is per-child, so it belongs next to the child it
affects (NN/g: position controls near the content they relate to) — *not* next to account actions,
where it sits today. Copy already exists at `AdultCorner.tsx:414-417` and is good: it names the
child, states that other children are untouched, and states that sound/music/difficulty are kept.

**Konto pane** — "Log ud på denne enhed" · "Log ud alle steder" · "Slet kontoen helt".

**The PIN reason table does not change.** `pinVerifierFor` in `src/contexts/AuthContext.tsx:34-47`
is the single source. Server-verified reasons (`manageCredentials`, `revokeSessions`, `changePin`)
must stay server-verified and must **not** be downgraded to "the adult already PIN'd in to open
settings." The ~5-minute `ADULT_UNLOCK_MS` window applies to LOCAL reasons only, by design.

---

## 8. Behaviour changes to call out

- **"Skift barn" is absorbed.** Today the row calls `profileStore.clearSelection()` and is
  deliberately un-gated (`AdultCorner.tsx:260-262`). In the new Barn pane, tapping another child
  switches directly via `requirePin('switchProfile')` — the rule `ProfilesPanel.tsx:50-59` already
  applies. The un-gated **boot** path (`ProfilePicker`, raised by `ProfileGate`) is untouched; only
  the un-gated *mid-session* shortcut goes away, and it lived inside a PIN-gated surface anyway.
- **"Sådan går det"** is read-only and fully derived — no new state, no new persistence:
  - rewards collected: `collectedFromLevel(progressStore.globalLevel())` from
    `src/config/progression.ts`, out of `REWARD_SLOTS` (45). **Use `collectedFromLevel`; never
    recompute the mapping inline** — it is THE mapping and is guarded by
    `progressInvariantViolations`.
  - next prize: `progressStore.nextReward()`.
  - lifetime stars, and which sections have been played (per-section `bloom` / `explored`).
- **Difficulty and theme are labelled as per-child.** Both already live in
  `progressStore.settings`; the UI just never said so.
- **Voice setting slims.** Drop the tier headings, the gender/"lead" chips and the three sample
  buttons. Keep a curated voice list, the rate slider (0.6–1.1, step 0.05, mark at
  `TTS_CONFIG.speakingRate`), and one "Hør et eksempel" button. Storage is unchanged:
  `ttsClient.setVoiceOverride()` → `voicelab_voice_override_v3` (`src/config/voiceOverride.ts:16`).
  **`VoiceOverridePanel` has exactly one importer — `AdultCorner.tsx:62`** (verified). `/voicelab`
  is a separate 553-line `VoiceLab.tsx` and stays. So the panel file can be deleted once absorbed.
- **Difficulty explanation becomes progressive.** `DifficultyPanel.tsx:38-42` currently renders all
  three `LEVEL_HELP` paragraphs at once. Show only the selected level's.

---

## 9. Invariants that must survive

Re-check every one of these before declaring a work package done.

1. **`captureScreenshot()` runs before any settings UI renders** (`AdultCorner.tsx:108-111`). A bug
   report must show the broken game, not the settings surface.
2. `requirePin('adultMenu')` gates the whole surface. The gear tap stays **inert while
   `auth.authUiOpen`** (`AdultCorner.tsx:130-133`).
3. `data-bl-redact` on anything showing credentials; `screenshotService` strips those nodes.
4. **No z-index literals.** The settings Dialog stays at MUI's 1300; the `AUTH_Z` ordering in
   `src/components/auth/authOverlayZ.ts` is unchanged and still guarded by
   `authOverlayZ.test.ts`.
5. **No emoji.** lucide-react only; `src/config/noEmoji.test.ts` allowlist stays **empty**.
6. Passkey calls stay **non-async with pre-fetched options** — iOS consumes user activation across
   an `await` (`.claude/rules/auth.md`). Do not "tidy" `LoginSecurityPanel`'s odd-looking
   pre-fetch + 4-minute refresh into an async call.
7. `resetAll()` still preserves `settings`/`settingsMeta` and bumps `sync.epoch`
   (`progressStore.ts:765-782`).
8. **iOS/iPadOS 17 floor.** Check every CSS/web API against Safari 17, not latest. Container-query
   units are fine (Safari 16+); do not reach for anything newer.
9. **No new spoken lines**, so no `tts:prebake` and no `/audit` sign-off is required by this work.
   If that changes, follow the 8-step protocol in `.claude/rules/audio-system.md`.
10. `lucide-react` is not named in `vite.config.ts` `manualChunks` and falls through to the default
    vendor chunk — don't add a large icon set casually.
11. `.claude/rules/responsive-design.md`: don't spread `SxProps` into an object literal — use the
    array form `sx={[a, b]}`.

---

## 10. Work packages

| WP | Scope | Independently verifiable |
|---|---|---|
| **W0** | `src/theme/adultTheme.ts` + `AdultThemeProvider`; apply to the **existing** dialogs unchanged | Screenshot A/B of today's panels in the new skin |
| **W1** | `AdultSettings.tsx` shell: two-pane split, rail, rail footer (bug report + version), compact collapse, single Luk, update strip, last-pane restore. Panes stubbed | Yes |
| **W2** | Barn pane — merge Profiler + Skift barn + "Sådan går det" + reset strip | Yes |
| **W3** | Læring pane | Yes |
| **W4** | Lyd pane, incl. the slimmed voice setting | Yes |
| **W5** | Udseende pane | Yes |
| **W6** | Konto pane — sync + PIN + Face ID + destructive strip | Yes |
| **W7** | Slim `AdultCorner` to gear + screenshot + PIN + mounting `AdultSettings`; delete absorbed files | Yes |
| **W8** | Responsive pass, hit-tests, re-capture `docs/ui-reference/overlays/` + add phone captures | Yes |

**W7 is a bundle win, not a cost.** `AdultCorner` is mounted globally in `App.tsx:209-212`, so its
module-scope imports are eager: MUI `List`/`Dialog`/`Switch`, 17 lucide icons, `screenshotService`,
`useProfiles`, `progressSync`, `profileStore`. Collapsing seven lazy chunks into **one** lazy
`AdultSettings` and leaving only the gear button eager makes first paint *lighter*. Say so in the
commit — PRD-07 will otherwise look like it was regressed.

---

## 11. Files

**New**
- `src/theme/adultTheme.ts`
- `src/components/adult/AdultSettings.tsx` — shell + rail + footer
- `src/components/adult/panes/{BarnPane,LaeringPane,LydPane,UdseendePane,KontoPane}.tsx`
- `src/config/adultSettingsIa.ts` + `src/config/adultSettingsIa.test.ts` (§12)

**Absorbed into panes, then deleted**
- `src/components/adult/ProfilesPanel.tsx` (→ Barn)
- `src/components/adult/DifficultyPanel.tsx` (→ Læring)
- `src/components/adult/ThemePanel.tsx` (→ Udseende)
- `src/components/adult/SyncPanel.tsx` (→ Konto)
- `src/components/adult/LoginSecurityPanel.tsx` (→ Konto)
- `src/components/voicelab/VoiceOverridePanel.tsx` (→ Lyd, slimmed)

**Changed**
- `src/components/adult/AdultCorner.tsx` — reduced to the gear button, screenshot capture, PIN gate,
  and mounting the lazy `AdultSettings`
- `src/components/adult/AdultBackHeader.tsx` — becomes the compact-width pane header only

**Kept as nested task dialogs, behaviour unchanged**
- `src/components/adult/BugReportDialog.tsx`
- `src/components/auth/CreateProfileDialog.tsx`
- `src/components/auth/PinSetupDialog.tsx`

---

## 12. Testing

The repo has **no jsdom and no component rendering** — `node --test` over `src/**/*.test.ts` plus
`lib/**`. So the guardable artifact is a pure IA module.

`src/config/adultSettingsIa.ts` exports the group/item structure: group ids and labels, item ids and
labels, each item's owning group, and for destructive items the `requirePin` reason.
`adultSettingsIa.test.ts` asserts:

- every group id is unique, and every item belongs to **exactly one** group (mutual exclusivity)
- no empty labels; no group named "Andet" / "Diverse" / "Øvrigt"
- every destructive item declares a reason, and every **account-scoped** destructive reason is in
  the SERVER set — this is the one that fails loudly if someone downgrades logout or account
  deletion to the local unlock

**Re-break requirement** (CLAUDE.md convention — the break must target what the test *measures*):
once green, (a) put one item in two groups and (b) flip one account-scoped reason to a local one,
and confirm **those specific tests** go red. Breaking something adjacent and watching the suite stay
green proves nothing.

---

## 13. Verification

- `npm run build` · `npm run lint` · `npm test`
- `ui-screenshot` skill with `?nogate=1`,
  `--click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' --clip '.MuiDialog-paper'`.
  Allow **~4.5s settle** — the snapdom capture runs before the surface renders.
- `--measure '.MuiDialog-paper'` proving `rect.bottom <= innerHeight` and no page scroll at
  **1024×768, 844×390 and 667×375**.
- **Hit-test, not screenshot, for stacking** (`.claude/rules/responsive-design.md` — this failure
  shipped twice): raise the PIN pad from inside Konto, then `document.elementFromPoint(cx, cy)` at
  the pad's centre must return the pad, not the settings paper.
- All 4 registered skins (`?theme=kid|ocean|space|dino`) — the adult skin inherits the active skin's
  primary as its accent, so it must read equally calm on each.
- `prefers-reduced-motion`.
- Re-capture the whole `docs/ui-reference/overlays/` set and **add the missing surfaces**: each of
  the 5 panes, the sync state, the logout and reset confirms, `CreateProfileDialog`, and phone
  captures of every pane (none exist today). Update `docs/ui-reference/README.md`.

Guard the probes: a crashed route still satisfies `--wait-for` on the error boundary's "Prøv igen"
button, so assert an expected element count and bail on "Noget gik galt".

---

## 14. Out of scope

- Auth surfaces — `LockScreen`, `PinDialog`, `PinPad`, `ProfilePicker` — keep their current look and
  behaviour
- The `/voicelab` and `/audit` dev routes
- Any change to the PIN reason table, the sync protocol, or the `progressStore` schema
- Any new spoken narration
- The child-visible `UpdateBanner` pill

---

## 15. Implementation prompt (for the fresh session)

> Implement `plans/adult-settings/tmp-prd-settings-01-adult-area-rework.md` — the two-pane
> "Til de voksne" settings rework: adult skin, five groups (Barn/Læring/Lyd/Udseende/Konto) plus a
> persistent support footer, merged Profiler+Skift barn, gathered destructive zones, compact phone
> variant.
> Work W0→W8 in order, keep §9's invariants intact (screenshot-before-render, PIN reason table,
> AUTH_Z, no emoji, Safari 17), and finish with the §13 verification incl. the `--measure` and
> `elementFromPoint` probes and a re-capture of `docs/ui-reference/overlays/`.
