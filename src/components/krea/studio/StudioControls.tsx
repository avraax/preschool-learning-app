import React from 'react'
import { Box, ButtonBase } from '@mui/material'
import type { CrayonColor, Tool } from '../canvas/strokeModel'
import { KREA_COLOR_NAME, KREA_RAINBOW_NAME } from '../../../config/kreaPhrases'
import { CRAYON_ART, KREA_ART } from '../../../assets/games/krea'

// The studio's controls (Krea PRD-01 §2.2.5, §4.10): six tools, the crayons, "Nyt papir", done and next.
// Pictures only, no words — the child is a pre-reader — and every one is a real ≥ 44 px box (≥ 56 px on
// an iPad via `BTN`), because these are hit constantly by five-year-olds.
//
// They are the owner's clay renders lying ON THE TABLE, not icons in white tiles: a tool you pick up
// rather than a toolbar. The chosen one lifts off the table with a warm glow under it; the rest rest
// with a soft contact shadow. One look on every skin, like all game art.

/** The control size: ≥ 56 px on an iPad (768 short side), the 44 px floor on a phone. */
export const BTN = 'clamp(44px, 7.6vmin, 68px)'

/** The right-hand column's controls (Nyt papir, done, next, back to the pictures): one size for all. */
export const SIDE_BTN = `calc(${BTN} * 1.4)`

/**
 * Room between the reward ring in the header and the first control of the right-hand column, in every
 * Krea game (owner, 2026-10-17: "Nyt papir is too close to the rewards icon"). Landscape only: in
 * portrait the column is a row under the paper, far from the ring.
 */
export const SIDE_TOP_CLEARANCE = 'clamp(14px, 3.4vmin, 30px)'

/** How far the + badge hangs past a "new" control's right edge — `PlusBadge`'s `right: -14%`. */
const BADGE_OVERHANG = 0.14

/**
 * The studio's COLUMN GEOMETRY, one definition for all three drawing games (owner 2026-11-04, iPad Pro
 * 12.9": "the crayons are not centred under the canvas" and "the + and paper are too far right — give it
 * the same spacing as the avatar pill").
 *
 * - The crayon row spans the whole stage, but the side column is wider than the tool column, so the row's
 *   centre sat 15–22 px right of the paper's. Both columns are now DEFINITE widths in landscape, and the
 *   row pads its right by their difference — so it is centred on the paper, by construction.
 * - The right-hand controls stand in a lane as wide as the widest of them, set in from the stage's edge
 *   so the + badge's OUTER edge lands where the header's name pill ends. The pill ends at the Toolbar's
 *   gutter (16 px, 24 px from 600 px wide); the shell's content sits 12 px in already — that difference is
 *   `--krea-pill-gap`, set by `studioStageVars`. Measured, not assumed: the sweep compares the two edges.
 *
 * `widest` is the biggest control the side column ever holds (Fri Tegning: the sheet; a piece: the ✓/→).
 */
export const studioColumns = (widest: string) => {
  // Lane centred, sheet centred in it, badge hanging 14 % past the sheet: pull it in by the difference.
  const inset = `calc(var(--krea-pill-gap) + ${SIDE_BTN} * ${BADGE_OVERHANG} - (${widest} - ${SIDE_BTN}) / 2)`
  return {
    tools: BTN,
    side: `calc(${widest} + ${inset})`,
    inset,
    /** A row under the paper (portrait): the sheet is the rightmost control, so only its badge counts. */
    rowInset: `calc(var(--krea-pill-gap) + ${SIDE_BTN} * ${BADGE_OVERHANG})`,
  }
}

const PAL_GAP = 'clamp(0px, 0.4vmin, 6px)'

/**
 * The `pal` grid cell under the paper: the crayon row's size CONTAINER, centred on the paper. It spans
 * the whole stage, so in landscape it pads its right by (side − tools) — the paper's offset — unless the
 * row would no longer fit at the 44 px floor (a phone), where fitting beats a few px of centring.
 * `n` = how many items the widest row holds.
 */
export const studioPalSx = (cols: ReturnType<typeof studioColumns>, n: number) => ({
  gridArea: 'pal',
  display: 'grid',
  // ONE track exactly as wide as the row: an `auto` track grew to the stamp tray's max-content (24
  // pictures, wider than the screen) and the crayons were centred on THAT, not on the paper.
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'center',
  alignItems: 'end',
  containerType: 'inline-size',
  '& > *': { gridArea: '1 / 1', width: '100%' },
  '@media (orientation: landscape)': {
    pr: `max(0px, min(${cols.side} - ${cols.tools}, 100% - ${n} * 44px - ${n - 1} * ${PAL_GAP}))`,
  },
})

/** The stage-level custom property `studioColumns` reads (see there). */
export const studioStageVars = {
  '--krea-pill-gap': '4px',
  '@media (min-width: 600px)': { '--krea-pill-gap': '12px' },
} as const

const REST_SHADOW = 'drop-shadow(0 3px 3px rgba(70,40,15,0.35))'
const LIFT_SHADOW = 'drop-shadow(0 0 7px rgba(255,214,90,0.95)) drop-shadow(0 9px 7px rgba(70,40,15,0.35))'

/**
 * The glow and contact shadow live on THIS inner layer, never on the button itself. On the iPad the
 * button is a composited layer (it moves: `transform` + a transition), and WebKit clipped a
 * `drop-shadow` on that same element to its square box — the glow and the shadow came out cut off in a
 * square (owner's photos, 2026-10-16; headless WebKit renders it fine, so this is rung 3 only). The
 * inner layer reaches 16 px past the button on every side with the art padded back to the button's size,
 * so the filtered pixels are inside its own box and nothing is left to clip.
 */
const Shadowed: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
  <Box
    aria-hidden
    // At least 16 px, and 22 % on a big button: the + badge hangs 14 % past the corner and must stay inside
    // this filtered box too (owner, 2026-10-17: the badge EXTENDS the icon, it does not shrink it).
    sx={{ position: 'absolute', inset: 'calc(-1 * max(16px, 22%))', p: 'max(16px, 22%)', pointerEvents: 'none', filter: on ? LIFT_SHADOW : REST_SHADOW, display: 'flex' }}
  >
    {children}
  </Box>
)

/**
 * Act on the PRESS, not on `click`. A child hammering Undo produces taps closer together than the
 * browser's double-tap window, and `click` then fires for only some of them — measured with real touch
 * input: 20 fast taps undid ONE stroke. `pointerdown` fires for every tap. A keyboard (Enter/Space)
 * still arrives as a `click` with `detail === 0`, so that path is kept; a pointer's own `click`
 * (`detail >= 1`) is ignored so a tap never counts twice.
 */
export const pressHandlers = (fn: () => void) => ({
  onPointerDown: (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    fn()
  },
  onClick: (e: React.MouseEvent) => {
    if (e.detail === 0) fn()
  },
})

const Art: React.FC<{ src: string }> = ({ src }) => (
  <Box component="img" src={src} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />
)

/**
 * "A NEW sheet": the clay sheet with a big green + on its corner. The bare sheet alone was read as
 * nothing in particular — small, white, and silent about what it does (owner, 2026-10-16). The badge is
 * drawn in code (two rounded bars on a disc), not a glyph.
 */
/**
 * The green + badge on a "new" control's corner — shared with Perleplade's "Ny plade". It hangs OUTSIDE
 * the corner: the sheet/board keeps the same size as every other icon and the badge extends it (owner,
 * 2026-10-17 — "don't make the icon smaller to fit the +").
 */
export const PlusBadge: React.FC = () => (
    <Box
      aria-hidden
      data-plus-badge
      sx={{
        position: 'absolute',
        right: '-14%',
        top: '-14%',
        width: '44%',
        height: '44%',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #6CCB5A 0%, #2E9D44 70%)',
        boxShadow: '0 0 0 3px #FFFDF6, 0 3px 6px rgba(40,70,20,0.45)',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '58%',
          height: '18%',
          borderRadius: '99px',
          background: '#FFFFFF',
          transform: 'translate(-50%, -50%)',
        },
        '&::after': { transform: 'translate(-50%, -50%) rotate(90deg)' },
      }}
    />
)

// The sheet fills the button like every other icon (centred on the column's line, under/over the picker);
// the badge hangs off its corner. No shift to centre sheet + badge together — that moved the sheet.
const NewPaper: React.FC = () => (
  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
    <Art src={KREA_ART.paper} />
    <PlusBadge />
  </Box>
)

export const PICTURES = {
  NewPaper,
  Paper: () => <Art src={KREA_ART.paper} />,
  Done: () => <Art src={KREA_ART.done} />,
  Next: () => <Art src={KREA_ART.next} />,
}

export interface StudioButtonProps {
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  size?: string
  children: React.ReactNode
  dataId?: string
  /**
   * `click` for a button INSIDE a blocking overlay (the "Nyt papir?" confirm): it must close on the
   * click, never on the press, or the rest of the same tap lands on the paper underneath.
   */
  activateOn?: 'press' | 'click'
}

/** One clay object you can tap. `aria-label` carries the Danish name for assistive tech and probes. */
export const StudioButton: React.FC<StudioButtonProps> = ({ label, onPress, selected, disabled, size = BTN, children, dataId, activateOn = 'press' }) => (
  <ButtonBase
    aria-label={label}
    aria-pressed={selected}
    data-krea-control={dataId}
    disabled={disabled}
    {...(activateOn === 'press' ? pressHandlers(onPress) : { onClick: onPress })}
    sx={{
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: '50%',
      p: 0,
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
      opacity: disabled ? 0.4 : 1,
      overflow: 'visible',
      transform: selected ? 'translateY(-6px) scale(1.08)' : 'translateY(0px) scale(1)',
      transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1)',
      '&:active': { transform: selected ? 'translateY(-4px) scale(1.02)' : 'translateY(1px) scale(0.95)' },
    }}
  >
    <Shadowed on={!!selected}>{children}</Shadowed>
  </ButtonBase>
)

export interface ToolRowProps {
  tool: Tool
  /** The crayon tool shows the crayon in hand — a colour or the rainbow — so the child sees what they draw with. */
  color: CrayonColor
  /**
   * The stamp tool shows the PICTURE it stamps (the sun, the star…), not a rubber stamp: a stamp is an
   * office object a five-year-old may not know, and the picture says what the button does (owner,
   * 2026-10-16). Same idea as the crayon tool showing the crayon in hand.
   */
  stampSrc?: string
  /**
   * The tools this game HAS, in the one fixed order crayon · pictures · eraser (undo always follows).
   * All three drawing games use this one row so the left column behaves the same everywhere (owner,
   * 2026-10-16): Fri Tegning has all three, Farvelæg crayon + eraser, Tegn med Mig the crayon.
   */
  available?: ReadonlyArray<'crayon' | 'stamp' | 'eraser'>
  onTool: (t: Tool) => void
  onUndo: () => void
  canUndo: boolean
  disabled?: boolean
  direction: 'row' | 'column'
}

/**
 * The tools, the same at every level — only the palette changes with level (§2.2.5): the crayon, the
 * stamps, the eraser and undo. Two former tools are VARIANTS now (owner, 2026-10-16): the rainbow crayon
 * lies with the other crayons, and a star is a stamp (the tap-and-hold glitter brush is gone; its
 * renderer stays in `brushes.ts` so an old session's glitter still draws).
 */
export const ToolRow: React.FC<ToolRowProps> = ({ tool, color, stampSrc = '', available = ['crayon', 'stamp', 'eraser'], onTool, onUndo, canUndo, disabled, direction }) => {
  const all: Array<{ id: 'crayon' | 'stamp' | 'eraser'; label: string; src: string; on: boolean }> = [
    { id: 'crayon', label: 'Farvekridt', src: tool === 'rainbow' ? KREA_ART.crayonRainbow : CRAYON_ART[color], on: tool === 'crayon' || tool === 'rainbow' },
    { id: 'stamp', label: 'Billeder', src: stampSrc, on: tool === 'stamp' },
    { id: 'eraser', label: 'Viskelæder', src: KREA_ART.eraser, on: tool === 'eraser' },
  ]
  const tools = all.filter((t) => available.includes(t.id))
  return (
    <Box data-krea-tools sx={{ display: 'flex', flexDirection: direction, gap: 'clamp(6px, 1.4vmin, 12px)', alignItems: 'center' }}>
      {tools.map((t) => (
        <StudioButton key={t.id} dataId={`tool-${t.id}`} label={t.label} selected={t.on} disabled={disabled} onPress={() => onTool(t.id)}>
          <Art src={t.src} />
        </StudioButton>
      ))}
      <StudioButton dataId="undo" label="Fortryd" disabled={disabled || !canUndo} onPress={onUndo}>
        <Art src={KREA_ART.undo} />
      </StudioButton>
    </Box>
  )
}

export interface CrayonPaletteProps {
  colors: readonly CrayonColor[]
  color: CrayonColor
  /** Which crayon is in hand: a colour (`crayon`), the rainbow, or neither (another tool). */
  inHand: 'crayon' | 'rainbow' | null
  onPick: (c: CrayonColor) => void
  /** Absent = no rainbow crayon (Farvelæg fills a region with ONE colour). */
  onPickRainbow?: () => void
  disabled?: boolean
}

/**
 * The crayons, lying side by side on the table like a tipped-out box, with the RAINBOW crayon last. The
 * chosen one lifts off the table with a glow. 8 colours at Let, 12 above (`KREA_PALETTE`) — plus the
 * rainbow at every level.
 */
export const CrayonPalette: React.FC<CrayonPaletteProps> = ({ colors, color, inHand, onPick, onPickRainbow, disabled }) => {
  const items: Array<{ id: CrayonColor | 'rainbow'; label: string; src: string; on: boolean; pick: () => void }> = [
    ...colors.map((c) => ({ id: c, label: KREA_COLOR_NAME[c], src: CRAYON_ART[c], on: inHand === 'crayon' && c === color, pick: () => onPick(c) })),
    ...(onPickRainbow ? [{ id: 'rainbow' as const, label: KREA_RAINBOW_NAME, src: KREA_ART.crayonRainbow, on: inHand === 'rainbow', pick: onPickRainbow }] : []),
  ]
  const n = items.length
  // A GRID with a fixed column count, never a wrapping flow: ONE row everywhere but a phone in portrait,
  // which gets two even rows (7 + 7, 7 + 6, 5 + 5…). A wrapping flow sized from `100vw` broke on the
  // owner's iPad (2026-11-04: the rainbow crayon alone on a second line). The cell is sized from the
  // row's OWN width (`cqw` — the `pal` box around it is the container, `studioPalSx`), so it cannot
  // outgrow it short of the 44 px floor.
  const cols = (k: number) => `max(44px, min(calc(${BTN} * 1.02), calc((100cqw - ${k - 1} * ${PAL_GAP}) / ${k})))`
  const half = Math.ceil(n / 2)
  return (
    <Box
      data-krea-palette
      data-krea-palette-size={colors.length}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, ${cols(n)})`,
        justifyContent: 'center',
        alignItems: 'end',
        columnGap: PAL_GAP,
        rowGap: '2px',
        '@media (orientation: portrait) and (max-width: 480px)': { gridTemplateColumns: `repeat(${half}, ${cols(half)})` },
      }}
    >
      {items.map((it) => (
        <ButtonBase
          key={it.id}
          aria-label={it.label}
          aria-pressed={it.on}
          data-krea-crayon={it.id}
          disabled={disabled}
          {...pressHandlers(it.pick)}
          sx={{
            width: '100%',
            aspectRatio: '1',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            overflow: 'visible',
            transform: it.on ? 'translateY(-10px) scale(1.12)' : 'translateY(0px) scale(1)',
            transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1)',
          }}
        >
          <Shadowed on={it.on}>
            <Art src={it.src} />
          </Shadowed>
        </ButtonBase>
      ))}
    </Box>
  )
}

export interface StampTrayProps {
  stamps: Array<{ id: string; src: string }>
  stamp: string | null
  onPick: (id: string) => void
  disabled?: boolean
}

/** The stamp tray — in the crayons' place, only while the stamp tool is picked (§2.2.5). */
/**
 * ONE swipeable row (24 pictures would cost the paper two or three rows of height). The row is wider
 * than the screen and scrolls sideways under a finger, with the edge item cut in half so the child sees
 * there is more. Its pictures act on the CLICK, not the press: a swipe that starts on a picture must
 * scroll, not pick it (the browser drops the click when the finger travelled). Room above and below for
 * the lifted, glowing one — a scroll box clips vertically too.
 */
export const StampTray: React.FC<StampTrayProps> = ({ stamps, stamp, onPick, disabled }) => (
  <Box
    data-krea-stamps
    sx={{
      display: 'flex',
      flexWrap: 'nowrap',
      gap: 'clamp(4px, 1vmin, 10px)',
      overflowX: 'auto',
      overflowY: 'hidden',
      touchAction: 'pan-x',
      overscrollBehaviorX: 'contain',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
      // As wide as the row under the paper (`studioPalSx`), padding included.
      width: '100%',
      boxSizing: 'border-box',
      px: '18px',
      pt: '22px',
      pb: '14px',
      mt: '-22px',
      mb: '-14px',
    }}
  >
    {stamps.map((s) => (
      <StudioButton key={s.id} dataId={`stamp-${s.id}`} label={s.id} selected={stamp === s.id} disabled={disabled} activateOn="click" onPress={() => onPick(s.id)}>
        <Art src={s.src} />
      </StudioButton>
    ))}
  </Box>
)
