// Per-game soft-3D icons (theme-CONSTANT), keyed COLLISION-FREE by `<section>.<id>` — NOT the
// bare game.id, because alphabet.memory10 and math.memory10 share an id but need distinct art
// (Liveliness PRD-05 W4.1 / batch B2). Kept in its OWN module (not beside sectionIconImages) so the
// 22 game icons bundle with the section-menu chunk and stay OFF the home first-paint.
//
// The two "memory" games in each section (10- and 20-pair boards) share one icon by design.
import alphabetLearn from './alphabet.learn.webp'
import alphabetQuiz from './alphabet.quiz.webp'
import alphabetMemory from './alphabet.memory.webp'
import mathNumbers from './math.numbers.webp'
import mathCounting from './math.counting.webp'
import mathAddition from './math.addition.webp'
import mathSubtraction from './math.subtraction.webp'
import mathComparison from './math.comparison.webp'
import mathPatterns from './math.patterns.webp'
import mathMemory from './math.memory.webp'
import colorsLaer from './colors.laer.webp'
import colorsFarvejagt from './colors.farvejagt.webp'
import colorsFarvequiz from './colors.farvequiz.webp'
import colorsRamFarven from './colors.ram-farven.webp'
import colorsNuancer from './colors.nuancer.webp'
import englishListen from './english.listen.webp'
import englishWord from './english.word.webp'
import englishTranslate from './english.translate.webp'
import englishLearn from './english.learn.webp'
import ordlegRead from './ordleg.read.webp'
import ordlegSpelling from './ordleg.spelling.webp'
import ordlegMic from './ordleg.mic.webp'

// Keyed `<section>.<id>`; GameTileIcon builds the key and falls back to emoji for any missing key.
export const gameIconImages: Record<string, string> = {
  'alphabet.learn': alphabetLearn,
  'alphabet.quiz': alphabetQuiz,
  'alphabet.memory10': alphabetMemory,
  'alphabet.memory20': alphabetMemory,
  'math.numbers': mathNumbers,
  'math.counting': mathCounting,
  'math.addition': mathAddition,
  'math.subtraction': mathSubtraction,
  'math.comparison': mathComparison,
  'math.patterns': mathPatterns,
  'math.memory10': mathMemory,
  'math.memory20': mathMemory,
  'colors.laer': colorsLaer,
  'colors.farvejagt': colorsFarvejagt,
  'colors.farvequiz': colorsFarvequiz,
  'colors.ram-farven': colorsRamFarven,
  'colors.nuancer': colorsNuancer,
  'english.listen': englishListen,
  'english.word': englishWord,
  'english.translate': englishTranslate,
  'english.learn': englishLearn,
  'ordleg.read': ordlegRead,
  'ordleg.spelling': ordlegSpelling,
  'ordleg.mic': ordlegMic,
}
