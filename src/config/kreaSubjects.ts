// Tegn med Mig's subjects as DATA (Krea PRD-01 §2.2.7, §2.4, §4.3) — 3 per family, 4 families, to grow
// later by adding entries, never code.
//
// Each subject is ≤ 6 steps, and each step NAMES a shape ("Tegn en stor cirkel til hovedet") — the shape
// is the lesson, so the guide is built from shapes (`kreaShapes.ts`), not free paths. Every step line is a
// WHOLE sentence, one prebaked clip, never stitched (§4.9). A `mirror` step is drawn on the left of the
// subject's vertical centre line and appears on the right as the child draws (§4.3) — symmetry lives
// here and in Perleplade, nowhere else.
//
// The done line DESCRIBES the alive motion and never grades the picture ("Se, fisken svømmer!", never
// "flot"); `kreaPhrases.test.ts` enforces it.
//
// Explicit `.ts` extensions: this module is in `shared-narration-clips.js`'s plain-Node import graph.

import type { Shape } from './kreaShapes.ts'

export type KreaFamily = 'dyr' | 'steder' | 'ting' | 'fantasi'
export const KREA_FAMILIES: readonly KreaFamily[] = ['dyr', 'steder', 'ting', 'fantasi']

/** The "comes alive" presets (`components/krea/studio/alive.ts`, §4.5). */
export type AlivePreset = 'hop' | 'swim' | 'fly-up' | 'flap' | 'sway' | 'drive' | 'glow'

export interface GuideStep {
  shapes: Shape[]
  /** The spoken instruction — a whole sentence, prebaked. */
  line: string
  /** Drawn on the left of x = 500, mirrored live onto the right. */
  mirror?: boolean
}

export interface KreaSubject {
  id: string
  name: string
  family: KreaFamily
  alive: AlivePreset
  doneLine: string
  steps: GuideStep[]
}

/**
 * The task-XP normaliser for a finished guided or colour-in piece (§2.5): one piece ≈ half a round. A
 * piece takes 1–3 minutes, about a quiz round, so this is a slight damp on purpose (Lepper 1973). The
 * same at every level — XP never depends on difficulty.
 */
export const KREA_TASKS_IN_ROUND = 2

/** The vertical centre line every mirror step reflects across, in subject units. */
export const MIRROR_AXIS = 500

const line = (x0: number, y0: number, x1: number, y1: number): Shape => ({ kind: 'poly', pts: [x0, y0, x1, y1] })
const rect = (x0: number, y0: number, x1: number, y1: number): Shape => ({ kind: 'poly', pts: [x0, y0, x1, y0, x1, y1, x0, y1], closed: true })
const circle = (cx: number, cy: number, r: number): Shape => ({ kind: 'circle', cx, cy, r })

/** Short rays around a sun. */
const rays = (cx: number, cy: number, r0: number, r1: number, n = 8): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n
    return line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
  })

const petals = (cx: number, cy: number, dist: number, r: number, n = 5): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n
    return circle(Math.round(cx + Math.cos(a) * dist), Math.round(cy + Math.sin(a) * dist), r)
  })

export const KREA_SUBJECTS: readonly KreaSubject[] = [
  // ----- Dyr ---------------------------------------------------------------------------------------
  {
    id: 'kat',
    name: 'Kat',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, katten hopper!',
    steps: [
      { shapes: [circle(500, 520, 260)], line: 'Tegn en stor cirkel til kattens hoved.' },
      { shapes: [{ kind: 'poly', pts: [285, 340, 300, 130, 430, 275] }, { kind: 'poly', pts: [570, 275, 700, 130, 715, 340] }], line: 'Tegn to trekanter til ørerne.' },
      { shapes: [circle(410, 470, 40), circle(590, 470, 40)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [465, 570, 535, 570, 500, 615], closed: true }], line: 'Tegn en lille trekant til næsen.' },
      { shapes: [line(380, 600, 170, 565), line(380, 645, 170, 665), line(620, 600, 830, 565), line(620, 645, 830, 665)], line: 'Tegn fire lange streger til knurhårene.' },
    ],
  },
  {
    id: 'fisk',
    name: 'Fisk',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, fisken svømmer!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 440, cy: 520, rx: 300, ry: 180 }], line: 'Tegn en stor oval til fiskens krop.' },
      { shapes: [{ kind: 'poly', pts: [730, 520, 930, 360, 930, 680], closed: true }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(270, 470, 38)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [360, 350, 450, 200, 570, 355] }], line: 'Tegn en bue til finnen.' },
      { shapes: [circle(120, 300, 28), circle(90, 190, 20)], line: 'Tegn to små cirkler til boblerne.' },
    ],
  },
  {
    id: 'sommerfugl',
    name: 'Sommerfugl',
    family: 'dyr',
    alive: 'flap',
    doneLine: 'Se, sommerfuglen flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 540, rx: 40, ry: 230 }], line: 'Tegn en lang oval til sommerfuglens krop.' },
      { shapes: [{ kind: 'curve', pts: [470, 430, 320, 170, 120, 250, 150, 460, 470, 500] }], line: 'Tegn en stor vinge. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'curve', pts: [470, 560, 260, 560, 200, 730, 330, 790, 470, 640] }], line: 'Tegn en lille vinge nedenunder.', mirror: true },
      { shapes: [circle(280, 350, 45)], line: 'Tegn en prik på vingen.', mirror: true },
      { shapes: [{ kind: 'curve', pts: [485, 310, 455, 210, 390, 150] }], line: 'Tegn en buet streg til følehornet.', mirror: true },
    ],
  },
  // ----- Steder ------------------------------------------------------------------------------------
  {
    id: 'hus',
    name: 'Hus med sol',
    family: 'steder',
    alive: 'hop',
    doneLine: 'Se, huset hopper!',
    steps: [
      { shapes: [rect(200, 480, 640, 880)], line: 'Tegn en stor firkant til huset.' },
      { shapes: [{ kind: 'poly', pts: [170, 480, 420, 230, 670, 480] }], line: 'Tegn en trekant til taget.' },
      { shapes: [{ kind: 'poly', pts: [370, 880, 370, 700, 470, 700, 470, 880] }], line: 'Tegn en lille firkant til døren.' },
      { shapes: [rect(250, 560, 330, 640)], line: 'Tegn en lille firkant til vinduet.' },
      { shapes: [circle(820, 200, 90)], line: 'Tegn en cirkel til solen.' },
      { shapes: rays(820, 200, 120, 180), line: 'Tegn små streger rundt om solen.' },
    ],
  },
  {
    id: 'bjerge',
    name: 'Bjerge',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på bjergene!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [80, 800, 400, 250, 720, 800] }], line: 'Tegn en stor trekant til bjerget.' },
      { shapes: [{ kind: 'poly', pts: [540, 800, 740, 430, 940, 800] }], line: 'Tegn en mindre trekant til et bjerg mere.' },
      { shapes: [{ kind: 'poly', pts: [312, 400, 355, 440, 400, 400, 445, 440, 488, 400] }], line: 'Tegn en takket streg til sneen på toppen.' },
      { shapes: [circle(830, 190, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til jorden.' },
    ],
  },
  {
    id: 'havet',
    name: 'Havet med båd',
    family: 'steder',
    alive: 'swim',
    doneLine: 'Se, båden sejler!',
    steps: [
      { shapes: [{ kind: 'curve', pts: [40, 720, 160, 660, 280, 720, 400, 660, 520, 720, 640, 660, 760, 720, 880, 660, 960, 710] }], line: 'Tegn en bølget streg til havet.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 540, r: 200, from: 0, to: 180 }, line(300, 540, 700, 540)], line: 'Tegn en bue til båden.' },
      { shapes: [line(500, 540, 500, 170)], line: 'Tegn en lang streg til masten.' },
      { shapes: [{ kind: 'poly', pts: [515, 190, 515, 500, 720, 500], closed: true }], line: 'Tegn en trekant til sejlet.' },
      { shapes: [circle(180, 180, 80)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  // ----- Ting --------------------------------------------------------------------------------------
  {
    id: 'raket',
    name: 'Raket',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, raketten flyver!',
    steps: [
      { shapes: [rect(410, 330, 590, 720)], line: 'Tegn en høj firkant til raketten.' },
      { shapes: [{ kind: 'poly', pts: [410, 330, 500, 140, 590, 330] }], line: 'Tegn en trekant til spidsen.' },
      { shapes: [circle(500, 440, 55)], line: 'Tegn en cirkel til vinduet.' },
      { shapes: [{ kind: 'poly', pts: [410, 560, 300, 740, 410, 720] }, { kind: 'poly', pts: [590, 560, 700, 740, 590, 720] }], line: 'Tegn to trekanter til vingerne.' },
      { shapes: [{ kind: 'poly', pts: [430, 730, 460, 860, 500, 780, 540, 860, 570, 730] }], line: 'Tegn en takket streg til ilden.' },
    ],
  },
  {
    id: 'bil',
    name: 'Bil',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, bilen kører!',
    steps: [
      { shapes: [rect(120, 500, 880, 690)], line: 'Tegn en lang firkant til bilen.' },
      { shapes: [{ kind: 'poly', pts: [270, 500, 340, 330, 660, 330, 730, 500] }], line: 'Tegn taget ovenpå bilen.' },
      { shapes: [circle(290, 700, 85), circle(710, 700, 85)], line: 'Tegn to cirkler til hjulene.' },
      { shapes: [rect(380, 370, 620, 470)], line: 'Tegn en firkant til vinduet.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til vejen.' },
    ],
  },
  {
    id: 'blomst',
    name: 'Blomst',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, blomsten svajer i vinden!',
    steps: [
      { shapes: [circle(500, 330, 80)], line: 'Tegn en cirkel til blomstens midte.' },
      { shapes: petals(500, 330, 150, 70), line: 'Tegn fem små cirkler rundt om til kronbladene.' },
      { shapes: [line(500, 480, 500, 880)], line: 'Tegn en lang streg til stilken.' },
      { shapes: [{ kind: 'curve', pts: [505, 730, 600, 620, 730, 640, 640, 750, 505, 735] }], line: 'Tegn et blad på stilken.' },
      { shapes: [line(150, 880, 850, 880)], line: 'Tegn en streg til jorden.' },
    ],
  },
  // ----- Fantasi -----------------------------------------------------------------------------------
  {
    id: 'drage',
    name: 'Drage',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, dragen danser!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 420, cy: 640, rx: 240, ry: 140 }], line: 'Tegn en stor oval til dragens krop.' },
      { shapes: [{ kind: 'curve', pts: [585, 555, 650, 470, 640, 350] }, { kind: 'curve', pts: [655, 625, 745, 520, 745, 360] }], line: 'Tegn to buede streger til den lange hals.' },
      { shapes: [{ kind: 'ellipse', cx: 720, cy: 295, rx: 115, ry: 72 }], line: 'Tegn en oval til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [250, 545, 290, 465, 335, 520, 380, 445, 425, 505, 470, 435, 515, 510] }], line: 'Tegn en takket streg til piggene på ryggen.' },
      { shapes: [{ kind: 'curve', pts: [185, 670, 90, 730, 50, 610] }, { kind: 'poly', pts: [30, 650, 50, 570, 100, 620] }], line: 'Tegn en lang bue til halen.' },
      { shapes: [line(340, 770, 340, 880), line(510, 770, 510, 880)], line: 'Tegn to streger til benene.' },
    ],
  },
  {
    id: 'robot',
    name: 'Robot',
    family: 'fantasi',
    alive: 'hop',
    doneLine: 'Se, robotten hopper!',
    steps: [
      { shapes: [rect(330, 440, 670, 770)], line: 'Tegn en stor firkant til robottens krop.' },
      { shapes: [rect(380, 170, 620, 400)], line: 'Tegn en firkant til hovedet.' },
      { shapes: [circle(440, 275, 38)], line: 'Tegn en cirkel til øjet. Det andet øje kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [330, 480, 190, 600, 230, 700] }], line: 'Tegn en streg til armen.', mirror: true },
      { shapes: [rect(380, 770, 460, 920)], line: 'Tegn en firkant til benet.', mirror: true },
      { shapes: [line(500, 170, 500, 90), circle(500, 66, 24)], line: 'Tegn en streg og en prik til antennen.' },
    ],
  },
  {
    id: 'slot',
    name: 'Slot',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, slottet lyser op!',
    steps: [
      { shapes: [rect(300, 460, 700, 860)], line: 'Tegn en stor firkant til slottet.' },
      { shapes: [rect(150, 320, 300, 860)], line: 'Tegn en høj firkant til tårnet. Det andet tårn kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [130, 320, 225, 150, 320, 320] }], line: 'Tegn en trekant til taget på tårnet.', mirror: true },
      { shapes: [{ kind: 'arc', cx: 500, cy: 760, r: 90, from: 180, to: 360 }, line(410, 760, 410, 860), line(590, 760, 590, 860)], line: 'Tegn en port med en bue.' },
      { shapes: [{ kind: 'poly', pts: [225, 150, 225, 70, 300, 95, 225, 120] }], line: 'Tegn et lille flag på toppen.', mirror: true },
    ],
  },
]

export const subjectById = (id: string | null | undefined): KreaSubject | undefined =>
  KREA_SUBJECTS.find((s) => s.id === id)

/** Every line Tegn med Mig can speak: each step, and each subject's done line. */
export function allSubjectLines(): string[] {
  const out: string[] = []
  for (const s of KREA_SUBJECTS) {
    for (const st of s.steps) out.push(st.line)
    out.push(s.doneLine)
  }
  return out
}
