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
  assert.match(place[1], /resolvePlacement\(worldRef\.current, target, item, facingNow\(\)\)/)
  // Nobody writes a block into the world by hand: the world's internals stay inside blockWorld.ts.
  for (const s of SOURCES) {
    if (s.rel === 'components/krea/blocks/blockWorld.ts') continue
    assert.doesNotMatch(s.code, /\bcells\s*:\s*\{|\.cells\[[^\]]+\]\s*=(?!=)/, `${s.rel} writes the world's cells directly`)
  }
  // Both gestures reach it: the stage tap and the chip drop.
  assert.match(game, /else place\(target, held\)/, 'the tap does not go through place()')
  assert.match(game, /place\(aimTarget\(\), item\)/, 'the drop does not go through place()')
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
  assert.equal(rafs, 5, 'requestAnimationFrame sites in BlockScene changed — re-check each one is bounded')
  // requestRender: one frame, guarded by `pending`, never re-scheduled from inside its own callback.
  const rr = scene.match(/requestRender\(\): void \{([\s\S]*?)\n {2}\}/)
  assert.ok(rr)
  assert.match(rr[1], /if \(this\.pending \|\| this\.disposed \|\| this\.lost\) return/)
  assert.doesNotMatch(rr[1].replace(/^[\s\S]*?=> \{/, ''), /requestRender|requestAnimationFrame/, 'requestRender schedules itself again')
  // …and the frame it draws asks for no next one (that is a loop by another name).
  const render = scene.match(/private render\(\): void \{([\s\S]*?)\n {2}\}/)
  assert.ok(render, 'BlockScene has no render()')
  assert.doesNotMatch(render[1], /requestRender|requestAnimationFrame|setAnimationLoop/, 'render() schedules the next frame')
  // The pick-up rise (T59B2): re-arms only while t < 1, then stops.
  assert.match(scene, /this\.liftAnim = t < 1 \? requestAnimationFrame\(tick\) : 0/)
  // animateTo: re-arms only while t < 1.
  assert.match(scene, /if \(t < 1\) this\.animation = requestAnimationFrame\(tick\)/)
  // The game's drag ghost: one raycast a frame, never a loop.
  assert.match(read(GAME), /if \(raf\.current\) return\s+raf\.current = requestAnimationFrame\(/)
})

// Measured 2026-11-06 (perf.mjs, 158 blocks, 4× CPU): turning cost 85% busy until these two went in, 21% after.
test('a turn costs one draw: no React render per camera move, no shadow pass per frame', () => {
  const game = read(GAME)
  assert.doesNotMatch(game, /useState<Pose>/, 'the camera pose is React state — every turn move re-renders the game')
  // No zoom buttons any more (owner 2026-11-07), so nothing in the game listens to the pose at all.
  assert.doesNotMatch(game, /onPose=/, 'the game re-renders on camera moves again')
  const scene = read(SCENE)
  assert.match(scene, /this\.renderer\.shadowMap\.autoUpdate = false/, 'the shadow map re-renders on every frame of a turn')
  const setBlocks = scene.slice(scene.indexOf('  setBlocks('), scene.indexOf('  setGhost('))
  assert.match(setBlocks, /this\.renderer\.shadowMap\.needsUpdate = true/, 'a block change no longer refreshes the shadow')
})

// Owner 2026-11-07: three tools only — Viskelæder, Fortryd, Ny. A pinch (or the wheel) zooms; no + / − / home.
test('the panel holds three tools, and the camera zooms by pinch or wheel', () => {
  const game = read(GAME)
  for (const id of ['eraser', 'undo', 'new-build']) assert.match(game, new RegExp(`dataId="${id}"`), `${id} is gone`)
  for (const id of ['zoom-in', 'zoom-out', 'home']) assert.doesNotMatch(game, new RegExp(`dataId="${id}"`), `${id} is back`)
  const stage = read('components/krea/blocks/BlockStage.tsx')
  assert.match(stage, /host\.addEventListener\('wheel', wheel, \{ passive: false \}\)/, 'a mouse cannot zoom')
  assert.match(stage, /pinchZoom\(g\.pinchPose/, 'a pinch no longer zooms')
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
  // three's module-level DFG lookup texture keeps a listener per renderer; without this every closed game
  // stayed reachable (heap snapshot, 2026-11-06). It must run BEFORE the materials are disposed, which
  // drops the properties it is read from.
  const dispose = scene.slice(scene.indexOf('  dispose(): void {'))
  const lut = dispose.indexOf('dfgLUT?.value?.dispose()')
  assert.ok(lut > 0, 'dispose() no longer releases three\'s shared DFG lookup texture — a closed game leaks')
  assert.ok(lut < dispose.indexOf('this.scene.traverse('), 'the DFG texture is released after the materials are gone')
  assert.match(scene, /this\.onLost = \(ev: Event\) => \{\s+ev\.preventDefault\(\)/, 'context loss is not prevented, so it can never be restored')
  // The feedback screenshot copies the canvas after the frame; a cleared buffer sent the owner an empty
  // sky (F6FB9, 2026-11-06).
  assert.match(scene, /new WebGLRenderer\(\{[^}]*preserveDrawingBuffer: true/, 'the feedback screenshot would capture an empty sky')
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

// The open world (owner G9BA8, then 2026-11-07: Normal and Svær are the same world, Let a plate): the
// GPU buffers are bounded by MAX_BLOCKS (never the 128×128×8 area), and only the open world pans.
test('the open world is Normal + Svær, Let a plate; buffers bounded by MAX_BLOCKS; only the world pans', () => {
  const diff = readFileSync(new URL('../../../config/difficulty.ts', import.meta.url), 'utf8')
  const table = diff.slice(diff.indexOf('export const KREA_BLOCKS'), diff.indexOf('}', diff.indexOf('svaer:', diff.indexOf('export const KREA_BLOCKS'))) + 1)
  assert.equal((table.match(/horizon: true/g) ?? []).length, 2)
  assert.match(table, /normal: \{[^}]*horizon: true/)
  assert.match(table, /svaer: \{[^}]*horizon: true/)
  assert.doesNotMatch(table, /let: \{[^}]*horizon/)
  const scene = readFileSync(new URL('./engine/BlockScene.ts', import.meta.url), 'utf8')
  assert.match(scene, /const capacity = Math\.min\(islandSize \* islandSize \* heightCap, MAX_BLOCKS\)/)
  assert.match(scene, /pan\(from: \{ x: number; y: number \}, to: \{ x: number; y: number \}\): Pose \{\s+if \(!this\.horizon\) return this\.getPose\(\)/)
})

// Owner T59B2: press-and-hold moves a block. A hold that never moved must put it back (the release point,
// seen through the lifted block, is the cell BEHIND it — a 1-cell nudge, measured), and a second finger
// cancels the move rather than dropping it mid-pinch.
test('hold-to-move: an unmoved hold puts the block back; a second finger cancels', () => {
  const stage = readFileSync(new URL('./BlockStage.tsx', import.meta.url), 'utf8')
  assert.match(stage, /onHoldEnd\?\.\(cancelled \|\| !g\.holdMoved \? null : local\(e\)\)/)
  assert.match(stage, /if \(gesture\.current\.holding\) \{\s+gesture\.current\.holding = false\s+holdRef\.current\.onHoldEnd\?\.\(null\)/)
  const game = readFileSync(new URL('../ByggeklodserGame.tsx', import.meta.url), 'utf8')
  assert.match(game, /if \(t\.on !== 'block' \|\| toolRef\.current !== 'block' \|\| confirmOpen\) return false/, 'the eraser (or an open question) can pick blocks up')
})

// Panning cost (owner 2026-11-07, "optimisations"): the shadow map is redrawn only once the view has
// travelled SHADOW_STEP, and re-centred when the gesture ends — never on every frame of a pan.
test('a pan redraws the shadow only every SHADOW_STEP, and settles it at the end', () => {
  const scene = readFileSync(new URL('./engine/BlockScene.ts', import.meta.url), 'utf8')
  assert.match(scene, /if \(Math\.hypot\(t\.x - this\.shadowAt\.x, t\.z - this\.shadowAt\.z\) > SHADOW_STEP\) this\.centreShadow\(t\)/)
  const stage = readFileSync(new URL('./BlockStage.tsx', import.meta.url), 'utf8')
  assert.match(stage, /if \(g\.multi \|\| g\.mousePan\) sceneRef\.current\?\.settleShadow\(\)/)
})
