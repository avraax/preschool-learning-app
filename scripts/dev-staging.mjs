// `npm run dev:staging` — bring up the whole local stack against the STAGING backend (staging PRD W5).
//
// Local development IS the staging tier: `.env.local` carries the staging Neon URL, and Vite plus
// `dev-server.js` on 3001 are the app. It never talks to the staging DEPLOYMENT — it has its own API —
// but it shares staging's database, which is the point.
//
// This script exists for one reason: to make "which database am I about to write to?" impossible to get
// wrong. It refuses to start unless `.env.local` says `BL_TIER=staging`, and it PRINTS the three facts
// a session needs to trust what it is looking at before either server comes up.
//
// Plain `node:child_process`, no new dependency — the repo has none for this and does not need one.
// NO ANSI COLOUR: this output lands in scrollback, screenshots and pasted bug reports, and the text
// prefixes below already separate the two servers. (Raw escape bytes in source are also a hazard —
// an editor or a copy-paste can silently eat them.)

import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import net from 'node:net'

const die = (msg) => {
  console.error(`[dev:staging] ${msg}`)
  process.exit(1)
}

// ---- 1. The gate: .env.local must SAY it is staging ------------------------------------------------

let envText
try {
  envText = readFileSync('.env.local', 'utf8')
} catch {
  die('no .env.local in the repo root. See tmp-prd-staging-environment.md §8 step 5.')
}

const env = new Map()
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env.set(m[1], m[2].replace(/^"|"$/g, '').trim())
}

if (env.get('BL_TIER') !== 'staging') {
  die(
    `.env.local does not declare BL_TIER=staging (found ${JSON.stringify(env.get('BL_TIER') ?? null)}).

  Add this line to .env.local:

      BL_TIER=staging

  If .env.local still points at PRODUCTION, do not add it — change DATABASE_URL first
  (tmp-prd-staging-environment.md §8 step 5). This gate is the only thing standing between
  a seed script and the child's real Reward Book.`,
  )
}

// ---- 2. Say what we are pointed at, BEFORE starting anything ---------------------------------------

// HOST ONLY. A connection string carries the password, and this line ends up in scrollback, in
// screenshots and in pasted bug reports.
const neonHost = (() => {
  const url = env.get('DATABASE_URL')
  if (!url) return '(DATABASE_URL not set)'
  try {
    return new URL(url).host
  } catch {
    return '(unparseable DATABASE_URL)'
  }
})()

console.log('[dev:staging] tier            ' + env.get('BL_TIER'))
console.log('[dev:staging] BETTER_AUTH_URL ' + (env.get('BETTER_AUTH_URL') ?? '(unset -> http://localhost:5173)'))
console.log('[dev:staging] database        ' + neonHost)
console.log('[dev:staging] production is not reachable from here — that is the point')

// ---- 3. Refuse to fight a sibling for a port -------------------------------------------------------

/** Resolves true if something is already LISTENING on `port`. Opens nothing, kills nothing. */
const portBusy = (port) =>
  new Promise((resolve) => {
    let settled = false
    const done = (v) => {
      if (settled) return
      settled = true
      probe.destroy()
      resolve(v)
    }
    const probe = net
      .connect({ port, host: '127.0.0.1' })
      .on('connect', () => done(true))
      .on('error', () => done(false))
    setTimeout(() => done(false), 800)
  })

// NEVER kill a process this script did not start. Another session may be working in this same tree, and
// `taskkill //IM node.exe` has taken down a sibling's Vite before
// (.claude/rules/working-in-this-tree.md). A Vite already on 5173 is ALREADY SERVING this working tree,
// so the right move is to say so and stop, not to "clear" the port.
const busy = []
for (const [port, what] of [
  [5173, 'Vite'],
  [3001, 'the API server'],
]) {
  if (await portBusy(port)) busy.push(`${port} (${what})`)
}
if (busy.length) {
  die(
    `already in use: ${busy.join(', ')}.

  That is almost certainly another session's server, and it is already serving THIS working
  tree — Vite picks up your edits over HMR. Nothing was started and nothing was killed.
  If you are sure it is stale, stop it in its own terminal. Never taskkill node.`,
  )
}

// ---- 4. Run both, prefixed, and forward the interrupt ----------------------------------------------

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = []

const start = (name, args) => {
  const child = spawn(npm, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  const prefix = `[${name}] `
  const pipe = (stream, out) => {
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const l of lines) out.write(prefix + l + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code, signal) => {
    console.log(`${prefix}exited (${signal ?? code})`)
    // If one half dies the stack is useless — take the other down rather than leave a half-up
    // environment that LOOKS healthy. These are processes this script started, so this is not the
    // rule above: never kill what you did not start.
    for (const c of children) if (c !== child && c.exitCode === null) c.kill()
    process.exitCode = code ?? 1
  })
  children.push(child)
  return child
}

start('vite', ['run', 'dev'])
start('api ', ['run', 'dev:api'])

// Forward the interrupt to BOTH, then let their own exit handlers unwind. Without this, Ctrl-C kills
// this wrapper and orphans two servers holding the ports the next run will refuse to fight over.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const c of children) if (c.exitCode === null) c.kill(sig)
  })
}
