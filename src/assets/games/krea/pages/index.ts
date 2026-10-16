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
}
