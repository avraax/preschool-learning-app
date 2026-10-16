import React, { useEffect, useMemo, useRef } from 'react'
import { Box } from '@mui/material'
import { mirrorShape, sampleShape, shapePath, subjectToPaper, subjectXToPaper } from '../../../config/kreaShapes'
import { MIRROR_AXIS, type GuideStep } from '../../../config/kreaSubjects'
import { PAPER_H, PAPER_W } from '../canvas/strokeModel'
import { idleGlow } from '../../../theme/idleMotion'
import { KREA_ART } from '../../../assets/games/krea'

// The dotted guide of Tegn med Mig's current step (Krea PRD-01 §4.3), over the ink, under nothing the
// child can touch (`pointer-events: none` — the drawing surface below takes every press).
//
// THICK DOTS, not a line: a dotted guide reads as "draw here", a solid one as "already drawn". Only the
// current step's guide shows; the finished steps are the child's own ink. A mirror step shows its
// drawn side in full and the other side as a faint ghost on the far side of a thin centre line — the
// half that "comes by itself".
//
// The stall hint (8 s idle) pulses the guide's opacity with `idleGlow` (a CSS keyframe, not a JS loop);
// under reduced motion it turns a stronger colour instead.

const GUIDE = '#7C8BA5'
const GUIDE_HINT = '#3F6FD8'

export const GuideLayer: React.FC<{ step: GuideStep | null; stepKey: string; hint: boolean; reduce: boolean }> = ({ step, stepKey, hint, reduce }) => {
  const paths = useMemo(() => (step ? step.shapes.map(shapePath) : []), [step])
  const ghosts = useMemo(() => (step?.mirror ? step.shapes.map((s) => shapePath(mirrorShape(s, MIRROR_AXIS))) : []), [step])
  if (!step) return null
  const pulse = hint ? idleGlow(reduce, { from: 1, to: 0.3, durationS: 1.1 }) : null
  const axis = subjectXToPaper(MIRROR_AXIS)
  return (
    <Box
      key={stepKey}
      aria-hidden
      data-krea-guide={stepKey}
      data-krea-guide-hint={hint ? 'on' : 'off'}
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        // The next step's guide fades in with its spoken line — a one-shot, opacity only.
        animation: reduce ? undefined : 'kreaGuideIn 380ms ease-out both',
        '@keyframes kreaGuideIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box {...(pulse?.props ?? {})} sx={[{ position: 'absolute', inset: 0 }, pulse?.sx ?? {}]}>
        <svg viewBox={`0 0 ${PAPER_W} ${PAPER_H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
          {step.mirror && (
            <line x1={axis} y1={PAPER_H * 0.04} x2={axis} y2={PAPER_H * 0.96} stroke={GUIDE} strokeOpacity={0.35} strokeWidth={4} strokeDasharray="14 14" />
          )}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {ghosts.map((d, i) => (
              <path key={`g${i}`} d={d} stroke={GUIDE} strokeOpacity={0.28} strokeWidth={10} strokeDasharray="0.1 24" />
            ))}
            {paths.map((d, i) => (
              <path key={i} d={d} stroke={hint && reduce ? GUIDE_HINT : GUIDE} strokeWidth={15} strokeDasharray="0.1 27" />
            ))}
          </g>
        </svg>
      </Box>
    </Box>
  )
}

/**
 * The demo pencil (Let only, §4.3): traces the step's guide ONCE, ~1.2 s, then is gone. A WAAPI one-shot
 * on transform/opacity, keyed off the guide's own samples so it follows exactly the dots the child sees.
 * The pencil lies tip DOWN-LEFT (the house art rule), so its tip — not its centre — is what follows.
 */
export const DemoPencil: React.FC<{ step: GuideStep | null; runKey: string | null; reduce: boolean }> = ({ step, runKey, reduce }) => {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !step || !runKey || reduce || typeof el.animate !== 'function') return
    // The guide's samples in paper units → percent of the paper; ≤ 40 keyframes is plenty for 1.2 s.
    const pts: number[] = []
    for (const s of step.shapes) {
      const p = sampleShape(s)
      for (let i = 0; i < p.length; i += 2) pts.push(...subjectToPaper(p[i], p[i + 1]))
    }
    const n = pts.length / 2
    if (!n) return
    const stride = Math.max(1, Math.ceil(n / 40))
    const frames: Keyframe[] = []
    for (let i = 0; i < n; i += stride) {
      frames.push({ transform: `translate(${((pts[i * 2] / PAPER_W) * 100).toFixed(2)}cqw, ${((pts[i * 2 + 1] / PAPER_H) * 100).toFixed(2)}cqh)` })
    }
    frames.push({ transform: `translate(${((pts[(n - 1) * 2] / PAPER_W) * 100).toFixed(2)}cqw, ${((pts[(n - 1) * 2 + 1] / PAPER_H) * 100).toFixed(2)}cqh)` })
    const move = el.animate(frames, { duration: 1200, easing: 'linear', delay: 250 })
    const fade = el.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }],
      { duration: 1450, easing: 'ease-out', fill: 'none' },
    )
    return () => {
      move.cancel()
      fade.cancel()
    }
  }, [step, runKey, reduce])
  if (!step || !runKey || reduce) return null
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', containerType: 'size', overflow: 'hidden' }}>
      <Box
        component="img"
        ref={ref}
        data-krea-demo-pencil
        src={KREA_ART.pencil}
        alt=""
        draggable={false}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          // Its tip is at (4%, 95%) of the sprite (measured on pencil.webp), so pull that point onto 0,0.
          width: 'clamp(56px, 16cqw, 140px)',
          marginLeft: 'calc(clamp(56px, 16cqw, 140px) * -0.04)',
          marginTop: 'calc(clamp(56px, 16cqw, 140px) * -0.95)',
          opacity: 0,
          filter: 'drop-shadow(0 4px 4px rgba(70,40,15,0.35))',
        }}
      />
    </Box>
  )
}
