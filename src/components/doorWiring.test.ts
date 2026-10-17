// The four-door front page's WIRING, guarded as SOURCE (Category restructure PRD-01 §7).
//
// `doors.test.ts` proves the map is right; it cannot see whether the components USE it
// (game-development.md, "a config/data test cannot see whether the component uses the config"). These
// read the .tsx files as text, comments stripped, so a prose mention can never satisfy an assertion.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const strip = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
const codeOf = (rel: string): string => strip(readFileSync(path.join(SRC, rel), 'utf8'))

const tsxUnder = (dir: string): string[] =>
  readdirSync(path.join(SRC, dir)).flatMap((name) => {
    const rel = path.join(dir, name)
    if (statSync(path.join(SRC, rel)).isDirectory()) return tsxUnder(rel)
    return name.endsWith('.tsx') ? [rel] : []
  })

// T1: ~20 games used to hard-code their back route, so merging two menus would have sent Stav Ordet's
// and every Krea game's back arrow to a retired menu (a double hop on staging, a bounce home on prod).
test('no game hard-codes a back route — GameShell derives it from the game\'s section', () => {
  const offenders = tsxUnder('components').filter((f) => /\bback(Route|Path)\s*[=:]/.test(codeOf(f)) && !f.endsWith('GameShell.tsx'))
  assert.deepEqual(offenders, [], `hard-coded back route in: ${offenders.join(', ')}`)
  const shell = codeOf('components/common/GameShell.tsx')
  assert.match(shell, /const backRoute = menuRouteFor\(categoryId as SectionId, fourDoorsShown\(\)\)/)
  assert.match(shell, /<BackButton to=\{backRoute\}/)
  assert.ok(!/backRoute\s*[?]?:\s*string/.test(shell), 'GameShell grew a backRoute prop again')
})

// A3: the colour alias is registered once, before the first render, from the same gate as the doors.
test('the door colour alias is registered at startup from the four-door gate', () => {
  const main = codeOf('main.tsx')
  assert.match(main, /setCategoryPaletteAlias\(paletteAliasFor\(fourDoorsShown\(\)\)\)/)
  assert.ok(main.indexOf('setCategoryPaletteAlias(') < main.indexOf('createRoot('), 'alias must be set before render')
})
