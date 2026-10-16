// Per-game soft-3D icons (theme-CONSTANT), keyed COLLISION-FREE by `<section>.<id>` — NOT the
// bare game.id, because alphabet.memory and math.memory share an id but need distinct art
// (Liveliness PRD-05 W4.1 / batch B2). Kept in its OWN module (not beside sectionIconImages) so the
// 22 game icons bundle with the section-menu chunk and stay OFF the home first-paint.
//
// Each section has ONE "memory" tile now — the board size follows the difficulty level rather than
// being two separate games (Difficulty PRD-01 W5).
import alphabetLearn from './alphabet.learn.webp'
import alphabetQuiz from './alphabet.quiz.webp'
import alphabetMemory from './alphabet.memory.webp'
import mathNumbers from './math.numbers.webp'
import mathCounting from './math.counting.webp'
// Placeholder: a copy of Tal Quiz's icon until the owner's Gemini render lands (Harbour PRD-01 W3).
import mathBoat from './math.boat.webp'
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
import englishLearn from './english.learn.webp'
import ordlegRead from './ordleg.read.webp'
import ordlegSpelling from './ordleg.spelling.webp'
// Placeholders: copies of existing tiles until the owner's Gemini renders land (Krea PRD-01 W0).
import kreaDraw from './krea.draw.webp'
import kreaGuide from './krea.guide.webp'
import kreaColor from './krea.color.webp'

// Keyed `<section>.<id>`; GameTileIcon builds the key and falls back to emoji for any missing key.
export const gameIconImages: Record<string, string> = {
  'alphabet.learn': alphabetLearn,
  'alphabet.quiz': alphabetQuiz,
  'alphabet.memory': alphabetMemory,
  'math.numbers': mathNumbers,
  'math.counting': mathCounting,
  'math.boat': mathBoat,
  'math.addition': mathAddition,
  'math.subtraction': mathSubtraction,
  'math.comparison': mathComparison,
  'math.patterns': mathPatterns,
  'math.memory': mathMemory,
  'colors.laer': colorsLaer,
  'colors.farvejagt': colorsFarvejagt,
  'colors.farvequiz': colorsFarvequiz,
  'colors.ram-farven': colorsRamFarven,
  'colors.nuancer': colorsNuancer,
  'english.listen': englishListen,
  'english.word': englishWord,
  'english.learn': englishLearn,
  'ordleg.read': ordlegRead,
  'ordleg.spelling': ordlegSpelling,
  'krea.draw': kreaDraw,
  'krea.guide': kreaGuide,
  'krea.color': kreaColor,
}
