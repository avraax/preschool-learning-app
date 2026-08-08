# Guardrail audit ledger

Append-only. One entry per `/guardrail-audit` run (and the PRD implementations that reset the baseline).
The **rejected** column is what stops the next audit re-litigating a decision the owner already made —
the same job PRD session-01 §3 does for the Vercel plugin and the failing test.

A gap in this file is the signal that the practice lapsed.

---

## 2026-08-06 — PRD session-01 implementation (baseline reset, not an audit)

| | |
|---|---|
| Claude Code | 2.1.223 |
| Model | `claude-opus-5[1m]` |
| Measured by | `scripts/baseline-probe.mjs`, 5-run medians; `scripts/context-budget.mjs` |

**Numbers**

| | before | after | target |
|---|---:|---:|---|
| headless baseline context | 53,873 tok | **40,032 tok** | ≤43,000 ✔ |
| one-component-edit step (probe B) | 54,431 tok | **26,727 tok** | <28,000 ✔ |
| rules loaded on one component edit | 101,784 B | **35,346 B** | — |
| always-loaded surface (CLAUDE.md + unscoped) | 28,637 B | **16,254 B** | ≤17,000 ✔ |
| `CLAUDE.md` | 28,637 B | **11,950 B** | ≤12,000 ✔ |
| mean first-turn baseline, last 18 sessions | 57,765 tok | (re-measure next audit) | — |

TTFT is **UNKNOWN** for this entry. The medians read 3–5 s before, spiked to 24–48 s mid-work on both
probes while context was going *down*, and settled at 9.6 s / 11.3 s on the final run. That spread is
service-side load, and it is far larger than any effect this change could have — so **no latency win is
claimed here**, in either direction. Re-measure in a quiet window before quoting a TTFT number.

**Doc facts relied on** (all as of 2026-08-06, from PRD session-01 §8):

- `SessionEnd` fires once per session and cannot add to conversation context; `Stop` fires once per
  turn; `InstructionsLoaded` fires when a `CLAUDE.md` / `.claude/rules/*.md` file loads.
- Statusline stdin carries `context_window.{total_input_tokens,context_window_size,used_percentage}`,
  `exceeds_200k_tokens`, `cost.*`, `rate_limits.*`; 300 ms debounce with in-flight cancellation;
  `used_percentage` is input-only.
- Skill authoring: SKILL.md body <500 lines, `description` ≤1,024 chars, references one level deep.
- Opus 5 migration: over-verification, increased delegation, 512-token cache minimum.
- [anthropics/claude-code#16299](https://github.com/anthropics/claude-code/issues/16299) does **not**
  affect 2.1.223 — path-scoped rules work here. Confirmed empirically by `InstructionsLoaded`.

**Applied** — W0–W8 of `tmp-prd-session-01-guardrail-budget.md`. Highlights:

- `animation-and-performance.md` scoped (was the only rule with no `paths:`).
- Vercel plugin disabled globally (−9,905 tok, more than the PRD's ~6,700 estimate).
- `CLAUDE.md` 28,637 → 11,950 B; incidents moved to `working-in-this-tree.md`.
- `audio-system.md` and `responsive-design.md` dropped the component glob; `audio-call-sites.md`
  (2,400 B) and `layout-contract.md` (5,998 B) own it instead.
- `games-catalog.md` split per section; `game-development.md` split from `game-authoring.md`.
- `contextBudget.test.ts` + `context-budget.mjs`, re-broken five ways.
- Two subagents deleted (see rejected/removed below).

**Rejected or deliberately not done**

| item | reason |
|---|---|
| 4,000 B cap on `working-in-this-tree.md` | Set to **4,500**. The content is 4,304 B of demonstrated incidents; the PRD's 4,000 predates the content, and trimming to it meant dropping a hazard. Still a pinned literal below natural sprawl. |
| Scoping `working-in-this-tree.md` to nothing (PRD's stated preference) | Left unscoped. These hazards fire *before* any file is opened, so no glob can predate them, and they have recurred *with* the guidance present. |
| Blanket CAPS-strip across all rules (W3.1) | Only the two genuinely unreasoned blocks were rewritten (`audio-system.md` "Mandatory Rules", `game-development.md` "Strict Rules"). The rest attach a reason, and a blanket rewrite is what W3 explicitly forbids. Remaining CAPS density is recorded below as a low-confidence finding. |
| W3.2 verification-scaffolding removal | **Found nothing.** Zero occurrences of "double-check"/"re-verify"/etc. across CLAUDE.md, 24 rules and 5 skills. Nothing changed. |
| W3.3 delegation encouragement removal | **Found nothing.** Zero occurrences. Nothing changed. |
| `scene-assets.md` (22,619 B) narrowing | Left alone. It, `scene-and-world.md` and `animation-and-performance.md` all claim `scene/*.tsx`, so a scene edit loads ~39,000 B — legitimate, since scene work needs all three. Flagged as the next candidate if scene sessions feel heavy. |
| `/usage` 7-day attribution (W0.5) | Needs the owner: it is an interactive TUI view. Not a gate. |

**Corrections to the PRD, found while implementing**

- `usage.iterations[]` in `-p --output-format json` is **not** per-turn — on a 2-turn run it holds one
  entry. §2.7's trap-1 fix does not work; the probe uses `--output-format stream-json --verbose` and
  reads `usage` off each `assistant` event.
- The dedupe-by-`message.id` trap is real but for a different reason than assumed: the stream emits one
  event per **content block**, all sharing the message id.
- §2.3 understated the `claude-api` skill load by ~6×. Measured from session `f2e53e6b`: turn 5 → 6 went
  79,510 → 323,267 context, a **+243,757-token** single turn, against the PRD's "roughly 40,000".
- A probe-B run where the model passes `limit` to `Read` reports a ~10,916-token step against 54,431 for
  a full read — a silent 5× understatement that reads as a win. Now classified UNKNOWN.
- Three subagents, not two, described a world that no longer exists. `audio-consolidation-expert`
  mandated `useAudio()` and forbade components importing Howler (the `sfx` channel is deliberately
  separate) — following it would have caused a regression. `child-ui-designer` specified MUI v7, a
  hardcoded hex palette against a token-driven theme, `/demo/*` routes that do not exist, and framer
  "floating idle animations" — the exact thing PRD-01 removed. Both deleted; `audio-debug-expert`
  pruned (it still told you to "test queue processing" two sections after stating there is no queue).
- The guard's own skill-description check was **vacuous on first write**: a single-line regex read YAML
  folded scalars (`>-`) as the literal string `">-"`, so every folded description measured ~2 chars.
  Found by inspection, fixed, and re-broken to confirm it now fires.

**Open for the owner**

1. Verification gate 6 — the quality check. **The audio half PASSED**, on a real task rather than a
   synthetic one: session `c14c13e4` started 12:59Z, 38 minutes after this work landed, and fixed the
   iOS 18.7 hung-`resume()` bug (`6f2353f`). It edited `SimplifiedAudioController.ts`,
   `audioLiveness.ts` and `SimplifiedAudioContext.tsx` — inside `audio-system.md`'s narrowed scope, so
   the deep rule loaded where it should — and it edited
   `.claude/skills/ui-screenshot/reference/recipes.md`, meaning it found and used the W3.5 split rather
   than tripping over it. It wrote two test files and a simulation probe, so the verification
   discipline survived the trim. Its first turn was **47,157 tokens against the 56,623–63,105 range of
   the four pre-change interactive sessions** — the first interactive confirmation, headless probes
   aside.
   **Still open: the game half.** No `src/components/**` file was touched, so `audio-call-sites.md`,
   `layout-contract.md`, `games-*.md` and `game-development.md` — the biggest restructure — remain
   unexercised on real work. If quality drops there, restore emphasis on the *specific* rule that got
   ignored, not on everything.
2. Gate 5 — `node scripts/session-cost.mjs --aggregate` over the next ten sessions; mean first-turn
   baseline should sit visibly below 57,765.
3. TTFT — re-measure in a quiet window.

---

## 2026-08-08 — Endless Play PRD-01 (data point, not an audit)

| | |
|---|---|
| Claude Code | 2.1.223 |
| Model | `claude-opus-5[1m]` |
| Scope | 15 files under `src/components/**`, plus config/services/tests (`a4af460`, `4c8b23a`) |

**This closes gate 6's open half.** The 2026-08-06 entry recorded the audio half passing and flagged
that `audio-call-sites.md`, `layout-contract.md`, `games-*.md` and `game-development.md` — the biggest
restructure — remained unexercised on real work. This session exercised all of them: every game
component changed, plus the memory engine, the quiz engine and the reward surfaces.

**The trimmed game rules held.** Four fired when needed, none of them re-derived:

- **Never edit a file with a shell text pipeline.** Reached for a Python patch script on one file to
  batch three edits. Caught it on the `git diff` (LF written over a CRLF file), reverted, redid it with
  the Edit tool. The rule works because it also says how the failure LOOKS.
- **A probe of an external/dependent thing has three outcomes.** Applied to the sweep verdicts:
  browses became N/A, Hukommelse and the two uncyclable Farver games UNKNOWN with a named reason,
  instead of three manufactured FAILs.
- **A level's pool must be at least the round constant** — carried straight into the endless-play
  rewrite, where it became the stronger cycle-length rule.
- **`/re-break`.** 17/17 mutations flipped their own test; the CRLF trap it documents fired exactly as
  written (one multi-line anchor skipped silently) and its "defensive, not load-bearing" outcome
  correctly classified one `boardBag` line.

**One guardrail was WRONG, and it was a probe reference.**
`.claude/skills/ui-screenshot/reference/probes.md` told a session to assert round outcomes at
`localStorage['bornelaering-progress'].perGame[gameId].bestStars` — fields deleted by this PRD, under a
key that had been per-child since the accounts release. Fixed here. **The pattern worth watching: the
stale guardrails are in the SKILL reference files, not the rules.** Rules get updated by the PRD's own
W8 docs step; skill references have no such trigger and drift silently.

**And a harness failed OPEN for three days.** `round-probe.js` detected round end via a `/Se bog/i`
button removed 2026-08-05, so `sweep.mjs` reported every game as "round never ended" — 21 routes of
real-looking defect with the harness apparently healthy, and `--selftest` cannot see it. Now captured
in `probes.md` as a class: a probe's success signal must be state the product cannot delete without
the probe failing to RUN, and a failure that uniform is almost never the app.

**Budget after this session's guardrail edits:** ALWAYS LOADED 16,485 / 17,000 · ONE COMPONENT EDIT
47,980 / 48,000. W8's rule rewrites pushed both over and were trimmed back in the same session; the
debrief items landed in skill reference files, which are outside both enforced numbers.

---

## 2026-08-08 — Staging environment PRD W1–W9 (data point, not an audit)

Shipped `staging` alongside `production`: a compile-time backend constant, a corner badge that prints
the backend HOST, a server-side tier cross-check that throws, marker-gated seed/wipe, two Codemagic
workflows. W9 updated `env-and-secrets.md`, `ios-shell.md`, `docs/device-testing.md` and CLAUDE.md as
part of the PRD, so the debrief itself had little left to capture — the pattern the previous entry
predicted, working as intended.

**Three guardrails were WRONG and were corrected**, all in `env-and-secrets.md`, all measured:

- "`vercel integration add <name> --help` lists that integration's `-m` metadata keys." It does not on
  CLI 54.12.2 — it prints the generic help. The keys come from the ERROR when you pass a wrong value.
- The rule implied a region could be chosen. It cannot be prompted for: the command provisions
  **silently in `us-east-1`**, which is how a staging database landed in Virginia against a Frankfurt
  production and a privacy policy claiming EU residency. Cost a delete-and-recreate.
- Nothing recorded that a **sensitive** Vercel variable reads back as `""`, so a round-trip cannot be
  verified by pulling. Proven by A/B on one variable, not assumed.

**The PRD's own spec was wrong once**, and the measurement won: W7 asked `verify-build-tier.mjs` to
assert "the other tier's origin is absent from `dist/`", which can never hold because `backendTarget.ts`
declares the production host as the constant the badge compares against. The shipped rule is asymmetric
and was proven in both directions by building each tier and verifying it as the other.

**41 re-break mutations across the PRD, each flipping its own test. Three guards were VACUOUS**, all one
shape — the forbidden token appearing in the guarded file's own user-facing string, where
comment-stripping does not help (`--yes` inside "Re-run with --yes", `taskkill` inside "Never taskkill
node"). Added to `re-break/SKILL.md`. **Two failures were the MUTATION's, not the test's**, which the
skill already warns about and which cost one wrong "vacuous" verdict before being caught.

**One rule was missing its inverse.** `auth.md` recorded that what sits ABOVE `AuthGate` runs before
login; it did not record that what sits BELOW it does not EXIST before login. The backend badge shipped
inside `<App />` and was therefore invisible on the lock screen. Added.

**Budget after this session's guardrail edits:** CLAUDE.md 11,993 / 12,000 · ALWAYS LOADED
16,489 / 17,000 · ONE COMPONENT EDIT 47,984 / 48,000. CLAUDE.md had **2 bytes** of headroom before the
new tier bullet; it was paid for by deleting the Update banner bullet (fully carried by
`adult-surface.md`) and trimming three others. `working-in-this-tree.md` sits at 4,496 / 4,500, so two
candidate items were cut rather than forced in — both files already explain themselves at the point of
use.
