import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { allKreaLines, colorsUsedLine, KREA_COLOR_NAME, NEW_PAPER_LINE, DRAW_ALIVE_LINE } from './kreaPhrases.ts'
import { PALETTE_12 } from './kreaPalette.ts'

// Pinned as LITERALS: the app and the enumerator call the same builder, so "they agree" would pass
// vacuously if the builder itself drifted (audio-system.md protocol, step 4).
test('the Krea lines say exactly this', () => {
  assert.equal(colorsUsedLine(1), 'Du har brugt én farve!')
  assert.equal(colorsUsedLine(4), 'Du har brugt fire farver!')
  assert.equal(colorsUsedLine(12), 'Du har brugt tolv farver!')
  assert.equal(colorsUsedLine(0), DRAW_ALIVE_LINE, 'rainbow/glitter/stamps only must not say "nul farver"')
  assert.equal(NEW_PAPER_LINE, 'Vil du have et nyt papir? Din tegning forsvinder.')
  assert.deepEqual(PALETTE_12.map((c) => KREA_COLOR_NAME[c]), [
    'rød', 'orange', 'gul', 'lysegrøn', 'grøn', 'lyseblå', 'blå', 'lilla', 'lyserød', 'brun', 'sort', 'hvid',
  ])
})

// Krea DESCRIBES, it never grades the product (PRD §5). These are the three words that would do it.
test('no Krea line praises or grades the picture', () => {
  for (const line of allKreaLines()) assert.doesNotMatch(line.toLowerCase(), /flot|smuk|dygtig/, line)
  // …and nothing in the Krea components composes one inline, past the builder.
  const dir = new URL('../components/krea/', import.meta.url)
  const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  for (const f of files) {
    const code = readFileSync(new URL(f.replace(/\\/g, '/'), dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(code, /['"`][^'"`]*\b(flot|smuk|dygtig)/i, f)
  }
})

test('every Krea line is in the prebake enumeration', async () => {
  const { collectNarrationClips } = await import('../../shared-narration-clips.js')
  const texts = new Set(collectNarrationClips().map((c: { text: string }) => c.text))
  const missing = allKreaLines().filter((l) => !texts.has(l))
  assert.deepEqual(missing, [])
})

// Fri Tegning never earns XP (PRD §2.1.2, Lepper 1973): free drawing must not become a task.
test('Fri Tegning has no task run — it earns nothing', () => {
  const code = readFileSync(new URL('../components/krea/FriTegningGame.tsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /useTaskRun|grantTaskXp|useBrowseXp|completeTask/)
  assert.doesNotMatch(code, /krea\.draw['"]\s*[,}]\s*\)/, 'krea.draw passed to an XP hook')
})
