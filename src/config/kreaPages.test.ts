import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { KREA_PAGES } from './kreaPages.ts'
import { KREA_FAMILIES } from './kreaSubjects.ts'
import { PAGE_REGIONS } from './kreaPageRegions.ts'

const asset = (f: string) => new URL(`../assets/games/krea/pages/${f}`, import.meta.url)

test('content: 18 pages per family, ids are letters only and unique', () => {
  assert.equal(KREA_PAGES.length, 72)
  assert.equal(new Set(KREA_PAGES.map((p) => p.id)).size, KREA_PAGES.length)
  for (const fam of KREA_FAMILIES) assert.equal(KREA_PAGES.filter((p) => p.family === fam).length, 18, fam)
  for (const p of KREA_PAGES) {
    assert.match(p.id, /^[a-z]+$/)
    assert.match(p.doneLine, /^Se, .+!$/, p.id)
  }
})

test('every page has its generated regions and both art files, and the label map is a PNG', () => {
  for (const p of KREA_PAGES) {
    const r = PAGE_REGIONS[p.id]
    assert.ok(r, `${p.id}: run node scripts/krea-regions.mjs`)
    // Enough to be a picture, few REQUIRED enough for a five-year-old to finish; the optional ones
    // (small parts, the background) never count against the finish.
    const required = r.count - r.optional.length
    assert.ok(required >= 3 && required <= 30, `${p.id}: ${required} required regions`)
    assert.equal(r.boxes.length, r.count)
    assert.ok(r.optional.every((id) => Number.isInteger(id) && id >= 1 && id <= r.count), `${p.id}: optional ids in range`)
    // The background is paintable on every page (owner 2026-11-04): the largest box spans the page.
    assert.equal(p.outside, 'optional', p.id)
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
    // The picker shows the small thumb, never the 1024² layer (72 full decodes ≈ 300 MB on the iPad).
    assert.match(idx, new RegExp(`from '\\./${p.id}\\.thumb\\.webp'`), `${p.id}: run node scripts/krea-regions.mjs`)
    assert.ok(existsSync(asset(`${p.id}.thumb.webp`)), `${p.id}.thumb.webp`)
  }
})
