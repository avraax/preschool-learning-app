import React from 'react'
import { Box, ButtonBase } from '@mui/material'
import { CRAYON_HEX } from '../canvas/brushes'
import type { CrayonColor, Tool } from '../canvas/strokeModel'
import { KREA_COLOR_NAME } from '../../../config/kreaPhrases'

// The studio's controls (Krea PRD-01 §2.2.5, §4.10): six tool buttons, the crayons, "Nyt papir", done
// and next. Pictures only, no words — the child is a pre-reader — and every one is a real ≥ 44 px box
// (≥ 56 px on an iPad via `--btn`), because these are hit constantly by five-year-olds.
//
// The pictures are SVG stand-ins drawn in code until the owner's Gemini batches B–F land (crayons,
// tool props, buttons as objects); they are not emoji and not glyphs, and each is replaced 1:1 by its
// baked render. One look on every skin, like all game art.

/** The control size: ≥ 56 px on an iPad (768 short side), the 44 px floor on a phone. */
export const BTN = 'clamp(44px, 7.6vmin, 68px)'

const FRAME = {
  idle: '#FFFDF8',
  ring: 'rgba(120,80,40,0.22)',
  active: '#FFB300',
  shadow: '0 4px 0 rgba(120,80,40,0.28), 0 6px 14px rgba(80,50,20,0.22)',
  pressed: '0 1px 0 rgba(120,80,40,0.28), 0 2px 6px rgba(80,50,20,0.2)',
}

// ----- pictures ----------------------------------------------------------------------------------

const Crayon: React.FC<{ fill: string; rainbow?: boolean }> = ({ fill, rainbow }) => (
  <svg viewBox="0 0 40 80" width="100%" height="100%" aria-hidden>
    <defs>
      {rainbow && (
        <linearGradient id="krea-rb" x1="0" x2="0" y1="0" y2="1">
          {['#E53935', '#FB8C00', '#FDD835', '#2E9D44', '#1E63D6', '#8E44AD'].map((c, i) => (
            <stop key={c} offset={`${(i / 5) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      )}
    </defs>
    <path d="M20 2 L32 24 L8 24 Z" fill={rainbow ? '#FB8C00' : fill} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
    <rect x="8" y="23" width="24" height="54" rx="5" fill={rainbow ? 'url(#krea-rb)' : fill} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
    <rect x="8" y="38" width="24" height="18" fill="rgba(255,255,255,0.55)" />
    <rect x="12" y="26" width="5" height="48" rx="2.5" fill="rgba(255,255,255,0.35)" />
  </svg>
)

const Star: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <path d="M32 6 L39 24 L58 25 L43 37 L48 56 L32 45 L16 56 L21 37 L6 25 L25 24 Z" fill="#FFCA28" stroke="#E0A000" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="3" fill="#FFE082" />
    <circle cx="54" cy="52" r="2.5" fill="#FFF59D" />
    <circle cx="55" cy="12" r="2" fill="#FFFFFF" />
  </svg>
)

const StampPic: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <ellipse cx="32" cy="14" rx="11" ry="9" fill="#B07A45" />
    <rect x="27" y="18" width="10" height="18" fill="#9A6535" />
    <rect x="12" y="36" width="40" height="12" rx="4" fill="#C98B4E" />
    <rect x="14" y="48" width="36" height="9" rx="3" fill="#E53935" />
  </svg>
)

const Eraser: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <g transform="rotate(-25 32 32)">
      <rect x="8" y="20" width="48" height="24" rx="8" fill="#F8A5C2" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      <rect x="8" y="20" width="18" height="24" rx="8" fill="#5C9BD6" />
      <rect x="20" y="20" width="6" height="24" fill="#5C9BD6" />
    </g>
  </svg>
)

const Undo: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <path d="M22 22 H38 A14 14 0 0 1 38 50 H24" fill="none" stroke="#1E88E5" strokeWidth="8" strokeLinecap="round" />
    <path d="M26 10 L12 22 L26 34 Z" fill="#1E88E5" strokeLinejoin="round" stroke="#1E88E5" strokeWidth="3" />
  </svg>
)

const PaperPic: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <path d="M14 6 H40 L52 18 V58 H14 Z" fill="#FFFFFF" stroke="#B0A090" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M40 6 V18 H52" fill="#EDE6DA" stroke="#B0A090" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
)

const Check: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <circle cx="32" cy="32" r="29" fill="#2E9D44" />
    <path d="M18 33 L28 43 L47 22" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Arrow: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <circle cx="32" cy="32" r="29" fill="#FB8C00" />
    <path d="M18 32 H44 M34 20 L46 32 L34 44" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** A picture of the user's own paper, kept — the "Nej, behold den" choice of the confirm. */
const MyPicture: React.FC = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
    <rect x="8" y="10" width="48" height="44" rx="4" fill="#FFFFFF" stroke="#B0A090" strokeWidth="2.5" />
    <path d="M14 44 C 22 26, 30 26, 34 38 S 46 46, 50 22" fill="none" stroke="#E53935" strokeWidth="5" strokeLinecap="round" />
    <circle cx="44" cy="20" r="5" fill="#FDD835" />
  </svg>
)

export const PICTURES = { Crayon, Star, StampPic, Eraser, Undo, PaperPic, Check, Arrow, MyPicture }

// ----- buttons -----------------------------------------------------------------------------------

export interface StudioButtonProps {
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  size?: string
  round?: boolean
  children: React.ReactNode
  dataId?: string
}

/** One tactile clay-ish control. `aria-label` carries the Danish name for assistive tech and probes. */
export const StudioButton: React.FC<StudioButtonProps> = ({ label, onPress, selected, disabled, size = BTN, round, children, dataId }) => (
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
      borderRadius: round ? '50%' : '22%',
      background: round ? 'transparent' : FRAME.idle,
      boxShadow: round ? 'none' : `${FRAME.shadow}, inset 0 0 0 ${selected ? 4 : 2}px ${selected ? FRAME.active : FRAME.ring}`,
      transform: selected ? 'translateY(-3px)' : 'translateY(0px)',
      transition: 'transform 120ms cubic-bezier(0.3,0.7,0.4,1), box-shadow 120ms ease',
      // NOT a percentage: padding % resolves against the PARENT's width, so in a row of tools it
      // swallowed the whole button and the picture drew at 0×0 (measured, portrait).
      p: round ? 0 : `calc(${size} * 0.14)`,
      opacity: disabled ? 0.4 : 1,
      touchAction: 'manipulation',
      '&:active': round ? { transform: 'scale(0.94)' } : { boxShadow: `${FRAME.pressed}, inset 0 0 0 2px ${FRAME.ring}`, transform: 'translateY(2px)' },
      filter: round ? 'drop-shadow(0 4px 6px rgba(60,40,20,0.3))' : 'none',
    }}
  >
    {children}
  </ButtonBase>
)

export interface ToolRowProps {
  tool: Tool
  onTool: (t: Tool) => void
  onUndo: () => void
  canUndo: boolean
  disabled?: boolean
  direction: 'row' | 'column'
}

const TOOLS: Array<{ id: Tool; label: string; pic: React.ReactNode }> = [
  { id: 'crayon', label: 'Farvekridt', pic: <Crayon fill="#E53935" /> },
  { id: 'rainbow', label: 'Regnbue', pic: <Crayon fill="#000" rainbow /> },
  { id: 'glitter', label: 'Glimmer', pic: <Star /> },
  { id: 'stamp', label: 'Stempler', pic: <StampPic /> },
  { id: 'eraser', label: 'Viskelæder', pic: <Eraser /> },
]

/** The six tools, the same at every level — only the palette changes with level (§2.2.5). */
export const ToolRow: React.FC<ToolRowProps> = ({ tool, onTool, onUndo, canUndo, disabled, direction }) => (
  <Box data-krea-tools sx={{ display: 'flex', flexDirection: direction, gap: 'clamp(6px, 1.4vmin, 12px)', alignItems: 'center' }}>
    {TOOLS.map((t) => (
      <StudioButton key={t.id} dataId={`tool-${t.id}`} label={t.label} selected={tool === t.id} disabled={disabled} onPress={() => onTool(t.id)}>
        {t.pic}
      </StudioButton>
    ))}
    <StudioButton dataId="undo" label="Fortryd" disabled={disabled || !canUndo} onPress={onUndo}>
      <Undo />
    </StudioButton>
  </Box>
)

export interface CrayonPaletteProps {
  colors: readonly CrayonColor[]
  color: CrayonColor
  active: boolean
  onPick: (c: CrayonColor) => void
  disabled?: boolean
}

/**
 * The crayons on the table. The chosen one stands up out of the row; picking one also switches the
 * tool back to the crayon. 8 at Let, 12 above (`KREA_PALETTE`).
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
      columnGap: 'clamp(2px, 0.8vmin, 10px)',
      rowGap: '4px',
      // Phone portrait: two rows of six rather than twelve 28 px slivers.
      maxWidth: `calc(${BTN} * ${colors.length > 8 ? 13 : 10})`,
      '@media (orientation: portrait) and (max-width: 480px)': { maxWidth: `calc(${BTN} * 6.6)` },
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
            width: `calc(${BTN} * 0.78)`,
            minWidth: '44px',
            height: `calc(${BTN} * 1.25)`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            touchAction: 'manipulation',
            borderRadius: '10px',
            transform: on ? 'translateY(-14%)' : 'translateY(0px)',
            transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1)',
            filter: `drop-shadow(0 ${on ? 6 : 3}px ${on ? 6 : 3}px rgba(60,40,20,0.35))`,
          }}
        >
          <Box sx={{ width: '62%', height: '100%' }}>
            <Crayon fill={CRAYON_HEX[c]} />
          </Box>
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
  <Box data-krea-stamps sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(4px, 1vmin, 10px)', maxWidth: `calc(${BTN} * 9)` }}>
    {stamps.map((s) => (
      <StudioButton key={s.id} dataId={`stamp-${s.id}`} label={s.id} selected={stamp === s.id} disabled={disabled} onPress={() => onPick(s.id)}>
        <Box component="img" src={s.src} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      </StudioButton>
    ))}
  </Box>
)
