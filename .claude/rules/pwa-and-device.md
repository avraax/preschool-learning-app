---
paths:
  - "src/main.tsx"
  - "vite.config.ts"
  - "index.html"
  - "public/manifest.json"
  - "vercel.json"
  - "src/utils/lazyWithReload.ts"
  - "src/utils/swCleanup.ts"
  - "src/utils/devHarness.ts"
  - "src/utils/deviceDetection.ts"
  - "src/config/referenceViewports.ts"
  - "package.json"
---

# PWA, delivery & the target device

## Network-only, no service worker

PRD-08. `main.tsx` runs a one-time legacy-SW unregister + cache sweep (`utils/swCleanup.ts`) for clients
from an older SW era. **Consequence: a cold launch with no network already fails at the document fetch**
(no SW + `no-store` on `/(.*)` = uncacheable `index.html`), so **never design a feature around "works
offline"** — only an already-resident app resuming survives.

- Exactly one manifest: hand-authored `public/manifest.json` (linked in `index.html`). Keep its
  `theme_color`/`background_color` consistent with the `theme-color` meta, and `orientation: any`
  (landscape-first design).
- **`display: standalone` only pays off from SAFARI's "Føj til hjemmeskærm"** — on iPadOS a shortcut added
  from Chrome opens as a tab inside Chrome, and no manifest field, `display_override` or
  `apple-mobile-web-app-*` meta overrides that. So "it doesn't start fullscreen" is answered by which
  browser added it, never by a code change.
- Lazy routes are wrapped in `lazyWithReload`: a stale-chunk/dynamic-import failure after a deploy triggers
  a single `location.reload()` (sessionStorage-guarded against loops) instead of crashing into
  `AppErrorBoundary`.
- `progressStore` flushes synchronously on `pagehide`/`visibilitychange:hidden` (survives a fast PWA
  swipe-away) and re-hydrates from a cross-tab `storage` event (last-writer-wins).

## Delivery / caching (`vercel.json`)

PRD-07. **`rewrites` and `headers` obey OPPOSITE rules, and the rewrite one is load-bearing.**

- A **rewrite is FIRST-match-wins**, and the whole `rewrites` array is evaluated **before** the generated
  dynamic-route entries — so an SPA `/(.*)` → `/index.html` fallback silently swallows every
  `api/**/[...param]` route, which answers 200 `text/html` and reads as a routing mystery, not a failure.
  Keep `/api` out of that fallback and route a catch-all function explicitly
  (`.claude/rules/api-endpoints.md`).
- **Headers are the reverse**: all matching rules apply, and for a duplicate key the **last** matching entry
  wins — so the `/(.*)` `no-store` catch-all is overridden by more-specific rules placed **after** it
  (`/assets` + `/sounds/tts/` immutable; `/sounds/(.*)`, images, `manifest.json`, `da-DK.pls` = 1-day).
  Keep the immutable `/sounds/tts/` rule **after** the general `/sounds/` one, and keep **HTML uncached** so
  deploys are picked up. Verify prod with `curl -I`, never local dev — Vercel headers don't apply in dev.
- First-paint JS is split in `vite.config.ts` `manualChunks`: `media-vendor` = **howler only** (eager via
  `sfxClient`) — don't co-bundle lazy-only libs with it (react-confetti rides the lazy
  `CelebrationEffect`/`StickerReveal` chunk). The whole adult area is ONE `React.lazy` chunk
  (`AdultSettings`), leaving only the gear button eager in `AdultCorner`.

## The compatibility floor IS the target device

The child plays on an **iPad Pro 2nd gen (A10X, 2017) on iPadOS 17.7.11**, its terminal OS. **Check any new
web/media API against Safari 17, not "latest Safari"** — the newer devices in the house hide 17-only
breakage, which is how Ogg audio shipped and silenced that iPad. The build target is **PINNED** to
`['safari17','ios17']` in `vite.config.ts`: Vite 8's default merely happened to resolve below the floor, and
a bump could have raised it past 17.7, whose only symptom is a blank screen on this one device.

Verify with `webkit.mjs --device ipad-pro` (the DEFAULT) / `ipad-pro-split` / `ipad-105`, and `sweep.mjs`,
which lead with the iPad Pro sizes.

**It is the 12.9" (owner-confirmed); that iPad has never sent a bug report, so the numbers come from another
device.** The measured 12.9" numbers in `referenceViewports.ts` (screen 1024×1366 @dpr 2, PWA landscape
**1366×992**, **Split View 678×992** — so Split View is real usage) come from the household's **M1** Pro:
prod reports `platform: MacIntel`, `isM1iPad: true`, UA `Macintosh … Version/26.5`, because M1+ iPads send a
desktop-class UA. Both 12.9" generations share CSS geometry so they transfer — but **CSS resolution alone
cannot tell a 2017 Pro from an M1 one; only `isM1iPad`/the UA can**, and this was nearly documented as his
device. The 992 (not 1024) is iOS keeping a ~32px status strip even standalone — don't round it. `1024×768`
is no current iPad Pro at all; it stays only as the tighter small-iPad case. Full record + performance
caveats in `docs/device-testing.md`.

## Two limits before promising anything about that device

- **A green unit suite is not device coverage.** `sceneLayers.test.ts` is the ONLY unit consumer of
  `REFERENCE_VIEWPORTS` and is **insensitive to viewport size** (`overscanPx` ≥ travel by construction, and
  the one height-scaling term is exempted — a 1×1 viewport passes). Device-size checking must come from the
  browser sweep.
- **Production-bundle behaviour needs `npm run build:harness`.** `?nogate=1` is `DEV &&`-gated and
  `import.meta.env.DEV` is false in any `vite build`, so a normal build tree-shakes the harness away and a
  preview build stops at the login screen. That mode builds a production-shaped bundle (NODE_ENV forced)
  that still answers the dev params; `__HARNESS__` is statically `false` everywhere else so the bypass is
  ABSENT from deploy output (a plain build contains zero occurrences of `nogate`), and
  `harnessBuild.test.ts` fails if any deploy script selects the mode. **Never deploy it.** Measure that
  bundle, never the dev server (unbundled ESM overstates load ~10×).
