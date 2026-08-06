# PRD Session-01 — The guardrail token budget

**Status:** authored 2026-08-06, NOT implemented.
**Scope:** `CLAUDE.md`, `.claude/rules/**`, `.claude/skills/**`, `.claude/agents/**`, the Vercel
plugin, two new measurement scripts, one build-failing guard, the existing statusline plus two hooks
(W7), and a periodic audit skill with its ledger (W8). **No app code, no tests of app behaviour, no
art, no narration.**

This PRD is self-contained: every number in it was measured in the authoring session and is
reproduced here, so an implementer starting cold does not need to re-derive anything.

---

## 1. The problem

Sessions in this repo feel heavy and slow. The owner named two specific symptoms — **long waits per
reply** and **too much preamble before real work starts** — and was explicit that output quality is
good and must not regress. This is therefore a latency-and-noise problem, not a cost problem, and
the plan is judged on those terms.

Two independent causes were found. They need different fixes and should not be conflated:

1. **Size.** The always-loaded instruction surface is large, and one rule's glob is wide enough that
   editing a single game component injects ~27,000 tokens of rules.
2. **Calibration.** The prose is written for a model that under-followed instructions. On Opus 5,
   several of those habits now cost quality instead of buying it.

## 2. What was measured

Environment: Claude Code **2.1.223**, model `claude-opus-5[1m]`. Evidence: `.claude/**` file sizes,
and the 104 session transcripts (743.3 MB) under
`~/.claude/projects/C--Source-preschool-learning-app/*.jsonl`.

**Token figures below are `chars ÷ 2.52`, and that divisor is MEASURED** (§2.7) — not the 3.7 this
PRD was first written with. Everything was ~1.47× understated in the first draft; the corrected
numbers make the case stronger, not weaker. The divisor still comes from a single mixed-content
sample, so **byte budgets are the thing to gate on** (deterministic, no divisor) and token figures
are for reporting only.

### 2.1 The startup baseline

Every session begins at **56,000–63,000 tokens before the first user request does anything.** First
API turn, four most recent sessions: 56,623 / 60,925 / 62,658 / 63,105.

A headless probe (§2.7) measures the baseline as **54,086 tokens**, reproducible to ±21 across runs.
Interactive sessions sit a little higher because of the plan-mode reminder and other per-session
attachments — compare like with like.

Of that baseline, **~21,400 tokens are ours**, i.e. **about 35%**:

| Loaded on every session, unconditionally | Bytes | ≈tokens |
|---|---:|---:|
| `CLAUDE.md` | 28,637 | 11,364 |
| `.claude/rules/animation-and-performance.md` — **has no `paths:` frontmatter** | 8,751 | 3,473 |
| Vercel plugin `SessionStart` hook (`inject-claude-md.mjs`, the knowledge-update text) | 7,812 | 3,100 |
| Vercel plugin's share of the skill listing (33 of 52 lines) | 8,819 | 3,500 |
| Remaining skill descriptions (19 lines, incl. our 4 = 1,886 B) | 7,539 | 2,991 |
| Vercel plugin `session-start-profiler.mjs` | 192 | 76 |

The remaining ~33,000 tokens are Claude Code's own system prompt and tool schemas. Not ours to cut.
MCP tool definitions are deferred by default, so the nine `claude.ai` MCP servers contribute names
only and are **out of scope** — they are not the problem.

`CLAUDE.md` was 28,165 B when this PRD was opened and 28,637 B a few hours later: **+472 B, ~187
tokens, in one working day.** That rate is the reason W4 exists.

### 2.2 Path-scoped rules work here. Glob width is the leak.

`.claude/rules/*.md` frontmatter `paths:` is a real, functioning Claude Code mechanism, and it works
on 2.1.223: the authoring session loaded `CLAUDE.md` and `animation-and-performance.md` and **none**
of the other 14 rules — 216 KB that stayed on disk.
[anthropics/claude-code#16299](https://github.com/anthropics/claude-code/issues/16299) (open,
reported 2026-01-05 against v2.0.76: path-scoped rules loading globally regardless of frontmatter,
28 rules loading where 5 should) is **not** biting us. Do not restructure around that bug.

So the architecture is right and two specific things are wrong:

- `animation-and-performance.md` is the **only** rule missing `paths:`, so 2,365 tokens of
  CSS-keyframe-vs-framer guidance load into every session about auth, narration or accounts.
- `audio-system.md` (36,782 B) and `responsive-design.md` (18,708 B) both claim
  `src/components/**/*.tsx`. Opening one game component therefore loads:

  | Rule | Bytes | ≈tokens |
  |---|---:|---:|
  | `audio-system.md` | 36,782 | 14,596 |
  | `games-catalog.md` | 24,509 | 9,726 |
  | `game-development.md` | 21,785 | 8,645 |
  | `responsive-design.md` | 18,708 | 7,424 |
  | **total for one component edit** | **101,784** | **≈40,400** |

  **Measured, not inferred:** a probe that reads `MathOperationGame.tsx` (35,380 B) goes from 54,107
  tokens on turn 1 to **108,546 on turn 2** — a **54,439-token step for opening one file**, which is
  those four rules plus the file itself. The rules are three-quarters of it. That is the "heavy"
  feeling, and it lands on the single most common edit in the repo.

### 2.3 One skill can dwarf all of it

Invoking the bundled `claude-api` skill during the authoring session added roughly **40,000 tokens
in one tool result** — more than half the startup baseline, in a single call. Our own
`ui-screenshot/SKILL.md` is **59,006 B (~16,000 tok)** in the body, against Anthropic's documented
≤500-line guidance, and every invocation pays it in full.

### 2.4 Where the tokens actually go

Opus 5 list rates: **$5/M input, $25/M output**; cache write ×1.25 = $6.25/M, cache read ×0.1 =
$0.50/M. Minimum cacheable prefix on Opus 5 is 512 tokens (halved from 1,024 on Opus 4.8). Cache
lifetime is 1 hour on a subscription, dropping to 5 minutes on usage credits.

**These figures are deduplicated by `message.id`** — see the trap in §2.7. The first draft of this
PRD double-counted by 1.6–2.05×, so its dollar figures were roughly twice reality.

| Session | turns | first ctx | max ctx | cache read | output | ≈token-equiv |
|---|---:|---:|---:|---:|---:|---:|
| `09b45e44` | 145 | 56,623 | 405,222 | 37,249,668 | 144,811 | ~$30 |
| `e5afa8cf` | 253 | 60,925 | 384,402 | 65,976,979 | 159,834 | ~$43 |
| `c1300c1e` | 21 | 62,658 | 185,512 | 2,817,283 | 31,880 | ~$3 |

**Cache read is 60–77% of the total** ($33 of $43 on `e5afa8cf`), and cache read = context size ×
turn count. The correction *strengthens* this conclusion even as it halves the totals. On a
subscription these are plan-usage equivalents at list price, not a bill.

A single measured turn is a useful anchor: the trivial `-p` probe cost **$0.34** for four output
tokens, because it still paid to establish a 54,086-token prefix. Almost all of that is prefix, not work.

The decisive consequence is latency, not money: **time-to-first-token scales with context length
even on a cache hit.** A session sitting at 400k tokens re-reads 400k every turn, which is exactly
the reported symptom.

### 2.5 The 1M context window is part of the cause

`opus[1m]` means nothing forces compaction. Sessions run to 355–405k and then re-read all of it,
every turn, for hours. A 200k-window model would have compacted and stayed fast. The large window
removed the forcing function that used to keep sessions lean, and `/clear` now has to replace it
deliberately. This is a habit change (§5.6), not a config change — and it is the largest single
cost lever available.

### 2.6 Which lever does what

Be honest about this when reporting progress; do not oversell the baseline cut.

| Work | Latency | Quality | Token cost |
|---|---|---|---|
| W1 baseline cut (~14.5k → ~7k) | small win on **every** turn | win — less noise competing with real rules | ~$1–2 per long session |
| W2 glob width (27.5k → <10k per component edit) | real win on game work | win | meaningful — keeps sessions off 400k, worth ~$10 on a long game session |
| W3 Opus-5 calibration | none | **the main quality item** | none |
| W4/W5 tooling | none | none — it stops regrowth | none |
| W6 `/clear` + subagent habits | largest win | win (less stale context) | **largest cost lever** |
| W7 statusline + `SessionEnd` report | indirect — makes W6 happen instead of hoping for it | none | indirect, and probably the best effort-to-effect ratio here |
| W8 periodic audit | none directly | **the only thing that stops model drift** | none directly — it is what keeps W1–W3 from being redone in a few months |

### 2.7 How to measure all of this autonomously

**`/context` is not needed and cannot be scripted** — it is an interactive TUI command, not a tool. A
headless run measures the same thing better, because it reports the *billed* numbers rather than a UI
rendering, and it needs no human in the loop:

```
claude -p "Reply with exactly: OK" --output-format json
```

The JSON carries everything this PRD gates on: `usage.input_tokens` +
`usage.cache_creation_input_tokens` + `usage.cache_read_input_tokens` = the context, plus
**`ttft_ms`** (time-to-first-token — the actual reported symptom, measured directly rather than
inferred), `total_cost_usd`, `duration_api_ms`, and `modelUsage` with the model and window size.

Two probes give both headline numbers:

| Probe | Prompt | Measures |
|---|---|---|
| **A — baseline** | `Reply with exactly: OK` | startup context, TTFT at rest |
| **B — component edit** | `Read src/components/math/MathOperationGame.tsx and then reply with exactly: DONE` | the rule-injection step, as turn 2 minus turn 1 |

Measured values at authoring time, as the before-picture: **A = 54,086 tokens, TTFT 5,640 ms, $0.34.
B = 54,107 → 108,546, i.e. a 54,439-token step, $0.89.**

**Five traps, all of which bit this PRD's own first draft.** Any script built here must handle them:

1. **The top-level `usage` in `-p` JSON is an aggregate across turns, not a context size.** Probe B's
   top-level total reads 162,653, which is turn 1 (54,107) plus turn 2 (108,546). Reporting it as a
   context size overstates by ~50%. Use the per-message `iterations[]` array, or read the transcript
   per turn.
2. **Transcripts contain duplicate records per assistant message** — 1.6× to 2.05× inflation on these
   files. **Dedupe by `message.id`.** Undeduped, `09b45e44` reads as 287 turns and 69.0M cache-read
   tokens; deduped it is 145 turns and 37.2M. Every per-turn and per-session total is wrong without
   this, and it is the single most important line in W5.
3. **Never measure a live session.** `e5afa8cf`'s raw cache-read total moved from 84.0M to 104.8M
   between two readings minutes apart, because it was still being written to. Skip files whose mtime
   is within the last few minutes.
4. **Headless ≠ interactive.** 54,086 headless against 56.6–63.1k interactive. Compare probe-to-probe,
   never probe-against-a-past-interactive-session.
5. **TTFT is noisy** — network and load move it. Run the probe 3–5× and take the median before
   claiming a latency win. A single reading proves nothing.

Cost of the method: about **$0.35–0.90 per probe run**, so a 5× median on both probes is ~$4. Cheap
for a number that currently gets guessed at. Pass `--no-session-persistence` so probe runs do not
litter the transcript directory (verify once — the transcript is not needed, since the JSON carries
the usage).

**What still needs the owner, and cannot be automated:** verification gate 6, the quality check.
Whether the right rules fired on a real task, and whether the reply is still short and plain, is a
judgement call. Everything numeric in this PRD is autonomous; that one is not.

## 3. Decisions already taken

Do not re-litigate these; the owner decided them during authoring.

1. **Appetite is "restructure, lose nothing."** Detail moves into path-scoped rules that load on
   demand. Deletion is reserved for content that is genuinely obsolete for Opus 5 (§5.3), and each
   such deletion must name the pattern it matches.
2. **The Vercel plugin gets disabled**, globally, and the few facts it carries that we actually rely
   on are folded into rules that already exist.
3. **The budget is enforced by a failing test**, in the same shape as `src/config/noEmoji.test.ts` —
   not an advisory script. Reason: `session-debrief` has been adding to these files for weeks, and
   without a mechanical gate W1–W3 regrow within a month.
4. **The "How to talk to the owner" block in `CLAUDE.md` stays verbatim and stays at the top**,
   including its dates. It is load-bearing, it was asked for three times, and shortening the
   surrounding file is precisely what will make it stick.

## 4. Invariants — what must survive

A guardrail exists because a mistake happened. These must still be in force after the rewrite, in
whatever file ends up owning them. Losing one of these means the PRD failed even if every byte
target is met.

- **All shipped audio is MP3.** Ogg silenced narration and SFX on the iPadOS 17.7 floor device twice.
- **Safari 17 is the API floor**; `content-visibility` is banned because it fails silently.
- **The `.ts`-vs-`.js` relative-import split**, and that "reaches a Vercel function" is transitive.
- **Never edit a file with a shell text pipeline** — PowerShell re-encoding mojibakes every `æøå`,
  and `node -e`/heredoc command-substitutes backticks and silently drops them.
- **Local green proves nothing about the deployed artifact.**
- **Another session may be working in this tree** — check `git log` as well as `git status`, never
  leave work staged, `master` is the deploy trigger.
- **`kidCollision`, never `closestCenter`**; a game that takes one gesture takes both.
- **The re-break discipline**: after fixing a bug, re-break the code and confirm *that* test flips.
  A test seeded with the wrong shape stays green while the product is broken.
- **A claim must name the verification rung it came from**; unverified is UNKNOWN, not broken.
- **`collectedFromLevel(level) = level - 1`**, never show `globalLevel()`, rewards only via ceremony.
- **No emoji ships in the UI**, allowlist empty.
- **No adaptive difficulty** — static, manual, defined once in `difficulty.ts`.

## 5. Work

### W0 — Build the probe. Do this first, and it needs no human input.

The calibration is already done: **2.52 chars/token, measured** (§2.7), and the before-picture is
recorded there. W0 is now about turning that one-off measurement into a repeatable script, so every
later gate is a number rather than a request for the owner to run `/context`.

1. Write **`scripts/baseline-probe.mjs`** (standalone `.mjs`, plain `node`). It shells out to
   `claude -p … --output-format json`, runs probe A and probe B from §2.7 **n times (default 5)**,
   and reports the **median** baseline tokens, rule-step tokens, TTFT and cost. Add
   `"probe": "node scripts/baseline-probe.mjs"` to `package.json`.
   Handle all five traps in §2.7 — in particular read `iterations[]`, not the top-level `usage`.
2. `--save <label>` writes the run to `plans/session-performance/probe-log.tsv`; `--compare <a> <b>`
   diffs two saved labels and exits non-zero if the baseline did not drop. That exit code is what
   makes W1.4 and the verification gates self-checking.
3. Run `node scripts/baseline-probe.mjs --save before` and confirm it reproduces §2.7's numbers
   within a few hundred tokens. If it does not, the probe is wrong, not the PRD.
4. Refine the divisor per content type if it turns out to matter: markdown prose, dense
   backtick-heavy rules and `.tsx` source do not tokenize alike, and 2.52 is a blend of all three.
   **Do not block on this** — every gate that matters is either measured tokens (the probe) or bytes
   (the guard). The divisor is for readable reporting only.
5. Optional, and the only step needing the owner: run `/usage` and press `w` to record the 7-day
   attribution per skill / subagent / plugin / MCP plus the `long context` and `cache misses`
   behaviour flags. Useful colour, not a gate. (Per-MCP attribution was overstated before 2.1.222;
   we are on 2.1.223, so the figures are trustworthy.)

### W1 — Reclaim the startup baseline (~14,500 → ~7,000 tokens)

**W1.1 — Add `paths:` to `animation-and-performance.md`.** The cheapest win in the PRD: 2,365 tokens
off every session, for a five-line edit. Scope it to what the rule actually governs:

```yaml
---
paths:
  - "src/theme/idleMotion.ts"
  - "src/theme/motion.ts"
  - "src/theme/idleMotionBudget.test.ts"
  - "src/theme/depth.ts"
  - "src/config/parallax.ts"
  - "src/config/perfProfile.ts"
  - "src/config/perfProfile.test.ts"
  - "src/components/common/scene/*.ts"
  - "src/components/common/scene/*.tsx"
  - "src/components/common/LivingCard.tsx"
  - "src/components/common/TactileTile.tsx"
---
```

Cross-check against the files the rule names in its own prose before finalising the list. Anything
the rule cites but the globs miss is a scoping bug.

**W1.2 — Disable the Vercel plugin.** Set `"vercel@claude-plugins-official": false` in
`~/.claude/settings.json`. Saves ~4,500 tok/session (2,110 hook + 2,384 skill descriptions), plus it
stops the unactionable "Vercel CLI is not installed" warning that fires every session.

Before flipping it, confirm each fact we rely on already lives in a rule. Expected state — verify,
don't assume:

| Fact | Should already be in |
|---|---|
| Deploy = push to `master`; Vercel auto-deploys | `CLAUDE.md` Commands, `pwa-and-device.md` |
| Caching / rewrite order, `no-store` on `/sounds` | `pwa-and-device.md` |
| `vercel env pull` destroys `.env.local` secrets; silent `--force` no-ops; `preview` needs an empty branch arg | `env-and-secrets.md` |
| Each `api/*.ts` compiles to a sibling `.js` and specifiers are not rewritten | `api-endpoints.md`, `CLAUDE.md` |
| Functions are a trust boundary — CORS, origin allow-list, rate limit, no error-detail leaks | `api-endpoints.md` |

Add anything missing to the owning rule *before* disabling. Note in the PRD that the plugin also
carried genuinely useful platform corrections (Fluid Compute, `vercel.ts`, function size/body
limits) — none of which this app uses, and none of which are worth 4,500 tokens a session. If a
future feature needs them, re-enable the plugin for that session.

**W1.3 — `CLAUDE.md`: 28,165 B → budget 12,000 B (~3,250 tok).** Anthropic's own guidance is "under
200 lines… only include things that apply broadly," and, verbatim: *"Bloated CLAUDE.md files cause
Claude to ignore your actual instructions."* At 192 lines we pass the line count and fail the intent
— the lines are extremely dense.

This is a **move**, not a delete. Route as follows:

- **"Verifying without the owner's iPad"** (the three rungs, `perf.mjs` vs `cdp.mjs --perf`,
  `recalcMsPerSec` vs `recalcPerSec`, `sweep.mjs --selftest`, the probe-defects-outnumbered-the-app
  lesson) → the `ui-screenshot` skill, which already owns the recipes. **Keep in `CLAUDE.md`:** one
  sentence naming the three rungs and the rule that a claim must name its rung, plus "unverified is
  UNKNOWN, not broken."
- **The Conventions bullets that are incident write-ups** — the PowerShell mojibake pipeline, the
  `node -e` backtick substitution, the five parallel-session hazards, LOCAL GREEN PROVES NOTHING,
  the external-probe-has-three-outcomes rule → new `.claude/rules/working-in-this-tree.md`. **Keep
  in `CLAUDE.md`:** the one-sentence rule for each (`Never edit a file with a shell text pipeline —
  use the Edit tool`), with the narrative in the rule.
  This rule is about *how to work*, not about a file path, so it cannot be usefully path-scoped.
  Two options, decide during implementation and record which: leave it unscoped and hold it under
  **4,000 B**, or scope it to nothing and reference it from `CLAUDE.md` so it loads on demand. Prefer
  the second unless the mistakes recur without it.
- **Key Architecture bullets that restate a rule they already point to** — collapse to the one
  sentence that would cause a mistake if absent, plus the pointer. The bullet's job is routing.
- **Prebaked-TTS paragraph, difficulty paragraph, SFX paragraph** — each is currently a
  mini-document. Reduce to the invariant plus the pointer; the detail is already in
  `audio-system.md` / `games-catalog.md`.

Keep, verbatim and first: the "How to talk to the owner" block.

**W1.4 — Verify, autonomously.** `node scripts/baseline-probe.mjs --save after-w1` then
`--compare before after-w1`. **Target: baseline ≤ 43,000 tokens** (from 54,086 — ours dropping from
~21,400 to ~10,400) and TTFT no worse on the 5-run median. No `/context`, no owner in the loop; the
script's exit code is the gate. If the number does not move, stop and find out why before starting
W2 — an assumption in §2.1 is then wrong.

### W2 — Fix glob width

**W2.1 — Split `audio-system.md` (36,782 B).** Narrow its `paths:` to the engine and config files it
documents: `SimplifiedAudioController.ts`, `SimplifiedAudioContext.tsx`, `useSimplifiedAudio.ts`,
`useSpeechInput.ts`, `ttsClient.ts`, `audioReadiness.ts`, `audioLiveness.ts`,
`AudioBlockedCue.tsx`, `sfxClient.ts`, `audioFormat.test.ts`. **Drop
`src/components/**/*.tsx` from it.**

Create `.claude/rules/audio-call-sites.md`, **budget 4,000 B**, owning `src/components/**/*.tsx`. It
carries only what a component author can get wrong:

- One audio at a time, new audio cancels current, **no queue**.
- Never route SFX through `SimplifiedAudioController`; `sfx` is a separate short channel.
- Never `await` narration inside a tap handler.
- Never `await` a padded prebaked clip to pace a sequence — use a fixed onset step.
- All shipped audio is MP3, never Ogg/Opus.
- `ctx.state === 'running'` is not liveness in either direction.
- Adding or changing any spoken line follows the 8-step protocol → pointer to `audio-system.md`.

Saves ~7,500 tok on every component edit. The deep engine detail is still one `Read` away when the
work is actually about audio.

**W2.2 — `responsive-design.md` (18,708 B).** Same shape. Keep the layout contract a component
author needs (full-viewport, no scroll, portrait and landscape, 44px targets, reserve the space
rather than tuning a percentage) under the component glob; move the measured-viewport tables and the
phone-compact derivations to `pwa-and-device.md` or a narrower scope. Target ≤6,000 B under the
component glob.

**W2.3 — Audit the remaining 13 rules for globs wider than their subject.** In particular
`games-catalog.md` (24,509 B) and `game-development.md` (21,785 B) both fire on all five section
directories. Ask of each: is this a *rule* (inject it) or a *reference* (let the model read it when
the task is about that game)? A per-game invariant catalogue is closer to a reference. Consider
scoping the catalogue per section, or converting it to a skill with one file per section.

Record the decision and the reason for each of the 15 rules in a table in this PRD, so the next
debrief does not redo the analysis.

### W3 — Opus-5-calibrate every rule, skill and agent

Covers all 15 rules, 4 skills, 3 agents, `CLAUDE.md`. **This is an audit that produces a report,
not a blanket rewrite.** Each finding names the pattern it matches and why that pattern is obsolete
for Opus 5; a finding that cannot be tied to one is not a finding, and an audit that finds nothing
should change nothing.

**W3.1 — Emphasis.** Opus 5 follows the system prompt closely. When many instructions are marked
critical the marker stops carrying information, and the prompt's register becomes the reply's
register — an anxious prompt produces a hedging model. Strip CAPS emphasis and
`NEVER`/`ALWAYS`/`MUST`/`IMPORTANT` **where no reason is attached**.

**Keep every prohibition that encodes a demonstrated failure**, each with its one-line *because* —
the §4 invariants all qualify. The rule survives; the volume drops. Concretely:
`**LOCAL GREEN PROVES NOTHING ABOUT THE DEPLOYED ARTIFACT.**` becomes `Local green proves nothing
about the deployed artifact — two outages in one session were correct in the tree and broken in what
Vercel shipped.` Same information, no shouting.

**W3.2 — Verification scaffolding.** Opus 5 verifies its own work unprompted; instructions telling
it to verify produce over-verification, and the documented fix is to **delete** them, not soften
them. Remove generic self-check prose ("double-check", "re-verify before responding").

Explicitly **not** in this category, and staying: the `re-break` skill, and the specific lesson that
a test seeded with the wrong *shape* stays green while the product is broken. That is a demonstrated
repeat failure with a concrete procedure, not scaffolding. Note the tension in the PRD so a future
session does not "helpfully" delete it.

**W3.3 — Delegation.** Opus 5 reaches for subagents *more* readily than 4.8 — the opposite of the
previous model. Remove any encouragement to delegate. The existing session-level "do not call the
AgentTool unless the user requested it" is already the right shape and stays. Do not add a
"delegate more" line to any rule.

**W3.4 — Archaeology.** Guardrail authority comes from the behaviour it prescribes, not the incident
that motivated it. Move dated narratives (`owner, 2026-08-03`, `PRD-07 cut multi-second clips…`,
`it happened twice in one session`) out of instruction bodies. Each rule keeps at most one trailing
*why* clause. Two exceptions, both deliberate: the "How to talk to the owner" dates (they *are* the
argument), and a date that distinguishes a live constraint from a dead one (iPadOS 17.7.11).

**W3.5 — Skills.** Anthropic's authoring rules: SKILL.md body **under 500 lines**; `description`
≤1,024 chars, third person, saying both what it does *and when* to use it; references **one level
deep** from SKILL.md; a table of contents in any reference file over 100 lines; no time-sensitive
content outside an "old patterns" section.

- `ui-screenshot/SKILL.md` **59,006 B → body ≤500 lines.** Move the rung table, the recipes, the DEV
  query params, the silence-vs-cancellation traps and the per-probe usage into one-level-deep
  `reference/*.md` siblings (`reference/rungs.md`, `reference/recipes.md`, `reference/probes.md`,
  `reference/dev-params.md`). The `.mjs` probes stay where they are — they are *executed*, not read,
  so they cost nothing until run. Make the execute-vs-read intent explicit for each.
- `re-break/SKILL.md` (10,938 B) and `debug-report/SKILL.md` (6,281 B) are within budget. Check
  descriptions only.
- `session-debrief` already has the `SKILL.md` + `reference.md` split — that is the pattern to copy.

**W3.6 — Agents.** The three agents total 10,486 B and cost one listing line each, so they are cheap.
Check accuracy rather than size: `audio-debug-expert` and `audio-consolidation-expert` predate the
Audio v2 rebuild (Azure sole provider, `ttsClient`, no permission modal) and may describe an
architecture that no longer exists. A subagent describing the old world is worse than no subagent.
Prune or delete; do not expand.

**W3.7 — The durable fix. This is the most important item in W3.** Update
`.claude/skills/session-debrief/SKILL.md` so the system cannot regrow:

- Before proposing additions, run `npm run context:check` and show the current budget.
- State the **byte and token impact** of every proposed item, per artifact.
- Every new rule needs a `paths:` block. No exceptions without a named reason.
- **A glob may not be wider than the rule's subject**, and `src/components/**/*.tsx` is reserved for
  rules under 6,000 B.
- Adding to `CLAUDE.md` requires removing something, or explaining why the budget should rise.
- Prefer a *pointer* in `CLAUDE.md` plus detail in a scoped rule, over prose in `CLAUDE.md`.
- Its existing "slimming an over-budget file" section is already close — extend it with these
  mechanics and with the Opus 5 calibration rules from W3.1–W3.4, so future debriefs write
  correctly-calibrated prose in the first place.

### W4 — `scripts/context-budget.mjs` + a build-failing guard

Standalone `.mjs` with no `.ts` imports, so plain `node scripts/context-budget.mjs` runs it without
the `--import ./scripts/js-to-ts-resolve.mjs` resolver. Add `"context:check": "node
scripts/context-budget.mjs"` to `package.json`.

**Report mode** (default) prints a table: for each of `CLAUDE.md`, `.claude/rules/*.md`,
`.claude/skills/*/SKILL.md` and siblings, `.claude/agents/*.md` — bytes, ≈tokens, whether a rule has
`paths:`, **how many repo files each glob actually matches**, SKILL.md body line count — then an
always-loaded total and a worst-case "one component edit" total.

**Guard mode** (`--check`, and the mode the test uses) exits non-zero when:

1. `CLAUDE.md` exceeds its byte budget (12,000 after W1.3).
2. Any `.claude/rules/*.md` lacks a `paths:` block. Allowlist with a **named reason per entry**, in
   the `noEmoji` style, and ideally empty. `working-in-this-tree.md` may be the one entry, in which
   case it also carries a 4,000 B cap.
3. Any rule's globs match more repo files than a declared ceiling.
4. Any rule over 6,000 B claims `src/components/**/*.tsx`.
5. Any `SKILL.md` body exceeds 500 lines.
6. Any skill `description` (+ `when_to_use`) exceeds 1,024 chars, or a `name` breaks the
   lowercase-hyphen rule.

Wire it as `src/config/contextBudget.test.ts` so `npm test` fails. Follow the house rules for
guards: **strip comments before matching source**, and keep the allowlist reasoned.

**Then re-break it**, per the `/re-break` skill — three separate breaks, each of which must turn
*this* test red and be reverted:

1. Delete the `paths:` block from a rule → rule 2 fires.
2. Widen a narrow rule's glob to `src/**/*.tsx` → rule 3 or 4 fires.
3. Append 5 KB of prose to `CLAUDE.md` → rule 1 fires.

A guard that stays green while the budget is blown is worse than no guard. Note the specific trap
that applies here: this guard reads its own inputs from `.claude/**`, so a test that asserts
"budget ≥ current size" moves with the thing it measures and passes vacuously. **Pin the numeric
budgets as literals in the test**, not derived from the files.

### W5 — `scripts/session-cost.mjs`

Parses `~/.claude/projects/C--Source-preschool-learning-app/*.jsonl`. Add
`"session:cost": "node scripts/session-cost.mjs"`.

Per session: API turn count, first-turn baseline, max context, cache-write / cache-read / output
totals, token-equivalent cost at Opus 5 list rates ($6.25/M write, $0.50/M read, $25/M output), the
context-growth curve, and — the most useful output — **the turns where a single tool result added
more than 10,000 tokens**, with the tool name. That list is how you find heavyweight skill loads and
the file reads that should have been delegated.

`--aggregate` mode: mean first-turn baseline and mean cache-read-per-turn across the last N
sessions, so W1–W3 can be proven against the next ten sessions rather than argued about.

Read `usage` off each assistant message: total context = `input_tokens +
cache_read_input_tokens + cache_creation_input_tokens`.

**Two mandatory correctness rules, both of which the first draft of this PRD got wrong** (§2.7):

- **Dedupe by `message.id` before summing anything.** These transcripts carry each assistant message
  1.6–2.05× over. Without this, every total is inflated by roughly double and the script confidently
  reports fiction. Assert it: a run whose raw row count equals its deduped count on these files is a
  sign the dedupe is not working.
- **Skip files modified in the last few minutes** — a live session's totals move while you read them.

Note in the script's header that `input_tokens` alone is the *uncached remainder*, not the prompt
size; reading it as the total under-reports by ~100×.

State plainly in the output that these are token-equivalent list-price figures, not a subscription
bill.

### W6 — Habits (documented, not enforced)

Short list, goes in `CLAUDE.md` only if it survives the byte budget; otherwise it lives here.

- **`/clear` between unrelated tasks.** The 1M window will not force it, and this is the largest
  cost lever available (§2.5, §2.6). `/rename` first if the session is worth resuming.
- **`/btw` for side questions** — the answer never enters conversation history.
- **`/context`** at the start of any session that feels heavy.
- **`/usage` + `w`** weekly: watch the attribution breakdown and the `long context` / `cache misses`
  behaviour flags.
- **Subagents for verbose reads** — but only when asked for; Opus 5 already over-delegates.
- **Compact instructions**: consider a `# Compact instructions` block so a compaction preserves the
  modified-file list and the test commands.

### W7 — Make the cost visible without spending tokens to do it

Three additions, all of which run **outside** the conversation and cost zero context. That constraint
is the whole point: a monitor that reports into the session spends tokens to measure tokens.

**What was rejected, and why** — so this isn't revisited:

- **A `PostToolUse` logging hook.** Hooks never see token counts. They get the tool's input and
  output, so at best they measure *bytes*; `usage` (cache read/write, context size) exists only in
  the API response, which already lands in the transcript. So a per-tool hook produces worse data
  than W5 already has, and pays a process spawn on every tool call — on Windows that is real latency
  added to the thing we are trying to speed up.
- **OpenTelemetry export.** The documented answer for per-user metrics, and correct for a team with
  a metrics backend. Overkill for one developer on one machine.

**W7.1 — Extend the existing statusline.** `~/.claude/statusline-command.sh` already exists and
already prints `N% used` from `context_window.used_percentage`. The defect is that **a percentage of
a 1M window is misleading**: 30% reads as comfortable and is 300,000 tokens re-read on every turn.
The threshold that matters is a latency threshold, not a window-capacity one.

Add, from the documented stdin schema:

| Field | Use |
|---|---|
| `context_window.total_input_tokens` | show **absolute tokens** next to the percentage — this is the number that predicts reply latency |
| `context_window.context_window_size` | 1,000,000 here; needed to show `230k / 1M` rather than a bare percentage |
| `exceeds_200k_tokens` | fixed 200k threshold regardless of window size — i.e. *"past where a 200k model would have compacted."* Colour the segment when true; that is the `/clear` nudge |
| `cost.total_cost_usd` | client-side session estimate, resets on `/clear` |
| `rate_limits.five_hour.used_percentage` | the number that actually matters on a subscription |

Colour bands tuned to latency, not to capacity: green under ~80k, yellow ~80–200k, red over 200k
(where `exceeds_200k_tokens` flips). Under the current script a 400k session shows "40% used" in
plain dim white, which is exactly backwards.

Constraints from the docs, all of which the current script already respects — do not break them:

- Updates are **debounced at 300ms** and an in-flight script is **cancelled** if a new update
  arrives. The script must stay fast. It already shells out to `node` plus up to three `git` calls;
  **do not add a transcript parse to the statusline.** That belongs in W5/W7.2.
- `used_percentage` is calculated from **input tokens only** (`input_tokens + cache_creation +
  cache_read`); it excludes `output_tokens`. If any figure is computed by hand, use the same formula
  or the two will disagree.
- `context_window.current_usage` is `null` before the first API call and again right after
  `/compact`. Guard for it — the existing script's null-handling for `used_percentage` is the pattern.
- Leave `refreshInterval` unset. The event-driven triggers are sufficient and a timer costs CPU for
  nothing here.

**W7.2 — A `SessionEnd` hook that writes the report to disk.** `SessionEnd` fires **once per
session** (matchers: `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`,
`other`), receives `transcript_path` and `session_id`, and — importantly — **cannot add content to
the conversation context**. It is documented as being for side effects: logging and cleanup. That is
exactly the right shape.

Wire it to run `scripts/session-cost.mjs` against the supplied `transcript_path` and append one line
per session to `plans/session-performance/session-log.tsv` (gitignored, or committed if the trend is
worth keeping): timestamp, session id, turns, first-turn baseline, max context, cache read, cost
estimate, and the count of >10k-token turns. Zero context cost, zero per-turn overhead, and the
`--aggregate` comparison in W5 gets its data without anyone remembering to run anything.

Keep the hook cheap and non-blocking, and let it fail silently — a session ending must never hang on
a monitor.

**W7.3 — `InstructionsLoaded`, to verify the glob work empirically.** There is a hook event that
fires **when a `CLAUDE.md` or `.claude/rules/*.md` file is loaded**. This is the authoritative answer
to "did my `paths:` scoping actually work", and it beats reasoning about globs or inferring from
transcripts.

Use it as a **temporary instrument**, not a permanent fixture: enable it, run one session per work
area (a game component edit, an audio change, an auth change, a docs-only session), log which rule
files loaded and their sizes, confirm W1.1 and W2 did what they were supposed to, then remove the
hook. If it proves useful enough to keep, it must stay silent-on-success and write to disk only.

This also gives W4's guard a real cross-check: the guard counts what the globs *should* match;
`InstructionsLoaded` records what actually loaded. If those two ever disagree, trust the hook.

**W7.4 — Everything in W7 lives in `~/.claude/`, outside the repo.** The statusline script and the
hook block are therefore not covered by the W4 guard, not versioned with the project, and lost on a
new machine. Paste the final versions of both into an appendix of this PRD so they can be rebuilt,
and note that `settings.local.json` currently sets `"defaultMode": "bypassPermissions"`, which makes
the `permissions.allow` list in `.claude/settings.json` largely redundant — worth tidying while in
there, but it is not a performance item and must not be bundled into a claim about token savings.

### W8 — Keep it from happening again

W3.7 stops *silent* regrowth: the W4 guard fails the build when a file exceeds its budget. But a
guard only enforces a number. It cannot notice that a rule became **wrong**, that a skill nobody
triggers should be deleted, or that a new model release inverted the advice a rule encodes. Those are
exactly what rotted this time, and none of them trip a byte limit. Without W8 this PRD gets rewritten
in a few months.

Three decay modes, three different answers:

| Decay | Detected by | Fix |
|---|---|---|
| **Size creep** — files grow | W4 guard, mechanically | already solved |
| **Staleness** — a rule describes behaviour that no longer exists; a skill never fires | nothing today; detectable from `InstructionsLoaded` logs + `/usage` attribution | W8.2 |
| **Model drift** — guidance written for an older model becomes a liability | nothing local can see it | W8.3, and it needs the official docs |

Model drift is the expensive one and the reason W3 exists at all. Anthropic's own guidance is
explicit: prompts are per-model artifacts, re-audit at **every model release**, and each migration
section doubles as a removal checklist.

**W8.1 — A separate `/guardrail-audit` skill.** New `.claude/skills/guardrail-audit/SKILL.md`.
Deliberately **not** folded into `session-debrief`: debrief runs at the end of most sessions, so it
must stay cheap, and making the most frequently-invoked skill the most expensive one is the exact
pattern this PRD removes. Debrief captures what we learned; audit periodically re-examines whether
what we captured is still true.

`description` (third person, what + when, ≤1,024 chars) should trigger on: a new Claude model or a
Claude Code version jump, "sessions feel heavy again", "audit the guardrails", "are our rules still
current", or an explicit `/guardrail-audit`. Body ≤500 lines with the doc-fact tables in
`reference/*.md` — the skill must obey the rules it enforces.

Workflow:

1. **Read the ledger** (W8.4) — last audit date, model, Claude Code version, and the doc facts that
   audit relied on. The point is to *diff*, not to re-derive from scratch every time.
2. **Numbers.** `npm run context:check`, plus `node scripts/session-cost.mjs --aggregate` for the
   trend since the last audit.
3. **Staleness** (W8.2).
4. **Docs** (W8.3).
5. **Findings.** Use the `shared/prompt-audit.md` rubric: each finding names the pattern it matches,
   why it is obsolete for the *current* model, and a confidence level; high/medium confidence get a
   concrete proposed edit, low confidence is flagged only. Load-bearing content — the §4 invariants,
   prohibitions against demonstrated failures, fragile exact-sequence instructions — is on the
   keep-list and is not a finding.
6. **Propose grouped by area, wait for confirmation**, exactly as `session-debrief` principle #4
   requires. Nothing under `.claude/**` or `CLAUDE.md` changes without the owner's yes.
7. **Apply confirmed items, then update the ledger** — including what was *rejected* and why.

**An audit that finds nothing must change nothing.** State this in the skill body as a rule, because
the failure mode of any recurring review is becoming a ritual that edits files to justify having run.
"Clean, no changes, here are the numbers" is a successful audit.

**W8.2 — Staleness signals, from data we already collect.** Over the sessions since the last audit:

- Which `.claude/rules/*.md` files loaded at all (W7.3's `InstructionsLoaded` log)?
- Which skills and subagents were invoked (`/usage` attribution, 7-day view)?

A rule that never loaded in ~30 sessions is **either dead or mis-scoped, and those need opposite
fixes.** Check the glob before concluding anything — `animation-and-performance.md` was the inverse
case (loading always, when it should have loaded rarely), and a rule that never loads is the same bug
mirrored. Only after confirming the scope is right does "never fires" mean "delete it". Never delete
a rule on the strength of the counter alone.

Same test for subagents: `audio-debug-expert` and `audio-consolidation-expert` are already suspected
of describing a pre-Audio-v2 world (W3.6). If the counter says they have never been invoked, that is
the evidence to act on.

**W8.3 — Fetch the official docs each audit.** Working from what we already wrote down cannot catch
model drift by construction — that is precisely what went undetected until this session. Each audit
WebFetches and diffs against our guardrails:

| Page | What to check for |
|---|---|
| `code.claude.com/docs/en/best-practices` | CLAUDE.md content guidance, context-management features, new failure patterns |
| `code.claude.com/docs/en/costs` | new inspection commands, caching behaviour, attribution changes |
| `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices` | body/description limits, disclosure patterns |
| `claude-api` skill → `shared/prompt-audit.md` | the current cruft-vs-load-bearing rubric |
| `claude-api` skill → `shared/model-migration.md`, the section for the **current** model | behavioural shifts; each migration checklist is also a removal checklist |
| `code.claude.com/docs/en/statusline`, `/hooks` | new fields or events worth using (this is how W7.3 was found) |

Record the date and the specific facts relied on, so the next audit diffs against them.

Two traps, both of which this repo has been bitten by. A probe of an external service has **three**
outcomes — a rate-limited or partial doc fetch is UNKNOWN, not "unchanged", and must not silently
become a clean bill of health. And Anthropic's docs describe the general case; where a house rule
contradicts them for a measured, recorded reason, **the house rule wins** — the audit's job is to
notice the contradiction and ask, not to defer to the newer document.

**W8.4 — The audit ledger.** `plans/session-performance/audit-ledger.md`, committed, append-only.
One entry per audit: date, Claude Code version, model, the measured baseline, the doc facts relied on
with their date, findings applied, and **findings rejected with the reason**. That last column is
what stops the next audit re-litigating a decision the owner already made — the same job this PRD's
§3 does for the Vercel plugin and the failing test.

**W8.5 — `session-debrief` gains a handoff, not a second job.** Add to its workflow: read the ledger
and, if the model or Claude Code version has changed since the last audit, or more than ~20 sessions
have passed, say so in one line and offer `/guardrail-audit`. It does not run the audit itself. This
is the only nag in the system, and it is one sentence at the end of a session.

**Honest caveat.** W8 is the item most likely to be quietly skipped, because its payoff is invisible
when it works — a clean audit produces no diff. The ledger is what makes it visible: a gap in it is
the signal that the practice lapsed.

## 6. Verification

1. **`node scripts/baseline-probe.mjs --compare before after`.** Baseline **≤43,000 tokens** (from
   54,086) on a 5-run median, TTFT no worse. Primary success criterion, autonomous, exit-code gated.
2. **Probe B in the same run.** The turn-1→turn-2 step must fall **below 28,000 tokens** (from
   54,439) — the file itself is ~14,000 of that and does not change, so this is the rules going from
   ~40,400 to under ~14,000. Cross-check with `InstructionsLoaded` (W7.3), which names the files
   rather than inferring from a delta.
3. **`npm test` green.** Then the three re-breaks in W4, each turning the specific test red.
4. **`npm run build` and `npm run lint` clean.** No app behaviour changes, so this is a regression
   check on the new `.mjs` + test files and on the `.ts`-vs-`.js` extension convention only. Run
   each plain-node entry point (`npm test`, `dev:api`, `tts:*`, `audit:*`) if any shared module was
   touched — the extension hazard is transitive.
5. **`node scripts/session-cost.mjs --aggregate`** over the next ten sessions: mean first-turn
   baseline and mean cache-read-per-turn both visibly below the §2.4 table.
6. **The quality gate, which can veto the whole PRD.** Run one real task in each of two areas — a
   game tweak and an audio change — and confirm the output is still right: the rules that matter
   still fire, the invariants in §4 are still respected, and the reply is still short and plain. If
   quality drops, W3.1 went too far. **Restore emphasis on the specific rule that got ignored, not
   on everything** — a blanket revert loses the whole gain.
7. **W7 checks.** The statusline shows absolute tokens and changes colour past 200k — verify by
   letting a session grow, not by reasoning about it. `SessionEnd` appends exactly one line per
   session to the log, and ending a session is not measurably slower. `InstructionsLoaded` confirms
   that a docs-only session loads no game or audio rules, and that a game-component session loads
   `audio-call-sites.md` rather than `audio-system.md` — that pair is the direct proof W2 worked.
8. **W8 dry run.** Invoke `/guardrail-audit` immediately after W1–W7 land. It should report a clean
   surface and **propose no changes** — everything it would find was just fixed. If it proposes a pile
   of edits, the skill is a ritual rather than an audit and needs the "finds nothing → changes
   nothing" rule made harder. Then write the first ledger entry, which doubles as the after-picture
   for gate 1.
9. Confirm `git status` is clean at the end and that nothing was left staged.

## 7. Out of scope

App code, tests of app behaviour, art, narration, difficulty tuning. The nine `claude.ai` MCP
servers — their tool definitions are deferred and cost names only. Claude Code's own ~40,000 tokens
of system prompt and tool schemas. Agent teams (disabled by default; ~7× tokens). Restructuring
around issue #16299, which does not affect 2.1.223.

## 8. Sources

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) — CLAUDE.md
  content table, the 200-line target, `/context` to verify, the failure patterns.
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — `/usage` attribution and
  behaviour flags, cache lifetime, move-instructions-to-skills, why usage climbs in a long session.
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  — the 500-line body limit, progressive disclosure, one-level-deep references, description rules,
  degrees of freedom.
- `claude-api` skill, `shared/prompt-audit.md` — the emphasis / scaffolding / fossil / archaeology
  patterns and the keep-list.
- `claude-api` skill, `shared/model-migration.md` → *Migrating to Claude Opus 5* — over-verification,
  increased delegation, verbosity, pricing, the 512-token cache minimum.
- [Customize your status line](https://code.claude.com/docs/en/statusline) — the full stdin schema
  (`context_window.*`, `exceeds_200k_tokens`, `cost.*`, `rate_limits.*`), the 300ms debounce and
  in-flight cancellation, and the note that `used_percentage` is input-only.
- [Hooks reference](https://code.claude.com/docs/en/hooks) — the event list and firing frequency.
  `SessionEnd` is once per session with no context-addition capability; `InstructionsLoaded` fires
  when a `CLAUDE.md` or `.claude/rules/*.md` file loads; `Stop` is once per *turn*, which is why it
  is the wrong choice for a session report.
- [anthropics/claude-code#16299](https://github.com/anthropics/claude-code/issues/16299) — the
  path-scoping bug that does *not* apply to us.

---

## Kickoff prompt

> Implement `plans/session-performance/tmp-prd-session-01-guardrail-budget.md`, W0 through W8, in
> order. Verify each numeric gate yourself with `scripts/baseline-probe.mjs` rather than asking me to
> run `/context`, and show me the diff for each work item before applying it.

W1.4 is still a hard checkpoint, but it no longer needs the owner: the probe's `--compare` exit code
is the gate, so the session stops itself if the baseline did not move. The only gate that genuinely
requires the owner is verification 6, the quality check.
