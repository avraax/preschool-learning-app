import { createTheme, type Theme } from '@mui/material/styles'
import type {
  ThemeTokens,
  CategoryTokens,
  DecorTokens,
  ShadowTokens,
  SceneTokens,
  MaterialTokens,
} from './tokens/types'
import { emptyScene, noMaterials } from './tokens/helpers'
import { setActiveTokens } from './tokens/activeTokens'

// buildTheme(tokens) → MUI Theme.
// Maps theme tokens onto the MUI palette/typography/components AND attaches the custom
// `categories`, `decor`, and `customShadows` buckets so components can read them via
// `useTheme()`. Structural constants that are NOT part of the skin (font sizes, spacing,
// breakpoints, component geometry) live here as theme-wide defaults.

export function buildTheme(tokens: ThemeTokens): Theme {
  // Keep non-React helpers (getCategoryTheme) in sync with the active skin.
  setActiveTokens(tokens)

  const { palette, fontFamily, shadows } = tokens

  // World tokens are optional (authored incrementally per the Theme Worlds phases).
  // Absence → today's flat look: title uses the body font, no scene, no materials.
  const titleFontFamily = tokens.titleFontFamily ?? fontFamily
  const scene = tokens.scene ?? emptyScene()
  const materials = tokens.materials ?? noMaterials()

  return createTheme({
    palette: {
      mode: 'light',
      primary: palette.primary,
      secondary: palette.secondary,
      success: palette.success,
      warning: palette.warning,
      error: palette.error,
      info: palette.info,
      pink: palette.pink,
      background: {
        default: palette.backgroundDefault,
        paper: palette.backgroundPaper,
      },
      text: {
        primary: palette.textPrimary,
        secondary: palette.textSecondary,
      },
    },

    typography: {
      fontFamily,

      // Large, kid-friendly font sizes
      h1: {
        fontSize: '3rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      h2: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body1: {
        fontSize: '1.125rem', // 18px - larger for kids
        lineHeight: 1.6,
        fontWeight: 400,
      },
      body2: {
        fontSize: '1rem', // 16px
        lineHeight: 1.6,
        fontWeight: 400,
      },
      button: {
        fontSize: '1.125rem', // 18px
        fontWeight: 600,
        textTransform: 'none' as const, // Don't uppercase buttons
        letterSpacing: '0.02em',
      },
    },

    shape: {
      borderRadius: 16, // Very rounded corners for playful feel
    },

    spacing: 8, // 8px base spacing

    breakpoints: {
      values: {
        xs: 0,
        sm: 600,   // Small phone to large phone
        md: 768,   // Tablet portrait (iPad)
        lg: 1024,  // Tablet landscape (iPad)
        xl: 1280,  // Large tablets and small desktops
      },
    },

    components: {
      // Apply the single theme font to the document body so non-MUI elements
      // (e.g. the memory game's plain divs) inherit it too.
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontFamily }
        }
      },
      // Button styling for kids
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            padding: '12px 24px',
            minHeight: 48, // Large touch targets
            minWidth: 120,
            fontSize: '1.125rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            '&:hover': {
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'translateY(0px)',
            },
          },
          sizeLarge: {
            padding: '16px 32px',
            minHeight: 56,
            fontSize: '1.25rem',
          },
          sizeSmall: {
            padding: '8px 16px',
            minHeight: 40,
            fontSize: '1rem',
          },
        },
      },

      // Card styling for kids
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            boxShadow: shadows.card,
            border: '2px solid transparent',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              boxShadow: shadows.cardHover,
              transform: 'translateY(-4px)',
            },
          },
        },
      },

      // Paper styling
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
          elevation1: {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      },

      // Fab (Floating Action Button) for main actions
      MuiFab: {
        styleOverrides: {
          root: {
            width: 72,
            height: 72,
            fontSize: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            '&:hover': {
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.3)',
              transform: 'scale(1.1)',
            },
          },
          sizeSmall: {
            width: 56,
            height: 56,
            fontSize: '1.5rem',
          },
          sizeMedium: {
            width: 64,
            height: 64,
            fontSize: '1.75rem',
          },
        },
      },

      // Chip styling for score displays
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            fontSize: '1rem',
            fontWeight: 600,
            height: 40,
            padding: '0 12px',
          },
          sizeSmall: {
            height: 32,
            fontSize: '0.875rem',
          },
        },
      },

      // AppBar for navigation - seamless blend with app background
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0, // Remove rounded corners
            boxShadow: 'none', // Remove shadow for seamless blend
            background: 'transparent', // Make background transparent
          },
        },
      },

      // Toolbar - extra padding on iPad to avoid status bar collision
      MuiToolbar: {
        styleOverrides: {
          root: {
            // Extra top padding on iPad to avoid collision with status bar/notch
            '@media (min-width: 768px) and (orientation: landscape)': {
              paddingTop: '24px', // Move content lower on iPad landscape
            },
            '@media (min-width: 768px) and (orientation: portrait)': {
              paddingTop: '16px', // Move content lower on iPad portrait
            },
          },
        },
      },

      // Container for main layouts - optimized for tablets
      MuiContainer: {
        styleOverrides: {
          root: {
            paddingLeft: 16,
            paddingRight: 16,
            '@media (min-width: 600px)': {
              paddingLeft: 24,
              paddingRight: 24,
            },
            '@media (min-width: 768px)': {
              paddingLeft: 32,
              paddingRight: 32,
              maxWidth: '100% !important', // Ensure full width on tablets
            },
          },
        },
      },

      // Grid for layouts
      MuiGrid: {
        styleOverrides: {
          root: {
            '&.MuiGrid-container': {
              margin: 0,
              width: '100%',
            },
          },
        },
      },
    },

    // ---- Custom theme buckets (read via useTheme().categories / .decor / .customShadows) ----
    categories: tokens.categories,
    decor: tokens.decor,
    customShadows: tokens.shadows,

    // ---- Immersive world buckets (Theme Worlds PRD) ----
    titleFontFamily,
    scene,
    materials,
  })
}

// Module augmentation: register custom palette + theme buckets so TypeScript knows about
// `theme.categories`, `theme.decor`, `theme.customShadows`, and `palette.pink`.
declare module '@mui/material/styles' {
  interface Palette {
    pink: Palette['primary']
  }
  interface PaletteOptions {
    pink?: PaletteOptions['primary']
  }

  interface Theme {
    categories: CategoryTokens
    decor: DecorTokens
    customShadows: ShadowTokens
    titleFontFamily: string
    scene: SceneTokens
    materials: MaterialTokens
  }
  interface ThemeOptions {
    categories?: CategoryTokens
    decor?: DecorTokens
    customShadows?: ShadowTokens
    titleFontFamily?: string
    scene?: SceneTokens
    materials?: MaterialTokens
  }
}

export default buildTheme
