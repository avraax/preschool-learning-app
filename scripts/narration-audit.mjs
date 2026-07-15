// Narration-audit guard + bulk-approve (PRD-11 §6).
//
//   node scripts/narration-audit.mjs                # --check (default): regression guard
//   node scripts/narration-audit.mjs --approve-all  # mark the whole current closed set signed-off
//
// The guard compares the enumerated CLOSED narration set (shared-narration-clips.js — exactly what
// prebake bakes and the child hears) against the committed audited-OK checklist
// (docs/audit/narration-audit.json). Any clip that isn't marked verdict:"ok" — because it's newly
// added content that was never auditioned, or was flagged wrong — fails the check. So a new sticker,
// English word, colour object, etc. surfaces as UNAUDITED and can't silently ship un-listened.
//
// The checklist is the same file the /audit harness writes (via the dev-server). --approve-all is the
// owner's bulk sign-off after a full listen pass; it never downgrades an existing verdict.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectNarrationClips } from '../shared-narration-clips.js'
import { renderAuditMarkdown, GROUP_LABELS } from '../shared-audit-render.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AUDIT_JSON = path.join(ROOT, 'docs', 'audit', 'narration-audit.json')
const AUDIT_MD = path.join(ROOT, 'docs', 'audit', 'narration-audit.md')

const APPROVE = process.argv.includes('--approve-all')

async function readDoc() {
  try {
    return JSON.parse(await readFile(AUDIT_JSON, 'utf-8'))
  } catch {
    return { clips: {} }
  }
}

const clips = collectNarrationClips() // the closed (prebaked) set — exactly what ships

if (APPROVE) {
  const doc = await readDoc()
  const out = { ...(doc.clips ?? {}) }
  let approved = 0
  for (const c of clips) {
    const existing = out[c.key]
    if (!existing || existing.verdict == null) {
      out[c.key] = {
        verdict: 'ok',
        note: existing?.note ?? 'Bulk-approved (PRD-11 owner listen pass)',
        candidateIpa: existing?.candidateIpa ?? '',
        text: c.text,
        group: c.group,
        updatedAt: Date.now(),
      }
      approved++
    } else {
      // Keep the owner's existing verdict/note; just refresh text/group if content shifted.
      out[c.key] = { ...existing, text: c.text, group: c.group }
    }
  }
  const finalDoc = { updatedAt: new Date().toISOString(), clips: out }
  await mkdir(path.dirname(AUDIT_JSON), { recursive: true })
  await writeFile(AUDIT_JSON, JSON.stringify(finalDoc, null, 2))
  await writeFile(AUDIT_MD, renderAuditMarkdown(finalDoc))
  console.log(
    `✅ Approved ${approved} previously-unaudited clip(s); ${clips.length} in the closed set are now signed off.`,
  )
  console.log('   Wrote docs/audit/narration-audit.{json,md}. Commit them.')
  process.exit(0)
}

// --check (default): the regression guard
const checklist = (await readDoc()).clips ?? {}
const problems = []
for (const c of clips) {
  const rec = checklist[c.key]
  if (!rec || rec.verdict == null) problems.push({ ...c, state: 'UNAUDITED' })
  else if (rec.verdict === 'wrong') problems.push({ ...c, state: 'FLAGGED-WRONG' })
}

if (problems.length === 0) {
  console.log(`✅ Narration audit clean: all ${clips.length} closed-set clips are signed off (verdict OK).`)
  process.exit(0)
}

console.error(`❌ ${problems.length}/${clips.length} narration clip(s) NOT signed off:\n`)
for (const p of problems.slice(0, 50)) {
  console.error(`  [${p.state}] ${GROUP_LABELS[p.group] ?? p.group}: "${p.text}"`)
}
if (problems.length > 50) console.error(`  … and ${problems.length - 50} more.`)
console.error(
  '\nAudition these in /audit (npm run dev → http://localhost:5173/audit), mark OK, then re-run.\n' +
    'To bulk-approve the entire current set after a full listen pass: npm run audit:approve-all',
)
process.exit(1)
