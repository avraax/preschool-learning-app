#!/usr/bin/env node
// SessionEnd hook (PRD session-01 W7.2). Appends one line per session to
// plans/session-performance/session-log.tsv so `session-cost.mjs --aggregate` gets its data without
// anyone remembering to run anything.
//
// Why SessionEnd and not Stop: SessionEnd fires ONCE per session and cannot add anything to the
// conversation context — it is documented for side effects. `Stop` fires once per TURN, which would
// make a monitor that spends tokens to measure tokens.
//
// It reads the hook payload on stdin (`transcript_path`, `session_id`, `reason`).
//
// Rules for this file: cheap, non-blocking, and SILENT ON FAILURE. A session ending must never hang
// or error on a monitor. Every path exits 0.

import { spawn } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LOG = join(REPO, 'plans', 'session-performance', 'session-log.tsv')

const bail = () => process.exit(0)
setTimeout(bail, 10_000).unref() // never hold a session open

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => { raw += d })
process.stdin.on('error', bail)
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw || '{}')
    const transcript = payload.transcript_path
    if (!transcript || !existsSync(transcript)) bail()
    mkdirSync(dirname(LOG), { recursive: true })
    const child = spawn(
      process.execPath,
      [join(REPO, 'scripts', 'session-cost.mjs'), '--file', transcript, '--append', LOG],
      { cwd: REPO, stdio: 'ignore', detached: false },
    )
    child.on('error', bail)
    child.on('exit', bail)
  } catch {
    bail()
  }
})
