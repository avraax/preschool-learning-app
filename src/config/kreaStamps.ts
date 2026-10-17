// Fri Tegning's pictures (the stamp tray): stable ids and the Danish name SAID when one is picked, just
// as every crayon says its colour (owner, 2026-10-16). Said WITH its article ("en is", "et hjerte"): a
// bare "is", "and", "sky" or "bold" is an English word too, and Azure read "is" as English (owner,
// 2026-10-17). A short Danish phrase gives the voice the context to pick Danish — and en/et is a lesson. Pure data, so the prebake enumerator and the
// guards can read it; the art for each id is in `components/krea/studio/stamps.ts`. Ids are ASCII
// (æ → ae, ø → oe, å → aa) because a resumed picture stores them.
export const KREA_STAMP_NAME = {
  sol: 'en sol',
  hjerte: 'et hjerte',
  stjerne: 'en stjerne',
  blomst: 'en blomst',
  sommerfugl: 'en sommerfugl',
  trae: 'et træ',
  sky: 'en sky',
  maane: 'en måne',
  ballon: 'en ballon',
  bold: 'en bold',
  is: 'en is',
  jordbaer: 'et jordbær',
  kat: 'en kat',
  hund: 'en hund',
  fisk: 'en fisk',
  fugl: 'en fugl',
  and: 'en and',
  froe: 'en frø',
  mariehoene: 'en mariehøne',
  skildpadde: 'en skildpadde',
  hval: 'en hval',
  bjoern: 'en bjørn',
  loeve: 'en løve',
  raev: 'en ræv',
} as const

export type KreaStampId = keyof typeof KREA_STAMP_NAME
export const KREA_STAMP_IDS = Object.keys(KREA_STAMP_NAME) as KreaStampId[]
