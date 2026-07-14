# Børnelæring — Improvement PRDs

These PRDs were produced from a whole-app analysis + live-playthrough session on **2026-07-14**
(against commit `19eefa7`). Each is **self-contained**: it can be handed to a fresh Claude Code
session with no prior context and implemented independently. They are ordered by priority.

> **Line numbers** in these documents are from the analysis snapshot. Code moves — always
> `grep`/read the current file to confirm a location before editing. Where a PRD gives a code
> sketch, treat it as intent, not a literal patch.

> **Testing.** This repo ships a headless-Chrome UI harness — the `ui-screenshot` skill
> (`.claude/skills/ui-screenshot/cdp.mjs`). Use it to screenshot routes, drive taps/clicks, measure
> element rects, and capture console errors. The dev servers must be running in **Windows
> PowerShell** (not WSL): `npm run dev:api` (port 3001) + `npm run dev` (port 5173). Verify every
> user-facing change in the harness before calling it done, and re-capture `docs/ui-reference/`
> baselines after visual changes.

| PRD | Title | Priority | Scope |
|-----|-------|----------|-------|
| 01 | Drag-and-drop correctness (Farver) | **P0** | Small–Medium |
| 02 | Quiz-engine input lock, timers & hook stability | **P0** | Medium |
| 03 | Mic safety, STT content filter & API hardening | **P1** | Small–Medium |
| 04 | Content & data quality (emoji, Danish, sizing) | **P1** | Medium (mostly data) |
| 05 | Gameplay fairness & help (engine hint, difficulty, echo) | P2 | Medium |
| 06 | Audio latency, caching & iOS robustness | P2 | Medium–Large |
| 07 | Delivery performance & bundle | **P1** (has a 1-line quick win) | Small–Medium |
| 08 | Stability & PWA | P2 | Medium |
| 09 | Reward & result-screen UX | P2 | Small–Medium |
| 10 | Refactor, dead code & docs | P3 | Large |
| 11 | Narration & pronunciation correctness | **P1** | Medium–Large |

**Suggested order:** 01 → 02 → 03 → 07 (quick wins) → 04 → 05 → 06 → 08 → 09 → 10.
01, 02, 03, 07 are largely independent and can run in parallel sessions. 10 (refactor) is easiest
*after* the behavioural fixes land, so it consolidates the corrected logic rather than fossilizing bugs.
