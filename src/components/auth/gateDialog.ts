// The shell every adult-gate dialog wears: the PIN pad, the PIN setup, the account-deletion pad and
// the guest arithmetic challenge.
//
// THE BUG THIS CLOSES. Reported on an iPhone 13 Pro running the installed home-screen PWA: the bottom
// key row was unreachable and the content scrolled. A full-bleed PWA has no browser chrome, so the
// home indicator sits INSIDE the viewport, and a MUI Dialog knows nothing about `env(safe-area-inset-*)`
// — the last row was simply underneath it. Every gate now pads itself out of the insets.
//
// THREE RULES, and each was violated by at least one of the four dialogs before this existed:
//
//  1. **Full-screen on a phone.** `AdultSettings` already does this (it is the surface the gate leads
//     into), and it is what buys the height for finger-sized keys. `PHONE_ANY` is width/height based,
//     not a MUI breakpoint, so a portrait iPad at 768px is NOT a phone and keeps the floating card.
//  2. **Height comes from `--vh`, never `100%`.** `useViewportHeight` maintains it against
//     `visualViewport`, and it is the same basis `#root` and every page use. MUI's default paper
//     `maxHeight: calc(100% - 64px)` is measured against a viewport iOS keeps changing.
//  3. **A radius is a LENGTH.** `borderRadius: 4` multiplies this theme's `shape.borderRadius` of 16
//     into a 64px blob — which is exactly what the guest gate shipped with on a 326px-wide card.
//
// `zIndex: AUTH_Z.pin` stays at each call site rather than moving here: `authOverlayZ.test.ts` greps
// for it literally, and a guard that can be satisfied by an import is a guard that can be deleted
// without going red.

import { useMediaQuery } from '@mui/material'
import type { Theme } from '@mui/material/styles'
// `SystemStyleObject`, not `SxProps` — a host has to be able to compose these with `sx={[a, b]}`
// (never a spread; `.claude/rules/layout-contract.md`), and the array form does not accept the wider
// union. Same import the theme's idleMotion helpers use.
import type { SystemStyleObject } from '@mui/system'
import { PHONE_ANY } from '../../theme/phoneMedia'

export interface GateDialogShell {
  /** Pass to `<Dialog fullScreen={…}>`. */
  fullScreen: boolean
  /** Pass to `slotProps.paper.sx`. */
  paperSx: SystemStyleObject<Theme>
  /**
   * Pass to `<DialogContent sx={…}>`. `overflow: hidden`, NOT `auto` — that is what makes "never
   * scrolls" a property of the layout rather than something we hope stays true. Anything that does
   * not fit has to be solved by the keypad shrinking (it does) or by compressing the chrome, and a
   * regression shows up as a clipped control in the measurement probe instead of hiding in a
   * scrollbar nobody sees on a touch device.
   */
  contentSx: SystemStyleObject<Theme>
}

export function useGateDialogShell(): GateDialogShell {
  const fullScreen = useMediaQuery(PHONE_ANY)

  return {
    fullScreen,
    paperSx: {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...(fullScreen
        ? {
            borderRadius: 0,
            // The whole point of the module — see the header.
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }
        : {
            borderRadius: '28px',
            // A DEFINITE height, not just a cap — and this is the difference between an iPad keypad
            // with 86px keys and one with 59px keys (both measured). A `maxHeight` alone leaves the
            // paper shrink-to-fit, so the keypad's `flex: 1` has nothing to grow into and the pad
            // collapses to its intrinsic size: the roomiest device got the SMALLEST keys, which is
            // backwards. Same shape as `AdultSettings`, which sizes its paper the same way.
            height: 'min(680px, calc(var(--vh, 1vh) * 100 - 16px))',
            maxHeight: 'calc(var(--vh, 1vh) * 100 - 16px)',
            // Reclaim MUI's 32px of margin down to 8.
            //
            // NO `maxWidth` HERE. It is tempting (to match the margin) and it silently defeats the
            // Dialog's own `maxWidth="xs"`, whose 444px lives on the same element at lower
            // specificity: the paper measured 960px wide on an iPad before this comment existed.
            m: 1,
          }),
    },
    contentSx: {
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
  }
}
