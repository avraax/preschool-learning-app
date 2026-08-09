#!/usr/bin/env node
// The guardrail context budget: what `.claude/**` + CLAUDE.md cost a session, and whether any of it
// has grown past what PRD session-01 set. Report mode by default; `--check` is the gate the
// `src/config/contextBudget.test.ts` test runs, and it exits non-zero on a violation.
//
// Standalone: no `.ts` imports, so plain `node scripts/context-budget.mjs` runs it without the
// `--import ./scripts/js-to-ts-resolve.mjs` resolver.
//
// Token figures are `bytes / 2.52` and are FOR REPORTING ONLY - the divisor is one measured sample of
// mixed content and does not tokenize markdown prose, backtick-dense rules and .tsx source alike.
// Every gate below is on BYTES or LINES, which are deterministic.
//
//   node scripts/context-budget.mjs            # the table
//   node scripts/context-budget.mjs --check    # the gate (exit 1 on violation)

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHARS_PER_TOKEN = 2.52

// ---------------------------------------------------------------------------------------------
// Budgets. These are PINNED LITERALS on purpose.
//
// The trap this guard is most exposed to: it reads its own inputs from `.claude/**`, so a budget
// derived from the current file sizes would move with the thing it measures and pass vacuously.
// Changing a number here is a decision, and it belongs in a commit message.
// ---------------------------------------------------------------------------------------------
const BUDGETS = {
  claudeMd: 12_000,
  // A rule claiming the component glob is paid on the single most common edit in the repo.
  componentGlobRuleMax: 6_000,
  // Everything loaded on EVERY session: CLAUDE.md + every rule with no `paths:`.
  alwaysLoadedTotal: 17_000,
  // CLAUDE.md + unscoped rules + every rule matching one game component.
  componentEditTotal: 48_000,
  skillBodyLines: 500,
  skillDescriptionChars: 1_024,
  // A glob set wider than this is describing the repo, not a subject. The widest rule without a
  // declared override matches 26 files, so 40 leaves headroom and still fires on `src/**/*.tsx`.
  ruleGlobMatchCeiling: 40,
}

// A rule with no `paths:` is loaded into every session about anything. Each entry needs a reason,
// and the list should stay this short.
const UNSCOPED_ALLOWLIST = {
  'working-in-this-tree.md': {
    max: 4_500,
    reason:
      'Git and shell hazards fire BEFORE any file is opened, so no `paths:` glob can predate them, '
      + 'and they have recurred with the guidance present. CLAUDE.md keeps the one-line rule; this '
      + 'file keeps the incident.',
  },
}

// Rules whose subject genuinely spans a lot of files. Each needs a reason.
const GLOB_CEILING_OVERRIDES = {
  'audio-call-sites.md': { max: 120, reason: 'owns the component glob by design; 2.4 KB is the price' },
  'layout-contract.md': { max: 120, reason: 'owns the component glob by design; held under 6 KB' },
  'scene-assets.md': { max: 500, reason: 'owns every art directory; those globs are asset trees, not code' },
  'auth.md': { max: 60, reason: 'src/components/auth/** IS the subject; the gate refactor split it into more, smaller files' },
}

const COMPONENT_GLOB = 'src/components/**/*.tsx'
// The single most common edit in the repo, and the file probe B reads.
const PROBE_COMPONENT = 'src/components/math/MathOperationGame.tsx'

const tok = (bytes) => Math.round(bytes / CHARS_PER_TOKEN)

/**
 * Byte length of the CANONICAL (LF) form, not of the working copy.
 *
 * `.gitattributes`/`core.autocrlf` give this repo CRLF line endings on a Windows checkout, so every
 * newline costs an extra byte on disk that does not exist in git and is not content. Measuring the
 * working copy made the budget PLATFORM-DEPENDENT: CLAUDE.md is 11973 B in git and was 12134 B on
 * disk, so the guard passed on a LF checkout (CI, Vercel, Linux) and failed on the owner's Windows
 * machine — 161 B of pure carriage returns, on a 12000 B budget. It had been failing locally on
 * master before anyone noticed, which is the worst outcome for a guard: red for a reason nobody
 * believes, so it stops being read.
 *
 * This is NOT a budget increase. The budgets still measure the same thing they were authored
 * against; they just no longer count a line-ending artifact. Raising a budget still means editing
 * BUDGETS above and saying so in a commit.
 */
const canonicalBytes = (src) => Buffer.byteLength(src.replace(/\r\n/g, '\n'), 'utf8')

function repoFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return out.split(/\r?\n/).filter(Boolean)
}

// Minimal glob -> RegExp. `**` crosses directory separators, `*` and `?` do not.
function globToRe(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` should also match zero directories, so `a/**/b.ts` matches `a/b.ts`.
        if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2 } else { re += '.*'; i += 1 }
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + '$')
}

function matchesAny(globs, file) {
  return globs.some((g) => globToRe(g).test(file))
}

function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : null
}

function parseRule(file) {
  const src = readFileSync(file, 'utf8')
  const fm = frontmatter(src)
  const globs = fm ? [...fm.matchAll(/-\s*["']?([^"'\r\n]+?)["']?\s*$/gm)].map((m) => m[1].trim()) : []
  return { src, bytes: canonicalBytes(src), hasPaths: fm != null && /(^|\n)paths:/.test(fm), globs }
}

function parseSkill(file) {
  const src = readFileSync(file, 'utf8')
  const fm = frontmatter(src)
  const body = fm ? src.slice(src.indexOf('---', 4) + 4) : src
  // Reads `key: value` AND the YAML block scalars (`>-`, `>`, `|`, `|-`) that these files actually
  // use. A single-line regex here measured the literal string ">-" and passed vacuously on every
  // folded description - which is the whole failure mode this guard exists to catch.
  const get = (key) => {
    if (!fm) return null
    const lines = fm.split(/\r?\n/)
    const i = lines.findIndex((l) => l.startsWith(key + ':'))
    if (i < 0) return null
    const inline = lines[i].slice(key.length + 1).trim()
    if (inline && !/^[>|][-+]?$/.test(inline)) return inline.replace(/^["']|["']$/g, '')
    const out = []
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s/.test(lines[j]) && lines[j].trim() !== '') break
      out.push(lines[j].trim())
    }
    return out.join(' ').trim()
  }
  return {
    bytes: canonicalBytes(src),
    bodyLines: body.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === '')).length,
    name: get('name'),
    description: get('description'),
    whenToUse: get('when_to_use'),
  }
}

function collect() {
  const files = repoFiles()
  const rulesDir = join(REPO, '.claude', 'rules')
  const rules = existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort().map((f) => {
      const r = parseRule(join(rulesDir, f))
      return { file: f, ...r, matchCount: files.filter((x) => matchesAny(r.globs, x)).length }
    })
    : []

  const skillsDir = join(REPO, '.claude', 'skills')
  const skills = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory()).sort().map((d) => {
      const md = join(skillsDir, d, 'SKILL.md')
      const siblings = readdirSync(join(skillsDir, d))
        .filter((f) => f !== 'SKILL.md')
        .map((f) => ({ f, bytes: statSync(join(skillsDir, d, f)).size, read: /\.md$/.test(f) }))
      return { dir: d, exists: existsSync(md), ...(existsSync(md) ? parseSkill(md) : {}), siblings }
    })
    : []

  const agentsDir = join(REPO, '.claude', 'agents')
  const agents = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()
      .map((f) => ({ file: f, bytes: statSync(join(agentsDir, f)).size }))
    : []

  const claudeMd = canonicalBytes(readFileSync(join(REPO, 'CLAUDE.md'), 'utf8'))
  const unscoped = rules.filter((r) => !r.hasPaths)
  const alwaysLoaded = claudeMd + unscoped.reduce((a, r) => a + r.bytes, 0)
  const onComponent = rules.filter((r) => !r.hasPaths || matchesAny(r.globs, PROBE_COMPONENT))
  const componentEdit = claudeMd + onComponent.reduce((a, r) => a + r.bytes, 0)

  return { rules, skills, agents, claudeMd, unscoped, alwaysLoaded, onComponent, componentEdit }
}

function report(d) {
  const row = (a, b, c, e) => console.log('  ' + String(a).padEnd(34) + String(b).padStart(8) + String(c).padStart(9) + '  ' + (e || ''))
  console.log('\nCLAUDE.md + .claude/**  (tokens are bytes/2.52, reporting only)\n')
  row('file', 'bytes', '~tokens', 'scope')
  row('CLAUDE.md', d.claudeMd, tok(d.claudeMd), `budget ${BUDGETS.claudeMd}`)
  console.log('')
  for (const r of d.rules) {
    const scope = !r.hasPaths
      ? 'UNSCOPED - loads always'
      : `${r.globs.length} glob(s), ${r.matchCount} file(s)` + (r.globs.includes(COMPONENT_GLOB) ? '  [component glob]' : '')
    row(r.file, r.bytes, tok(r.bytes), scope)
  }
  console.log('')
  for (const s of d.skills) {
    const sib = s.siblings.reduce((a, x) => a + (x.read ? x.bytes : 0), 0)
    row(`skills/${s.dir}/SKILL.md`, s.bytes || 0, tok(s.bytes || 0),
      `${s.bodyLines} body lines (max ${BUDGETS.skillBodyLines})` + (sib ? `, +${sib} B readable siblings` : ''))
  }
  console.log('')
  for (const a of d.agents) row(`agents/${a.file}`, a.bytes, tok(a.bytes), 'one listing line each')

  console.log('\n  ' + '-'.repeat(70))
  row('ALWAYS LOADED (CLAUDE.md + unscoped)', d.alwaysLoaded, tok(d.alwaysLoaded), `budget ${BUDGETS.alwaysLoadedTotal}`)
  row('ONE COMPONENT EDIT (worst case)', d.componentEdit, tok(d.componentEdit), `budget ${BUDGETS.componentEditTotal}`)
  console.log('  loaded on a component edit: ' + d.onComponent.map((r) => r.file.replace(/\.md$/, '')).join(', '))
  console.log('')
}

function check(d) {
  const fail = []

  if (d.claudeMd > BUDGETS.claudeMd) {
    fail.push(`CLAUDE.md is ${d.claudeMd} B, budget ${BUDGETS.claudeMd} B. Move detail into a scoped rule.`)
  }

  for (const r of d.unscoped) {
    const allow = UNSCOPED_ALLOWLIST[r.file]
    if (!allow) {
      fail.push(`.claude/rules/${r.file} has no \`paths:\` block, so it loads into every session. `
        + `Scope it, or add it to UNSCOPED_ALLOWLIST with a reason.`)
    } else if (r.bytes > allow.max) {
      fail.push(`.claude/rules/${r.file} is ${r.bytes} B against its allowlisted cap of ${allow.max} B.`)
    }
  }

  for (const r of d.rules) {
    if (!r.hasPaths) continue
    const ceiling = GLOB_CEILING_OVERRIDES[r.file]?.max ?? BUDGETS.ruleGlobMatchCeiling
    if (r.matchCount > ceiling) {
      fail.push(`.claude/rules/${r.file} matches ${r.matchCount} repo files against a ceiling of ${ceiling}. `
        + `Narrow the globs, or declare an override with a reason.`)
    }
    if (r.globs.includes(COMPONENT_GLOB) && r.bytes > BUDGETS.componentGlobRuleMax) {
      fail.push(`.claude/rules/${r.file} is ${r.bytes} B and claims \`${COMPONENT_GLOB}\`, which is `
        + `reserved for rules under ${BUDGETS.componentGlobRuleMax} B - it is paid on the most common edit in the repo.`)
    }
  }

  if (d.alwaysLoaded > BUDGETS.alwaysLoadedTotal) {
    fail.push(`Always-loaded surface is ${d.alwaysLoaded} B, budget ${BUDGETS.alwaysLoadedTotal} B.`)
  }
  if (d.componentEdit > BUDGETS.componentEditTotal) {
    fail.push(`One component edit loads ${d.componentEdit} B, budget ${BUDGETS.componentEditTotal} B.`)
  }

  for (const s of d.skills) {
    if (!s.exists) { fail.push(`.claude/skills/${s.dir} has no SKILL.md.`); continue }
    if (s.bodyLines > BUDGETS.skillBodyLines) {
      fail.push(`.claude/skills/${s.dir}/SKILL.md body is ${s.bodyLines} lines, max ${BUDGETS.skillBodyLines}. `
        + `Move detail into one-level-deep reference/*.md siblings.`)
    }
    const desc = (s.description || '') + (s.whenToUse || '')
    if (!s.description) fail.push(`.claude/skills/${s.dir}/SKILL.md has no \`description\`.`)
    else if (desc.length > BUDGETS.skillDescriptionChars) {
      fail.push(`.claude/skills/${s.dir} description is ${desc.length} chars, max ${BUDGETS.skillDescriptionChars}. `
        + `It is paid in the skill listing on every session.`)
    }
    if (s.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.name)) {
      fail.push(`.claude/skills/${s.dir} name "${s.name}" is not lowercase-hyphen.`)
    }
  }

  return fail
}

const args = process.argv.slice(2)
const data = collect()
if (args.includes('--check')) {
  const fail = check(data)
  if (fail.length) {
    console.error('\ncontext-budget: ' + fail.length + ' violation(s)\n')
    for (const f of fail) console.error('  - ' + f)
    console.error('')
    process.exit(1)
  }
  console.log('context-budget: OK')
  process.exit(0)
}
report(data)
const fail = check(data)
if (fail.length) {
  console.log('violations (run with --check to gate):')
  for (const f of fail) console.log('  - ' + f)
  console.log('')
}
export { BUDGETS, UNSCOPED_ALLOWLIST, GLOB_CEILING_OVERRIDES, collect, check }
