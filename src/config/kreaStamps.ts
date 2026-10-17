// Fri Tegning's pictures (the stamp tray): stable ids and the Danish name SAID when one is picked, just
// as every crayon says its colour (owner, 2026-10-16). Pure data, so the prebake enumerator and the
// guards can read it; the art for each id is in `components/krea/studio/stamps.ts`. Ids are ASCII
// (æ → ae, ø → oe, å → aa) because a resumed picture stores them.
export const KREA_STAMP_NAME = {
  sol: 'sol',
  hjerte: 'hjerte',
  stjerne: 'stjerne',
  blomst: 'blomst',
  sommerfugl: 'sommerfugl',
  trae: 'træ',
  sky: 'sky',
  maane: 'måne',
  ballon: 'ballon',
  bold: 'bold',
  is: 'is',
  jordbaer: 'jordbær',
  kat: 'kat',
  hund: 'hund',
  fisk: 'fisk',
  fugl: 'fugl',
  and: 'and',
  froe: 'frø',
  mariehoene: 'mariehøne',
  skildpadde: 'skildpadde',
  hval: 'hval',
  bjoern: 'bjørn',
  loeve: 'løve',
  raev: 'ræv',
} as const

export type KreaStampId = keyof typeof KREA_STAMP_NAME
export const KREA_STAMP_IDS = Object.keys(KREA_STAMP_NAME) as KreaStampId[]
