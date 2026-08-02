// The ADULT skin (Settings PRD-01 §5) — a calm, system-font, tighter-density theme for the
// "Til de voksne" surface only.
//
// Everything child-facing keeps the kid skin: Comic Sans, 16-20px radii, 48px buttons, pastel
// accents. The adult area inherited all of that wholesale, which is why the settings dialog read
// like a game screen. CLAUDE.md already says "Comic Sans MS for CHILD-FACING typography" — this is
// the boundary that finally enforces it.
//
// TWO-ARG MERGE, NOT A FRESH THEME. `createTheme(base, overrides)` builds from the live skin and
// deep-merges on top, so `theme.categories` / `.decor` / `.customShadows` / `.scene` / `.materials`
// / `.transition` / `.titleFontFamily` — the module augmentations declared in buildTheme.ts — all
// survive. A theme created from scratch would drop them and crash anything that reads them.
//
// The accent is deliberately NOT hardcoded: it is the ACTIVE skin's `palette.primary`, so the adult
// surface stays coherent with the world the child chose without being pastel.

import React, { createContext, useContext, useMemo } from 'react'
import { createTheme, ThemeProvider, useTheme, type Theme } from '@mui/material/styles'

/**
 * System stack. Also applied to the Dialog paper root's `sx` at the call site: `buildTheme` sets the
 * Comic font via `MuiCssBaseline.body`, and a NESTED provider does not re-apply CssBaseline — so raw
 * text inside a plain `<Box>` would still inherit Comic from `body` without that belt-and-braces.
 */
export const ADULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** Neutral greys. Only the accent comes from the skin. */
const INK = '#1f2328'
const INK_MUTED = '#5b6472'
const LINE = 'rgba(0, 0, 0, 0.10)'
const SURFACE = '#ffffff'
const CANVAS = '#f4f5f7'

export function buildAdultTheme(base: Theme): Theme {
  return createTheme(base, {
    typography: {
      fontFamily: ADULT_FONT,
      // The kid scale is deliberately oversized (body1 18px). Adults get a normal reading size.
      body1: { fontSize: '0.95rem', lineHeight: 1.5, fontWeight: 400 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
      caption: { fontSize: '0.8rem', lineHeight: 1.4 },
      subtitle1: { fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4 },
      subtitle2: { fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.4 },
      h6: { fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.35 },
      button: {
        fontSize: '0.95rem',
        fontWeight: 600,
        textTransform: 'none' as const,
        letterSpacing: 0,
      },
    },

    palette: {
      background: { paper: SURFACE, default: CANVAS },
      text: { primary: INK, secondary: INK_MUTED },
      divider: LINE,
    },

    shape: { borderRadius: 10 },

    components: {
      MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },

      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${LINE}`,
            boxShadow: 'none',
            // The kid card lifts and grows a shadow on hover. Settings rows must sit still.
            '&:hover': { boxShadow: 'none', transform: 'none' },
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            // 44 is the accessibility floor, not a style choice — it stays despite the tighter
            // density (the kid theme's 48 is what made the old panels feel like a game).
            minHeight: 44,
            minWidth: 'auto',
            padding: '8px 16px',
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'none' as const,
            borderRadius: 10,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', transform: 'none' },
            '&:active': { transform: 'none' },
          },
          sizeSmall: { minHeight: 36, padding: '6px 12px', fontSize: '0.875rem' },
          sizeLarge: { minHeight: 48, padding: '10px 20px', fontSize: '1rem' },
        },
      },

      // 44 is the accessibility FLOOR, and an IconButton is where the tighter density quietly breaks
      // it: MUI's default is 8px padding round the glyph, i.e. 33px for a 17px icon, and `size="small"`
      // is 32px. Enforced here rather than per call site — measured at 1024×768 / 844×390 / 667×375.
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 44, minHeight: 44 },
          sizeSmall: { minWidth: 44, minHeight: 44 },
        },
      },

      MuiListItemButton: {
        styleOverrides: { root: { minHeight: 44, borderRadius: 8 } },
      },
      MuiListItem: {
        styleOverrides: { root: { minHeight: 44 } },
      },

      MuiChip: {
        styleOverrides: {
          root: { height: 28, fontSize: '0.8rem', fontWeight: 600, borderRadius: 8, padding: '0 4px' },
          sizeSmall: { height: 24, fontSize: '0.75rem' },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none' as const, fontWeight: 600, minHeight: 40, borderRadius: 8 },
        },
      },

      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 700, padding: '16px 20px 8px' } },
      },
      MuiDialogContent: { styleOverrides: { root: { padding: '8px 20px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 16px' } } },
    },
  })
}

/**
 * Wraps the adult tree. Rebuilds only when the underlying skin object changes (a theme switch), so
 * flipping panes costs nothing.
 *
 * NON-GOAL (§5): auth surfaces are NOT re-skinned. `PinPad`/`PinDialog`/`LockScreen`/`ProfilePicker`/
 * `CreateProfileDialog`/`PinSetupDialog` are shared with the child-facing gate and deliberately keep
 * the app theme — so anything raising one of those from inside settings must mount it OUTSIDE this
 * provider. AdultSettings does exactly that.
 */
export const AdultThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const base = useTheme()
  const adult = useMemo(() => buildAdultTheme(base), [base])
  return (
    // The base skin is stashed OUTSIDE the ThemeProvider so <AppSkin> below can restore it. React
    // context flows through MUI's portals, so a nested Dialog can reach it.
    <BaseSkinContext.Provider value={base}>
      <ThemeProvider theme={adult}>{children}</ThemeProvider>
    </BaseSkinContext.Provider>
  )
}

const BaseSkinContext = createContext<Theme | null>(null)

/**
 * Re-applies the APP skin inside the adult tree. Wrap any auth surface raised from settings —
 * `PinSetupDialog`, the account-deletion `PinPad`, `CreateProfileDialog` — so it keeps the look it
 * has everywhere else (§5's explicit non-goal). Outside an `AdultThemeProvider` it is a no-op.
 */
export const AppSkin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const base = useContext(BaseSkinContext)
  const current = useTheme()
  return <ThemeProvider theme={base ?? current}>{children}</ThemeProvider>
}

export default buildAdultTheme
