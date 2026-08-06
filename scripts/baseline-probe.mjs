#!/usr/bin/env node
// Measures the session startup cost that PRD session-01 gates on, without a human in the loop.
//
// `/context` is an interactive TUI command and cannot be scripted. A headless `claude -p` run
// measures the same thing better: it reports the BILLED numbers rather than a UI rendering.
//
//   Probe A (baseline)      "Reply with exactly: OK"        -> startup context + TTFT at rest
//   Probe B (component)     read MathOperationGame.tsx      -> the rule-injection step (turn2 - turn1)
//
// Context size for one turn = input_tokens + cache_creation_input_tokens + cache_read_input_tokens.
//
// Traps this script exists to avoid (all of them bit the PRD's own first draft):
//   1. The TOP-LEVEL `usage` in -p JSON is an aggregate ACROSS turns, not a context size. Probe B's
//      top-level total reads ~162k, which is turn 1 (~54k) plus turn 2 (~108k). `usage.iterations[]`
//      is not the fix either - on a 2-turn run it holds ONE entry (the last call). So we run
//      `--output-format stream-json --verbose` and read `usage` off each `assistant` event, which is
//      genuinely per-turn.
//   2. The stream emits each assistant message MORE THAN ONCE (measured here: turn 1 twice). Dedupe
//      by `message.id` before summing or every total is inflated.
//   3. TTFT is noisy - network and load move it. Default n=5 and we report the MEDIAN.
//   4. Headless != interactive (54k vs 56-63k). Only ever compare probe-to-probe.
//   5. A probe has THREE outcomes. An API error / permission denial is UNKNOWN, not a measurement:
//      it is dropped from the median and reported separately, never folded into a real verdict.
//   6. `--no-session-persistence` keeps probe runs out of the transcript directory. The stream
//      carries the usage, so the transcript is not needed.
//
// Cost: ~$0.35-0.90 per probe, so a default 5x run of both probes is roughly $4.
//
// Usage:
//   node scripts/baseline-probe.mjs                      # 5x both probes, report only
//   node scripts/baseline-probe.mjs --n 3 --probe a      # 3x probe A only
//   node scripts/baseline-probe.mjs --save before        # append the run to probe-log.tsv
//   node scripts/baseline-probe.mjs --compare before after   # diff; exit 1 if it did not improve

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOG = join(REPO, 'plans', 'session-performance', 'probe-log.tsv')
const LOG_HEADER = [
  'label', 'timestamp', 'n', 'model', 'ccVersion',
  'baselineTokens', 'stepTokens', 'ttftMs', 'costUsd', 'unknowns',
].join('\t')

const PROBES = {
  a: {
    id: 'a',
    name: 'baseline',
    prompt: 'Reply with exactly: OK',
    measures: 'startup context, TTFT at rest',
  },
  b: {
    id: 'b',
    name: 'component-edit',
    prompt: 'Read src/components/math/MathOperationGame.tsx and then reply with exactly: DONE',
    measures: 'the rule-injection step, as turn 2 minus turn 1',
    // The step is only comparable if the model read the WHOLE file. One observed run passed a
    // `limit` and reported a 10,916-token step against 54,439 for a full read - a silent 5x
    // understatement that would have read as a win. That run is UNKNOWN, not a measurement.
    target: 'src/components/math/MathOperationGame.tsx',
  },
}

function parseArgs(argv) {
  const out = { n: 5, probe: 'both', save: null, compare: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--n') out.n = Number(argv[++i])
    else if (a === '--probe') out.probe = String(argv[++i]).toLowerCase()
    else if (a === '--save') out.save = argv[++i]
    else if (a === '--compare') out.compare = [argv[++i], argv[++i]]
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`unknown argument: ${a}`)
  }
  if (!Number.isInteger(out.n) || out.n < 1) throw new Error('--n must be a positive integer')
  if (!['a', 'b', 'both'].includes(out.probe)) throw new Error('--probe must be a, b or both')
  if (out.compare && (!out.compare[0] || !out.compare[1])) throw new Error('--compare needs two labels')
  return out
}

function median(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function ctxOf(usage) {
  return (usage.input_tokens || 0)
    + (usage.cache_creation_input_tokens || 0)
    + (usage.cache_read_input_tokens || 0)
}

// Returns {ok:true, ...measurement} or {ok:false, why} - the UNKNOWN third outcome.
function runProbe(probe) {
  // The prompt goes in on STDIN, never in argv. `claude` is a .cmd shim on Windows so the spawn
  // needs `shell: true`, and that joins argv on spaces WITHOUT quoting - which silently shredded
  // the prompt into separate arguments and made the model do something else entirely.
  const res = spawnSync(
    'claude',
    ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence'],
    {
      cwd: REPO,
      encoding: 'utf8',
      input: probe.prompt,
      maxBuffer: 256 * 1024 * 1024,
      shell: process.platform === 'win32',
    },
  )
  if (res.error) return { ok: false, why: `spawn failed: ${res.error.message}` }

  const seen = new Set() // trap 2: the stream repeats assistant messages
  const turns = []
  const toolUses = []
  let result = null
  let rawRows = 0
  let model = 'unknown' // from the assistant events, NOT modelUsage: that also lists the side
                        // models (a haiku summariser) which emit no assistant turn of their own.
  for (const line of String(res.stdout).split(/\r?\n/)) {
    if (!line.trim()) continue
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    if (ev.type === 'assistant' && ev.message?.usage) {
      rawRows++
      for (const c of ev.message.content || []) if (c.type === 'tool_use') toolUses.push(c)
      if (seen.has(ev.message.id)) continue
      seen.add(ev.message.id)
      if (ev.message.model) model = ev.message.model
      turns.push(ctxOf(ev.message.usage))
    } else if (ev.type === 'result') {
      result = ev
    }
  }

  if (!result) return { ok: false, why: `no result event (exit ${res.status}): ${String(res.stdout).slice(-200)}` }
  if (result.is_error || result.subtype !== 'success') {
    return { ok: false, why: `probe reported ${result.subtype} / api_error_status=${result.api_error_status}` }
  }
  if (turns.length === 0) return { ok: false, why: 'no assistant usage in the stream - the event shape changed' }
  if (probe.target) {
    if (turns.length < 2) {
      return { ok: false, why: `probe needs 2 turns, got ${turns.length} (did it skip the Read?)` }
    }
    const want = probe.target.replace(/\//g, '\\')
    const read = toolUses.find((t) => t.name === 'Read' && String(t.input?.file_path || '').replace(/\//g, '\\').endsWith(want))
    if (!read) {
      return { ok: false, why: `no full Read of ${probe.target}; tools used: ${toolUses.map((t) => t.name).join(',') || '(none)'}` }
    }
    if (read.input.limit != null || read.input.offset != null) {
      return { ok: false, why: `partial Read (limit=${read.input.limit}, offset=${read.input.offset}) - the step is not comparable` }
    }
  }
  return {
    ok: true,
    turns,
    rawRows,
    firstTurn: turns[0],
    lastTurn: turns[turns.length - 1],
    step: turns.length > 1 ? turns[turns.length - 1] - turns[0] : null,
    ttftMs: result.ttft_ms ?? null,
    costUsd: result.total_cost_usd ?? 0,
    model,
  }
}

function ccVersion() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
  return (r.stdout || '').trim().split(' ')[0] || 'unknown'
}

function summarise(runs) {
  const ok = runs.filter((r) => r.ok)
  const bad = runs.filter((r) => !r.ok)
  return {
    n: ok.length,
    unknowns: bad.length,
    reasons: bad.map((r) => r.why),
    firstTurn: median(ok.map((r) => r.firstTurn)),
    lastTurn: median(ok.map((r) => r.lastTurn)),
    step: median(ok.map((r) => r.step).filter((x) => x != null)),
    ttftMs: median(ok.map((r) => r.ttftMs).filter((x) => x != null)),
    costUsd: ok.reduce((a, r) => a + r.costUsd, 0),
    model: ok[0]?.model || 'unknown',
  }
}

function readLog() {
  if (!existsSync(LOG)) return []
  const lines = readFileSync(LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean)
  const header = lines.shift()?.split('\t') || []
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [header[i], v])))
}

function doCompare([a, b]) {
  const rows = readLog()
  const last = (label) => [...rows].reverse().find((r) => r.label === label)
  const ra = last(a)
  const rb = last(b)
  if (!ra || !rb) {
    console.error(`compare: missing label ${!ra ? a : b} in ${LOG}`)
    console.error(`labels present: ${[...new Set(rows.map((r) => r.label))].join(', ') || '(none)'}`)
    return 2
  }
  const num = (v) => (v === '' || v == null ? null : Number(v))
  const fields = [
    ['baselineTokens', 'baseline context', true],
    ['stepTokens', 'one-component-edit step', true],
    ['ttftMs', 'TTFT (median ms)', false],
    ['costUsd', 'cost of the probe run', false],
  ]
  console.log(`\ncompare  ${a} -> ${b}\n`)
  let failed = false
  for (const [key, name, gated] of fields) {
    const va = num(ra[key])
    const vb = num(rb[key])
    if (va == null || vb == null || Number.isNaN(va) || Number.isNaN(vb)) {
      console.log(`  ${name.padEnd(26)} UNKNOWN (not recorded in one of the runs)`)
      if (gated) failed = true
      continue
    }
    const d = vb - va
    const pct = va ? ((d / va) * 100).toFixed(1) : '-'
    const arrow = d < 0 ? 'down' : d > 0 ? 'UP' : 'flat'
    console.log(`  ${name.padEnd(26)} ${String(va).padStart(10)} -> ${String(vb).padStart(10)}  ${arrow} ${pct}%`)
    if (gated && !(d < 0)) failed = true
  }
  console.log('')
  if (failed) {
    console.error('FAIL: a gated number did not drop. Find out why before continuing.')
    return 1
  }
  console.log('PASS: baseline and step both dropped.')
  return 0
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'))
    return 0
  }
  if (args.compare) return doCompare(args.compare)

  const ids = args.probe === 'both' ? ['a', 'b'] : [args.probe]
  const results = {}
  for (const id of ids) {
    const probe = PROBES[id]
    process.stderr.write(`probe ${id.toUpperCase()} (${probe.name}) x${args.n}: `)
    const runs = []
    for (let i = 0; i < args.n; i++) {
      const r = runProbe(probe)
      process.stderr.write(r.ok ? '.' : '?')
      runs.push(r)
    }
    process.stderr.write('\n')
    results[id] = summarise(runs)
  }

  const version = ccVersion()
  console.log(`\nbaseline-probe  n=${args.n}  claude-code ${version}\n`)
  for (const id of ids) {
    const s = results[id]
    const p = PROBES[id]
    console.log(`  probe ${id.toUpperCase()} - ${p.name} (${p.measures})`)
    console.log(`    model             ${s.model}`)
    console.log(`    turn-1 context    ${s.firstTurn ?? 'UNKNOWN'} tokens (median)`)
    if (id === 'b') {
      console.log(`    turn-2 context    ${s.lastTurn ?? 'UNKNOWN'} tokens (median)`)
      console.log(`    step              ${s.step ?? 'UNKNOWN'} tokens  <- the rules + the file`)
    }
    console.log(`    TTFT              ${s.ttftMs ?? 'UNKNOWN'} ms (median)`)
    console.log(`    cost of this run  $${s.costUsd.toFixed(2)} over ${s.n} run(s)`)
    if (s.unknowns) {
      console.log(`    UNKNOWN runs      ${s.unknowns} dropped from the median:`)
      for (const r of s.reasons) console.log(`                      - ${r}`)
    }
    console.log('')
  }

  if (results.a && results.a.n === 0) {
    console.error('every probe-A run was UNKNOWN - nothing was measured.')
    return 2
  }

  if (args.save) {
    mkdirSync(dirname(LOG), { recursive: true })
    if (!existsSync(LOG)) appendFileSync(LOG, LOG_HEADER + '\n')
    const a = results.a
    const b = results.b
    const row = [
      args.save,
      new Date().toISOString(),
      args.n,
      (a || b).model,
      version,
      a ? a.firstTurn : '',
      b ? b.step : '',
      a ? a.ttftMs : (b ? b.ttftMs : ''),
      ((a?.costUsd || 0) + (b?.costUsd || 0)).toFixed(4),
      (a?.unknowns || 0) + (b?.unknowns || 0),
    ].join('\t')
    appendFileSync(LOG, row + '\n')
    console.log(`saved as "${args.save}" in ${LOG}`)
  }
  return 0
}

process.exit(main())
