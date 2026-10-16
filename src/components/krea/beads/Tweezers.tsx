import React from 'react'
import { ButtonBase } from '@mui/material'
import { BEAD_ART } from '../../../assets/games/krea/beads'
import { pressHandlers } from '../studio/StudioControls'
import { Bead } from './Bead'
import type { BeadColor } from './beadBoard'

// The tweezers (Krea PRD-02 §4.2). Held tools lie on the right with the tip pointing DOWN-LEFT (house
// art rule) — the render already does. Where the tips meet, as a fraction of the sprite box, measured
// on the keyed 256² WebP: that is where the bead sits.
const TIP = { x: 0.2, y: 0.78 }

/**
 * In the side column: the tweezers, holding the tapped bead if there is one. Tapping them while they
 * hold a bead puts it back in its bowl (the same as tapping that bowl again).
 */
export const TweezersHolder: React.FC<{ held: BeadColor | null; disabled: boolean; onPress: () => void }> = ({ held, disabled, onPress }) => (
  <ButtonBase
    data-krea-control="tweezers"
    data-krea-held={held ?? ''}
    aria-label={held ? 'Læg perlen tilbage' : 'Pincet'}
    disabled={disabled || !held}
    {...pressHandlers(onPress)}
    sx={{
      position: 'relative',
      width: 'var(--bead-tweezers)',
      height: 'var(--bead-tweezers)',
      flex: '0 0 auto',
      borderRadius: '24px',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
      filter: 'drop-shadow(0 4px 4px rgba(70,40,15,0.32))',
      transform: held ? 'translateY(-4px) rotate(-6deg)' : 'translateY(0px) rotate(0deg)',
      transition: 'transform 160ms cubic-bezier(0.3,0.7,0.4,1)',
    }}
  >
    <img src={BEAD_ART.tweezers} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
    {held ? (
      <Bead colour={held} style={{ position: 'absolute', width: '30%', height: '30%', left: `${TIP.x * 100 - 15}%`, top: `${TIP.y * 100 - 15}%` }} />
    ) : null}
  </ButtonBase>
)

/**
 * The bead in the finger while dragging: the bead with the tweezers' tips on it, floating about one
 * pitch ABOVE the finger so the finger never hides the peg it lands on (§4.2). Positioned imperatively
 * by the game on every pointermove (`translate`), so a drag re-renders nothing.
 */
export const DragGhost: React.FC<{ ghostRef: React.Ref<HTMLDivElement>; colour: BeadColor | null; beadPx: number }> = ({ ghostRef, colour, beadPx }) => {
  const tw = beadPx * 2.6
  return (
    <div
      ref={ghostRef}
      data-krea-ghost={colour ?? ''}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        zIndex: 30,
        pointerEvents: 'none',
        display: colour ? 'block' : 'none',
        transition: 'none',
      }}
    >
      {colour ? (
        <>
          <Bead colour={colour} style={{ position: 'absolute', width: beadPx, height: beadPx, left: -beadPx / 2, top: -beadPx / 2, boxShadow: '0 6px 8px rgba(60,40,20,0.35)' }} />
          <img
            src={BEAD_ART.tweezers}
            alt=""
            draggable={false}
            style={{ position: 'absolute', width: tw, height: tw, left: -TIP.x * tw, top: -TIP.y * tw, pointerEvents: 'none', filter: 'drop-shadow(0 6px 6px rgba(70,40,15,0.3))' }}
          />
        </>
      ) : null}
    </div>
  )
}
