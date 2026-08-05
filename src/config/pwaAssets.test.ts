import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// EVERY asset the shipped HTML and the PWA manifest reference must exist in `public/` **and be TRACKED BY
// GIT** — Vercel builds from the repository, not from this disk.
//
// This is not hypothetical. `.gitignore` carries a blanket `*.json` (for credentials) with a handful of
// `!` exceptions, and `public/manifest.json` was never one of them. So the manifest existed locally,
// every local build and preview was perfect, and production served `index.html` for `/manifest.json` —
// the SPA rewrite catching a path the filesystem phase could not satisfy. Safari then found no
// installable web app and added a plain BOOKMARK to the iPad home screen, which opens in the DEFAULT
// BROWSER (Chrome) instead of standalone. Nothing local could ever reproduce it.
//
// Same shape as the `.ts`-import trap in `.claude/rules/api-endpoints.md`: green everywhere except the
// one place that matters.

const ROOT = process.cwd()

const isTracked = (file: string): boolean =>
  spawnSync('git', ['ls-files', '--error-unmatch', file], { cwd: ROOT, encoding: 'utf8' }).status === 0

/** Root-relative URLs referenced from the document head (manifest, icons, favicons). */
const htmlRefs = (): string[] => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  return [...html.matchAll(/(?:href|src)\s*=\s*["'](\/[^"']+)["']/g)].map((m) => m[1])
}

/** Icon paths declared by the manifest itself (relative to the manifest's own location, i.e. the root). */
const manifestRefs = (): string[] => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8')) as {
    icons?: Array<{ src?: string }>
  }
  return (manifest.icons ?? []).map((i) => `/${String(i.src ?? '').replace(/^\//, '')}`)
}

test('git tracking is actually observable here', () => {
  // If `git ls-files` cannot run, every assertion below passes vacuously — and this guard exists
  // precisely because the failure it catches is invisible without it.
  assert.ok(isTracked('index.html'), 'git ls-files is not working in this environment')
  assert.ok(!isTracked('public/definitely-not-a-real-file.json'), 'the tracking check never says no')
})

test('the PWA manifest is committed, not just present on disk', () => {
  // The specific file that broke, called out by name so the failure message says what to do.
  assert.ok(existsSync(path.join(ROOT, 'public', 'manifest.json')), 'public/manifest.json is missing')
  assert.ok(
    isTracked('public/manifest.json'),
    'public/manifest.json is NOT tracked by git — Vercel will build without it and /manifest.json will ' +
      'answer with index.html. Add a `!public/manifest.json` negation to .gitignore.',
  )
})

test('every asset index.html and the manifest reference is present AND tracked', () => {
  const refs = [...new Set([...htmlRefs(), ...manifestRefs()])]
  assert.ok(refs.length > 5, `only found ${refs.length} references — the parser is probably wrong`)

  const missing: string[] = []
  const untracked: string[] = []
  for (const ref of refs) {
    // `/src/**` is the dev entry (Vite rewrites it at build) and `/assets/**` is build OUTPUT — neither
    // lives in public/, and both are covered by the build itself failing.
    if (ref.startsWith('/src/') || ref.startsWith('/assets/')) continue
    const rel = path.posix.join('public', ref.replace(/^\//, ''))
    if (!existsSync(path.join(ROOT, rel))) missing.push(rel)
    else if (!isTracked(rel)) untracked.push(rel)
  }
  assert.deepEqual(missing, [], `referenced but absent from public/:\n  ${missing.join('\n  ')}`)
  assert.deepEqual(
    untracked,
    [],
    `present locally but NOT COMMITTED — production will 404 or fall through to the SPA rewrite:\n  ${untracked.join('\n  ')}`,
  )
})

test('the manifest still declares a standalone web app', () => {
  // `display` is what makes iOS install a web app rather than a bookmark; without it the home-screen icon
  // opens in the default browser even when the file itself is served correctly.
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8')) as {
    display?: string
    start_url?: string
    scope?: string
  }
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
})
