// Per-theme title-font loaders (Theme Worlds PRD §5.7).
//
// Only the ACTIVE theme's display font is fetched — a dynamic import of the @fontsource CSS,
// LATIN subset only (covers the Danish glyphs æ ø å used in "Børnelæring"). Body text stays
// Comic Neue (loaded globally), which is also the fallback for any theme not listed here, so
// the title always renders even if a font is missing a glyph.

const loaders: Record<string, () => Promise<unknown>> = {
  ocean: () =>
    Promise.all([
      import('@fontsource/fredoka/latin-500.css'),
      import('@fontsource/fredoka/latin-700.css'),
    ]),
}

// Fire-and-forget: kicks off loading the active theme's title font (no-op if none/already).
export const loadTitleFont = (id: string): void => {
  loaders[id]?.()
}

export default loadTitleFont
