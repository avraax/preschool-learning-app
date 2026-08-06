---
name: write-prompt
description: Turn a rough request into a finished prompt tuned for Opus 5 — asks only the questions needed to understand the intent, then emits one copy-pasteable prompt built from Anthropic's current Opus 5 guidance. Use on /write-prompt.
disable-model-invocation: true
argument-hint: "[the rough idea — omit to use the previous message]"
---

# /write-prompt

The user gives a rough intent; you hand back **one finished prompt**, optimised for Opus 5. Not a plan,
not an analysis of their wording, and not the task itself — the prompt is the deliverable.

Facts below come from the `claude-api` skill (`shared/model-migration.md` → *Migrating to Claude Opus 5*
and `shared/prompt-audit.md`). If a session needs to re-verify or the model has moved on, load that
skill rather than trusting this file.

## Step 1 — find only the gaps that change the prompt

Read `$ARGUMENTS` (or the preceding message) and check six slots:

**goal + why** · **the concrete ask** · **deliverable and where it lands** · **scope boundary**
· **definition of done** · **facts only the author knows** (device, audience, constraints, house rules).

Fill what you can from the conversation and the repo — a couple of read-only lookups are fine. Ask only
about a slot where two plausible answers would produce **materially different prompts**. Do not ask
about anything you can read, and never ask the user to confirm their own wording back.

## Step 2 — ask, in rounds, until nothing material is open

**Every question goes through AskUserQuestion** — never ask in prose. Options are real candidate answers
(your recommendation first, labelled), `multiSelect` when the choices aren't exclusive, a `preview` when
two options differ in shape rather than in words.

The tool takes 4 questions per call, so **keep calling it**: batch the 4 most decision-changing gaps,
read the answers, and if more than 4 were open — or an answer opened a new one, or an "Other" reply
changed the shape of the task — ask another round. Repeat until every remaining unknown is one you can
settle with a stated assumption. Don't ration the rounds; a wrong guess costs more than a question.
Only when nothing material is open, skip the tool and go straight to Step 3 — a manufactured question is
worse than none.

## Step 3 — build it

Emit one fenced block, in this order, dropping any part the task doesn't need:

1. **Goal and why it matters** — one or two sentences; Opus 5 uses intent to connect the task to context.
2. **The request** — outcomes and constraints, not a numbered procedure. Prescriptive step-by-step
   scaffolding *lowers* output quality on this model; keep numbered steps only where order is genuinely
   load-bearing (a destructive command, an auth flow, an 8-step protocol this repo already documents).
3. **Facts it can't infer** — paths, the target device, the audience, the quality bar. Context is never
   cruft; this is the part worth being long.
4. **Done means** — what must be true and how to check it, stated as a condition, not as an instruction
   to go verify.
5. **Out of scope** — the boundary, so it doesn't widen the job.

Then add each corrective **only when its trigger is present** — they are load-bearing on Opus 5:

| trigger in the task | line to add |
|---|---|
| answer is read by a person | keep it focused and brief; caveats short, the answer first |
| it writes files/docs | match deliverable length to the substance; no filler sections |
| easy to over-reach | deliver the asked scope; routine judgment calls yourself, ask only when readings diverge materially; finish the whole task and say plainly what's missing |
| harness has subagents | delegate rarely; never for work finishable in a few tool calls, never to verify; keep spawn counts low |
| user-facing product | only correct an earlier statement when the error changes the outcome |
| code review / bug hunt | report every finding with confidence + severity; filter downstream (a severity filter is followed literally and hides real bugs) |
| long-horizon autonomous run | full spec up front in one turn; effort `high`/`xhigh` |

## Never put these in the prompt

Each is actively harmful on Opus 5, not merely wasted tokens:

- `CRITICAL:` / `MUST` / `ALWAYS` / "if in doubt, use X" → say it once, plainly, with the reason.
- **"double-check / verify your work"** → **delete it.** Opus 5 verifies unprompted; asking makes it
  over-verify. This inverts the usual prompting advice, so say so if the user expects it.
- "think step by step", `<thinking>` tags, "plan before acting" → thinking is on by default.
- "be thorough / don't be lazy / don't stop early" → it is proactive by default.
- numeric caps ("under 120 words") and a single gold example → they freeze behaviour; ask for concision
  and give two or three varied examples if examples are needed at all.
- assistant prefill or "output ONLY valid JSON" scaffolding → structured outputs (`output_config.format`).
- lowering `effort` to shorten the answer → it doesn't work; prompt for concision instead.

## If the target is an API call, not a chat turn

Add the config alongside the prompt: `model: "claude-opus-5"`; thinking is **on by default** (omit it, or
`{type:"adaptive"}`) and `{type:"disabled"}` is a 400 above effort `high` — and disabling it can make a
tool call arrive as plain text that never runs; `temperature`/`top_p`/`top_k` are rejected; start effort
at `xhigh` for coding/agentic and `high` otherwise, then sweep down (`low`/`medium` are unusually strong);
`max_tokens` ≥ 64k at `xhigh`/`max`; check `stop_reason == "refusal"` before reading `content` and pass
`fallbacks: "default"`.

## Then stop

Under the block, three sentences at most: what you assumed, and which correctives you added and why —
CLAUDE.md house style, no headings, no recap. If the user says "run it", run the prompt you just wrote.
