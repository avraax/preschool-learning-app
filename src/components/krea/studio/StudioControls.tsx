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

const REST_SHADOW = 'drop-shadow(0 3px 3px rgba(70,40,15,0.35))'
const LIFT_SHADOW = 'drop-shadow(0 0 7px rgba(255,214,90,0.95)) drop-shadow(0 9px 7px rgba(70,40,15,0.35))'

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
const NewPaper: React.FC = () => (
  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
    <Art src={KREA_ART.paper} />
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        right: '-2%',
        top: '-2%',
        width: '46%',
        height: '46%',
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
      filter: selected ? LIFT_SHADOW : REST_SHADOW,
      transform: selected ? 'translateY(-6px) scale(1.08)' : 'translateY(0px) scale(1)',
      transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1), filter 140ms ease',
      '&:active': { transform: selected ? 'translateY(-4px) scale(1.02)' : 'translateY(1px) scale(0.95)' },
    }}
  >
    {children}
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
  stampSrc: string
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
export const ToolRow: React.FC<ToolRowProps> = ({ tool, color, stampSrc, onTool, onUndo, canUndo, disabled, direction }) => {
  const tools: Array<{ id: Tool; label: string; src: string; on: boolean }> = [
    { id: 'crayon', label: 'Farvekridt', src: tool === 'rainbow' ? KREA_ART.crayonRainbow : CRAYON_ART[color], on: tool === 'crayon' || tool === 'rainbow' },
    { id: 'stamp', label: 'Billeder', src: stampSrc, on: tool === 'stamp' },
    { id: 'eraser', label: 'Viskelæder', src: KREA_ART.eraser, on: tool === 'eraser' },
  ]
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
  onPickRainbow: () => void
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
    { id: 'rainbow' as const, label: KREA_RAINBOW_NAME, src: KREA_ART.crayonRainbow, on: inHand === 'rainbow', pick: onPickRainbow },
  ]
  const n = items.length
  // One row on a tablet: 13 must fit 768 wide in portrait INSIDE the shell's side padding (measured: at
  // `(100vw - 40px) / 13.6` the rainbow wrapped alone onto a second line). On a phone in portrait, two
  // even rows.
  const cell = `min(calc(${BTN} * 1.02), calc((100vw - 64px) / ${n + 1.2}))`
  return (
    <Box
      data-krea-palette
      data-krea-palette-size={colors.length}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-end',
        columnGap: 'clamp(0px, 0.4vmin, 6px)',
        rowGap: '2px',
        maxWidth: `calc(${BTN} * ${n + 1.4})`,
        '@media (orientation: portrait) and (max-width: 480px)': { maxWidth: `calc(${BTN} * ${Math.ceil(n / 2) + 0.8})` },
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
            width: cell,
            minWidth: '44px',
            height: cell,
            minHeight: '44px',
            borderRadius: '50%',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            filter: it.on ? LIFT_SHADOW : REST_SHADOW,
            transform: it.on ? 'translateY(-10px) scale(1.12)' : 'translateY(0px) scale(1)',
            transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1), filter 140ms ease',
          }}
        >
          <Art src={it.src} />
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
export const StampTray: React.FC<StampTrayProps> = ({ stamps, stamp, onPick, disabled }) => (
  <Box data-krea-stamps sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(4px, 1vmin, 10px)', maxWidth: `calc(${BTN} * 9)`, '@media (orientation: portrait) and (max-width: 480px)': { maxWidth: `calc(${BTN} * 5)` } }}>
    {stamps.map((s) => (
      <StudioButton key={s.id} dataId={`stamp-${s.id}`} label={s.id} selected={stamp === s.id} disabled={disabled} onPress={() => onPick(s.id)}>
        <Art src={s.src} />
      </StudioButton>
    ))}
  </Box>
)
