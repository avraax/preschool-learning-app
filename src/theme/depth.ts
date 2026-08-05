import { useCallback, useRef, useState } from 'react'
import { hexToRgba } from './tokens/helpers'

// Structured World depth helpers (Liveliness PRD-05 W1.3). The "premium soft-3D look",
// delivered in pure CSS — layered drop-shadows, a grounded contact-shadow ellipse, and a tiny
// pointer-tilt. Shared by SceneObject, reward art, and (later) the games so the whole shell
// reads as one tactile material language. No WebGL, no runtime 3D — baked art + CSS depth.

// A stacked, soft drop-shadow for a cut-out object (used as a `filter`, so it hugs the alpha
// shape rather than a rectangle). `elevation` 0→3 = resting → lifted. Warmer, softer than a
// hard box-shadow so objects feel like clay, not paper.
export const softShadow = (elevation = 1): string => {
  const e = Math.max(0, elevation)
  const near = `drop-shadow(0 ${1 + e}px ${2 + e * 1.5}px rgba(0,0,0,0.20))`
  const far = `drop-shadow(0 ${4 + e * 3}px ${10 + e * 6}px rgba(0,0,0,0.22))`
  return `${near} ${far}`
}

/**
 * The `box-shadow` equivalent of `softShadow()` — the SAME two layers (a tight near shadow plus a wide
 * soft far one), for a rectangle or a rounded rectangle.
 *
 * **`box-shadow` for OPAQUE boxes; `drop-shadow` for alpha cut-outs AND for translucent surfaces**
 * (Performance PRD-01 W4/F6 — the second half of that rule was MEASURED here, not in the PRD).
 *
 * F6 says "for a rectangle or a rounded rectangle, `box-shadow` is the same picture at a fraction of the
 * cost". That is only true when the rectangle is OPAQUE. `drop-shadow` paints the element's own
 * silhouette BEHIND the element, so on a translucent surface the shadow shows through the element's own
 * face and darkens it; `box-shadow` is clipped to outside the border box and cannot. Every tile surface
 * in this app is translucent toward the bottom — `tileSurface()` ends at `rgba(accent, 0.08)` — so the
 * drop-shadow there is load-bearing for the MATERIAL, not just the outline. Measured on a
 * `/alphabet/learn` tile: swapping mechanisms lifted the face from rgb(208,210,219) to rgb(228,230,240)
 * and lightened the shadow band beneath it by 11 RGB. A compensating background wash closed only 3 of
 * those 17, because the two mismatches have different causes. So `TactileTile`, Plus/Minus's equation
 * tile and Stav Ordet's slots deliberately KEEP `softShadow()`.
 *
 * Use this for a box whose fill is opaque: `TactilePill` (an accent fill under a sheen), Sig et Ord's
 * clay orb. There the two are pixel-equivalent and the filter passes are pure cost.
 * `softShadow()` returns two CHAINED `drop-shadow()` filters, which means two input paths, channel
 * swizzling, a blur and a blend **per element** — and on mobile Safari chained `drop-shadow` is
 * documented as both slow and visually buggy (shadows left behind when the element moves, wrong on
 * first render, flicker). For a rounded rectangle it also buys nothing: the shadow of a rectangle IS a
 * rectangle, so `box-shadow` draws the same picture. `UnifiedMemoryGame` already noted this, standing
 * a layered box-shadow in for exactly this reason.
 *
 * Keep `softShadow()` where the shadow must hug a cut-out silhouette — `SceneObject`, `PromptArt`, the
 * section landmark, `farverArt`, `EnglishLearning`. There, the filter is doing work `box-shadow` cannot.
 *
 * Offsets, blurs and alphas are COPIED from `softShadow()` **1:1, with no rescaling.** The Filter
 * Effects spec defines `drop-shadow()`'s third length as a blur radius "interpreted as in box-shadow"
 * — both are σ = radius/2 — so the same numbers give the same softness. Doubling them (on the theory
 * that the two units differ) was tried and measured: `/alphabet/learn` went from 25.9% to 44.3% busy at
 * 6x and its layer texture grew 6 MB, because a 34px blur on 29 tiles paints far outside each tile's
 * box. If these values ever look wrong, A/B a screenshot — don't rescale them from first principles.
 */
export const boxSoftShadow = (elevation = 1): string => {
  const e = Math.max(0, elevation)
  const near = `0 ${1 + e}px ${2 + e * 1.5}px rgba(0,0,0,0.20)`
  const far = `0 ${4 + e * 3}px ${10 + e * 6}px rgba(0,0,0,0.22)`
  return `${near}, ${far}`
}

/**
 * Whisper-thin lift for one cell in a dense FIELD of tiles (Lær Tal's hundreds-chart).
 *
 * `softShadow()` is built for an object with space around it: its far layer is a ~17px blur offset
 * ~8px down. In a grid of 35px-tall tiles with 3px gaps, each tile's shadow lands on its neighbours
 * and in the gaps, so ~200 overlapping black shadows at 20–22% alpha pool into an even grey wash that
 * reads as a translucent panel behind the whole chart — measured 2026-08-02 as −35 RGB across the grid
 * area (and −32 on the tile faces themselves), with 0 change outside it. One tight near-shadow keeps
 * the cells distinct without pooling; the tiles' hairline edge + inner highlight carry the rest.
 */
export const fieldShadow = (): string => 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.14))'

// There is deliberately NO `box-shadow` form of `fieldShadow()`. A field cell's surface is the MOST
// translucent one in the app (`translucentTileSurface`, a 58%-alpha white top), so it is the last place
// the substitution above would be equivalent — see `boxSoftShadow`'s note.

// The soft contact-shadow ellipse that sits BENEATH an object and grounds it in the world.
// Returns a `background` (radial gradient) for a blurred `Box`; tint it with the section accent
// (a hint of the object's own colour, not flat grey) so it reads as a warm cast shadow.
// `strength` 0→1 scales the darkness (lower it on tap, when the object lifts toward the camera).
export const contactShadow = (accent = '#000000', strength = 1): string => {
  const s = Math.max(0, Math.min(1, strength))
  return `radial-gradient(ellipse at center, ${hexToRgba(accent, 0.36 * s)} 0%, ${hexToRgba(
    accent,
    0.18 * s,
  )} 42%, ${hexToRgba(accent, 0)} 72%)`
}

// ---- Pointer tilt -------------------------------------------------------------------
// A tiny 3D parallax tilt: the object leans toward the pointer, giving depth on hover/drag.
// Returns props to spread on the tilting element (which must live under a `perspective` parent)
// plus the transform string. `disabled` (reduced-motion / in-game / touch-only) → inert: the
// handlers no-op and the transform stays flat, so it never fights the CSS breathe / framer squash.

interface UsePointerTiltArgs {
  strength?: number // max tilt in degrees at the edge (default ~8)
  disabled?: boolean
}

interface PointerTilt {
  transform: string // rotateX/rotateY — apply to the tilting layer
  handlers: {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerLeave: () => void
  }
}

export function usePointerTilt({ strength = 8, disabled = false }: UsePointerTiltArgs = {}): PointerTilt {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const frame = useRef<number | null>(null)

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.pointerType === 'touch') return
      const rect = e.currentTarget.getBoundingClientRect()
      // -0.5→0.5 relative to the element centre.
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      if (frame.current != null) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        // Lean TOWARD the pointer: tilt around X is driven by vertical position (inverted).
        setTilt({ x: -py * strength, y: px * strength })
      })
    },
    [disabled, strength],
  )

  const onPointerLeave = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    setTilt({ x: 0, y: 0 })
  }, [])

  const transform = disabled ? 'none' : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
  return { transform, handlers: { onPointerMove, onPointerLeave } }
}

export default { softShadow, contactShadow, usePointerTilt }
