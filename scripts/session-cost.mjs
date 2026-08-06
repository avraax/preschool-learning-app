#!/usr/bin/env node
// What a session in this repo actually costs, read off the transcripts Claude Code already writes.
//
//   node scripts/session-cost.mjs                # per-session table, newest first
//   node scripts/session-cost.mjs --aggregate    # the trend, for proving a guardrail change worked
//   node scripts/session-cost.mjs --last 10      # limit how many sessions
//   node scripts/session-cost.mjs --file <path>  # one transcript (what the SessionEnd hook passes)
//   node scripts/session-cost.mjs --append <tsv> # append one line per session to a log
//
// Context size for one assistant turn is
//     input_tokens + cache_read_input_tokens + cache_creation_input_tokens
// `input_tokens` ALONE is the uncached remainder, not the prompt size - reading it as the total
// under-reports by roughly 100x.
//
// TWO CORRECTNESS RULES, both of which the PRD that specified this script got wrong first time:
//
//   1. DEDUPE BY `message.id` BEFORE SUMMING ANYTHING. These transcripts carry each assistant message
//      1.6x-2.05x over (the stream emits one event per content block, all sharing the message id).
//      Undeduped, one session reads as 287 turns and 69.0M cache-read tokens; deduped it is 145 turns
//      and 37.2M. Every total is roughly double without this. The script asserts the dedupe is doing
//      something: if raw row count equals deduped count on these files, say so loudly, because it
//      almost certainly means the shape changed and the numbers are now wrong.
//   2. SKIP FILES WRITTEN IN THE LAST FEW MINUTES. A live session's totals move while you read them -
//      one file's raw cache-read went from 84.0M to 104.8M between two readings minutes apart.
//
// All money figures are TOKEN-EQUIVALENTS AT LIST PRICE, not a subscription bill.

import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'

const PROJECT_DIR = join(homedir(), '.claude', 'projects', 'C--Source-preschool-learning-app')
const LIVE_WINDOW_MS = 5 * 60 * 1000
const BIG_TURN_TOKENS = 10_000

// Opus 5 list rates, $/million.
const RATE = { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 }

function parseArgs(argv) {
  const out = { aggregate: false, last: 12, file: null, append: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--aggregate') out.aggregate = true
    else if (a === '--last') out.last = Number(argv[++i])
    else if (a === '--file') out.file = argv[++i]
    else if (a === '--append') out.append = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return out
}

const ctxOf = (u) => (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
const usd = (t) => (t.input * RATE.input + t.cacheWrite * RATE.cacheWrite + t.cacheRead * RATE.cacheRead + t.output * RATE.output) / 1e6

// `allowFresh` exists because the liveness skip below is right for a DIRECTORY SWEEP and wrong for an
// explicitly named file. SessionEnd fires the moment a session ends, so the transcript it hands us is
// always seconds old — with the skip applied, the W7.2 hook logged nothing, silently, forever. Naming
// a file is the caller asserting which one it wants.
function readSession(file, allowFresh = false) {
  // Third outcome: an unreadable transcript is UNKNOWN, not an empty session and not a crash. The
  // SessionEnd hook passes whatever path it was given, and a throw here would be swallowed by the
  // hook's `stdio: ignore` and read as "nothing to log".
  let mtime
  try {
    mtime = statSync(file).mtimeMs
  } catch (e) {
    return { file, unreadable: String(e.message || e) }
  }
  if (!allowFresh && Date.now() - mtime < LIVE_WINDOW_MS) return { file, live: true }

  let lines
  try {
    lines = readFileSync(file, 'utf8').split(/\r?\n/)
  } catch (e) {
    return { file, unreadable: String(e.message || e) }
  }
  const seen = new Set()
  const turns = []
  const toolNames = new Map() // assistant message id -> tool names it called
  let rawAssistantRows = 0
  let model = null
  let firstTs = null
  let lastTs = null

  for (const line of lines) {
    if (!line.trim()) continue
    let j
    try { j = JSON.parse(line) } catch { continue }
    if (j.timestamp) { firstTs ??= j.timestamp; lastTs = j.timestamp }
    if (j.type !== 'assistant' || !j.message?.usage) continue
    rawAssistantRows++
    const id = j.message.id
    const names = (j.message.content || []).filter((c) => c.type === 'tool_use').map((c) => c.name)
    if (names.length) toolNames.set(id, [...(toolNames.get(id) || []), ...names])
    if (seen.has(id)) continue
    seen.add(id)
    model ??= j.message.model
    turns.push({ id, ctx: ctxOf(j.message.usage), usage: j.message.usage })
  }

  if (!turns.length) return { file, empty: true }

  const totals = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }
  for (const t of turns) {
    totals.input += t.usage.input_tokens || 0
    totals.cacheWrite += t.usage.cache_creation_input_tokens || 0
    totals.cacheRead += t.usage.cache_read_input_tokens || 0
    totals.output += t.usage.output_tokens || 0
  }

  // A step is what the PREVIOUS turn's tool calls dragged in.
  const bigSteps = []
  for (let i = 1; i < turns.length; i++) {
    const step = turns[i].ctx - turns[i - 1].ctx
    if (step >= BIG_TURN_TOKENS) {
      bigSteps.push({ turn: i + 1, step, tools: (toolNames.get(turns[i - 1].id) || ['(no tool - a long reply or a pasted message)']).join(', ') })
    }
  }

  return {
    file,
    id: basename(file, '.jsonl'),
    model,
    date: (firstTs || '').slice(0, 10),
    turns: turns.length,
    rawAssistantRows,
    dedupeRatio: rawAssistantRows / turns.length,
    firstCtx: turns[0].ctx,
    maxCtx: Math.max(...turns.map((t) => t.ctx)),
    cacheReadPerTurn: Math.round(totals.cacheRead / turns.length),
    totals,
    costUsd: usd(totals),
    bigSteps: bigSteps.sort((a, b) => b.step - a.step),
    durationMin: firstTs && lastTs ? Math.round((Date.parse(lastTs) - Date.parse(firstTs)) / 60000) : null,
  }
}

function sessionFiles() {
  if (!existsSync(PROJECT_DIR)) return []
  return readdirSync(PROJECT_DIR).filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(PROJECT_DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

const args = parseArgs(process.argv.slice(2))
const files = args.file ? [args.file] : sessionFiles().slice(0, args.last)
// An explicitly named --file is never treated as live; see readSession.
const sessions = files.map((f) => readSession(f, Boolean(args.file)))
const done = sessions.filter((s) => !s.live && !s.empty && !s.unreadable)
const live = sessions.filter((s) => s.live)
const unreadable = sessions.filter((s) => s.unreadable)

if (args.append) {
  for (const s of done) {
    appendFileSync(args.append, [
      new Date().toISOString(), s.id, s.date, s.model, s.turns, s.firstCtx, s.maxCtx,
      s.totals.cacheRead, s.totals.output, s.costUsd.toFixed(2), s.bigSteps.length,
    ].join('\t') + '\n')
  }
  process.exit(0)
}

// The dedupe assertion: if it never fires, it is not doing anything and the totals are suspect.
const suspicious = done.filter((s) => s.dedupeRatio === 1)
if (done.length && suspicious.length === done.length) {
  console.log('\n  WARNING: raw assistant rows == deduped rows in every file. The dedupe is a no-op here,')
  console.log('  which historically meant the transcript shape changed. Treat these totals as UNKNOWN.\n')
}

if (args.aggregate) {
  const n = done.length
  if (!n) { console.log('no completed sessions to aggregate'); process.exit(0) }
  const mean = (f) => Math.round(done.reduce((a, s) => a + f(s), 0) / n)
  console.log(`\naggregate over ${n} completed session(s)` + (live.length ? ` (${live.length} skipped as live)` : '') + '\n')
  console.log(`  mean first-turn baseline   ${mean((s) => s.firstCtx).toLocaleString()} tokens`)
  console.log(`  mean max context           ${mean((s) => s.maxCtx).toLocaleString()} tokens`)
  console.log(`  mean cache read per turn   ${mean((s) => s.cacheReadPerTurn).toLocaleString()} tokens`)
  console.log(`  mean turns per session     ${mean((s) => s.turns)}`)
  console.log(`  mean cost-equivalent       $${(done.reduce((a, s) => a + s.costUsd, 0) / n).toFixed(2)}`)
  console.log(`  mean >10k-token turns      ${mean((s) => s.bigSteps.length)}`)
  console.log('\n  Token-equivalents at Opus 5 list price, not a subscription bill.\n')
  process.exit(0)
}

console.log('\nsession cost (token-equivalents at Opus 5 list price, NOT a subscription bill)\n')
console.log('  ' + 'session'.padEnd(10) + 'date'.padEnd(12) + 'turns'.padStart(6) + 'first ctx'.padStart(11)
  + 'max ctx'.padStart(10) + 'cache read'.padStart(12) + 'output'.padStart(9) + '$equiv'.padStart(9) + '  >10k turns')
for (const s of done) {
  console.log('  ' + s.id.slice(0, 8).padEnd(10) + String(s.date).padEnd(12)
    + String(s.turns).padStart(6) + s.firstCtx.toLocaleString().padStart(11)
    + s.maxCtx.toLocaleString().padStart(10) + s.totals.cacheRead.toLocaleString().padStart(12)
    + s.totals.output.toLocaleString().padStart(9) + ('$' + s.costUsd.toFixed(2)).padStart(9)
    + '  ' + s.bigSteps.length)
}
for (const s of live) console.log('  ' + basename(s.file, '.jsonl').slice(0, 8).padEnd(10) + 'SKIPPED - written within the last 5 minutes (a live session\'s totals move while you read them)')
for (const s of unreadable) console.log('  ' + basename(s.file, '.jsonl').slice(0, 8).padEnd(10) + 'UNKNOWN - ' + s.unreadable)

const withSteps = done.filter((s) => s.bigSteps.length)
if (withSteps.length) {
  console.log('\n  single turns that added more than ' + BIG_TURN_TOKENS.toLocaleString() + ' tokens'
    + ' - heavyweight skill loads and reads that should have been narrowed:\n')
  for (const s of withSteps.slice(0, 6)) {
    console.log('    ' + s.id.slice(0, 8) + ':')
    for (const b of s.bigSteps.slice(0, 6)) {
      console.log(`      turn ${String(b.turn).padStart(4)}  +${b.step.toLocaleString().padStart(8)} tokens   ${b.tools}`)
    }
  }
}
console.log('')
