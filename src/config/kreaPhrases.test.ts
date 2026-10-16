import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { allKreaLines, KREA_COLOR_NAME, KREA_RAINBOW_NAME, NEW_BOARD_LINE, NEW_PAPER_LINE } from './kreaPhrases.ts'
import { PALETTE_12 } from './kreaPalette.ts'

// Pinned as LITERALS: the app and the enumerator call the same builder, so "they agree" would pass
// vacuously if the builder itself drifted (audio-system.md protocol, step 4).
test('the Krea lines say exactly this', () => {
  assert.equal(KREA_RAINBOW_NAME, 'regnbue')
  assert.equal(NEW_PAPER_LINE, 'Vil du have et nyt papir? Din tegning forsvinder.')
  assert.equal(NEW_BOARD_LINE, 'Vil du have en ny plade? Dine perler forsvinder.')
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

// The step and done lines are whole sentences, one clip each — pinned as literals for a sample, and the
// enumerated set must hold every step of every subject and every page's done line.
test('Tegn med Mig and Farvelæg speak exactly these lines', async () => {
  const { KREA_SUBJECTS } = await import('./kreaSubjects.ts')
  const { KREA_PAGES } = await import('./kreaPages.ts')
  const kat = KREA_SUBJECTS.find((s) => s.id === 'kat')!
  assert.equal(kat.steps[0].line, 'Tegn en stor cirkel til kattens hoved.')
  assert.equal(kat.doneLine, 'Se, katten hopper!')
  assert.equal(KREA_SUBJECTS.find((s) => s.id === 'sommerfugl')!.steps[1].line, 'Tegn en stor vinge. Den anden vinge kommer af sig selv.')
  assert.equal(KREA_PAGES.find((p) => p.id === 'tog')!.doneLine, 'Se, toget kører!')
  const all = new Set(allKreaLines())
  for (const s of KREA_SUBJECTS) for (const l of [...s.steps.map((x) => x.line), s.doneLine]) assert.ok(all.has(l), l)
  for (const p of KREA_PAGES) assert.ok(all.has(p.doneLine), p.doneLine)
})

// The finished pieces DO earn: one task per piece, through the seam, and the game actually judges steps
// / fills regions with the pure modules (a data test can't see whether the component uses them).
test('Tegn med Mig and Farvelæg grant one task per finished piece and use the pure engines', () => {
  const strip = (f: string) =>
    readFileSync(new URL(`../components/krea/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const [file, id] of [['TegnMedMigGame.tsx', 'krea.guide'], ['FarvelaegGame.tsx', 'krea.color']]) {
    const c = strip(file)
    assert.match(c, new RegExp(`GAME_ID = '${id.replace('.', '\\.')}'`), file)
    assert.match(c, /useTaskRun\(\{ tasksInRound: KREA_TASKS_IN_ROUND, gameId: GAME_ID \}\)/, file)
    assert.equal((c.match(/run\.completeTask\(true\)/g) ?? []).length, 1, `${file}: one task per finished piece`)
  }
  assert.match(strip('TegnMedMigGame.tsx'), /judgeStep\(step, ink, toleranceInPaper\(tuning\.tolerancePx/)
  assert.match(strip('canvas/FillSurface.tsx'), /regionAt\(labels\.current/)
  assert.match(strip('canvas/FillSurface.tsx'), /paintRegion\(img\.data, lab/)
})

// Fri Tegning never earns XP (PRD §2.1.2, Lepper 1973): free drawing must not become a task.
test('Fri Tegning has no task run — it earns nothing', () => {
  const code = readFileSync(new URL('../components/krea/FriTegningGame.tsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /useTaskRun|grantTaskXp|useBrowseXp|completeTask/)
  assert.doesNotMatch(code, /krea\.draw['"]\s*[,}]\s*\)/, 'krea.draw passed to an XP hook')
})
