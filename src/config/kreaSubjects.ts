// Tegn med Mig's subjects as DATA (Krea PRD-01 §2.2.7, §2.4, §4.3) — 9 per family, 4 families (12 at v1,
// 36 since 2026-11); it grows by adding entries, never code.
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

/** A five-pointed star as one closed zigzag, point up. */
const star = (cx: number, cy: number, r0: number, r1: number): Shape => ({
  kind: 'poly',
  closed: true,
  pts: Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? r1 : r0
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]
  }).flat(),
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
  {
    id: 'hund',
    name: 'Hund',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, hunden hopper!',
    steps: [
      { shapes: [circle(500, 480, 230)], line: 'Tegn en stor cirkel til hundens hoved.' },
      { shapes: [{ kind: 'ellipse', cx: 260, cy: 500, rx: 65, ry: 170 }, { kind: 'ellipse', cx: 740, cy: 500, rx: 65, ry: 170 }], line: 'Tegn to ovaler til ørerne.' },
      { shapes: [circle(415, 420, 38), circle(585, 420, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 525, rx: 60, ry: 40 }], line: 'Tegn en lille oval til næsen.' },
      { shapes: [{ kind: 'curve', pts: [415, 615, 500, 690, 585, 615] }], line: 'Tegn en bue til munden.' },
    ],
  },
  {
    id: 'kanin',
    name: 'Kanin',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, kaninen hopper!',
    steps: [
      { shapes: [circle(500, 610, 220)], line: 'Tegn en stor cirkel til kaninens hoved.' },
      { shapes: [{ kind: 'ellipse', cx: 405, cy: 230, rx: 55, ry: 160 }, { kind: 'ellipse', cx: 595, cy: 230, rx: 55, ry: 160 }], line: 'Tegn to lange ovaler til ørerne.' },
      { shapes: [circle(420, 560, 38), circle(580, 560, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [465, 650, 535, 650, 500, 695], closed: true }], line: 'Tegn en lille trekant til næsen.' },
      { shapes: [line(400, 680, 180, 640), line(400, 720, 180, 760), line(600, 680, 820, 640), line(600, 720, 820, 760)], line: 'Tegn fire lange streger til knurhårene.' },
    ],
  },
  {
    id: 'ugle',
    name: 'Ugle',
    family: 'dyr',
    alive: 'flap',
    doneLine: 'Se, uglen basker med vingerne!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 570, rx: 220, ry: 300 }], line: 'Tegn en stor oval til uglens krop.' },
      { shapes: [circle(415, 460, 70)], line: 'Tegn en cirkel til øjet. Det andet øje kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [460, 560, 540, 560, 500, 630], closed: true }], line: 'Tegn en lille trekant til næbbet.' },
      { shapes: [{ kind: 'curve', pts: [285, 450, 120, 600, 295, 800] }], line: 'Tegn en bue til vingen. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [330, 360, 300, 190, 420, 290] }], line: 'Tegn en trekant til øret.', mirror: true },
    ],
  },
  {
    id: 'fugl',
    name: 'Fugl',
    family: 'dyr',
    alive: 'fly-up',
    doneLine: 'Se, fuglen flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 460, cy: 600, rx: 250, ry: 170 }], line: 'Tegn en stor oval til fuglens krop.' },
      { shapes: [circle(680, 390, 110)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [785, 350, 900, 395, 785, 440], closed: true }], line: 'Tegn en lille trekant til næbbet.' },
      { shapes: [circle(705, 365, 28)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [270, 540, 360, 320, 530, 500] }], line: 'Tegn en bue til vingen.' },
      { shapes: [{ kind: 'poly', pts: [215, 600, 60, 490, 60, 710], closed: true }], line: 'Tegn en trekant til halen.' },
    ],
  },
  {
    id: 'snegl',
    name: 'Snegl',
    family: 'dyr',
    alive: 'drive',
    doneLine: 'Se, sneglen kravler!',
    steps: [
      { shapes: [circle(420, 465, 220)], line: 'Tegn en stor cirkel til sneglens hus.' },
      { shapes: [circle(420, 465, 100)], line: 'Tegn en lille cirkel inde i huset.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 770, rx: 400, ry: 70 }], line: 'Tegn en lang oval til kroppen.' },
      { shapes: [line(800, 710, 760, 540), line(860, 715, 910, 550)], line: 'Tegn to streger til følehornene.' },
      { shapes: [circle(755, 510, 30), circle(915, 520, 30)], line: 'Tegn to små cirkler til øjnene.' },
    ],
  },
  {
    id: 'skildpadde',
    name: 'Skildpadde',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, skildpadden svømmer!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 460, cy: 620, r: 280, from: 180, to: 360 }, line(180, 620, 740, 620)], line: 'Tegn en stor bue til skjoldet.' },
      { shapes: [circle(830, 540, 90)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [250, 620, 250, 740, 340, 740, 340, 620] }, { kind: 'poly', pts: [580, 620, 580, 740, 670, 740, 670, 620] }], line: 'Tegn to små firkanter til benene.' },
      { shapes: [circle(460, 480, 75)], line: 'Tegn en cirkel på skjoldet.' },
      { shapes: [circle(855, 515, 25)], line: 'Tegn en lille cirkel til øjet.' },
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
  {
    id: 'skov',
    name: 'Skov',
    family: 'steder',
    alive: 'sway',
    doneLine: 'Se, træerne svajer i vinden!',
    steps: [
      { shapes: [line(40, 860, 960, 860)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [line(255, 610, 255, 860), line(325, 610, 325, 860)], line: 'Tegn to streger til træstammen.' },
      { shapes: [circle(290, 420, 190)], line: 'Tegn en stor cirkel til trækronen.' },
      { shapes: [{ kind: 'poly', pts: [550, 760, 730, 280, 910, 760], closed: true }], line: 'Tegn en stor trekant til grantræet.' },
      { shapes: [line(730, 760, 730, 860)], line: 'Tegn en kort streg til stammen.' },
      { shapes: [circle(860, 140, 70)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'strand',
    name: 'Strand',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på stranden!',
    steps: [
      { shapes: [line(40, 820, 960, 820)], line: 'Tegn en lang streg til stranden.' },
      { shapes: [{ kind: 'curve', pts: [560, 640, 640, 590, 720, 640, 800, 590, 880, 640, 960, 600] }], line: 'Tegn en bølget streg til havet.' },
      { shapes: [{ kind: 'arc', cx: 290, cy: 440, r: 210, from: 180, to: 360 }, line(80, 440, 500, 440)], line: 'Tegn en bue til parasollen.' },
      { shapes: [line(290, 440, 290, 820)], line: 'Tegn en lang streg til parasollens stok.' },
      { shapes: [circle(790, 230, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: rays(790, 230, 115, 170), line: 'Tegn små streger rundt om solen.' },
    ],
  },
  {
    id: 'fyrtaarn',
    name: 'Fyrtårn',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, fyrtårnet lyser!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [390, 780, 440, 340, 560, 340, 610, 780], closed: true }], line: 'Tegn en høj firkant til fyrtårnet.' },
      { shapes: [rect(440, 220, 560, 340)], line: 'Tegn en lille firkant til lampen.' },
      { shapes: [{ kind: 'poly', pts: [420, 220, 500, 110, 580, 220] }], line: 'Tegn en trekant til taget.' },
      { shapes: [line(600, 250, 820, 180), line(600, 310, 820, 380), line(400, 250, 180, 180), line(400, 310, 180, 380)], line: 'Tegn fire lange streger til lyset.' },
      { shapes: [{ kind: 'curve', pts: [40, 880, 160, 830, 280, 880, 400, 830, 520, 880, 640, 830, 760, 880, 880, 830, 960, 870] }], line: 'Tegn en bølget streg til havet.' },
    ],
  },
  {
    id: 'telt',
    name: 'Telt',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, månen skinner på teltet!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [140, 800, 430, 320, 720, 800] }], line: 'Tegn en stor trekant til teltet.' },
      { shapes: [{ kind: 'poly', pts: [350, 800, 430, 590, 510, 800] }], line: 'Tegn en lille trekant til døren.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [{ kind: 'arc', cx: 820, cy: 210, r: 110, from: 70, to: 290 }, { kind: 'arc', cx: 880, cy: 210, r: 105, from: 102, to: 258 }], line: 'Tegn to buer til månen.' },
      { shapes: [star(190, 200, 90, 40)], line: 'Tegn en stjerne på himlen.' },
    ],
  },
  {
    id: 'regnbue',
    name: 'Regnbue',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, regnbuen skinner!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 700, r: 400, from: 180, to: 360 }], line: 'Tegn en stor bue til regnbuen.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 700, r: 280, from: 180, to: 360 }], line: 'Tegn en mindre bue indeni.' },
      { shapes: [{ kind: 'ellipse', cx: 160, cy: 730, rx: 120, ry: 70 }, { kind: 'ellipse', cx: 840, cy: 730, rx: 120, ry: 70 }], line: 'Tegn to ovaler til skyerne.' },
      { shapes: [circle(830, 160, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: [line(40, 870, 960, 870)], line: 'Tegn en lang streg til jorden.' },
    ],
  },
  {
    id: 'by',
    name: 'By',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på byen!',
    steps: [
      { shapes: [rect(120, 340, 370, 860)], line: 'Tegn en høj firkant til et hus.' },
      { shapes: [rect(430, 540, 640, 860)], line: 'Tegn en lav firkant til et hus mere.' },
      { shapes: [rect(700, 260, 900, 860)], line: 'Tegn en høj firkant til et hus mere.' },
      { shapes: [rect(165, 410, 235, 480), rect(265, 410, 335, 480), rect(500, 610, 570, 680), rect(765, 330, 835, 400)], line: 'Tegn små firkanter til vinduerne.' },
      { shapes: [circle(540, 220, 80)], line: 'Tegn en cirkel til solen.' },
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
  {
    id: 'bold',
    name: 'Bold',
    family: 'ting',
    alive: 'hop',
    doneLine: 'Se, bolden hopper!',
    steps: [
      { shapes: [circle(500, 470, 300)], line: 'Tegn en stor cirkel til bolden.' },
      { shapes: [{ kind: 'curve', pts: [300, 250, 420, 470, 300, 690] }, { kind: 'curve', pts: [700, 250, 580, 470, 700, 690] }], line: 'Tegn to buede streger på bolden.' },
      { shapes: [line(500, 170, 500, 770)], line: 'Tegn en lang streg midt på bolden.' },
      { shapes: [line(150, 880, 850, 880)], line: 'Tegn en streg til jorden.' },
    ],
  },
  {
    id: 'tog',
    name: 'Tog',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, toget kører!',
    steps: [
      { shapes: [rect(100, 460, 560, 690)], line: 'Tegn en lang firkant til toget.' },
      { shapes: [{ kind: 'poly', pts: [380, 460, 380, 290, 560, 290, 560, 460] }], line: 'Tegn en høj firkant til førerhuset.' },
      { shapes: [{ kind: 'poly', pts: [170, 460, 170, 340, 250, 340, 250, 460] }], line: 'Tegn en lille firkant til skorstenen.' },
      { shapes: [rect(620, 500, 910, 690)], line: 'Tegn en firkant til vognen.' },
      { shapes: [circle(210, 730, 60), circle(450, 730, 60), circle(680, 730, 60), circle(850, 730, 60)], line: 'Tegn fire cirkler til hjulene.' },
      { shapes: [circle(225, 250, 45), circle(310, 150, 35)], line: 'Tegn to små cirkler til røgen.' },
    ],
  },
  {
    id: 'fly',
    name: 'Fly',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, flyet flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 520, rx: 380, ry: 95 }], line: 'Tegn en lang oval til flyets krop.' },
      { shapes: [{ kind: 'poly', pts: [400, 600, 300, 830, 540, 610] }], line: 'Tegn en trekant til vingen.' },
      { shapes: [{ kind: 'poly', pts: [175, 470, 150, 270, 290, 440] }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(570, 505, 30), circle(670, 505, 30), circle(770, 505, 30)], line: 'Tegn tre små cirkler til vinduerne.' },
      { shapes: [{ kind: 'ellipse', cx: 790, cy: 190, rx: 130, ry: 65 }], line: 'Tegn en oval til skyen.' },
    ],
  },
  {
    id: 'ballon',
    name: 'Luftballon',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, ballonen flyver op!',
    steps: [
      { shapes: [circle(500, 350, 260)], line: 'Tegn en stor cirkel til ballonen.' },
      { shapes: [{ kind: 'curve', pts: [430, 105, 330, 350, 430, 595] }, { kind: 'curve', pts: [570, 105, 670, 350, 570, 595] }], line: 'Tegn to buede streger på ballonen.' },
      { shapes: [line(330, 550, 420, 760), line(670, 550, 580, 760)], line: 'Tegn to streger til snorene.' },
      { shapes: [rect(400, 760, 600, 890)], line: 'Tegn en lille firkant til kurven.' },
      { shapes: [{ kind: 'ellipse', cx: 160, cy: 720, rx: 110, ry: 60 }], line: 'Tegn en oval til skyen.' },
    ],
  },
  {
    id: 'is',
    name: 'Is',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, isen danser!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [310, 530, 690, 530, 500, 920], closed: true }], line: 'Tegn en stor trekant til vaflen.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 530, r: 210, from: 180, to: 360 }], line: 'Tegn en stor bue til iskuglen.' },
      { shapes: [circle(500, 255, 50)], line: 'Tegn en lille cirkel til kirsebærret.' },
      { shapes: [line(390, 450, 420, 500), line(480, 400, 510, 450), line(580, 450, 610, 500)], line: 'Tegn tre små streger på isen.' },
    ],
  },
  {
    id: 'paraply',
    name: 'Paraply',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, paraplyen svajer i vinden!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 480, r: 320, from: 180, to: 360 }], line: 'Tegn en stor bue til paraplyen.' },
      { shapes: [{ kind: 'curve', pts: [180, 480, 260, 420, 340, 480, 420, 420, 500, 480, 580, 420, 660, 480, 740, 420, 820, 480] }], line: 'Tegn en bølget streg under buen.' },
      { shapes: [line(500, 470, 500, 820)], line: 'Tegn en lang streg til skaftet.' },
      { shapes: [{ kind: 'arc', cx: 435, cy: 820, r: 65, from: 0, to: 180 }], line: 'Tegn en lille bue til håndtaget.' },
      { shapes: [circle(140, 180, 32), circle(860, 170, 32), circle(240, 90, 32)], line: 'Tegn tre små cirkler til regndråberne.' },
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
  {
    id: 'enhjoerning',
    name: 'Enhjørning',
    family: 'fantasi',
    alive: 'hop',
    doneLine: 'Se, enhjørningen hopper!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 610, rx: 200, ry: 270 }], line: 'Tegn en stor oval til enhjørningens hoved.' },
      { shapes: [{ kind: 'poly', pts: [455, 345, 500, 70, 545, 345] }], line: 'Tegn en lang trekant til hornet.' },
      { shapes: [{ kind: 'poly', pts: [330, 470, 245, 330, 375, 400] }, { kind: 'poly', pts: [625, 400, 755, 330, 670, 470] }], line: 'Tegn to trekanter til ørerne.' },
      { shapes: [circle(420, 540, 38), circle(580, 540, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [circle(445, 770, 28), circle(555, 770, 28)], line: 'Tegn to små cirkler til næseborene.' },
    ],
  },
  {
    id: 'ufo',
    name: 'Flyvende tallerken',
    family: 'fantasi',
    alive: 'fly-up',
    doneLine: 'Se, den flyvende tallerken flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 560, rx: 380, ry: 110 }], line: 'Tegn en lang oval til den flyvende tallerken.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 475, r: 180, from: 180, to: 360 }], line: 'Tegn en bue til toppen.' },
      { shapes: [circle(500, 380, 50)], line: 'Tegn en lille cirkel til rumvæsenet.' },
      { shapes: [circle(320, 575, 30), circle(500, 600, 30), circle(680, 575, 30)], line: 'Tegn tre små cirkler til lysene.' },
      { shapes: [line(330, 660, 260, 820), line(670, 660, 740, 820)], line: 'Tegn to streger til benene.' },
    ],
  },
  {
    id: 'krone',
    name: 'Krone',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, kronen skinner!',
    steps: [
      { shapes: [rect(200, 600, 800, 760)], line: 'Tegn en lang firkant til kronen.' },
      { shapes: [{ kind: 'poly', pts: [200, 600, 200, 330, 350, 480, 500, 280, 650, 480, 800, 330, 800, 600] }], line: 'Tegn en takket streg til toppen.' },
      { shapes: [circle(330, 680, 38), circle(500, 680, 38), circle(670, 680, 38)], line: 'Tegn tre små cirkler til ædelstenene.' },
      { shapes: [circle(200, 280, 38), circle(500, 230, 38), circle(800, 280, 38)], line: 'Tegn tre små cirkler til perlerne.' },
    ],
  },
  {
    id: 'nisse',
    name: 'Nisse',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, nissen danser!',
    steps: [
      { shapes: [circle(500, 480, 160)], line: 'Tegn en cirkel til nissens hoved.' },
      { shapes: [{ kind: 'poly', pts: [320, 400, 500, 120, 680, 400], closed: true }], line: 'Tegn en stor trekant til huen.' },
      { shapes: [circle(500, 75, 42)], line: 'Tegn en lille cirkel til kvasten.' },
      { shapes: [{ kind: 'curve', pts: [350, 560, 370, 810, 500, 900, 630, 810, 650, 560] }], line: 'Tegn en stor bue til skægget.' },
      { shapes: [circle(440, 465, 28), circle(560, 465, 28)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [circle(500, 550, 34)], line: 'Tegn en lille cirkel til næsen.' },
    ],
  },
  {
    id: 'piratskib',
    name: 'Piratskib',
    family: 'fantasi',
    alive: 'swim',
    doneLine: 'Se, piratskibet sejler!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [160, 570, 840, 570, 720, 730, 280, 730], closed: true }], line: 'Tegn en lang firkant til skibet.' },
      { shapes: [line(500, 570, 500, 150)], line: 'Tegn en lang streg til masten.' },
      { shapes: [rect(320, 210, 680, 470)], line: 'Tegn en stor firkant til sejlet.' },
      { shapes: [{ kind: 'poly', pts: [500, 150, 500, 70, 590, 95, 500, 120] }], line: 'Tegn et lille flag på toppen.' },
      { shapes: [{ kind: 'curve', pts: [40, 820, 160, 760, 280, 820, 400, 760, 520, 820, 640, 760, 760, 820, 880, 760, 960, 810] }], line: 'Tegn en bølget streg til havet.' },
    ],
  },
  {
    id: 'havfrue',
    name: 'Havfrue',
    family: 'fantasi',
    alive: 'swim',
    doneLine: 'Se, havfruen svømmer!',
    steps: [
      { shapes: [circle(500, 210, 110)], line: 'Tegn en cirkel til havfruens hoved.' },
      { shapes: [{ kind: 'curve', pts: [390, 130, 330, 210, 385, 290, 330, 370] }, { kind: 'curve', pts: [610, 130, 670, 210, 615, 290, 670, 370] }], line: 'Tegn to bølgede streger til håret.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 445, rx: 100, ry: 120 }], line: 'Tegn en oval til kroppen.' },
      { shapes: [{ kind: 'curve', pts: [420, 515, 440, 710, 500, 830] }, { kind: 'curve', pts: [580, 515, 560, 710, 500, 830] }], line: 'Tegn to buede streger til halen.' },
      { shapes: [{ kind: 'poly', pts: [500, 830, 380, 930, 620, 930], closed: true }], line: 'Tegn en trekant til halefinnen.' },
      { shapes: [line(405, 420, 270, 530), line(595, 420, 730, 530)], line: 'Tegn to streger til armene.' },
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
