import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { CRAYON_HEX } from './brushes'
import { UNFILLABLE, decodeLabels, fillsOf, paintRegion, regionAt, type FillAction } from './regionFill'
import type { PageRegions } from '../../../config/kreaPageRegions'
import type { CrayonColor } from './strokeModel'
import { idleGlow } from '../../../theme/idleMotion'

// Farvelæg's page (Krea PRD-01 §4.4): the FILL canvas under the line art. A tap looks up the region id
// under the finger in the label map and paints exactly that region — no flood fill, so it can't leak.
//
// Layers, back to front: the paper (the parent's), the fill canvas at the label map's own resolution
// (CSS-scaled; the region edges sit under the thick black lines, so the scale never shows), the line
// art `<img>`, and — only while the last few regions wait — a soft pulsing mask over them.
//
// The label map is decoded ONCE per page into a Uint16Array. It is a lossless PNG with no colour
// profile, and the decode is CHECKED: any id the page does not have is counted and exposed as
// `data-krea-label-bad` (a colour-managed decode would corrupt ids silently).

/** A finger is wider than a line: a tap on a line fills the nearest region within this many CSS px. */
const TAP_SLOP_PX = 20

const hexRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

export interface FillSurfaceProps {
  art: { line: string; regions: string }
  info: PageRegions
  actions: readonly FillAction[]
  disabled?: boolean
  /** Regions to pulse softly (the last-region hint), or null. */
  pulse: readonly number[] | null
  reduce: boolean
  /** A press landed on region `id` (0 = on nothing colourable). */
  onTap: (id: number) => void
}

const FillSurface: React.FC<FillSurfaceProps> = ({ art, info, actions, disabled, pulse, reduce, onTap }) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLCanvasElement>(null)
  const labels = useRef<Uint16Array | null>(null)
  const painted = useRef<readonly FillAction[] | null>(null)
  const [ready, setReady] = useState(false)
  const [bad, setBad] = useState(0)

  // Decode the label map once per page.
  useEffect(() => {
    let live = true
    labels.current = null
    painted.current = null
    setReady(false)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!live) return
      const c = document.createElement('canvas')
      c.width = info.w
      c.height = info.h
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g) return
      g.drawImage(img, 0, 0)
      const lab = decodeLabels(g.getImageData(0, 0, info.w, info.h).data)
      c.width = 0
      c.height = 0
      let wrong = 0
      for (let i = 0; i < lab.length; i++) if (lab[i] !== UNFILLABLE && lab[i] > info.count) wrong++
      labels.current = lab
      setBad(wrong)
      setReady(true)
    }
    img.src = art.regions
    return () => {
      live = false
    }
  }, [art.regions, info])

  // Paint the fills: one appended action paints its one region; anything else (undo, resume) repaints.
  useLayoutEffect(() => {
    const cv = fillRef.current
    const lab = labels.current
    if (!cv || !lab || !ready) return
    // The unmount release (below) zeroes the canvas, and StrictMode's dev remount runs it on a canvas
    // that stays mounted — React never re-applies an unchanged width prop, so restore it here.
    if (cv.width !== info.w || cv.height !== info.h) {
      cv.width = info.w
      cv.height = info.h
      painted.current = null
    }
    const g = cv.getContext('2d')!
    const prev = painted.current
    const appended = prev && actions.length === prev.length + 1 && prev.every((a, i) => a === actions[i])
    if (appended) {
      const [r, c] = actions[actions.length - 1]
      const box = info.boxes[r - 1]
      if (box) {
        const img = g.getImageData(box[0], box[1], box[2] - box[0] + 1, box[3] - box[1] + 1)
        paintRegion(img.data, lab, info.w, box, r, c ? hexRgb(CRAYON_HEX[c]) : null)
        g.putImageData(img, box[0], box[1])
      }
    } else {
      const fills = fillsOf(actions)
      const rgb = new Map<number, [number, number, number]>()
      for (const [r, c] of fills) rgb.set(r, hexRgb(CRAYON_HEX[c as CrayonColor]))
      const img = g.createImageData(info.w, info.h)
      const d = img.data
      for (let i = 0; i < lab.length; i++) {
        const v = rgb.get(lab[i])
        if (!v) continue
        d[i * 4] = v[0]
        d[i * 4 + 1] = v[1]
        d[i * 4 + 2] = v[2]
        d[i * 4 + 3] = 255
      }
      g.putImageData(img, 0, 0)
    }
    painted.current = actions
  }, [actions, ready, info])

  // Release the canvas on unmount — WebKit counts canvas memory against a hard total.
  useEffect(() => {
    const cv = fillRef.current
    return () => {
      if (cv) {
        cv.width = 0
        cv.height = 0
      }
    }
  }, [])

  // The last-region hint: a small mask of the waiting regions, pulsed with a CSS keyframe (no canvas
  // animation). Built once per change of the waiting set, at quarter resolution.
  const maskUrl = useMemo(() => {
    const lab = labels.current
    if (!pulse?.length || !lab || !ready) return null
    const want = new Set(pulse)
    const s = 4
    const mw = Math.ceil(info.w / s)
    const mh = Math.ceil(info.h / s)
    const c = document.createElement('canvas')
    c.width = mw
    c.height = mh
    const g = c.getContext('2d')!
    const img = g.createImageData(mw, mh)
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) if (want.has(lab[y * s * info.w + x * s])) img.data[(y * mw + x) * 4 + 3] = 255
    g.putImageData(img, 0, 0)
    const url = c.toDataURL('image/png')
    c.width = 0
    c.height = 0
    return url
  }, [pulse, ready, info])
  const glow = idleGlow(reduce, { from: 0.15, to: 0.6, durationS: 1.4 })

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || !labels.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const r = hostRef.current!.getBoundingClientRect()
    const kx = info.w / r.width
    const x = (e.clientX - r.left) * kx
    const y = (e.clientY - r.top) * (info.h / r.height)
    onTap(regionAt(labels.current, info.w, info.h, x, y, TAP_SLOP_PX * kx))
  }

  return (
    <Box
      ref={hostRef}
      data-krea-fill-surface
      data-krea-fill-ready={ready ? 'yes' : 'no'}
      data-krea-label-bad={bad}
      data-krea-labels-src={art.regions}
      data-krea-fills={fillsOf(actions).size}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        '& > *': { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
      }}
    >
      <canvas ref={fillRef} width={info.w} height={info.h} data-krea-fill />
      {maskUrl && (
        <Box
          aria-hidden
          data-krea-region-pulse={pulse?.join(',')}
          {...glow.props}
          sx={[
            {
              background: '#FFC93C',
              opacity: reduce ? 0.45 : undefined,
              WebkitMaskImage: `url(${maskUrl})`,
              maskImage: `url(${maskUrl})`,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
            },
            glow.sx,
          ]}
        />
      )}
      <Box component="img" src={art.line} alt="" draggable={false} data-krea-line />
    </Box>
  )
}

export default FillSurface
