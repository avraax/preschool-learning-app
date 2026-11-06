import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Byggeklodser's structural guards (Krea PRD-03 §4.1–§4.3, §5). Each one greps SOURCE, so comments are
// stripped first — a rule quoted in a comment must never satisfy (or trip) its own guard.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const SRC = path.join(ROOT, 'src')
const strip = (code: string): string =>
  code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (rel: string): string => strip(readFileSync(path.join(SRC, rel), 'utf8'))

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : []
  })
const SOURCES = walk(SRC).map((p) => ({ rel: path.relative(SRC, p).replace(/\\/g, '/'), code: strip(readFileSync(p, 'utf8')) }))

const GAME = 'components/krea/ByggeklodserGame.tsx'
const SCENE = 'components/krea/blocks/engine/BlockScene.ts'

// §4.3: a tap and a drop both land in `place()`; a second path would let the bounce/hint bookkeeping drift.
test('ONE resolver: resolvePlacement is called exactly once in the whole app, inside the game\'s place()', () => {
  const calls = SOURCES.flatMap((s) => [...s.code.matchAll(/\bresolvePlacement\(/g)].map(() => s.rel))
  const outside = calls.filter((r) => r !== 'components/krea/blocks/blockWorld.ts')
  assert.deepEqual(outside, [GAME], 'resolvePlacement is called from somewhere other than the game')
  const game = read(GAME)
  const place = game.match(/const place = \(target: Target \| null, item: Held\): boolean => \{([\s\S]*?)\n {2}\}\n/)
  assert.ok(place, 'the game has no place() resolver function')
  assert.match(place[1], /resolvePlacement\(worldRef\.current, target, item\)/)
  // Nobody writes a block into the world by hand: the world's internals stay inside blockWorld.ts.
  for (const s of SOURCES) {
    if (s.rel === 'components/krea/blocks/blockWorld.ts') continue
    assert.doesNotMatch(s.code, /\bcells\s*:\s*\{|\.cells\[[^\]]+\]\s*=(?!=)/, `${s.rel} writes the world's cells directly`)
  }
  // Both gestures reach it: the stage tap and the chip drop.
  assert.match(game, /else place\(target, held\)/, 'the tap does not go through place()')
  assert.match(game, /place\(aimTarget\(\), \{ kind: 'cube', color: c \}\)/, 'the drop does not go through place()')
})

// §5 / games-krea.md (Lepper 1973): free build earns NOTHING. W1 IS free build only; W4's model mode will
// bring a task run for a finished MODEL, and this guard then narrows to the free path.
test('free build has no task run — no XP hook anywhere in the game', () => {
  const game = read(GAME)
  assert.doesNotMatch(game, /useTaskRun|completeTask|thenContinue/)
})

// §4.1: render on demand. A continuous loop is the 40%-of-every-second class of cost on the A10X.
test('render on demand: no animation loop, and every requestAnimationFrame is a bounded one', () => {
  const scene = read(SCENE)
  assert.doesNotMatch(scene, /setAnimationLoop/, 'a three.js animation loop renders every frame forever')
  const rafs = [...scene.matchAll(/requestAnimationFrame\(/g)].length
  assert.equal(rafs, 3, 'requestAnimationFrame sites in BlockScene changed — re-check each one is bounded')
  // requestRender: one frame, guarded by `pending`, never re-scheduled from inside its own callback.
  const rr = scene.match(/requestRender\(\): void \{([\s\S]*?)\n {2}\}/)
  assert.ok(rr)
  assert.match(rr[1], /if \(this\.pending \|\| this\.disposed \|\| this\.lost\) return/)
  assert.doesNotMatch(rr[1].replace(/^[\s\S]*?=> \{/, ''), /requestRender|requestAnimationFrame/, 'requestRender schedules itself again')
  // animateTo: re-arms only while t < 1.
  assert.match(scene, /if \(t < 1\) this\.animation = requestAnimationFrame\(tick\)/)
  // The game's drag ghost: one raycast a frame, never a loop.
  assert.match(read(GAME), /if \(raf\.current\) return\s+raf\.current = requestAnimationFrame\(/)
})

// §4.1: exactly one WebGLRenderer, created in an effect on a fresh canvas, disposed with its context.
test('one renderer, made in the effect on a fresh canvas, and fully disposed', () => {
  const renderers = SOURCES.flatMap((s) => [...s.code.matchAll(/new WebGLRenderer\(/g)].map(() => s.rel))
  assert.deepEqual(renderers, [SCENE])
  const stage = read('components/krea/blocks/BlockStage.tsx')
  assert.match(stage, /useEffect\(\(\) => \{\s+const host = hostRef\.current[\s\S]*?document\.createElement\('canvas'\)[\s\S]*?new BlockScene\(/, 'the scene is not built on a fresh canvas inside the effect')
  assert.doesNotMatch(stage, /<canvas/, 'a JSX canvas survives StrictMode\'s remount with a force-lost context')
  const scene = read(SCENE)
  for (const call of ['this.renderer.dispose()', 'this.renderer.forceContextLoss()', 'this.canvas.width = 0']) {
    assert.ok(scene.includes(call), `dispose() lost ${call}`)
  }
  assert.match(scene, /this\.onLost = \(ev: Event\) => \{\s+ev\.preventDefault\(\)/, 'context loss is not prevented, so it can never be restored')
  assert.match(scene, /addEventListener\('webglcontextlost', this\.onLost/)
  assert.match(scene, /addEventListener\('webglcontextrestored', this\.onRestored/)
})

// §4.2: three loads only in the lazy /krea/klodser chunk.
test('three is imported only by the blocks engine, and the game is only ever lazy-loaded', () => {
  const importers = SOURCES.filter((s) => /from\s+'three(?:\/[^']*)?'/.test(s.code)).map((s) => s.rel)
  assert.ok(importers.length > 0)
  for (const r of importers) assert.ok(r.startsWith('components/krea/blocks/engine/'), `${r} imports three`)
  for (const s of SOURCES) assert.doesNotMatch(s.code, /import \* as THREE|from 'three\/addons'/, `${s.rel}: whole-namespace or barrel import`)
  for (const s of SOURCES) {
    if (s.rel === 'App.tsx') continue
    assert.doesNotMatch(s.code, /from '[./]*(components\/krea\/)?ByggeklodserGame'/, `${s.rel} imports the game statically`)
  }
  assert.match(read('App.tsx'), /const ByggeklodserGame = lazy\(\(\) => import\('\.\/components\/krea\/ByggeklodserGame'\)\)/)
})

// §4.2, read from the BUILD, not reasoned about: the entry and everything index.html preloads must not
// contain three. Only meaningful after `npm run build`; without a dist/ it says so rather than passing.
test('the built entry chunk and its preloads do not contain three', (t) => {
  const html = path.join(ROOT, 'dist', 'index.html')
  if (!existsSync(html)) {
    t.skip('UNKNOWN: no dist/ — run `npm run build` to check the built output')
    return
  }
  const index = readFileSync(html, 'utf8')
  const eager = [...index.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
  assert.ok(eager.length > 0)
  const assets = path.join(ROOT, 'dist', 'assets')
  const withThree = readdirSync(assets).filter((f) => f.endsWith('.js') && readFileSync(path.join(assets, f), 'utf8').includes('WebGLRenderer'))
  if (withThree.length === 0) {
    t.skip('UNKNOWN: dist/ predates Byggeklodser — rebuild to check')
    return
  }
  for (const f of eager) assert.ok(!withThree.includes(f), `${f} is loaded on first paint and contains three`)
  assert.ok(withThree.every((f) => f.startsWith('ByggeklodserGame-')), `three leaked into ${withThree.join(', ')}`)
})
