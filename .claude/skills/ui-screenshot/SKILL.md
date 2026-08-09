---
name: ui-screenshot
description: Headlessly drive the local app to SEE and verify UI - screenshot a route, click into modals, wait for elements, and measure element rects to catch layout bugs (overflow, clipping, wrapping) plus console errors. Also drives real WebKit with an iPad UA (webkit.mjs) for Safari-engine and iOS code paths, asserts that audio ACTUALLY PRODUCED SOUND (--audio-report) instead of asking the owner to listen, and measures steady-state rendering cost (perf.mjs) - reach for that whenever the question is "why does it stutter / feel slow", because load metrics cannot see an app sitting still. Use proactively, without waiting to be asked, whenever the work involves the visible UI or its audio: after changing any component, layout, style or theme, when asked to look at or check how something appears, when diagnosing a visual bug, or before reporting a UI or narration change as done. Vite + MUI app; the dev servers must be running.
---

# UI screenshot & layout verification

## Say which rung a claim came from

Three rungs, in increasing cost and decreasing convenience — and the opposite error (calling a WebKit
run "verified on iPad") is worse than under-claiming.

| rung | tool | proves | cannot prove |
|---|---|---|---|
| 1 | `cdp.mjs` (headless Chrome), `mic.mjs`, `perf.mjs`, `sweep.mjs` | layout, interaction, game logic, XP, that audio made a sound | anything Safari-specific — **including LAYOUT**; real touch feel |
| 2 | `webkit.mjs` (real WebKit, iPad UA) | the Safari engine, the app's iOS branches, the codec table | **cannot play audio at all**; not true iPadOS 17.7 |
| 3 | the owner's iPad | whether the Danish sounds RIGHT, real touch, true 17.7 behaviour | — |

**Rung 1 does not settle a layout claim.** The engines resolve `aspect-ratio` inside flex differently:
a keypad that measured square and correct at seven viewports in Chrome came back 36px and lopsided in
WebKit (`.claude/rules/responsive-design.md`). Re-run any sizing claim through `webkit.mjs` before
calling it verified.

**Unverified is not broken; say UNKNOWN.** Across the sweep sessions the probes' own defects outnumbered
the app's about five to one, every one a state that isn't a failure folded into the failure bucket. Keep
assertions tight enough to fail: `xpAfter > xpBefore` passed on a build with `taskXp` zeroed.

**"It stutters" is a steady-state question, and `cdp.mjs --perf` cannot see it** — that measures LOAD.
Use `perf.mjs`, and gate on `recalcMsPerSec`, never `recalcPerSec`.

App-wide checking runs through `sweep.mjs --phase …`; run `--selftest` first, which proves the guards
actually fire.

## Where the detail lives

Read the one you need — these are the skill's reference files, one level deep:

| file | contents |
|---|---|
| `reference/rungs.md` | the full rung table, and the **four** outcomes every probe needs (pass / fail / N/A / UNKNOWN) |
| `reference/recipes.md` | every command recipe: screenshot a route, `sweep.mjs`, rect traps, WebKit, throttled perf, `--audio-report`, `mic.mjs`, driving a tap, dnd-kit drag, passkeys, verifying spoken audio, the A/B pixel test |
| `reference/probes.md` | `perf.mjs` steady-state, the full option list, verifying XP/progress and difficulty, authoring a long `--eval` |
| `reference/gotchas.md` | built-in behaviours to know before blaming the app, and verifying a bug-report capture |

The `.mjs` probes in this directory are **executed, not read** — `cdp.mjs`, `webkit.mjs`, `perf.mjs`,
`sweep.mjs`, `mic.mjs` and the `*.js` payloads cost nothing until you run them. Don't Read them to
learn the flags; `reference/probes.md` has the list, and each takes `--help`.

## When to use (be proactive)
Reach for this automatically when a task touches the visible UI — e.g. you edited a component and
want to confirm it renders correctly, the user asks to see/verify how something looks, or you're
hunting a layout/overflow/wrapping bug. Don't wait for an explicit "take a screenshot"; if seeing
the UI would make the answer more correct, use it. Skip it for pure logic/backend changes.

## Prerequisites (do this first)
1. Dev servers running **in Windows PowerShell, not WSL** (WSL → 502 on /api; memory
   `project_dev-server-windows-not-wsl`). Start both in the background and confirm
   `curl http://127.0.0.1:5173/` → 200:
   - API:  `npm run dev:api`                                     (port 3001)
   - Vite: `node node_modules/vite/bin/vite.js --host 127.0.0.1` (port 5173)
   Vite HMR picks up source edits — re-run the driver after a change without rebuilding.
2. **The app is auth-gated.** Add `?nogate=1` to reach any screen (it implies no-auth too). It also
   attaches a stand-in child (`dev-local`), so `progressStore` is live — without that the store stays
   INERT, `?rewards=n` awaits `whenAttached()` forever and the un-dismissible "add a child" dialog
   covers whatever you were capturing. DEV handles: `__auth`, `__profiles`, `__progress`, `__sync`.
   **Do NOT mint a session with `scripts/auth-dev-session.mjs` just to take a screenshot** — it writes a
   real user + session into the owner's PRODUCTION Neon database, and test rows have reached his
   play-test that way before (`.claude/rules/auth.md`). Reserve it for passkey work that genuinely
   needs a server session, and delete the `user` row afterwards (it cascades). For everything else,
   set the fields you need on `window.__auth` in the same `--eval` — no network, no database.
3. Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe` (override `CHROME_PATH`).
4. For `webkit.mjs`: the `playwright` devDependency (installed) + `npx playwright install webkit`
   (one-time, ~150MB into the user cache, not the repo). If it reports a missing browser, re-run that.

Then **view a saved PNG with the Read tool** (it renders images).

## Three driver limits that read as app bugs

- **`--eval` is NOT repeatable**, unlike `--click`/`--wait-for`/`--type`. Pass two and only one runs,
  silently — a multi-step interaction has to be ONE eval that schedules the rest with `setTimeout`, then
  a `--wait` long enough to cover it. Wrap it as `(()=>{ … })()`: a bare `return` is a syntax error.
- **Solving the guest arithmetic gate crashes the WebKit target.** `--click '[aria-label="Til de
  voksne"]'` reaches the gate reliably and `[data-guest-gate-prompt]` reads its own question, but the
  moment the answer completes and the lazy adult surface mounts, the run dies with "Target crashed" or
  "context has been closed" — four attempts, reproducible. Not the app: the same path is fine on a
  device. So **the adult surface cannot currently be captured in real guest mode.** `?nogate=1` reaches
  it (the badge then reads the dev child, not `Gæst`), or capture on the iPad.
- **The dev build renders a backend pill** (`[data-backend-badge]`, `TEST · localhost:5173`). Remove it
  in the `--eval` before any capture that leaves this repo. Production renders none by construction, so
  deleting it is accurate rather than a cheat — `backendLabel()` returns null there.

App Store captures have their own rules — exact slot sizes, RGB not RGBA, and which screens go in which
slot — in `docs/app-store/listing.md` §2.2 and `docs/releasing.md`.

## Cleanup
Delete temp PNGs when done. Chrome is killed each run. Stop the dev servers (free 3001/5173) if you
started them only for the test.
