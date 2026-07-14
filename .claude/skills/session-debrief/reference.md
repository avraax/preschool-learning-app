# Authoring reference — CLAUDE.md, Skills & Subagents

Distilled from the official Claude Code docs — verify against them if something looks off:
- Memory / CLAUDE.md: https://code.claude.com/docs/en/memory.md
- Best practices: https://code.claude.com/docs/en/best-practices.md
- Large codebases: https://code.claude.com/docs/en/large-codebases.md
- Skills: https://code.claude.com/docs/en/skills.md
- Subagents: https://code.claude.com/docs/en/sub-agents.md

Only the fields/rules commonly needed here are listed; the docs cover more.

---

## CLAUDE.md — always-loaded project memory

**Layout & precedence** (all concatenated, most-specific wins): managed policy → user
`~/.claude/CLAUDE.md` → project `./CLAUDE.md` (or `.claude/CLAUDE.md`) → `./CLAUDE.local.md`
(gitignored, personal) → subdirectory CLAUDE.md (loaded on demand when Claude reads files there).

**`@path` imports** — `@path/to/file` expands that file into context at launch (relative paths
resolve against the importing file). Recursion allowed, **max depth 4**. A path in backticks or a
code block is NOT imported. Splitting into imports aids organization but does NOT reduce token cost.

**Include** (things Claude can't infer): non-guessable commands, code-style rules that differ from
defaults, test instructions, repo etiquette (branch/PR conventions), project-specific architecture
decisions, env quirks, non-obvious gotchas.
**Exclude**: anything derivable from reading code (incl. directory layouts / file maps / dependency
lists / architecture *overviews* — `/doctor` proposes trimming these), standard language conventions,
detailed API docs (link instead), frequently-changing info, file-by-file descriptions, self-evident
advice. Keep the *why* (rationale, gotchas, conventions differing from defaults), not the *where*.

**Authoring rules**
- **Prune test**: for each line, "would removing it make Claude make a mistake?" If not, cut it —
  bloat makes real instructions get ignored.
- **Target ~200 lines.** Beyond that, move detail into `.claude/rules/` (path-scoped) or a skill
  (loads on demand); in monorepos prefer per-directory CLAUDE.md files.
- **Be specific & verifiable** — "Run `npm test` before committing", "handlers live in `src/api/`" —
  not "test your changes" / "keep files organized".
- Structure with headers + bullets; no duplication (don't repeat an `@import`ed file's content).
- `<!-- … -->` HTML comments are stripped before injection → free maintainer notes.
- Maintain it: prune stale/conflicting lines; revisit after major model releases; `/doctor` proposes
  trims of derivable content; `/init` seeds a baseline, `/memory` opens loaded files.
- **Navigation is not CLAUDE.md's job** — don't add a table of contents / index / file map (bloats +
  goes stale). Help the agent locate things via code-intelligence plugins (language server),
  subagents for exploration, and `@file` references in prompts.

---

## Skill — `.claude/skills/<folder>/SKILL.md`

**Layout & discovery**
- Project skill: `.claude/skills/<folder>/SKILL.md`. Personal (all projects): `~/.claude/skills/<folder>/SKILL.md`.
- **The folder name is the `/command`.** The frontmatter `name` is display-only (default: folder name).
- Sibling files (`reference.md`, `examples.md`, `scripts/…`) are **loaded only when referenced** — progressive disclosure. Keep `SKILL.md` under ~500 lines.
- At session start Claude loads only each skill's **description**; the body loads on invocation and stays for the session.
- Precedence on name collision: enterprise > personal > project > plugin.

**Frontmatter (all optional; `description` strongly recommended)**

| Field | Notes |
|---|---|
| `name` | Display name in listings. Kebab-case. Not the command (folder is). |
| `description` | Drives auto-invocation. Lead with the use case; natural trigger phrases. Combined with `when_to_use`, capped at **1,536 chars**. If omitted, first paragraph of the body is used. |
| `when_to_use` | Extra trigger phrases/examples; appended to `description` (shares the 1,536 cap). |
| `allowed-tools` | Space/comma-separated or YAML list. **Pre-approves** tools (no per-use prompt) — does NOT restrict. Omit to let normal permissions apply. |
| `disallowed-tools` | Removes tools while the skill is active. |
| `disable-model-invocation` | Default `false`. `true` = manual `/name` only (use for risky automation you don't want auto-fired). |
| `user-invocable` | Default `true`. `false` = hidden from the `/` menu but Claude can still invoke. |
| `model` / `effort` | Override model / reasoning effort for the skill's turn. Default: inherit session. |
| `context: fork` + `agent` | Run the skill in an isolated subagent context; `agent` picks the type (Explore / Plan / general-purpose / custom). |
| `paths` | Glob(s); skill auto-loads only when working on matching files. |
| `argument-hint` / `arguments` | Autocomplete hint / named `$arg` substitution. `$ARGUMENTS` always holds the trailing text. |

**Body best practices**
- Task-focused instructions ("do X"), not narration. Every line is a recurring token cost once loaded.
- Progressive disclosure: overview in `SKILL.md`, detail in sibling files referenced by name.
- `` !`command` `` (or a ```` ```! ```` block) injects shell output into the skill *before* Claude reads it.

**Minimal example**
```markdown
---
name: pr-reviewer
description: Review a pull request for risks and quality. Use when asked to review a PR or check merge-readiness.
allowed-tools: Bash(gh *)
---
# PR Review
Review this diff for risks, missing tests, and quality issues.
!`gh pr diff`
Output: Risks / Improvements / Safe-to-merge.
```

**Gotchas**
- Malformed YAML → body loads with empty metadata (no auto-invoke). Verify with `--debug`.
- Won't trigger → description too abstract; add natural keywords; test with `/name`.
- Triggers too often → narrow the description ("only when…") or set `disable-model-invocation: true`.

---

## Subagent — `.claude/agents/<name>.md`

**Layout & discovery**
- Project: `.claude/agents/<name>.md`. User (all projects): `~/.claude/agents/<name>.md`.
- Markdown **body = the subagent's system prompt**. Runs in isolated context; only its result returns.
- Auto-delegated when a task matches its `description`; or invoke by name / `@"name (agent)"`; or run a whole session with `claude --agent <name>`.
- Subagents receive CLAUDE.md + git status (except the built-in Explore/Plan types, which skip them — restate critical rules in the task).

**Frontmatter (`name` + `description` required; rest optional)**

| Field | Notes |
|---|---|
| `name` | **Required.** Lowercase + hyphens. Unique. |
| `description` | **Required.** When to delegate — drives auto-invocation. Add "use proactively / when the task is…". |
| `tools` | Comma/space-separated or YAML list. **Inherits all if omitted.** Scope it down for focused/read-only agents. |
| `disallowedTools` | Tools to deny (applied before `tools`). Supports MCP patterns. |
| `model` | `sonnet` / `opus` / `haiku` / `fable` / full ID / `inherit` (default). Cheaper model for cheap work. |
| `permissionMode` | `default` / `acceptEdits` / `plan` (read-only) / `bypassPermissions` / … Parent's stricter mode wins. |
| `maxTurns` | Cap agentic turns. |
| `skills` | Skill names to preload (full content injected at startup). |
| `memory` | `user` / `project` / `local` → persistent `MEMORY.md` the agent reads/writes across sessions. |
| `isolation: worktree` | Run in a temporary git worktree (isolated file edits). |
| `color` | Display color in the task list. |

**Body best practices** — define role + goals + specific behavior; reference preloaded skills by name; keep focused.

**Minimal example**
```markdown
---
name: code-improver
description: Suggest readability/performance/best-practice improvements. Use proactively after code changes.
tools: Read, Grep, Glob
model: sonnet
permissionMode: plan
memory: project
---
You are a code-improvement specialist. Read the relevant files, identify readability,
performance, and best-practice issues, and for each give the problem + an improved version.
Record recurring patterns/anti-patterns in your agent memory.
```

**Gotchas**
- Fresh context: the subagent does NOT see conversation history or prior file reads — hand it what it needs.
- Explore/Plan skip CLAUDE.md — restate must-follow rules in the prompt.
- Plugin subagents can't use `hooks` / `mcpServers` / `permissionMode`; copy into `.claude/agents/` if you need those.

---

## When to use which (docs' own framing)

- **CLAUDE.md** — always-loaded facts/conventions. Terse.
- **Rule** (`.claude/rules/`) — a page of conventions/gotchas for a subsystem, pointed to from CLAUDE.md.
- **Skill** — a reusable procedure/checklist; lazy-loaded; optional isolation via `context: fork`.
- **Subagent** — isolated, reusable job with scoped tools/model and optional persistent memory; auto-delegated by description.
