import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The harness build (`--mode harness`) exists so the REAL bundle can be perf-measured and route-swept:
// `import.meta.env.DEV` is false in every `vite build`, so a normal build tree-shakes devHarness away
// and a preview build stops at the auth gate. That capability is only acceptable while it cannot reach a
// deploy, so this file guards the wiring rather than the behaviour.
//
// These read SOURCE, so per CLAUDE.md they strip comments first — the paragraphs explaining `__HARNESS__`
// mention the very strings being asserted, and a bare `includes()` would be satisfied by the prose while
// the code was gone.

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const viteConfig = strip(readFileSync(join(repo, 'vite.config.ts'), 'utf8'))
const harness = strip(readFileSync(join(repo, 'src', 'utils', 'devHarness.ts'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))

test('the bypass is a SEPARATE build-time flag, not a widening of DEV', () => {
  // If this ever becomes `DEV = true` or keys off a runtime value (a query param, localStorage, a
  // header), the bypass stops being statically removable and starts shipping.
  assert.match(harness, /const HARNESS = typeof __HARNESS__ !== 'undefined' && __HARNESS__ === true/)
  assert.match(harness, /export const DEV = IS_DEV \|\| HARNESS/)
  assert.match(harness, /const IS_DEV = import\.meta\.env\?\.DEV \?\? false/)
})

test('__HARNESS__ is defined for EVERY mode, so other builds get a literal false', () => {
  // A `define` that only exists in harness mode would leave `__HARNESS__` undefined elsewhere — the
  // code would still be safe (typeof guard) but would NOT be tree-shaken, so the bypass would sit in
  // the deploy bundle waiting for someone to set a global.
  assert.match(viteConfig, /__HARNESS__: JSON\.stringify\(harness\)/)
  assert.match(viteConfig, /const harness = mode === 'harness'/)
})

test('a harness build is production-shaped, or its measurements are worthless', () => {
  assert.match(viteConfig, /'process\.env\.NODE_ENV': '"production"'/)
})

test('the syntax floor is pinned to the target device, not left to a default', () => {
  // The child's iPad Pro 12.9" 2nd gen caps at iPadOS 17.7. Vite's default happens to be lower today;
  // an upgrade could raise it, and the only symptom is a blank screen on that one device.
  assert.match(viteConfig, /target: \['safari17', 'ios17'\]/)
})

test('the Node runtime is pinned in the repo, not per Vercel project', () => {
  // Same shape as the syntax floor above: a DEFAULT that happens to be fine today is not a decision.
  // Vercel assigns a Node version per PROJECT, and a project created later gets whatever the current
  // default is — the staging project was created on 24.x while production runs 22.x. Two tiers on
  // different Node majors makes staging a worse rehearsal for exactly the failures it exists to catch,
  // and the setting is invisible from this repo. `engines.node` overrides the project setting for BOTH
  // projects, so the version becomes a tracked, reviewable fact instead of a dashboard toggle.
  assert.equal(pkg.engines?.node, '22.x', 'the Node runtime is no longer pinned in package.json')
})

test('no deploy script builds the harness', () => {
  // Vercel runs `npm run build`. Every script that could be a deploy path must not select the mode.
  for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
    if (name === 'build:harness') continue
    assert.ok(
      !/--mode\s+harness/.test(cmd),
      `script "${name}" builds the harness (${cmd}) — that is a deploy path away from shipping an auth bypass`
    )
  }
  assert.equal(pkg.scripts['build:harness']?.includes('--mode harness'), true)
  assert.ok(!/--mode\s+harness/.test(pkg.scripts.build), 'the plain build must never be a harness build')
})
