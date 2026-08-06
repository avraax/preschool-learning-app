# Working in this tree

How to work here rather than what to change, so it has no `paths:` scope — the one declared exception in
`src/config/contextBudget.test.ts`, with a byte cap. `CLAUDE.md` carries the rule, this file the incident.

## Never edit a file with a shell text pipeline

- A PowerShell pipeline (`Get-Content -Raw … -replace … | Set-Content`) **re-encodes the whole file**, so
  every `æøå` and `—` becomes mojibake, and every file here is Danish. A whole-file rewrite in `git diff`
  is the tell.
- A `node -e`/heredoc patch **command-substitutes any backtick in the replacement** and drops what was
  inside it. Nearly every identifier here is backticked, so it deletes the words you were adding; it
  happened twice in one session, and the file stays syntactically fine, so nothing fails.

Use the Edit tool. If you must script a patch, single-quote the JS and make a missing anchor **exit
non-zero**.

## Another session may be working in this same tree

When `tsc`/`npm test` fails in files your change never touched, run `git status` first — usually a
parallel session mid-refactor. Leave their work alone and say whose the failure is; never "fix" it into a
collision or report their red build as your result. **HEAD also moves under you**, so check `git log`
too: your own work may already be committed by them. The rest is one hazard — `git add -A` takes the
working tree:

- **Never leave work staged, and a clean index is no protection** — an unstaged file is equally exposed.
  Committing promptly is the protection, not tidiness.
- **A shell error on a git command does not mean nothing happened.** A PowerShell here-string (`@'…'@`)
  passed to the Bash tool dies *after* `git add` and `git commit` both ran, leaving a garbage message.
  Check `git log` before retrying or you double-commit.
- **A subset commit by pathspec can leave your own edit behind** — re-check `git status` after one.
- **They may also push, and `master` is the deploy trigger.** "Committed but not pushed" is not "not
  deployed": check `git rev-list origin/master..HEAD` before saying something is still local.
- **A missing `node_modules` `@scope` is almost always your own interrupted delete** (the alphabetical
  cut-off is the signature) — mis-blamed twice. `npm install` fixes it, but ask: it is shared state.
- **Never `taskkill //IM node.exe`** — it killed a sibling's Vite. Yours failing to start on 5173 means
  theirs is already up, and a running Vite already serves your edits.

## Local green proves nothing about the deployed artifact

Two outages in one session were correct here and broken only in what Vercel shipped: a dynamic
`import('./auth.ts')` (compiled to a sibling `.js`, specifiers not rewritten → Google sign-in died after
the round trip), and an untracked `public/manifest.json` (see the `*.json` trap below). Dev, `vite
preview` and a local `vercel build` all read the working tree, so none can see either. `curl` the
deployed URL or read the built output, and guard it (`lib/serverImports.test.ts`, `pwaAssets.test.ts`).

An empty `git status` means the working tree **is** HEAD, so a green run already covers the commit; a
throwaway checkout is only needed after a subset commit of a dirty tree. If you make one (`git worktree
add` + a `mklink /J` junction to `node_modules`), **check the junction exists** — it fails silently and
`tsc` then "passes" because it never ran. Remove it with `git worktree remove`, never `Remove-Item
-Recurse`, which follows the junction into the real `node_modules`.

## Three smaller traps

- **`.gitignore` carries a blanket `*.json`** (for credentials) with a short `!` allow-list, and a file
  it swallows is invisible locally by construction. It took `public/manifest.json` (a production
  outage) and then `.claude/settings.json`, whose permission list had never been tracked at all. Any
  `.json` the repo needs versioned wants its own `!` negation.
- **A probe of an external service has three outcomes.** Rate-limits, partial reads and fail-closed 403s
  are UNKNOWN and retry with backoff, never folded into a real verdict — a `.dk` whois rate-limit banner
  read as "domain registered" produced two false results. Calibrate with a known-positive **and** a
  known-negative control.
- **Node ships a global `navigator` (≥21)**, so a feature-detect test can't use `typeof navigator ===
  'undefined'` for "unsupported"; swapping it needs `Object.defineProperty` + restore, not assignment.
