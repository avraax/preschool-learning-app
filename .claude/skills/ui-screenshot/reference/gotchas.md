# Gotchas

Built-in behaviours worth knowing before you blame the app, plus verifying a bug-report capture.

Back to `../SKILL.md`.

## Gotchas (built-in, but know them)
- **A long-lived dev server can serve a module graph that no longer exists, and reloading cannot fix
  it.** If `node_modules/.vite` is wiped while Vite is running, the process keeps handing the browser
  `?v=<old-hash>` URLs for optimized deps that are gone — `504 (Outdated Optimize Dep)` in the network
  tab, surfacing as `Failed to fetch dynamically imported module` on whichever route reaches the dep
  first (here Bogstav Quiz, via `@dnd-kit`). It never re-optimises on its own, so the page looks
  broken while `npm run build` is perfectly green. **Restart the process, not the tab.** Diagnose by
  crawling the graph for a non-200 rather than reading the entry module, which itself returns 200.
- **Restart `npm run dev:api` after editing anything under `lib/`** — a stale instance 404s every auth
  route while its banner looks healthy. And it is `npm run dev:api`, never a bare
  `node --env-file=.env.local dev-server.js`: without the `--import ./scripts/js-to-ts-resolve.mjs`
  hook the `.js` specifiers in `lib/` don't resolve and it dies on `ERR_MODULE_NOT_FOUND lib/db.js`.
- **A screenshot cannot prove a surface is on top — hit-test it.** An overlay that renders UNDERNEATH
  another is live and interactive but simply not drawn, so the picture looks perfectly correct and every
  `--wait-for`/`--measure` still passes (the element exists and has a rect). Assert
  `document.elementFromPoint(cx, cy)` at the element's centre returns it (or a descendant), not the
  thing above it. This is what found two shipped dead buttons: a MUI `<Dialog>` defaults to
  `theme.zIndex.modal` (1300) while this app's blocking surfaces are hand-rolled `fixed` boxes at
  ~10000, so any dialog opened FROM one of those mounts behind it.
- **`--wait-for '#root > *'` no longer waits for anything.** `BackendBadge` is mounted in `main.tsx`
  ABOVE `<AuthGate>`, so on any non-production backend it is a direct child of `#root` that renders
  immediately — the wait is satisfied before React renders a route, and `--measure '#root > *'` returns
  the BADGE's rect. It reads as a correct measurement of a page that isn't there yet. Wait on something
  the route itself owns (`[data-reward-ring]`, a heading, `[aria-label="Tilbage"]`), and treat a
  105×19 rect at (6, 64/88) as the tell that you measured the pill.
- **A CRASHED route still satisfies `--wait-for`, and then your probe passes VACUOUSLY.**
  `AppErrorBoundary`'s "Prøv igen" is a real `[role=button]`, so a wait/selector aimed at page content
  matches it, every `--measure` succeeds, and an "is anything overlapping?" probe cheerfully reports
  **0 overlaps on a page with 0 tiles**. This is not hypothetical: a parallel session's half-saved file
  crashed `/math` mid-sweep and would have turned 100 configurations green. So before reporting, **bail
  on `document.body.innerText.includes('Noget gik galt')` AND assert the EXPECTED element count** — then
  prove both guards fire (a deliberately wrong count, and `?crash-test=1`) before you trust the run.
  Distinct from the silent-dead-iteration trap below: there the run fails quietly; here it lies.
- **A MISTYPED ROUTE lies the same way, and it's easier to do.** A 404 renders `NotFound`, which has no
  game chrome at all — so the probe reports "the element is missing" and that reads as a bug in the
  feature you're verifying, not as a bad URL. Enumerate the routes from `App.tsx` instead of guessing
  them from the section names; three guesses in a row were wrong in one sweep (it is `/farver/jagt` not
  `/farver/farvejagt`, `/english/learn` not `/english/laer`, `/ordleg/spelling` not `/ordleg/stav`).
  Cheap insurance: bail on the NotFound copy the same way you bail on `Noget gik galt`.
- **A CSS-transformed element's rect is its PAINTED box, not its layout box** — so a rect-overlap sweep
  reports collisions that do not exist. `SymbolTile` scales its glyph ~2.5–3× to correct for the
  render's transparent padding (see `.claude/rules/scene-assets.md`), which made
  `getBoundingClientRect()` over-report it by that factor: measured 58px into each of Sammenlign Tal's
  answer tiles and ~9px into Plus Opgaver's numerals, with no visual and no hit-test consequence in
  either case. Derive the ink box (it is centred on the rect: `rect.width × inkW/160`), or drop the rect
  comparison and **hit-test** instead — `elementFromPoint` answers the question you actually care about.
- **A killed run leaves Chrome holding port 9333**, and the next invocation then hangs forever against
  that dead instance (looks like the page never loads). After any timeout/interrupt:
  `powershell.exe -Command "Get-Process chrome -EA SilentlyContinue | Stop-Process -Force"`.
- **Two driver runs cannot share port 9333** — they are not just slow, they collide. A long background
  sweep therefore blocks every other capture until it ends (a screenshot fired alongside one hung until
  its own timeout). Sequence them, or give the second run `--port`.
- **A surface that STANDS DOWN under `?nogate=1` is invisible here, so "it is absent" proves nothing.**
  This is a trap with no symptom: `?nogate=1` is the only way past the auth gate, and the surfaces that
  matter stand themselves down under it — while WITHOUT it, `authUiOpen` stands them down instead. Both
  runs render nothing, whatever the app believes. Before asserting a surface is absent, **prove the
  selector can ever match** (make it appear once in the same recipe); otherwise the assertion is vacuous.
  The audio cue is the worked example: it needs `?audio-cue=1` (lifts only the nogate stand-down) plus
  `--block-autoplay --simulate-audio-blocked` plus a `--trusted-tap`. Minting a real session instead is
  not an option — it writes into the owner's production DB (`.claude/rules/auth.md`).
- **`element.click()` grants NO `navigator.userActivation`** — use **`--trusted-tap "<css>"`** (real CDP
  input) whenever the assertion is about user activation: autoplay/audio unlock, clipboard, fullscreen,
  popups. Nothing fails when you get this wrong; the app simply stays in its pre-gesture state forever
  and the test passes for the wrong reason. `--trusted-tap` prints `hasBeenActive` afterwards so a failed
  activation is visible rather than inferred. `--click` stays right for everything else (it does not
  depend on hit-testing a coordinate).
- **`--simulate-audio-blocked` reaches a state no launch flag can produce.** `--block-autoplay` alone
  blocks playback only UNTIL the first gesture — and that same gesture grants activation, unlocks
  `play()` and resumes the context — so the app's `blocked` verdict is otherwise unreachable. The sim
  (`audio-blocked-sim.js`) rejects `play()` with a real `NotAllowedError` and stops
  `AudioContext.resume()` from running the clock, i.e. it fakes the DEVICE and lets the app's own
  evidence path reach the verdict, rather than forcing a component to render. **Pair it with
  `--block-autoplay`**: with autoplay allowed a fresh `AudioContext` is born `running`, so the stubbed
  `resume()` leaves a live clock and the verdict is correctly `live` (that cost one confusing run). It
  exposes `window.__audioBlockedSim.restore()`, which is how the RECOVERY leg is testable — proving a
  cue appears is half a test; proving it withdraws is the other half.
- **Back-to-back runs occasionally die inside `getJSON`** (the previous Chrome hasn't released the port
  yet) — that's launcher contention, NOT a page bug, so don't go debugging the app. `sleep 2` between
  consecutive invocations, and re-run the one that failed. A sweep over several viewports in one shell
  loop **hides** this: the dead iteration prints nothing and the loop carries on, so count one
  `measure:`/`screenshot saved:` line **per viewport** before claiming "verified at all sizes".
- **The viewport flags are `--w`/`--h`. `--width`/`--height` are SILENTLY IGNORED** — an unknown flag is
  not an error, so the run proceeds at the 540×940 default and a four-viewport loop produces four
  identical results that look like four passes. **Have the probe echo `innerWidth`/`innerHeight` in its
  own output** and read them; that is what caught it here. Generalise it: any probe parameterised per run
  must report the parameter it actually used, or a loop cannot be distinguished from a single run.
- **Git Bash mangles a leading-slash ARGUMENT into a Windows path.** `--only /math/numbers` reached the
  script as `C:/Program Files/Git/math/numbers`, so the filter matched nothing and three runs printed no
  results at all — which reads like the sweep being broken. Drop the leading slash (`--only math/numbers`)
  or set `MSYS_NO_PATHCONV=1`. Same class as the PowerShell quote-stripping note below.
- **Run the driver on the Windows side too** when working from WSL: WSL cannot reach the
  Windows-bound servers or Chrome's CDP port (NAT). Use
  `powershell.exe -Command "node .claude/skills/ui-screenshot/cdp.mjs --url '...' ..."`.
  PowerShell 5.1 strips embedded double quotes from native args, and the symptom is a silent
  `TIMEOUT waiting for selector` / `eval: undefined`, not a quoting error. Either use **quote-free CSS
  selectors** (`[aria-label^=Til]`, `.MuiDialog-paper [role=button]`) or — more generally, since CSS
  accepts either quote — **single-quote the string INSIDE the selector**:
  `--click "[aria-label='Indstillinger']"`. That survives PS arg passing and keeps exact matching.
- **Clicks use `element.click()`**, not synthetic mouse coordinates — MUI ignores synthetic coords.
  So `--click` takes a CSS selector. (`element.click()` fires no `pointerdown`, so tap-listeners
  like the diagnostics breadcrumbs won't see driver clicks.)
- **`--click-text` is a SUBSTRING match** on the first `<button>` whose `textContent.includes(txt)` —
  NOT exact. So `--click-text 1` clicks an `11` tile (and can silently advance a quiz). Use a value
  that isn't a substring of other on-screen text, or `--click` with a CSS/`data-*` selector to hit
  one specific element (answer tiles carry `[data-answer-tile]`).
- **Driving pointer gestures & SPA nav**: because `element.click()` fires no `pointerdown`, for an
  `onPointerDown` handler (e.g. the Sig et Ord mic) dispatch a real event via `--eval`:
  `el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`. To unmount a route so React
  cleanup runs, **soft-navigate** (`history.pushState({},'','/x');dispatchEvent(new PopStateEvent('popstate'))`)
  — a hard `location` change skips cleanup. To inspect real mic tracks in a getUserMedia test, launch
  Chrome with `--use-fake-device-for-media-stream` (needs a one-off custom launcher, not `cdp.mjs`).
- **Can't stub `window.location.reload`** in an `--eval` — it's non-configurable, so a `defineProperty`
  throws and the *real* reload fires, navigating the page so your eval returns `undefined`. To test
  code that reloads/navigates (e.g. `lazyWithReload`'s chunk recovery), make the side effect
  **injectable** with a default (`fn = () => window.location.reload()`) and pass a spy from the eval.
- **There is no audio modal any more.** The blocking "Tænd for lyd" surface is gone (Audio activation
  PRD-01); its replacement is a small non-blocking "Tryk for lyd" chip that appears only while the
  evidence-based verdict is `blocked`. Both drivers launch with autoplay allowed, so it never shows —
  nothing to dismiss, and `--keep-audio-modal` no longer exists. `--block-autoplay` (cdp.mjs) is how you
  make it show on purpose. **In `webkit.mjs` a shown cue is CORRECT** — that engine cannot play audio at
  all — so never read it there as a regression.
- **A layout probe's failures are meaningless without a BASELINE.** Before calling any of them a
  regression, re-run the SAME probe at HEAD and diff the two failure sets. **COMMIT YOUR OWN WORK
  FIRST** — this used to read "`git stash`/`git checkout --` the file", and `git checkout HEAD -- <file>`
  silently discards whatever is uncommitted in that file, including the `data-*` probe hook you added
  minutes ago for this very sweep. Restoring the file afterwards brings back HEAD, not your edit, so the
  probe then reports the feature as broken/absent and you debug a phantom (a ceremony "never appeared"
  for three runs). Commit, or use a throwaway `git worktree` at HEAD, and re-check `git status` after. Five of seven "failures" from a section-menu sweep were pre-existing — the shipped code
  was already violating the invariant a code comment in it claimed to hold. Report the delta (fixed /
  introduced / untouched), never the raw count. Same run, same trap in the other direction: **scope the
  selector to a `data-bl-*` hook on the container.** A bare `[aria-label]` sweep also matched the app-bar
  ring and the mascot, which bucketed into phantom extra "rows" and reported 25 failures on a page with
  none. Over-selecting fails loudly; under-selecting passes silently — both lie.
- **A CELEBRATION overlay is not just its content — scope the measurement to the content column.**
  `CelebrationEffect` mounts a **full-viewport `<canvas>`** as a sibling of the column, and react-confetti
  also injects **off-screen sprite `<img>`s**. So a `overlay.querySelectorAll('*')` bounding-box union
  reports a "column" 1213px wide on an 844px viewport (→ a false overflow failure), and
  `overlay.querySelector('img')` returns a **confetti particle** rather than the reward — which then
  measures 59px and looks like the sticker rendered at the wrong size. Both were probe bugs, not layout
  bugs. Pick the non-canvas direct child (`[...o.children].find(e => e.tagName !== 'CANVAS' &&
  !e.querySelector('canvas'))`) and measure inside that.
- **Measure, don't eyeball, for overflow.** A scaled thumbnail can hide a button clipped past a
  popover edge; `rect.r > container.r` is unambiguous (this caught the sample-button overflow).
  **`document.scrollWidth <= innerWidth` is NOT proof of no-clip** — GameShell's no-scroll root is
  `overflow:hidden`, so content that overflows the viewport is *clipped, not scrollable*, and
  scrollWidth still equals innerWidth. Prove on-screen by comparing each element's
  `getBoundingClientRect()` left/right against `[0, innerWidth]` (this caught a Ram Farven
  phone-landscape row clipped −64px left / +22px right that read as "no overflow").
- **MUI `sx` compiles to an emotion CLASS, not inline style** → in an `--eval`, `el.style.border` /
  `el.style.borderRadius` is **empty** for a `<Box sx={{…}}>`. Only raw `style={{}}` props show up in
  `el.style` — in practice the dnd primitives (`DroppableZone`/`DraggableItem`) and scatter `left/top%`.
  So `[...divs].filter(d => d.style.border.includes('dashed'))` silently matches nothing on sx-styled
  nodes and the eval returns `{}`. Select/measure MUI-styled elements via `getComputedStyle(el)` (styles)
  or `getBoundingClientRect()` (geometry) instead.
- App sizes to `--vh`; default 540x940 is representative. Useful selectors: the adult settings surface
  opens via TWO clicks — `[data-profile-chip]` (the child's name pill in the title row), then
  `[aria-label="Indstillinger"]` in the "Hvem spiller?" sheet. (The old 2s hold and its `?adult-tap=1`
  workaround are gone; the label is on the child's AVATAR now), is rail-ready in ~530ms under
  `?nogate=1` — the old "~4.5s is REQUIRED" was the blocking screenshot capture, which is gone, so a
  generous settle is now headroom for the lazy chunk rather than a floor — and its five panes are
  `[data-rail-item=konto|laering|lyd|udseende|privatliv]` (`barn` and the old `konto` merged into one,
  2026-09-05, and the `[data-guest-signin-promo]` row above the rail is deleted). The two danger blocks
  in `konto` are `[data-danger-block=fareBarn|fareKonto]`. **On a phone-sized viewport the rail only
  exists at the ROOT** — the surface opens onto the last-viewed pane, so click `[aria-label="Tilbage"]`
  first or the rail selector is simply absent. MUI dialogs render under `.MuiDialog-paper`, popovers
  under `.MuiPopover-paper`.
- **`?nogate=1` renders the SIGNED-IN adult surface, not a guest one** — `authGateDecision` short-circuits
  to `phase: 'authed'` on `devBypass` (`authGatePolicy.ts`), so `Sikkerhed`, `Synkronisering` and the
  `fareKonto` danger block are all drivable headlessly WITHOUT minting a session in the production Neon
  DB. Leaving `?nogate=1` off gives the guest shape behind the arithmetic gate. Both were verified this
  way for the Barn+Konto merge; only real Danish, touch feel and iPadOS 17.7 still need the device.
- **`?nogate=1` also disables `requirePin`** (`authStore.isDevBypass()` short-circuits it), so PIN pads
  raised via `requirePin` never appear headlessly and a "PIN-gated" path is really being driven
  un-gated. The only pad you can exercise is one a component raises DIRECTLY — e.g. the
  account-deletion pad in the Konto pane, which is how the settings dialog↔pad stacking was hit-tested.
  **The GUEST arithmetic gate IS drivable, by leaving `?nogate=1` OFF**: a session-less device
  auto-guests, so the door raises the real challenge (`[data-guest-gate-key]`, `[data-guest-gate-slot]`)
  and the whole gate layout can be measured. The PIN pad has no such route — reaching it needs an
  account, and minting one writes into the owner's PRODUCTION Neon DB (`.claude/rules/auth.md`), so a
  PIN-pad layout claim is made from the shared `<Keypad>`/`gateDialog` code, not from pixels. Say which.
- **DEV query params force states deterministically for capture** (all DEV-only — see
  `src/utils/devHarness.ts`): `?fx=correct|wrong|hint|streak` forces one tile/board into that feedback
  state (no need to solve), `?seed=<n>` makes questions deterministic (probe with `--eval` to find a
  seed that yields the case you want, e.g. a count-mode number or a high comparison pile), `?nogate=1`
  skips the auth gate (and stands the audio cue down — see above), `?reduce=1` forces reduced-motion,
  `?theme=<id>` sets the skin,
  `?mute-tts=1` forces narration UNHEALTHY so the two audio-only boards (Tal Quiz, Lyt og Find) show their
  degraded state — they print the answer as type, which is the only way to capture that path without
  actually breaking audio (see the narration-health section in `.claude/rules/audio-system.md`), and
  `?audio-cue=1` lifts ONLY the `?nogate=1` stand-down on the "Tryk for lyd" cue.
- **A harness param should lift a STAND-DOWN, not force the state.** `?audio-cue=1` makes the cue
  *reachable*; it does not make it appear — the app's own evidence still has to reach `blocked`, which is
  why it is paired with `--simulate-audio-blocked`. Forcing the render would prove only that the component
  can paint, which is never the thing in doubt. `?mute-tts=1` is the same shape (it pins a real counter
  the app reads, rather than switching the degraded UI on).
- **`?theme=` takes a REGISTERED id and an unknown one SILENTLY HALF-WORKS.** The ids are
  `kid`/`ocean`/`space`/`dino` (`src/theme/themes.ts`) — Regnbue is **`kid`**, not `rainbow`. A bogus id
  falls back to the default TOKENS, so the page looks like the default skin and nothing errors, but
  `loadSceneAssets(id)` returns `null` — so the parallax world, the mascot poses and the
  `ProgressionCompanion` all render **art-less**. An empty companion ring in a ceremony was chased as a
  missing-art bug for several runs before the URL turned out to be the cause. If art is inexplicably
  absent, check the theme id first.
- **Auto-played game TTS often doesn't fire in headless** (no real audio device), so the fetch-capture
  audio recipe is unreliable for a game's welcome/prompt — it works for **tap-triggered** echoes (browse
  screens, answer taps), not the gated auto-play. Confirmed with `--audio-report`: a bare Chrome run of
  `/alphabet/quiz` reports `NO AUDIO ATTEMPTED`, and tapping `[aria-label="Hør igen"]` then plays a real
  prebaked clip (clock advances ~1.5s of a 2.0s file). So **drive a trigger; never read "nothing played"
  on mount as a defect.** To identify which quiz **subject** is showing without
  audio, read the hero image src: `[data-prompt-focus] img` → the filename (Vite keeps the content id,
  e.g. `.../X.webp`). Combine with `?seed=<n>` to force a specific question deterministically.
- Always check the printed "console errors"/"page exceptions" lines — a clean screenshot can still
  hide a runtime error.
- **`?reduce=1` flips only the JS `useReducedMotion()` hook, NOT the CSS `@media (prefers-reduced-motion:
  reduce)`.** So animations gated purely in CSS (e.g. the living-card idle breathe) stay ON under
  `?reduce=1` — it only exercises the JS-gated paths (transition fallback, framer bumps, idle attract).
  Verify CSS-media-gated motion by emulating the media feature at the OS/DevTools level, not the dev param.
- **Games open straight to an interactive board** (no entry-beat curtain — the "Er du klar? … Kør!"
  `GameIntro` was removed in Liveliness PRD-06). The themed wipe (`TransitionOverlay`) still covers the
  mount/unmount, but it lifts on its own; there's no `[data-game-intro]` to click and no first-tap-as-skip.
- **Headless Chrome runs rAF/framer-motion unthrottled**, so route transitions + entrance animations
  complete almost instantly — you generally CAN'T screenshot a mid-animation frame (even `--wait 70`
  lands post-animation). Verify steady states + console cleanliness instead; for a "no white-flash"
  regression check, use a DARK skin (`?theme=space`) where any white frame would be unmissable.

## Verifying a bug-report capture (snapdom A/B)

The bug-report screenshot is NOT a photograph — snapdom clones the DOM, copies each node's *computed*
style onto the clone and rasterises that through an SVG `<foreignObject>` (CLAUDE.md, adult-tools
bullet). The only way to prove a capture change is to A/B it against a real screenshot of the SAME
frame, so do this for ANY edit to `screenshotService.ts` or its snapdom options.

One run gives you both: `--eval` fires the app's own `captureScreenshot()` and prints its data URL,
then `--out` takes the CDP screenshot. Redirect stdout to a file, slice the base64 after
`DATA:data:image/jpeg;base64,`, and pixel-diff the two with `sharp` (already a devDependency) from a
script **inside the project**.

```bash
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/?nogate=1&theme=ocean' \
  --w 1251 --h 869 --wait-for '#root > *' --settle 2000 --out real.png \
  --eval "(async()=>{const m=await import('/src/services/screenshotService.ts');
           const d=await m.captureScreenshot(); return 'DATA:'+d})()" > out.txt
```

Four things that make the result trustworthy:

- **`--eval` runs BEFORE `--out`**, so ~1s of ambient drift (bubbles, idle breathe, mascot pose) sits
  between the two frames and shows up as a real-looking diff. Discount moving decor; judge text,
  boxes and colour. Freeze what you can (`?reduce=1`) before blaming the capture.
- **A near-zero diff is a FAILURE signal, not a pass.** Two blank captures diff to `0.00`. A parallel
  session's mid-edit `SyntaxError` (a missing export) stopped the app mounting, and the run reported
  `ms=45`, `mean abs diff: 0.00` — perfect scores on an app that never rendered. Always read the
  driver's `TIMEOUT waiting for selector` / `page exceptions` lines before believing a number.
- **Assert nothing leaked.** `stabilizeForCapture` mutates the live DOM and restores it in a `finally`.
  In the same `--eval`, after the capture, count `[style]` nodes still carrying
  `margin-left: …!important` / `backdrop-filter: none !important` / `overflow: visible !important` —
  it must be 0, or the child is left looking at a page you edited.
- **Cover the shapes, not just one page**: a centred pill (Min Bog's header count → `margin:auto`), a
  long label near its `max-width` (home's "Tal og Regning" → false ellipsis), a frosted card over
  art (Min Bog's page panel → `backdrop-filter`), a dark skin, and phone landscape.

To attribute a defect, get at the clone itself rather than guessing — pass a plugin and keep the
context: `plugins: [{name:'spy', afterClone(ctx){ ref = ctx }}]` gives you `ctx.clone` (the styled
clone) and `ctx.classCSS` (the flat `.cNN{…}` rules snapdom generated), and `snapdom(...).url` is the
SVG data URL you can `decodeURIComponent` and read. Bare `import('@zumer/snapdom')` does NOT resolve
in `--eval`; use `/node_modules/@zumer/snapdom/dist/snapdom.mjs`.

**Known unexplained residual:** `/album`'s "x / 9 samlet" line does not paint, while the clone holds
the element with the right box, colour and font and the surrounding layout is pixel-identical. Ruled
out: font family, snapdom's `::first-letter` materialisation, multi-text-node children, geometry, and
snapdom 2.23.1 with and without `reconcile`. Don't re-run those four.
