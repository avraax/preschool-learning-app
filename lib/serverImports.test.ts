import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// EVERY relative import in the server-reachable graph must end in `.js`.
//
// Vercel compiles each `api/**` + `lib/**` file to a SIBLING `.js` and rewrites no specifiers, so a
// `.ts` specifier ships verbatim and dies at import with `ERR_MODULE_NOT_FOUND` for a path ending `.ts`.
// Nothing local catches it: `dev-server.js` runs the real `.ts` files off disk under Node's type
// stripping, and `typecheck:server` resolves `.ts` happily because `allowImportingTsExtensions` is on —
// it describes a bundler that does not exist at deploy time.
//
// This has now shipped TWICE. The accounts release went out with every auth/profiles/progress endpoint
// 500ing, and on 2026-08-04 a single DYNAMIC `await import('./auth.ts')` inside the OAuth callback took
// Google sign-in down in production while every check was green — reachable only after a real Google
// round trip, which is why it survived so long. The rule is in `.claude/rules/api-endpoints.md`; this is
// the mechanical version of it.
//
// The mirror-image rule applies to `src/**` (the client/test graph uses `.ts`), and the two graphs
// OVERLAP at `src/config` — so this guard checks only the files Vercel actually compiles.

const ROOTS = ['lib', 'api']

const walk = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|js)$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap(walk)

test('the server graph contains files to check', () => {
  // A walk that silently finds nothing would make every assertion below vacuous.
  assert.ok(files.length > 5, `only found ${files.length} server files`)
})

test('no relative import in api/ or lib/ ends in .ts', () => {
  // Covers BOTH forms. The one that shipped was a dynamic `import('./auth.ts')`, which no type-check and
  // no local run can catch, so matching only static `from '…'` would miss the exact bug this exists for.
  const pattern = /(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]*\.ts)['"]/g
  const offenders: string[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(pattern)) offenders.push(`${file} → ${m[1]}`)
  }
  assert.deepEqual(
    offenders,
    [],
    `these ship to Vercel as-is and will throw ERR_MODULE_NOT_FOUND at runtime:\n  ${offenders.join('\n  ')}`,
  )
})

test('relative imports carry an extension at all', () => {
  // Extensionless is the other half of the same failure: Node's ESM resolver rejects it outright.
  const pattern = /(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]*)['"]/g
  const offenders: string[] = []
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (!/\.(js|json|mjs|cjs)$/.test(m[1])) offenders.push(`${file} → ${m[1]}`)
    }
  }
  assert.deepEqual(offenders, [], `extensionless relative imports:\n  ${offenders.join('\n  ')}`)
})
