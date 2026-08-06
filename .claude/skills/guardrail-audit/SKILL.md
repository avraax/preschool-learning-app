---
name: guardrail-audit
description: >-
  Periodically re-examines whether this repo's Claude guardrails are still TRUE — CLAUDE.md,
  .claude/rules, .claude/skills, .claude/agents — rather than merely inside their byte budget. Checks
  the measured context numbers, finds rules that describe behaviour that no longer exists or never
  load, and diffs our guidance against the current official Claude Code and skill-authoring docs.
when_to_use: >-
  Run on a new Claude model or a Claude Code version jump, when "sessions feel heavy again", when
  asked "are our rules still current" or "audit the guardrails", or on an explicit /guardrail-audit.
  Also when `session-debrief` reports that the audit ledger is stale. NOT for capturing what a session
  learned — that is `session-debrief`.
---

# Guardrail audit

`session-debrief` captures what we learned. This audit periodically re-examines whether what we
captured is **still true**. They are separate on purpose: debrief runs at the end of most sessions and
must stay cheap, and making the most frequently invoked skill the most expensive one is the exact
pattern PRD session-01 removed.

The `src/config/contextBudget.test.ts` guard already handles one decay mode. This skill exists for the
two it cannot see:

| decay | detected by | handled in |
|---|---|---|
| **size creep** — files grow | the guard, mechanically | already solved, nothing to do here |
| **staleness** — a rule describes behaviour that no longer exists; a skill never fires | nothing automatic | step 3 |
| **model drift** — guidance written for an older model becomes a liability | nothing local can see it | step 4 |

**An audit that finds nothing must change nothing.** The failure mode of any recurring review is
becoming a ritual that edits files to justify having run. "Clean, no changes, here are the numbers" is
a successful audit and the expected result most of the time.

## Workflow

**1. Read the ledger.** `plans/session-performance/audit-ledger.md` — last audit date, Claude Code
version, model, the measured baseline, and the doc facts that audit relied on. The point is to *diff*,
not to re-derive from scratch. Note especially the **rejected** findings: those are decisions the owner
already made, and re-proposing one is the thing the ledger exists to prevent.

**2. Numbers.**

```
npm run context:check                      # the byte/token surface, and whether anything is over
node scripts/session-cost.mjs --aggregate  # the trend since the last audit
node scripts/baseline-probe.mjs --n 5 --save audit-<date>   # ~$4, only if the numbers look wrong
```

Compare against the ledger's last row. `context:check` being green means nothing grew past a budget;
it does **not** mean the content is still correct.

**3. Staleness.** Two signals, and they need opposite fixes, so never act on a counter alone:

- **Which rules actually loaded.** Re-enable the `InstructionsLoaded` hook (the block is commented in
  `scripts/hooks/instructions-loaded-log.mjs`), run one session per work area, then take it out again.
- **Which skills and subagents were invoked** — `/usage`, 7-day view, the attribution breakdown.

A rule that never loaded in ~30 sessions is **either dead or mis-scoped**. Check the glob before
concluding anything: `animation-and-performance.md` was the inverse case — loading always when it
should have loaded rarely — and a rule that never loads is the same bug mirrored. Only once the scope
is confirmed right does "never fires" mean "delete it".

**4. Docs.** Working from what we already wrote down cannot catch model drift by construction — that is
precisely what went undetected until PRD session-01. WebFetch and diff:

| page | check for |
|---|---|
| `code.claude.com/docs/en/best-practices` | CLAUDE.md content guidance, context-management features, new failure patterns |
| `code.claude.com/docs/en/costs` | new inspection commands, caching behaviour, attribution changes |
| `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices` | body/description limits, disclosure patterns |
| `code.claude.com/docs/en/statusline`, `/hooks` | new fields or events worth using — this is how `InstructionsLoaded` was found |
| `claude-api` skill → `shared/prompt-audit.md` | the current cruft-vs-load-bearing rubric |
| `claude-api` skill → `shared/model-migration.md`, section for the **current** model | behavioural shifts; each migration checklist doubles as a removal checklist |

Two traps this repo has been bitten by:

- **A probe of an external service has three outcomes.** A rate-limited or partial doc fetch is
  UNKNOWN, not "unchanged", and must not silently become a clean bill of health.
- **Where a house rule contradicts the docs for a measured, recorded reason, the house rule wins.** The
  audit's job is to notice the contradiction and ask, not to defer to the newer document.

Note the cost: loading the `claude-api` skill was **measured at +243,757 tokens in a single turn**. Load
it deliberately, once, and preferably in a session you are about to end.

**5. Findings.** Each names the pattern it matches, why it is obsolete for the *current* model, and a
confidence level. High and medium confidence get a concrete proposed edit; low confidence is flagged
only. A finding that cannot be tied to a named pattern is not a finding.

**On the keep-list, never a finding:** the invariants in PRD session-01 §4, any prohibition encoding a
demonstrated failure (with its one-line *because*), fragile exact-sequence instructions, the `/re-break`
discipline, and the "How to talk to the owner" block in `CLAUDE.md` — which stays verbatim, first, and
with its dates.

**6. Propose grouped by area, then wait.** CLAUDE.md · Rules · Skills · Subagents, each item as
*what → where → why → bytes*. Nothing under `.claude/**` or `CLAUDE.md` changes without the owner's
yes; they may accept a subset.

**7. Apply the confirmed items, then append a ledger entry** — including what was **rejected and why**.
Re-run `npm run context:check` and put the after-number in the entry.

## Honest caveat

This is the item most likely to be quietly skipped, because its payoff is invisible when it works: a
clean audit produces no diff. The ledger is what makes it visible — a gap in it is the signal that the
practice lapsed.
