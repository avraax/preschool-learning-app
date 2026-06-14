// Soft-3D math symbol tiles (Game-Page Rework PRD §C). Theme-CONSTANT (one set app-wide,
// like the section icons) — magenta-keyed cutouts produced by `optimize-theme-art.mjs symbols`
// from art-src/symbols/. Tiny (~18KB total) and used on first interaction, so statically
// bundled rather than code-split. Keyed by the operator character the games actually use.
import plus from './plus.webp'
import minus from './minus.webp'
import times from './times.webp'
import divide from './divide.webp'
import equals from './equals.webp'
import question from './question.webp'
import greater from './greater.webp'
import less from './less.webp'

export type SymbolOp = '+' | '-' | '=' | '?' | '>' | '<' | '×' | '÷'

export const symbolImages: Record<SymbolOp, string> = {
  '+': plus,
  '-': minus,
  '×': times,
  '÷': divide,
  '=': equals,
  '?': question,
  '>': greater,
  '<': less,
}
