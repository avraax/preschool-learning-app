# PRD-08 — Stability & PWA

**Priority:** P2
**Scope:** Medium
**Depends on:** none (coordinate with PRD-07 on `vercel.json`)

---

## Context

React 19 + Vite 8 SPA, routes lazy-loaded in `src/App.tsx`, `vite-plugin-pwa` configured in
`vite.config.ts`, deployed on Vercel (auto-deploy on `master`). Persistent progress is a
localStorage singleton `src/services/progressStore.ts` (250ms debounced save). Global crash handling:
`src/components/common/AppErrorBoundary.tsx` + window error/rejection hooks in
`src/services/diagnosticsBuffer.ts`. Update flow: `src/hooks/useUpdateChecker.ts` +
`src/components/common/UpdateBanner.tsx`. An app-wide parallax "scene" runs behind the router
(`src/components/common/scene/*`, `useParallax.ts` runs a permanent rAF loop).

## Problems (with evidence)

### P1 — Stale-chunk crash after every deploy

All routes are `lazy()`. Vercel replaces deployments, so a still-open client that navigates to a
not-yet-loaded section after a deploy 404s on the old hashed chunk → the `lazy()` rejection hits
`AppErrorBoundary` → the child sees "Ups! Noget gik galt" and an auto crash-report is burned. There's
no `ChunkLoadError → reload` recovery, and the boundary never resets without a full reload.

### P2 — Progress can be lost on a fast close; no multi-tab sync

`progressStore` saves on a 250ms debounce with **no flush on `pagehide`/`visibilitychange`** — swiping
the PWA away within ~250ms of earning a sticker loses it. No `storage` event listener → two tabs are
last-writer-wins over the whole blob.

### P3 — The "PWA" has no service worker registered; two manifests conflict *(confirmed)*

`vite.config.ts` sets `injectRegister: null` and nothing in `src/` calls
`navigator.serviceWorker.register`/`registerSW` — so the emitted `sw.js` is never registered (offline =
white screen; the emitted SW is dead weight; clients from an older SW era are never cleaned up).
`index.html` links `/manifest.json` (theme_color `#F8FAFC`) while the plugin injects a second
`/manifest.webmanifest` (theme_color `#8B5CF6`); the `<meta name="theme-color">` is a third value.
`orientation: portrait-primary` in `manifest.json` also contradicts the landscape-first iPad design.
CLAUDE.md claims "Network-only strategy, auto-generated service worker" — that component isn't wired.

### P4 — Scene animations run during gameplay

`useParallax.ts` runs an unconditional rAF loop for the app's whole lifetime on every route, feeding a
full-viewport `blur(7px) scale(1.06)` layer during games (`PersistentWorld.tsx`), plus `AmbientField`
runs 12–28 infinitely-animating promoted layers. `prefers-reduced-motion` kills it, but nothing else
does — continuous GPU/battery cost on older iPads behind gameplay that's blurred anyway.
`index.css` also sets a blanket `will-change: transform` on all buttons/cards/MUI-hover (mass layer
promotion).

## Goals / Non-goals

**Goals:** deploys don't crash open clients; earned progress survives a fast close; one coherent PWA
manifest + a deliberate SW decision; scene work paused during gameplay.

**Non-goals:** offline play as a feature (unless desired); the update-button UX (PRD-09).

## Implementation plan

1. **ChunkLoadError recovery (P1).** Wrap `lazy()` imports with a retry-then-reload helper: on a
   dynamic-import rejection matching `ChunkLoadError`/failed fetch, `location.reload()` once (guard
   against reload loops with a sessionStorage flag). Optionally give `AppErrorBoundary` a reset on
   route change.
2. **Persist reliably (P2).** Flush `progressStore` synchronously on `pagehide` and
   `visibilitychange:hidden` (write immediately, bypassing the debounce). Add a `storage` event
   listener to re-hydrate from other tabs (last-writer-wins is acceptable for a single-child app, but
   re-hydration avoids clobbering a newer tab's state). Document the multi-tab behaviour.
3. **Reconcile the PWA (P3).** Pick one manifest (correct `theme_color`, `orientation: any`, good
   icons) and delete the other; align the `theme-color` meta. Then **decide**: either register a real
   minimal SW (and add a legacy-SW unregister sweep for old clients) or remove the plugin's SW
   emission entirely and update CLAUDE.md to match reality. Given the network-only intent, removing +
   unregister-sweep is the simpler honest option.
4. **Freeze the scene during gameplay (P4).** When the route is a "game" (see
   `scene/routeKind.ts`), stop the parallax rAF and pause ambient animations (the scene is
   blurred/dimmed anyway). Remove the blanket `will-change` selectors in `index.css`; apply
   `will-change` narrowly where it's actually needed.

## Acceptance criteria

- [ ] Simulating a missing chunk (e.g. block a lazy chunk URL) reloads once instead of showing the
      crash screen.
- [ ] Earning a sticker then immediately backgrounding/closing the tab preserves it on next launch.
- [ ] Exactly one manifest is served; `theme_color`/orientation are consistent; the SW situation
      matches CLAUDE.md.
- [ ] On a game route, the parallax rAF is not running (verify no continuous rAF callbacks / the
      `--parallax-*` vars stop updating).
- [ ] Full harness sweep clean.

## How to verify

- Chunk error: in the `ui-screenshot` harness, intercept/eval to reject a dynamic import and confirm a
  single reload (or test the helper in isolation).
- Progress: set state, dispatch `visibilitychange`/`pagehide` via `--eval`, reload, read
  `progressStore`.
- Manifest/SW: after deploy, `curl` the HTML and check the manifest link(s); check
  `navigator.serviceWorker.getRegistrations()`.
- Scene freeze: `--eval` a rAF counter on a game route; confirm it's idle.

## Risks / notes

- Don't cache HTML/SW (coordinate with PRD-07) or deploys won't be seen.
- The legacy-SW unregister sweep matters: earlier commits shipped a real SW, so some installed clients
  may still have one controlling the page.
- Keep `prefers-reduced-motion` behaviour intact; the freeze is an additional gate, not a replacement.
