---
name: plan-feature
description: >-
  Run a planning session that ends in one committed, self-contained PRD another session can implement
  without this conversation. Use when a change is too big for one session, needs owner decisions, or
  touches several areas at once — "plan X", "write a PRD for X", "let's design X before building it",
  or an explicit /plan-feature. It grounds the design in the real code (and in how comparable kids'
  apps solve it), asks the owner in rounds until nothing material is open, then writes the PRD in this
  repo's house skeleton, commits it doc-only and hands back a kickoff prompt. It writes NO product
  code. The other half is `/ship-prd`, which implements the result.
---

# Plan a feature: the session ends in a PRD, not in code

The deliverable is **one markdown file another session can execute cold** — no memory of this
conversation, no access to the owner mid-flight. Everything below exists to make that true.

## Gate zero — does this need a PRD at all?

A PRD costs a session to write and a session to read. Skip it, say so in one sentence, and just do the
work when the change fits one session and needs no owner decision. Write one when **two or more** hold:

- it touches three or more areas, or more than ~10 files
- it needs owner decisions that would be expensive to reverse (IA, pacing, what a child sees)
- it changes the progress schema, the reward economy, or anything in `src/config/progression.ts`
- it needs new baked art, new spoken lines (the 8-step prebake protocol), or re-shot screenshots
- it reverses an earlier PRD's decision — then it must say so, by name, in its header

If the owner asked for a PRD anyway, write it. Don't argue the gate twice.

## Phase 1 — ground it before proposing anything

Never design from memory of this codebase. Read the real thing first:

- the components and modules the change lands in — and their call sites, which are usually where the
  surprise is (a fourth header nobody listed, a game that renders its own variant)
- the `.claude/rules/` files that own those paths, plus anything in `plans/` this supersedes
- what already exists that the change can reuse — a shared primitive, an existing bus, an existing gate

For a UX or child-facing question, **research how comparable apps solve it** (Khan Academy Kids,
Lingokids, YouTube Kids, Duolingo ABC, NN/g's material on 3–8 year-olds) before offering shapes. The
best PRDs here quoted that research in §1. A probe that rate-limits or 403s is **UNKNOWN**, not a
finding.

State what you found in a few sentences — the cause, not a tour — then move to questions.

## Phase 2 — ask in rounds until nothing material is open

**Every question goes through `AskUserQuestion`; never ask in prose.** Options are real candidate
answers with your recommendation first and labelled as such, `multiSelect` when they aren't exclusive,
a `preview` when two options differ in *shape* rather than in words.

The tool takes 4 questions per call, so **keep calling it**. Batch the 4 most decision-changing gaps,
read the answers, and go again when:

- more than 4 were open to begin with
- an answer opened a new question (it usually does — pick the shape and the edge cases appear)
- an "Other" reply changed the shape of the task
- an answer contradicts something already in the repo or in an earlier PRD

**Do not stop at one batch.** Keep rounds going until every remaining unknown is one you could settle
with a stated assumption that the owner would not care about — then say the assumption in the PRD
rather than asking. A manufactured question is worse than none, but a wrong guess costs a whole
implementation session, so don't ration the rounds.

Record every answer in the PRD with its date, under a heading that says **do not re-litigate**. The
owner has reversed decisions before (account deletion, the number word "en"); when he does, the
reversal wins and the PRD says so in place, rather than being quietly rewritten to look consistent.

## Phase 3 — offer shapes, don't pick for him

Where the design has a real fork, put **2–3 named shapes** (A/B/C) to the owner with the trade-off each
one buys, your recommendation first. The owner picks; you write. This is the step that makes the rest
of the PRD writable as *decisions* instead of *options*.

## Phase 4 — write it

**Path:** `plans/<program>/tmp-prd-<program>-NN-<slug>.md`. The `tmp-prd-` prefix is the grep token 30
existing PRDs and several `.claude/rules/` cross-references use — keep it even though the files are
permanent. A brand-new program gets a new folder; number from `01`. New art gets a sibling
`plans/<program>/<area>-art-prompts.md` (see `.claude/rules/scene-assets.md`).

**Skeleton** — drop a section only when it is genuinely empty:

1. **Title + status block** — authored date, `**NOT implemented**`, and what it supersedes *by name and
   section*, plus what survives from that document unchanged.
2. **§1 Why** — the defect or the opportunity, in terms of what the child or the owner experiences.
   Cite measurements and the research; this is the section that stops the change being re-argued.
3. **§2 Decisions** — the owner's answers, dated, "do not re-litigate". Each one a claim, not a
   discussion.
4. **§3 What changes in code** — a table of file → change → new/edited/deleted. Include the call site
   nobody would look for.
5. **§4 The traps** — *the highest-value section in this repo.* Everything that would silently produce
   a wrong result: the prop that is the component's one dimension, the Safari 17 API, the green
   subject that needs a keying override, the overlay that needs `{ force: true }`, the `.js` extension
   a Vercel function needs. Write it as "read this before you write any of it".
6. **§5 What must NOT change** — the invariants the change is near but must not touch (never read the
   prompt word aloud, XP independent of difficulty, `rewardNumber()` never `globalLevel()`, no emoji,
   one audio at a time).
7. **§6 Work stages W0…Wn** — ordered, each independently shippable and green on its own, W0 being
   whatever everything else renders against (an asset, a type, a schema bump). One commit per stage.
8. **§7 Verification** — split by rung: what rung 1–2 can settle (`ui-screenshot`, `webkit.mjs`,
   `--audio-report`), **the new guards, each named, each to be re-broken with `/re-break`**, and what
   only the owner's iPad can settle at rung 3.
9. **§8 Out of scope** — the boundary, so the implementing session doesn't widen the job.
10. **§9 Kickoff prompt for a fresh session** — a blockquote of 2–5 lines: implement this file, read
    these rules first, this stage first and why, re-break every guard in §7, name the rung for every
    claim. This is what the owner pastes.

**The self-containment test before you commit:** could a session that has never seen this conversation
implement it without asking the owner anything? If an answer only exists in this chat, it belongs in
the file.

Write with the **Write/Edit tools, never a shell text pipeline** — every file here is Danish and a
PowerShell pipeline mojibakes every `æøå`.

## Phase 5 — close the session

- Check the Danish characters survived (`grep` for a known `æøå` line).
- Commit doc-only: `docs(prd): <the decision in a sentence>`. **Don't push** — master is the deploy
  trigger, and `git status`/`git log` first because another session may share this tree.
- Write a memory entry (`project_<slug>-prd.md`) saying **authored, NOT implemented**, plus its one-line
  pointer in `MEMORY.md`.
- Reply with the kickoff prompt and nothing else of length — house style.

## The boundary

A planning session writes the PRD, its art-prompt sibling and nothing else. If you find a live bug
while grounding, **say it and leave it** unless the owner asks for the fix; a fix mid-planning is how a
planning session turns into an unreviewed implementation session. Implementation is `/ship-prd`.
