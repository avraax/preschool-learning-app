---
name: session-debrief
description: >-
  Capture durable knowledge and maintain this repo's Claude guardrails — CLAUDE.md, .claude/rules,
  .claude/skills, and .claude/agents. Use to debrief at the end of a substantial piece of work and
  record what was learned, when the same context keeps getting re-derived across sessions, or when
  asked to create, update, or prune a rule, skill, or subagent. Keeps guardrails high-level and
  low-maintenance so future sessions start informed instead of relearning the codebase.
when_to_use: >-
  Triggers: "debrief", "capture what we learned", "turn this into a rule/guardrail", "create/update a
  skill", "create/update an agent/subagent", "document how X works so you don't redo it", "clean up
  the .claude rules". Offer it proactively after finishing a non-trivial task that produced reusable
  knowledge.
---

# Guardrails — build & maintain the `.claude` knowledge system

**Mission:** so a future session (me) starts already knowing how this app is built and how to work in
it — instead of re-deriving it. This skill captures durable knowledge into the right artifact and
keeps the existing guardrails accurate. It is the maintainer of CLAUDE.md, `.claude/rules/`,
`.claude/skills/`, and `.claude/agents/`.

## Core principles (these are the point — honor them every time)

1. **Durable, not volatile.** Keep principles, non-obvious gotchas (and the fix), and *greppable
   pointers* to code (file paths, helper/function names). Leave OUT anything that drifts with normal
   tuning — counts, thresholds, per-item config, sizes, sample values. If it needs updating every
   time we tweak a feature, it does not belong in a guardrail; it belongs in the code's own comments.
   **Prune test** for any line: *would removing it make me make a mistake?* If not, cut it — bloat
   makes the real rules get ignored.
2. **High-level but still useful to me.** Enough to stop the mistake and route me to the code — not a
   spec I must keep in sync. Be concrete enough to verify — name the file, command, or pattern
   (`src/…`, `npm run …`), never vague ("organize well"). When in doubt, fewer words.
3. **No duplication or contradiction.** Read what already exists first; extend it rather than adding a
   second source of truth. If new work contradicts a current guardrail, the guardrail is now wrong —
   fix it.
4. **Propose before writing — always wait for confirmation.** Present the full proposal first,
   **grouped by area** (CLAUDE.md · Rules · Skills · Subagents), each item as *what → where → why*
   with a one-line preview of the change. Do NOT write to `.claude/**` or CLAUDE.md until the user
   confirms; they may accept a subset. Nothing is a shared, durable action taken behind their back.
5. **Flag divergences.** If a change we made diverges from what CLAUDE.md or a rule currently states,
   call it out explicitly and confirm before rewriting maintained prose.

## Workflow

1. **Extract.** From the session, list what's worth keeping: conventions established, gotchas that bit
   us + the fix, how to verify this class of change, any "never X / always Y". Discard one-offs and
   anything already recorded. Strong signals it's worth capturing: we hit the same mistake twice, a
   review caught something I should've known about this codebase, or I retyped a correction from a
   prior session.
2. **Filter** each item through principle #1 (durable vs volatile).
3. **Survey** the existing guardrails: skim `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`,
   `.claude/agents/` so you extend, don't duplicate or contradict.
4. **Route** each surviving item to the right artifact (see below).
5. **Propose, grouped by area** (CLAUDE.md · Rules · Skills · Subagents) — see principle #4. Wait for
   the user to confirm which items to apply.
6. **Apply** only the confirmed items, then **validate** (see "After writing").

## Choosing the artifact

| Put it in… | When the knowledge is… |
|---|---|
| **CLAUDE.md** (Key Architecture / a section line) | An always-relevant *fact* or convention every session should know — commands, conventions, project-specific architecture *rationale*, gotchas. Capture the *why*, not a file map/ToC (Claude derives the *where*). Always-loaded — keep it terse (~200 lines; offload detail to a rule or skill when it bloats). |
| **`.claude/rules/<topic>.md`** | A *class of gotcha* or mandatory convention for a subsystem — worth a page, not worth loading every turn. Add a one-line pointer to it from CLAUDE.md's Key Architecture list (mirror the Audio/Games/Layout/Drag bullets). |
| **`.claude/skills/<name>/SKILL.md`** | A *procedure / workflow / checklist* I should run on demand or auto-invoke (verifying UI, a release flow, this debrief). Lean body + supporting files. |
| **`.claude/agents/<name>.md`** | A *recurring, self-contained job* best done in isolated context with scoped tools/model (focused review, high-volume research). Give it `memory:` if it should accumulate knowledge across sessions. |

Rule of thumb: **fact → CLAUDE.md; convention/gotcha → rule; thing-to-run → skill; thing-to-delegate → subagent.**

## Maintaining existing guardrails (not just creating)

- When behavior changes, update the rule/CLAUDE.md line that described the old behavior in the same
  session — stale guardrails are worse than none.
- Prune guardrails that are now wrong, redundant, or never triggered.
- Revisit after major model releases — a rule that only worked around an older model's limits may now
  be pure overhead; delete it.
- Keep the CLAUDE.md rule-pointer list in sync when you add/remove a rule.

## Authoring correctly

Before writing or editing any CLAUDE.md, SKILL.md, or subagent file, **read `reference.md`** in this
skill folder — it has the official CLAUDE.md authoring rules plus the exact frontmatter fields,
constraints, and minimal examples for skills/subagents. The essentials:

- A skill lives at `.claude/skills/<folder>/SKILL.md`; the **folder name is the `/command`** (the
  `name` field is display-only). Keep the body lean and push detail into sibling files.
- `description` (+ `when_to_use`) is what makes me auto-invoke it — lead with the use case, use
  natural trigger phrases, keep the pair ≤1536 chars.
- A subagent lives at `.claude/agents/<name>.md`; **`name` and `description` are required**; scope
  `tools` and pick `model` deliberately; add `memory:` for cross-session learning.
- Match the house style of the existing files in each folder.

## After writing

- Confirm a new/edited skill shows in `/skills` (or "what skills are available?") and a subagent in
  the agent list; if it doesn't, check the YAML frontmatter parses.
- Sanity-check the `description` actually reads like the moment it should trigger.
- Report what changed and where, and note anything left for the user to ratify.
