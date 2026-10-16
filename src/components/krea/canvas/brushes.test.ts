import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { drawStroke, type BrushEnv } from './brushes.ts'
import { addStroke, emptyDrawing, seedFor, undo, type Drawing, type Stroke } from './strokeModel.ts'

/** A 2D context that records every call and property write — the "pixels" of a headless replay. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = []
  const fmt = (a: unknown) => (typeof a === 'number' ? a.toFixed(3) : String(a))
  const ctx = new Proxy({}, {
    get: (_t, prop) => (...args: unknown[]) => { log.push(`${String(prop)}(${args.map(fmt).join(',')})`) },
    set: (_t, prop, v) => { log.push(`${String(prop)}=${String(v)}`); return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}

const replay = (d: Drawing, mirrorX?: number): string[] => {
  const { ctx, log } = recorder()
  const env: BrushEnv = {
    ctx,
    scale: 1.5,
    crayonPaint: (c) => `paint:${c}`,
    stampImage: (id) => ({ id }) as unknown as CanvasImageSource,
    mirrorX,
  }
  for (const s of d.strokes) drawStroke(env, s)
  return log
}

const STROKES: Stroke[] = [
  { tool: 'crayon', color: 'roed', points: [10, 10, 60, 40, 120, 90, 200, 95], seed: seedFor(0) },
  { tool: 'glitter', points: [300, 300, 380, 340, 460, 300, 540, 360], seed: seedFor(1) },
  { tool: 'rainbow', points: [100, 600, 300, 620, 500, 600], seed: seedFor(2) },
  { tool: 'stamp', stamp: 'sun', x: 900, y: 200, size: 150, seed: seedFor(3) },
  { tool: 'eraser', points: [50, 50, 90, 90], seed: seedFor(4) },
]

test('a replay is deterministic: the same list paints the same picture, glitter and stamps included', () => {
  let d = emptyDrawing()
  for (const s of STROKES) d = addStroke(d, s)
  assert.deepEqual(replay(d), replay(d))
  assert.ok(replay(d).some((l) => l.startsWith('fillStyle=#')), 'glitter drew no stars — the test would be vacuous')
})

test('undo then replay paints exactly what the picture looked like before that stroke', () => {
  let before = emptyDrawing()
  for (const s of STROKES.slice(0, 4)) before = addStroke(before, s)
  const after = undo(addStroke(before, STROKES[4]))
  assert.deepEqual(replay(after), replay(before))
})

test('a different seed scatters the glitter differently (the seed is what is load-bearing)', () => {
  const a = addStroke(emptyDrawing(), { ...STROKES[1], seed: 1 } as Stroke)
  const b = addStroke(emptyDrawing(), { ...STROKES[1], seed: 2 } as Stroke)
  assert.notDeepEqual(replay(a), replay(b))
})

test('a mirror axis draws every stroke twice, reflected', () => {
  const d = addStroke(emptyDrawing(), STROKES[0])
  const plain = replay(d).filter((l) => l.startsWith('stroke(')).length
  assert.equal(replay(d, 600).filter((l) => l.startsWith('stroke(')).length, plain * 2)
  assert.ok(replay(d, 600).includes(`moveTo(${((2 * 600 - 10) * 1.5).toFixed(3)},${(10 * 1.5).toFixed(3)})`))
})

// The replay test proves only what the renderer does with its seed; this pins that nothing in it reaches
// for an unseeded source, which would re-roll the picture on every undo.
test('no unseeded randomness in the renderers', () => {
  const code = readFileSync(new URL('./brushes.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /Math\.random|Date\.now|performance\.now|crypto\./)
})

// The live layer paints a stroke a few points at a time; the committed stroke is painted whole. Both
// must lay down exactly the same marks, or the line visibly changes the moment the finger lifts.
test('painting a stroke incrementally makes exactly the marks of painting it whole', async () => {
  const { createPainter } = await import('./brushes.ts')
  const GEOM = /^(moveTo|quadraticCurveTo|lineTo|stroke|fill|closePath|strokeStyle=|fillStyle=)/
  for (const s of STROKES.filter((x) => x.tool !== 'stamp') as Array<Stroke & { points: number[] }>) {
    const whole = recorder()
    const env = (ctx: CanvasRenderingContext2D): BrushEnv => ({ ctx, scale: 1.5, crayonPaint: (c) => `paint:${c}`, stampImage: () => null })
    createPainter(s).paint(env(whole.ctx), true)
    const live = recorder()
    const growing = { ...s, points: s.points.slice(0, 2) }
    const painter = createPainter(growing)
    for (let i = 2; i < s.points.length; i += 2) {
      growing.points.push(s.points[i], s.points[i + 1])
      painter.paint(env(live.ctx), false)
    }
    painter.paint(env(live.ctx), true)
    // Style is re-set on every frame; what matters is the same geometry in the same order.
    const geom = (log: string[]) => log.filter((l) => GEOM.test(l)).filter((l, i, a) => !(l.endsWith('=') || (/=/.test(l) && a[i - 1] === l)))
    assert.deepEqual(geom(live.log).filter((l) => !/Style=/.test(l)), geom(whole.log).filter((l) => !/Style=/.test(l)), s.tool)
  }
})
