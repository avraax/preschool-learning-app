// Shared renderer for the committed narration-audit checklist (PRD-11 §3.5 / §6).
// Used by BOTH the dev-server (/api/audit-save, written as the owner clicks in the harness) and the
// CLI guard (scripts/narration-audit.mjs) so the generated docs/audit/narration-audit.md can't drift.

export const GROUP_ORDER = ['letters', 'numbers', 'phrases', 'colours', 'mixed', 'english']

export const GROUP_LABELS = {
  letters: 'Bogstaver',
  numbers: 'Tal',
  phrases: 'Sætninger',
  colours: 'Farver',
  mixed: 'Blandet',
  english: 'Engelsk',
}

/** Render the committed audit doc ({ updatedAt, clips: { key → {group,text,verdict,note,candidateIpa} } }). */
export function renderAuditMarkdown(doc) {
  const clips = Object.values(doc?.clips ?? {})
  const total = clips.length
  const ok = clips.filter((c) => c.verdict === 'ok').length
  const wrong = clips.filter((c) => c.verdict === 'wrong').length
  const unaudited = total - ok - wrong
  const lines = []
  lines.push('# Narration audit checklist (PRD-11)')
  lines.push('')
  lines.push('> AUTO-GENERATED (by the `/audit` harness via the dev-server, or `npm run audit:approve-all`).')
  lines.push('> Do not hand-edit — source of truth is `narration-audit.json`.')
  lines.push('')
  lines.push(`Last updated: ${doc?.updatedAt ?? 'n/a'}`)
  lines.push('')
  lines.push(`**${ok} OK · ${wrong} wrong · ${unaudited} unaudited** (of ${total} clips)`)
  lines.push('')
  const byGroup = {}
  for (const c of clips) (byGroup[c.group] ??= []).push(c)
  for (const group of GROUP_ORDER) {
    const list = byGroup[group]
    if (!list || !list.length) continue
    lines.push(`## ${GROUP_LABELS[group] ?? group}`)
    lines.push('')
    lines.push('| Verdict | Text | Note | Candidate IPA/respelling |')
    lines.push('|---|---|---|---|')
    const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    for (const c of list.sort((a, b) => String(a.text).localeCompare(String(b.text), 'da'))) {
      const mark = c.verdict === 'ok' ? '✅' : c.verdict === 'wrong' ? '❌' : '⬜'
      lines.push(`| ${mark} | ${esc(c.text)} | ${esc(c.note)} | ${esc(c.candidateIpa)} |`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
