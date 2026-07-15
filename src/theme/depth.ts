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
