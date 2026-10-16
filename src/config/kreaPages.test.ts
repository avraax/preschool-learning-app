import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { KREA_PAGES } from './kreaPages.ts'
import { KREA_FAMILIES } from './kreaSubjects.ts'
import { PAGE_REGIONS } from './kreaPageRegions.ts'

const asset = (f: string) => new URL(`../assets/games/krea/pages/${f}`, import.meta.url)

test('v1 content: 3 pages per family, ids are letters only', () => {
  assert.equal(KREA_PAGES.length, 12)
  for (const fam of KREA_FAMILIES) assert.equal(KREA_PAGES.filter((p) => p.family === fam).length, 3, fam)
  for (const p of KREA_PAGES) {
    assert.match(p.id, /^[a-z]+$/)
    assert.match(p.doneLine, /^Se, .+!$/, p.id)
  }
})

test('every page has its generated regions and both art files, and the label map is a PNG', () => {
  for (const p of KREA_PAGES) {
    const r = PAGE_REGIONS[p.id]
    assert.ok(r, `${p.id}: run node scripts/krea-regions.mjs`)
    // Enough to be a picture, few enough for a five-year-old to finish.
    assert.ok(r.count >= 3 && r.count <= 30, `${p.id}: ${r.count} regions`)
    assert.equal(r.boxes.length, r.count)
    assert.ok(existsSync(asset(`${p.id}.line.webp`)), `${p.id}.line.webp`)
    // NEVER a lossy format for the label map: the PNG signature, not just the extension.
    const head = readFileSync(asset(`${p.id}.regions.png`)).subarray(0, 8)
    assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${p.id}.regions.png is not a PNG`)
  }
})

test('difficulty: Farvelæg only widens the palette (EXEMPT), Tegn med Mig has a real level axis', async () => {
  const { EXEMPT, TUNING, KREA_PALETTE, KREA_GUIDE } = await import('./difficulty.ts')
  assert.ok((EXEMPT['krea.color'] ?? '').length > 30)
  assert.equal(TUNING['krea.color'], KREA_PALETTE)
  assert.ok(!('krea.guide' in EXEMPT), 'Tegn med Mig must differ at every level')
  assert.equal(TUNING['krea.guide'], KREA_GUIDE)
})

test('the game imports every page statically (a missing page is a build error)', () => {
  const idx = readFileSync(new URL('../assets/games/krea/pages/index.ts', import.meta.url), 'utf8')
  for (const p of KREA_PAGES) {
    assert.match(idx, new RegExp(`from '\\./${p.id}\\.regions\\.png'`), p.id)
    assert.match(idx, new RegExp(`from '\\./${p.id}\\.line\\.webp'`), p.id)
  }
})
