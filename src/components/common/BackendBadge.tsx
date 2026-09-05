import React from 'react'
import { Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { backendLabel } from '../../config/backendTarget'
import { ADULT_FONT } from '../../theme/adultTheme'

// WHICH BACKEND AM I LOOKING AT, from across the room (Staging PRD W3 / §4.2).
//
// A small non-interactive pill naming the host this build's `/api` calls actually reach. It is NOT a
// flag that says "this is staging" — it PRINTS THE ORIGIN, so a mislabelled build is structurally
// impossible: a binary compiled against the staging host says so even if its `BL_TIER` claims
// production. See `backendTarget.ts` for why the label is derived from the origin and not the tier.
//
// THE EARLY RETURN IS THE WHOLE SAFETY PROPERTY. `backendLabel()` is null exactly when the backend is
// production, so the reviewed App Store binary renders nothing — there is no flag to remember, no
// build flavour to get wrong, and no way to ship a "TEST" pill to the store short of pointing the
// production build at a different host, which is the thing you would want a pill for anyway.
//
// NOT `import.meta.env.DEV`-GATED, and a future session must not "simplify" it to that:
// `import.meta.env.DEV` is false in every `vite build` regardless of mode (`harnessBuild.test.ts`),
// so a DEV check would strip the badge from precisely the builds that need it — the TestFlight ones.
//
// Not dismissible: this is a property of the binary, not a notification. `pointerEvents: 'none'` so it
// can never eat a tap meant for the board beneath it.

const BackendBadge: React.FC = () => {
  const theme = useTheme()
  const label = backendLabel()
  if (!label) return null

  return (
    <Box
      aria-hidden
      // Measurable by the layout probes; there is no accessible name to select on, by design.
      data-backend-badge={label}
      sx={{
        position: 'fixed',
        // BOTTOM-RIGHT (owner, 2026-09-05). It lived top-left, tucked under the back button, and the
        // whole top row is now spoken for on every surface: brand or back button on the left, the
        // reward ring and the child's name pill on the right. A technical string wedged into a row a
        // five-year-old reads is the wrong neighbourhood for it — this belongs to the adult, and an
        // adult looks for build information at an edge, not in the chrome.
        //
        // BOTTOM-RIGHT SPECIFICALLY, not bottom-left: the corner mascot lives bottom-LEFT on home and
        // on every game that shows one (`MASCOT_CORNER_SIZE`), and it is the one page element with a
        // reserved footprint down there. Nothing claims the bottom-right corner on any surface — the
        // game boards are centred in a flex column and Min Bog's grid is `maxWidth="md"` centred, so
        // this sits over the world rather than over content, which is what `pointerEvents: 'none'`
        // has always covered.
        //
        // The old top values are gone with the position: they existed to clear the back button's row
        // (88px on iPad, 64 on phone landscape, both measured), and there is nothing to clear here.
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 6px)',
        // Same tier as the update pill: below the adult corner button (1001) and below every modal, so
        // it never competes with a surface someone is actually using.
        zIndex: 1000,
        pointerEvents: 'none',
        maxWidth: 'min(46vw, 320px)',
        px: 0.75,
        py: 0.25,
        borderRadius: '999px',
        // Inverted contrast from the palette rather than an accent: this must read on every skin and on
        // both light and dark worlds, and an accent-on-light pill would need `onTileColor` juggling to
        // stay legible. `text.primary` on `background.paper` is AA on all four skins by construction.
        bgcolor: alpha(theme.palette.text.primary, 0.82),
        color: theme.palette.background.paper,
        // QUIETER, NOT SMALLER (owner 323FF: "too visible … more subtle and still visible"). Two
        // changes, and the shadow is the bigger one: `customShadows.card` is what made a 10px
        // technical string read as a raised OBJECT sitting on the sky, competing with the tiles.
        // The fade then goes on the whole box rather than on the fill, so the white-on-dark pair
        // fades TOGETHER and keeps its own contrast — measured ~5:1 at 0.78 over the default sky,
        // still AA. Fading only `bgcolor` would soften the pill and leave the text stranded; going
        // much below 0.78 drops under 4.5:1, and this has to be readable from across the room.
        opacity: 0.78,
        // A host is a technical string, not child-facing typography — Comic Sans mangles a URL. Same
        // system stack the adult surface uses, so there is one definition of "not the child's font".
        fontFamily: ADULT_FONT,
        fontSize: '0.62rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      TEST · {label}
    </Box>
  )
}

export default BackendBadge
