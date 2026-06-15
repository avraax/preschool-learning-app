---
name: ui-screenshot
description: Headlessly drive the local app in Chrome to SEE and verify UI — screenshot a route or component, click into modals/popovers, wait for elements, and measure element rects to catch layout bugs (overflow, clipping, wrapping) plus runtime console errors. Use PROACTIVELY and automatically — without waiting to be asked — whenever the work involves the app's visible UI: after making or reviewing a change to any component/layout/style/theme, when the user asks to "look at / see / check / verify how X looks", when diagnosing a visual or layout issue, or before reporting a UI change as done. This is a Vite + MUI app; the dev servers must be running.
---

# UI screenshot & layout verification

Drive the locally-running app in **headless Chrome** (already installed) via the Chrome DevTools
Protocol, using the zero-dependency driver `cdp.mjs` here (Node 22+ global WebSocket/fetch — no
`npm install`). Capture screenshots to view, wait for elements, and measure rects to PROVE layout.

## When to use (be proactive)
Reach for this automatically when a task touches the visible UI — e.g. you edited a component and
want to confirm it renders correctly, the user asks to see/verify how something looks, or you're
hunting a layout/overflow/wrapping bug. Don't wait for an explicit "take a screenshot"; if seeing
the UI would make the answer more correct, use it. Skip it for pure logic/backend changes.

## Prerequisites (do this first)
1. Dev servers running **in Windows PowerShell, not WSL** (WSL → 502 on /api; memory
   `project_dev-server-windows-not-wsl`). Start both in the background and confirm
   `curl http://127.0.0.1:5173/` → 200:
   - API:  `node --env-file=.env.local dev-server.js`            (port 3001)
   - Vite: `node node_modules/vite/bin/vite.js --host 127.0.0.1` (port 5173)
   Vite HMR picks up source edits — re-run the driver after a change without rebuilding.
2. Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe` (override `CHROME_PATH`).

Then **view a saved PNG with the Read tool** (it renders images).

## Recipes

```bash
# Wait for the app to render, then screenshot a route
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --wait-for '#root > *' --out shot.png

# Open a popover, wait for it, tight-crop just that element
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --click '[aria-label="Stemme-test"]' --wait-for '.MuiPopover-paper' \
  --clip '.MuiPopover-paper' --out panel.png

# PROVE no overflow/clipping (compare child rect.r to the container's inner right edge)
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --click '[aria-label="Stemme-test"]' --wait-for '.MuiPopover-paper' \
  --measure '.MuiPopover-paper, .MuiPopover-paper button'

# Check a different viewport (landscape) for responsive layout
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/math/counting \
  --w 900 --h 440 --wait-for '#root > *' --out landscape.png
```

## Options
- Core: `--url` (req) · `--out <png>` · `--w/--h` (viewport, default 540x940)
- Waiting (prefer over sleeps): `--wait-for "<css>"` · `--wait-for-text "<txt>"` · `--timeout <ms>`
  (default 10000) · `--settle <ms>` (default 500) · `--wait <ms>` (fixed; only when no `--wait-for*`)
- Interact (clicks auto-wait for their selector): `--click "<css>"` · `--click-text "<txt>"` ·
  `--type "<css>::<text>"`
- Output: `--measure "<s1,s2>"` (rects) · `--clip "<css>"` (crop to element) · `--full-page` ·
  `--eval "<js>"`. Console errors + page exceptions are ALWAYS captured + summarised.
- Behaviour: `--keep-audio-modal` · `--port <n>`. Exit code is non-zero if a `--wait-for`/click
  target never appears (so failures are loud, not silently green).

## Gotchas (built-in, but know them)
- **Clicks use `element.click()`**, not synthetic mouse coordinates — MUI ignores synthetic coords.
  So `--click` takes a CSS selector.
- **Audio modal ("Tænd for lyd")** is auto-dismissed (launches with autoplay allowed + clicks
  "Start lyd nu"). Use `--keep-audio-modal` only to screenshot the modal itself.
- **Measure, don't eyeball, for overflow.** A scaled thumbnail can hide a button clipped past a
  popover edge; `rect.r > container.r` is unambiguous (this caught the sample-button overflow).
- App sizes to `--vh`; default 540x940 is representative. Useful selectors: voice override panel
  opens via `[aria-label="Stemme-test"]`; MUI popovers render under `.MuiPopover-paper`.
- Always check the printed "console errors"/"page exceptions" lines — a clean screenshot can still
  hide a runtime error.

## Cleanup
Delete temp PNGs when done. Chrome is killed each run. Stop the dev servers (free 3001/5173) if you
started them only for the test.
