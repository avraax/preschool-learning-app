// The 3×4 keypad, shared by the PIN pad and the guest arithmetic gate.
//
// It used to be duplicated byte-for-byte in `PinPad` and `GuestAdultGate` — same grid, same cells,
// same TactileTile config — so every layout fix had to be made twice and the two drifted anyway
// (only one of them ever got the landscape height reclaim).
//
// HOW IT SIZES ITSELF, because this replaces four fixed pixel values that were wrong on a phone:
//
//   The pad used to be `maxWidth: 260 / 216 / 198` with cells at `aspectRatio: '3 / 2'`. On a 390px
//   iPhone that resolves to keys of 68 × 45 — wide, short, and nothing like a fingertip. The numbers
//   were also absolute, so they could not respond to the thing that actually varies: how much HEIGHT
//   is left over after the title, the prompt and the actions.
//
//   Now the pad is the largest 3:4 box that fits the space it is given. Three columns over four rows
//   of a 3:4 box means every cell is square by construction, on every viewport, with no per-device
//   number to tune — and when the space shrinks the pad shrinks with it instead of overflowing. The
//   parent gives it a definite height (a flex row with `min-height: 0`); `aspect-ratio` derives the
//   width from that height, and `maxHeight` caps how large the keys are allowed to get on an iPad.
//
//   Gaps make the cells 0.67px off square at these sizes. That is deliberate — subtracting them
//   exactly would need the gap in the ratio, which reintroduces a number that has to be kept in sync.
//
// THERE IS NO `minHeight` FLOOR ON THE PAD. A floor would trade the owner's hard requirement (never
// scroll, on any device or orientation) for a soft one, and it would do it silently. The 44px touch
// target is asserted by MEASUREMENT instead — `gateLayout` drives every supported viewport and fails
// if a key comes back under 44px, so a chrome regression that squeezes the pad is a red test rather
// than a keypad nobody can hit.

import React from 'react'
import { Box } from '@mui/material'
import { Delete } from 'lucide-react'
import TactileTile from '../common/TactileTile'
// Digit glyphs sit on the white tileSurface, so they use onTileColor(accent), never the raw accent.
import { onTileColor } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

/** The blank is the dead cell left of `0` — it keeps `del` under `9`. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

// The only cap. On a tall phone the pad would otherwise stretch to the full leftover height and the
// cells would come out tall rather than square, so WIDTH is what is capped and the height follows the
// ratio. 340 is three ~107px keys plus gaps — it fills a 390px phone edge to edge with a comfortable
// margin, and it is the value that closed the dead band that opened between the answer slots and the
// pad when the cap was lower (measured at 390 × 844).
const MAX_PAD_WIDTH = 340
const MAX_PAD_HEIGHT = (MAX_PAD_WIDTH * 4) / 3

export interface KeypadProps {
  accent: string
  /** Shakes every key and paints the wrong state. Owned by the host. */
  wrong?: boolean
  disabled?: boolean
  onPress: (key: string) => void
  /**
   * `data-pin-key` or `data-guest-gate-key`. Both names are load-bearing: the ui-screenshot recipes
   * and the layout probes select on them, so a shared component must not collapse them into one.
   */
  keyAttr: 'data-pin-key' | 'data-guest-gate-key'
}

const Keypad: React.FC<KeypadProps> = ({ accent, wrong = false, disabled = false, onPress, keyAttr }) => {
  const glyph = onTileColor(accent)

  return (
    // The centring box. It takes the leftover space of the flex parent, which is what makes the pad's
    // own height definite — `aspect-ratio` needs one axis resolved before it can derive the other.
    //
    // `alignSelf: stretch` is load-bearing and easy to lose: the host is a COLUMN normally but a ROW
    // on a landscape phone (info beside the pad), and a row parent centres its items, which would
    // leave this box content-height and the `height: 100%` below resolving against nothing.
    <Box
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // In the landscape ROW the main axis is width. Growing without a cap made this box swallow
        // all the leftover width, so the pad centred inside a box far wider than itself and the pair
        // read as two things flung to opposite edges — but shrink-to-fit (`flex: 0 1 auto`) is
        // WRONG, and only real WebKit says so: it then sizes this box from the grid's MIN-CONTENT
        // width, not from the aspect ratio, so the pad came back 123 × 287 with keys from 36 to 66px
        // while Chrome rendered a perfect 58 × 59 grid. Grow to a CAP: the width stays definite
        // (which is what `aspect-ratio` needs) and the pair still centres.
        [PHONE_LANDSCAPE]: { flex: '1 1 auto', maxWidth: 360 },
      }}
    >
      <Box
        role="group"
        aria-label="Talpanel"
        data-keypad
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
          gap: 1,
          height: '100%',
          aspectRatio: '3 / 4',
          maxHeight: MAX_PAD_HEIGHT,
          maxWidth: `min(100%, ${MAX_PAD_WIDTH}px)`,
          userSelect: 'none',
        }}
      >
        {KEYS.map((key, i) =>
          key === '' ? (
            <Box key={`spacer-${i}`} />
          ) : (
            // A bare cell: no height, no aspect ratio. The grid track IS the size.
            <Box key={key} sx={{ minWidth: 0, minHeight: 0 }}>
              <TactileTile
                accent={accent}
                variant="chip"
                state={wrong ? 'wrong' : 'idle'}
                disabled={disabled}
                onActivate={() => onPress(key)}
                domProps={{
                  'aria-label': key === 'del' ? 'Slet sidste ciffer' : `Ciffer ${key}`,
                  [keyAttr]: key,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    color: glyph,
                    fontWeight: 700,
                    fontSize: 'clamp(1.1rem, 4vw, 1.6rem)',
                  }}
                >
                  {/* `1em` rather than lucide's `size` prop, so the icon grows with the key exactly
                      as the digits do — a fixed `size={20}` stayed small on an 88px iPad key. */}
                  {key === 'del' ? <Delete style={{ width: '1em', height: '1em' }} aria-hidden /> : key}
                </Box>
              </TactileTile>
            </Box>
          ),
        )}
      </Box>
    </Box>
  )
}

export default Keypad
