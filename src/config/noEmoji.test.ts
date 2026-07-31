import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// De-emoji PRD-01 W0 — the regression guard that turns "get rid of the emoji" into an invariant.
//
// The app is baked soft-3D everywhere that matters, so a remaining emoji is a visible seam: flat 2D,
// a foreign palette, and rendered by the OS font — which means it CHANGES SHAPE between the iPadOS
// 17.7 floor device and any newer one, and a few glyphs don't exist on 17 at all. Child-facing
// surfaces get baked art or nothing; adult/dev surfaces get lucide-react.
//
// Every remaining occurrence must be named in ALLOWED_FILES below with the workstream that removes
// it. Each workstream shrinks that list; W7 empties it and deletes it.
//
// Dump the current inventory (regenerates plans/de-emoji/emoji-inventory-*.md by hand):
//   EMOJI_REPORT=scan.md node --test "src/config/noEmoji.test.ts"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = path.join(ROOT, 'src')

// Emoji proper, plus the dingbat symbols that get USED as icons but are not Extended_Pictographic:
// U+2713..U+2718 (check / ballot X / multiplication X) and U+2605..U+2606 (star). Written as escapes
// so this guard is not itself a source of emoji.
const ICONIC_SYMBOLS = '\\u2713-\\u2718\\u2605\\u2606'
const GLYPH = new RegExp(`[\\p{Extended_Pictographic}${ICONIC_SYMBOLS}]`, 'gu')

// Bucket E (PRD §7, owner option (a)): the glyph prefixes on `console.error(...)` are never rendered —
// they only show up in devtools and in captured bug-report diagnostics rings, where they make
// scanning easier. Flip to false to strip them too.
const ALLOW_LOG_PREFIXES = true
const LOG_CALL = /\b(?:console\.\w+|originalConsole|addLog)\s*\(/

// file → { max: glyphs still allowed, why }. `max` counts only occurrences the log rule does NOT
// already cover, so it can only ever shrink.
const ALLOWED_FILES: Record<string, { max: number; why: string }> = {
  // W6 — the 45 reward renders; `Reward.emoji` dies with the last one.
  'src/config/stickers.ts': { max: 50, why: 'W6 reward art' },
  // Bucket E, but the prefix sits on a `message:` field rather than on the log call itself.
  'src/utils/remoteConsole.ts': { max: 1, why: 'log prefix (PRD §7)' },
  // NOT in the de-emoji inventory — the child-profile avatars arrived with the accounts work AFTER
  // it was taken. They are child-facing (D1) AND persisted (`ChildProfile.avatarEmoji`, validated
  // server-side by `cleanAvatar` in api/profiles.ts as "a pictograph"), so removing them needs baked
  // avatar art PLUS a profile-schema migration — its own batch. Prompts are speced in
  // plans/de-emoji/de-emoji-avatar-prompts.md (12 portraits, owner-locked 2026-07-31).
  // Any further surface that renders an avatar needs art or its own entry here.
  'src/components/auth/CreateProfileDialog.tsx': { max: 12, why: 'accounts: child-profile avatars, needs art + schema' },
}

// W4 removed, verified against art coverage before deletion (see `gameIcons.test.ts` /
// `themes.test.ts` for the invariants that replaced them):
//   categoryThemes.ts (24)  · every `<section>.<game.id>` resolves in the baked icon registry
//   helpers.ts SECTION_ICONS (5) + kidTheme icon/iconSize · nothing ever rendered `CategoryTheme.icon`
//   *.tokens.ts selectorEmoji (6) · every registered skin ships `selectorThumb`

type Hit = { file: string; line: number; glyphs: string; count: number; text: string; logged: boolean }

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

// Blank out comments while preserving line numbers. Quote-aware on purpose: `import.meta.glob('./*.webp')`
// would otherwise read as a block-comment opener and blind the rest of the file. Ambiguity (a regex
// literal holding a quote) leaves us in "code", which can only ever produce a LOUD false positive.
const blankComments = (src: string): string => {
  const out = src.split('')
  let i = 0
  const keepNewlines = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      keepNewlines(i, end === -1 ? src.length : end)
      i = end === -1 ? src.length : end
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      keepNewlines(i, stop)
      i = stop
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      i++
      while (i < src.length && src[i] !== c) i += src[i] === '\\' ? 2 : 1
      i++
      continue
    }
    i++
  }
  return out.join('')
}

const scan = (): Hit[] => {
  const hits: Hit[] = []
  for (const file of sourceFiles(SRC)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const raw = readFileSync(file, 'utf-8').split(/\r?\n/)
    blankComments(readFileSync(file, 'utf-8'))
      .split(/\r?\n/)
      .forEach((line, i) => {
        const found = [...line.matchAll(GLYPH)].map((m) => m[0])
        if (!found.length) return
        hits.push({
          file: rel,
          line: i + 1,
          glyphs: [...new Set(found)].join(' '),
          count: found.length,
          text: raw[i].trim().slice(0, 100),
          logged: LOG_CALL.test(line),
        })
      })
  }
  return hits
}

const hits = scan()

if (process.env.EMOJI_REPORT) {
  const byFile = new Map<string, number>()
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + h.count)
  writeFileSync(
    process.env.EMOJI_REPORT,
    [
      `${hits.length} lines · ${hits.reduce((a, h) => a + h.count, 0)} glyphs · ${byFile.size} files`,
      ...[...byFile].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${String(n).padStart(3)}  ${f}`),
      '',
      ...hits.map((h) => `${h.file}:${h.line}  ${h.glyphs}${h.logged ? '  [log]' : ''}  | ${h.text}`),
    ].join('\n'),
    'utf-8'
  )
}

const unexcused = hits.filter((h) => !(ALLOW_LOG_PREFIXES && h.logged))

test('no emoji ships outside the de-emoji allowlist', () => {
  const offenders = unexcused.filter((h) => !ALLOWED_FILES[h.file])
  assert.deepEqual(
    offenders.map((h) => `${h.file}:${h.line}  ${h.glyphs}  | ${h.text}`),
    [],
    'child-facing surfaces take baked art or nothing; adult/dev surfaces take lucide-react'
  )
})

test('allowlisted files stay within the glyph count they were granted', () => {
  const over: string[] = []
  for (const [file, { max, why }] of Object.entries(ALLOWED_FILES)) {
    const n = unexcused.filter((h) => h.file === file).reduce((a, h) => a + h.count, 0)
    if (n > max) over.push(`${file}: ${n} glyphs > allowed ${max} (${why})`)
  }
  assert.deepEqual(over, [], 'the allowlist may only shrink — do not add emoji to an allowlisted file')
})

test('the allowlist has no dead entries left behind', () => {
  const dead = Object.entries(ALLOWED_FILES)
    .filter(([file]) => !unexcused.some((h) => h.file === file))
    .map(([file, { why }]) => `${file} is emoji-free now — drop its entry (${why})`)
  assert.deepEqual(dead, [])
})
