import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Fyld Båden is the app's quality benchmark and the first game with a full-bleed animated scene, so its
// motion is held to the GPU-only subset Safari 17 (the A10X iPad's terminal OS) composites:
//   - framer's `x`/`y`/`scale`/`rotate` SHORTHANDS run on the main thread every frame (Motion only hands
//     `transform`/`opacity`/`filter`/`clipPath` to WAAPI) — animate a full `transform` string instead;
//   - SPRINGS compile to `linear()` easing, which WebKit 17 will not accelerate — use a cubic-bezier.
// (Harbour PRD-01 §10; WebKit safari-7618 KeyframeEffect::canBeAccelerated; motion.dev/docs/performance.)

const FILES = [
  '../FyldBaadenGame.tsx',
  './Boat.tsx',
  './Quay.tsx',
  './HarbourScene.tsx',
  './Cargo.tsx',
]

const code = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** The balanced `{…}` expression of every `initial=` / `animate=` prop, plus props passed through. */
const motionProps = (src: string): string[] => {
  const out: string[] = []
  for (const m of src.matchAll(/\b(initial|animate)=\{/g)) {
    let depth = 0
    let i = m.index! + m[0].length - 1
    const start = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}' && --depth === 0) break
    }
    out.push(src.slice(start, i + 1))
  }
  return out
}

test('Fyld Båden animates with transform/opacity strings, never framer shorthands', () => {
  let seen = 0
  for (const rel of FILES) {
    const src = code(rel)
    // Animate values computed into a variable first (boatAnimate) are checked where they are built.
    const blocks = [...motionProps(src), ...[...src.matchAll(/const boatAnimate =[\s\S]*?\n\n/g)].map((m) => m[0])]
    seen += blocks.length
    for (const b of blocks) {
      assert.ok(!/\b(x|y|scale|rotate|scaleX|scaleY)\s*:/.test(b), `${rel}: framer shorthand in ${b.trim().slice(0, 120)}`)
      // Motion interpolates toward 'none' by ZEROING each function: `scale(0.7) → 'none'` ends at
      // scale(0) and the element vanishes (shipped once; every loaded crate was 0×0). Write the identity.
      assert.ok(!/transform:\s*(\[[^\]]*)?['"]none['"]/.test(b), `${rel}: transform 'none' as a motion value in ${b.trim().slice(0, 120)}`)
    }
  }
  // Not vacuous: the files really do animate (boat travel, shake, landing, bundle, sail, refill fade).
  assert.ok(seen >= 10, `only ${seen} motion props found — the scan is broken`)
})

test('Fyld Båden uses no spring transitions (they become linear() easing, not GPU-run in Safari 17)', () => {
  for (const rel of FILES) {
    const src = code(rel)
    assert.ok(!/\b(POP|SNAP|BOUNCE)\b/.test(src), `${rel} uses a spring preset from theme/motion`)
    assert.ok(!/type:\s*['"]spring['"]/.test(src), `${rel} declares a spring transition`)
  }
})
