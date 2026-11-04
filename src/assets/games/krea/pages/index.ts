// Farvelæg's pages (Krea PRD-01 §4.4), produced by `node scripts/krea-regions.mjs` from
// art-src/krea/pages/*.jpg: a transparent line layer (WebP) and a LOSSLESS region label map (PNG — a
// lossy format would corrupt the ids). Static imports, so a missing page is a BUILD error.
import hundLine from './hund.line.webp'
import hundRegions from './hund.regions.png'
import ugleLine from './ugle.line.webp'
import ugleRegions from './ugle.regions.png'
import froeLine from './froe.line.webp'
import froeRegions from './froe.regions.png'
import strandLine from './strand.line.webp'
import strandRegions from './strand.regions.png'
import skovLine from './skov.line.webp'
import skovRegions from './skov.regions.png'
import byLine from './by.line.webp'
import byRegions from './by.regions.png'
import togLine from './tog.line.webp'
import togRegions from './tog.regions.png'
import sejlbaadLine from './sejlbaad.line.webp'
import sejlbaadRegions from './sejlbaad.regions.png'
import isLine from './is.line.webp'
import isRegions from './is.regions.png'
import enhjoerningLine from './enhjoerning.line.webp'
import enhjoerningRegions from './enhjoerning.regions.png'
import rumskibLine from './rumskib.line.webp'
import rumskibRegions from './rumskib.regions.png'
import drageLine from './drage.line.webp'
import drageRegions from './drage.regions.png'
import katLine from './kat.line.webp'
import katRegions from './kat.regions.png'
import fiskLine from './fisk.line.webp'
import fiskRegions from './fisk.regions.png'
import sommerfuglLine from './sommerfugl.line.webp'
import sommerfuglRegions from './sommerfugl.regions.png'
import kaninLine from './kanin.line.webp'
import kaninRegions from './kanin.regions.png'
import skildpaddeLine from './skildpadde.line.webp'
import skildpaddeRegions from './skildpadde.regions.png'
import elefantLine from './elefant.line.webp'
import elefantRegions from './elefant.regions.png'
import bondegaardLine from './bondegaard.line.webp'
import bondegaardRegions from './bondegaard.regions.png'
import havbundLine from './havbund.line.webp'
import havbundRegions from './havbund.regions.png'
import haveLine from './have.line.webp'
import haveRegions from './have.regions.png'
import legepladsLine from './legeplads.line.webp'
import legepladsRegions from './legeplads.regions.png'
import vinterLine from './vinter.line.webp'
import vinterRegions from './vinter.regions.png'
import campingLine from './camping.line.webp'
import campingRegions from './camping.regions.png'
import bilLine from './bil.line.webp'
import bilRegions from './bil.regions.png'
import brandbilLine from './brandbil.line.webp'
import brandbilRegions from './brandbil.regions.png'
import flyLine from './fly.line.webp'
import flyRegions from './fly.regions.png'
import ballonLine from './ballon.line.webp'
import ballonRegions from './ballon.regions.png'
import kageLine from './kage.line.webp'
import kageRegions from './kage.regions.png'
import bamseLine from './bamse.line.webp'
import bamseRegions from './bamse.regions.png'
import havfrueLine from './havfrue.line.webp'
import havfrueRegions from './havfrue.regions.png'
import robotLine from './robot.line.webp'
import robotRegions from './robot.regions.png'
import rumvaesenLine from './rumvaesen.line.webp'
import rumvaesenRegions from './rumvaesen.regions.png'
import feLine from './fe.line.webp'
import feRegions from './fe.regions.png'
import slotLine from './slot.line.webp'
import slotRegions from './slot.regions.png'
import dinoLine from './dino.line.webp'
import dinoRegions from './dino.regions.png'

export const PAGE_ART: Record<string, { line: string; regions: string }> = {
  hund: { line: hundLine, regions: hundRegions },
  ugle: { line: ugleLine, regions: ugleRegions },
  froe: { line: froeLine, regions: froeRegions },
  strand: { line: strandLine, regions: strandRegions },
  skov: { line: skovLine, regions: skovRegions },
  by: { line: byLine, regions: byRegions },
  tog: { line: togLine, regions: togRegions },
  sejlbaad: { line: sejlbaadLine, regions: sejlbaadRegions },
  is: { line: isLine, regions: isRegions },
  enhjoerning: { line: enhjoerningLine, regions: enhjoerningRegions },
  rumskib: { line: rumskibLine, regions: rumskibRegions },
  drage: { line: drageLine, regions: drageRegions },
  kat: { line: katLine, regions: katRegions },
  fisk: { line: fiskLine, regions: fiskRegions },
  sommerfugl: { line: sommerfuglLine, regions: sommerfuglRegions },
  kanin: { line: kaninLine, regions: kaninRegions },
  skildpadde: { line: skildpaddeLine, regions: skildpaddeRegions },
  elefant: { line: elefantLine, regions: elefantRegions },
  bondegaard: { line: bondegaardLine, regions: bondegaardRegions },
  havbund: { line: havbundLine, regions: havbundRegions },
  have: { line: haveLine, regions: haveRegions },
  legeplads: { line: legepladsLine, regions: legepladsRegions },
  vinter: { line: vinterLine, regions: vinterRegions },
  camping: { line: campingLine, regions: campingRegions },
  bil: { line: bilLine, regions: bilRegions },
  brandbil: { line: brandbilLine, regions: brandbilRegions },
  fly: { line: flyLine, regions: flyRegions },
  ballon: { line: ballonLine, regions: ballonRegions },
  kage: { line: kageLine, regions: kageRegions },
  bamse: { line: bamseLine, regions: bamseRegions },
  havfrue: { line: havfrueLine, regions: havfrueRegions },
  robot: { line: robotLine, regions: robotRegions },
  rumvaesen: { line: rumvaesenLine, regions: rumvaesenRegions },
  fe: { line: feLine, regions: feRegions },
  slot: { line: slotLine, regions: slotRegions },
  dino: { line: dinoLine, regions: dinoRegions },
}
