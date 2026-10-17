// The section names as an ADULT reads them, in one place — the difficulty rows and the child's
// "har spillet" summary both label the same sections and used to spell them independently.
//
// With FOUR DOORS (Category restructure PRD-01 D10) the adult sees what the child sees: one row per
// door, labelled with the door's name, and a door row writes EVERY member section — setting "Bogstaver
// og Ord" to Svær sets both Alfabetet and Ordleg. The per-section storage is unchanged (A1); only the
// view groups it. The accepted cost: words at Let with letters at Svær can no longer be set from here.

import type { SectionId } from './progressSchema.ts'
import { DOORS, doorOf } from './doors.ts'

export const SECTION_LABELS: Record<SectionId, string> = {
  alphabet: 'Alfabetet',
  math: 'Tal',
  colors: 'Farver',
  english: 'Engelsk',
  ordleg: 'Ordleg',
  krea: 'Krea',
}

/** One adjustable difficulty row: what the adult reads, and every section a change writes. */
export interface DifficultyRow {
  key: string
  label: string
  members: readonly SectionId[]
}

/**
 * The per-section difficulty rows. Four doors → one row per door (D10). Otherwise one row per section,
 * with Krea's only when Krea is shown (Krea PRD-01 §2.5 — no setting for a hidden section).
 */
export const difficultyRows = (fourDoors: boolean, kreaShown: boolean): DifficultyRow[] =>
  fourDoors
    ? DOORS.map((d) => ({ key: d.id, label: d.label, members: d.members }))
    : (['alphabet', 'math', 'colors', 'english', 'ordleg', 'krea'] as SectionId[])
        .filter((s) => s !== 'krea' || kreaShown)
        .map((s) => ({ key: s, label: SECTION_LABELS[s], members: [s] }))

/**
 * A door row's displayed level: the members' shared override, or `null` ("Som global") when none is
 * set. If an older per-section setting left the members DIFFERENT, the primary's wins on screen — and
 * the next tap on the row makes them agree again.
 */
export const rowLevel = <L extends string>(
  row: DifficultyRow,
  perSection: Partial<Record<SectionId, L>>,
): L | null => {
  const primary = row.members[0]
  return perSection[primary] ?? row.members.map((m) => perSection[m]).find((v) => v != null) ?? null
}

/** What the child has played, as the adult reads it: door names with four doors, deduped, in door order. */
export const playedLabels = (played: readonly SectionId[], fourDoors: boolean): string[] =>
  fourDoors
    ? DOORS.filter((d) => played.some((s) => doorOf(s).id === d.id)).map((d) => d.label)
    : played.map((s) => SECTION_LABELS[s])
