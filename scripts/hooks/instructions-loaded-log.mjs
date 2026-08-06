#!/usr/bin/env node
// InstructionsLoaded hook (PRD session-01 W7.3). Records which CLAUDE.md / .claude/rules/*.md files
// actually loaded, and how big they were.
//
// This is the authoritative answer to "did my `paths:` scoping work" — it beats reasoning about globs
// and beats inferring from a transcript delta. `context-budget.mjs` counts what the globs SHOULD
// match; this records what actually loaded. If the two ever disagree, trust this.
//
// A TEMPORARY INSTRUMENT, not a fixture. The hook block is NOT wired in `.claude/settings.json` —
// re-add it when you need to answer the scoping question again, run one session per work area, read
// `plans/session-performance/instructions-loaded.tsv`, then take it out.
//
//   "InstructionsLoaded": [{ "hooks": [
//     { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/instructions-loaded-log.mjs\"", "timeout": 8 }
//   ]}]
//
// Measured 2026-08-06, right after PRD session-01 W2 (this is the after-picture to diff against):
//   game component -> CLAUDE.md, working-in-this-tree, audio-call-sites, layout-contract,
//                     games-catalog, games-math, game-development   (47,296 B)
//   audio engine   -> CLAUDE.md, working-in-this-tree, audio-system
//   auth           -> CLAUDE.md, working-in-this-tree, auth         (no game or audio rules)
//   docs-only      -> CLAUDE.md, working-in-this-tree               (nothing else)
//
// Silent on failure, always exits 0 — a hook must never be able to break a session.

import { appendFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LOG = join(REPO, 'plans', 'session-performance', 'instructions-loaded.tsv')

const bail = () => process.exit(0)
setTimeout(bail, 5_000).unref()

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => { raw += d })
process.stdin.on('error', bail)
process.stdin.on('end', () => {
  try {
    const p = JSON.parse(raw || '{}')
    // The payload names the file(s) that loaded; accept the shapes it might use rather than
    // assuming one, since a wrong guess here logs nothing and looks like "no rules loaded".
    const paths = []
    for (const k of ['file_path', 'path', 'instructions_path', 'source']) if (typeof p[k] === 'string') paths.push(p[k])
    for (const k of ['files', 'paths', 'instructions']) {
      const v = p[k]
      if (Array.isArray(v)) for (const x of v) paths.push(typeof x === 'string' ? x : x?.path || x?.file_path)
    }
    mkdirSync(dirname(LOG), { recursive: true })
    const stamp = new Date().toISOString()
    const sid = String(p.session_id || '').slice(0, 8)
    if (!paths.filter(Boolean).length) {
      // Log the raw keys once so the shape can be corrected instead of silently recording nothing.
      appendFileSync(LOG, [stamp, sid, 'UNPARSED', Object.keys(p).join('+'), raw.slice(0, 300).replace(/\s+/g, ' ')].join('\t') + '\n')
      bail()
    }
    for (const f of paths.filter(Boolean)) {
      let bytes = ''
      try { bytes = String(statSync(f).size) } catch { bytes = '?' }
      appendFileSync(LOG, [stamp, sid, 'LOADED', relative(REPO, f) || f, bytes].join('\t') + '\n')
    }
  } catch { /* silent */ }
  bail()
})
