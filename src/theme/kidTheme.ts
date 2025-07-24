import { createTheme } from '@mui/material/styles'

// Kid-friendly color palette with bright, high-contrast colors
const kidColors = {
  primary: {
    main: '#8B5CF6', // Bright purple
    light: '#A78BFA',
    dark: '#7C3AED',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#3B82F6', // Bright blue
    light: '#60A5FA',
    dark: '#2563EB',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#10B981', // Bright green
    light: '#34D399',
    dark: '#059669',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#F59E0B', // Bright orange
    light: '#FBBF24',
    dark: '#D97706',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#EF4444', // Bright red
    light: '#F87171',
    dark: '#DC2626',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#06B6D4', // Bright cyan
    light: '#22D3EE',
    dark: '#0891B2',
    contrastText: '#FFFFFF',
  },
  pink: {
    main: '#EC4899',
    light: '#F472B6',
    dark: '#DB2777',
    contrastText: '#FFFFFF',
  },
}

// Kid-friendly theme configuration
export const kidTheme = createTheme({
  palette: {
    mode: 'light',
    ...kidColors,
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
    },
  },
  
  typography: {
    fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    
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
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: '2px solid transparent',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.18)',
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
    
    // AppBar for navigation
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: '0 0 20px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
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
})

// Extend theme with custom kid colors
declare module '@mui/material/styles' {
  interface Palette {
    pink: Palette['primary']
  }

  interface PaletteOptions {
    pink?: PaletteOptions['primary']
  }
}

export default kidTheme