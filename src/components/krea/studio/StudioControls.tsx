import React from 'react'
import { Box, ButtonBase } from '@mui/material'
import type { CrayonColor, Tool } from '../canvas/strokeModel'
import { KREA_COLOR_NAME } from '../../../config/kreaPhrases'
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

const Art: React.FC<{ src: string }> = ({ src }) => (
  <Box component="img" src={src} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />
)

export const PICTURES = {
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
}

/** One clay object you can tap. `aria-label` carries the Danish name for assistive tech and probes. */
export const StudioButton: React.FC<StudioButtonProps> = ({ label, onPress, selected, disabled, size = BTN, children, dataId }) => (
  <ButtonBase
    aria-label={label}
    aria-pressed={selected}
    data-krea-control={dataId}
    disabled={disabled}
    onClick={onPress}
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
  /** The crayon tool shows the crayon in hand, so the child sees which colour they are drawing with. */
  color: CrayonColor
  onTool: (t: Tool) => void
  onUndo: () => void
  canUndo: boolean
  disabled?: boolean
  direction: 'row' | 'column'
}

/** The six tools, the same at every level — only the palette changes with level (§2.2.5). */
export const ToolRow: React.FC<ToolRowProps> = ({ tool, color, onTool, onUndo, canUndo, disabled, direction }) => {
  const tools: Array<{ id: Tool; label: string; src: string }> = [
    { id: 'crayon', label: 'Farvekridt', src: CRAYON_ART[color] },
    { id: 'rainbow', label: 'Regnbue', src: KREA_ART.crayonRainbow },
    { id: 'glitter', label: 'Glimmer', src: KREA_ART.glitter },
    { id: 'stamp', label: 'Stempler', src: KREA_ART.stamp },
    { id: 'eraser', label: 'Viskelæder', src: KREA_ART.eraser },
  ]
  return (
    <Box data-krea-tools sx={{ display: 'flex', flexDirection: direction, gap: 'clamp(6px, 1.4vmin, 12px)', alignItems: 'center' }}>
      {tools.map((t) => (
        <StudioButton key={t.id} dataId={`tool-${t.id}`} label={t.label} selected={tool === t.id} disabled={disabled} onPress={() => onTool(t.id)}>
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
  active: boolean
  onPick: (c: CrayonColor) => void
  disabled?: boolean
}

/**
 * The crayons, lying side by side on the table like a tipped-out box. The chosen one lifts off the
 * table with a glow; picking one also switches the tool back to the crayon. 8 at Let, 12 above
 * (`KREA_PALETTE`).
 */
export const CrayonPalette: React.FC<CrayonPaletteProps> = ({ colors, color, active, onPick, disabled }) => (
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
      maxWidth: `calc(${BTN} * ${colors.length > 8 ? 13.4 : 9.4})`,
      // Phone portrait: two rows of six rather than twelve slivers.
      '@media (orientation: portrait) and (max-width: 480px)': { maxWidth: `calc(${BTN} * 6.8)` },
    }}
  >
    {colors.map((c) => {
      const on = active && c === color
      return (
        <ButtonBase
          key={c}
          aria-label={KREA_COLOR_NAME[c]}
          aria-pressed={on}
          data-krea-crayon={c}
          disabled={disabled}
          onClick={() => onPick(c)}
          sx={{
            // Twelve must fit ONE row on an iPad in portrait (768 wide): at the full size the row was
            // 744 px in a 736 px track and the white crayon wrapped alone onto a second line.
            width: `min(calc(${BTN} * 1.02), calc((100vw - 40px) / 12.6))`,
            minWidth: '44px',
            height: `min(calc(${BTN} * 1.02), calc((100vw - 40px) / 12.6))`,
            minHeight: '44px',
            borderRadius: '50%',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            filter: on ? LIFT_SHADOW : REST_SHADOW,
            transform: on ? 'translateY(-10px) scale(1.12)' : 'translateY(0px) scale(1)',
            transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1), filter 140ms ease',
          }}
        >
          <Art src={CRAYON_ART[c]} />
        </ButtonBase>
      )
    })}
  </Box>
)

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
