// Audit-harness clip model (PRD-11 §3.2). Wraps the SHARED closed-set enumeration
// (shared-narration-clips.js — the exact set prebake bakes) and appends the KNOWN-DYNAMIC clips
// (math facts, colour-mix reveals, composed score lines) that are never prebaked and so can only be
// heard "force live". Keeping the closed set from the shared builder means the harness rows map 1:1
// to prebaked files and the regression guard can compare enumerated-vs-audited by cache key.

import { collectNarrationClips, type NarrationClip } from '../../../shared-narration-clips.js'
import { ttsCacheKey } from '../../../shared-tts-key.js'
import { TTS_CONFIG } from '../../config/tts-config'
import { DANISH_PHRASES, getDanishNumberText } from '../../config/danish-phrases'

export type AuditGroup = 'letters' | 'numbers' | 'phrases' | 'colours' | 'mixed' | 'english'

export interface AuditClip {
  key: string // ttsCacheKey — the verdict + prebaked-manifest key
  group: AuditGroup
  text: string
  voiceName: string
  lang: string
  rate: number
  useLexicon: boolean
  dynamic: boolean // true = never prebaked (composed at runtime) → force-live only
}

export const GROUP_ORDER: AuditGroup[] = ['letters', 'numbers', 'phrases', 'colours', 'mixed', 'english']

export const GROUP_LABELS: Record<AuditGroup, string> = {
  letters: 'Bogstaver',
  numbers: 'Tal (0–100)',
  phrases: 'Sætninger',
  colours: 'Farver',
  mixed: 'Blandet',
  english: 'Engelsk',
}

const DA = TTS_CONFIG.voices.primary
const RATE = TTS_CONFIG.speakingRate

/** A da-DK, default-rate, lexicon-on composed clip with its computed cache key. */
const daDynamic = (text: string): AuditClip => ({
  key: ttsCacheKey({ name: DA.name, lang: DA.lang, rate: RATE, useLexicon: true, text }),
  group: 'mixed',
  text,
  voiceName: DA.name,
  lang: DA.lang,
  rate: RATE,
  useLexicon: true,
  dynamic: true,
})

// Representative composed (non-prebaked) clips (PRD-11 §2.6 / §3.2 "Mixed"). Built from the real
// helpers so they read exactly as in-game. Not exhaustive — a spot-check that the composed sentences
// read correctly and stay in one voice.
function dynamicClips(): AuditClip[] {
  const N = getDanishNumberText
  const { prefix } = DANISH_PHRASES.gamePrompts.mathQuestion
  const { plus, minus } = DANISH_PHRASES.math
  const out: AuditClip[] = []

  // Math-fact prompts ("Hvad er X plus/minus Y") + completed-fact echoes ("X plus Y er Z").
  const adds: Array<[number, number]> = [[2, 3], [4, 5], [7, 8], [9, 10]]
  const subs: Array<[number, number]> = [[10, 4], [20, 7], [15, 6]]
  for (const [a, b] of adds) {
    out.push(daDynamic(`${prefix} ${N(a)} ${plus} ${N(b)}`))
    out.push(daDynamic(`${N(a)} ${plus} ${N(b)} er ${N(a + b)}`))
  }
  for (const [a, b] of subs) {
    out.push(daDynamic(`${prefix} ${N(a)} ${minus} ${N(b)}`))
    out.push(daDynamic(`${N(a)} ${minus} ${N(b)} er ${N(a - b)}`))
  }

  // Composed score lines (only noPoints/onePoint are prebaked; multiplePoints is dynamic).
  const { prefix: sPrefix, suffix: sSuffix } = DANISH_PHRASES.score.multiplePoints
  for (const n of [2, 5, 8]) out.push(daDynamic(`${sPrefix} ${N(n)} ${sSuffix}`))

  // Colour-mix reveals ("{c1} og {c2} bliver {result}") — the 3 iconic secondaries (RamFarven).
  const mixes: Array<[string, string, string]> = [
    ['rød', 'gul', 'orange'],
    ['blå', 'gul', 'grøn'],
    ['rød', 'blå', 'lilla'],
  ]
  for (const [c1, c2, r] of mixes) out.push(daDynamic(`${c1} og ${c2} bliver ${r}`))

  return out
}

/** Full ordered audit inventory: the shared closed (prebaked) set + the known-dynamic clips. */
export function buildAuditClips(): AuditClip[] {
  const closed: AuditClip[] = collectNarrationClips().map((c: NarrationClip) => ({ ...c, dynamic: false }))
  return [...closed, ...dynamicClips()]
}
