import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { createPainter, drawStroke, makeCrayonTile, type BrushEnv, type StrokePainter } from './brushes'
import {
  PAPER_H,
  PAPER_W,
  STAMP_SIZE,
  quantise,
  seedFor,
  type CrayonColor,
  type Drawing,
  type Stroke,
  type Tool,
} from './strokeModel'

// The drawing surface (Krea PRD-01 §4.2) — the only place in the app that draws on a canvas.
//
// Layers, back to front: the paper (CSS, the parent's), the INK canvas, the LIVE canvas (the stroke
// under the finger). The parent owns the `Drawing`; this component renders it and reports each finished
// stroke through `onCommit`. Undo is a replay of the list from ONE checkpoint canvas (strokes older
// than `UNDO_DEPTH` are baked into it) — never a bitmap snapshot per step.
//
// Safari 17 traps handled here, each of which is silent if missed:
//   - `getCoalescedEvents()` only exists from Safari 18.2 → feature-detected, plain pointermove otherwise;
//   - points are smoothed with quadratic curves in `brushes.ts`, and drawing is batched into one rAF;
//   - `touch-action: none` + a non-passive `touchmove` and `gesturestart/change` preventDefault, so a
//     stroke never scrolls, zooms or rubber-bands the page; no text selection or callout;
//   - `setPointerCapture`, so a stroke that leaves the paper keeps drawing to the edge;
//   - ONE active pointer: the first wins, a second finger (a palm, a sibling) is ignored;
//   - palm guard: once a `pen` has touched a surface, `touch` is ignored on surfaces for the session;
//   - the backing store is capped at dpr 2, and every canvas is released (0×0) on unmount.

/** Once an Apple Pencil has drawn, fingers on the paper are palms (§2.2.12). Module = page session. */
let penSeen = false

const MAX_DPR = 2

export interface DrawingSurfaceProps {
  drawing: Drawing
  tool: Tool
  color: CrayonColor
  stamp: string | null
  /** id → image URL for every stamp the tray offers (and any already on the paper). */
  stampUrls: Record<string, string>
  disabled?: boolean
  /** Tegn med Mig mirror steps: reflect every stroke across this vertical axis (paper units). */
  mirrorX?: number
  onCommit: (s: Stroke) => void
  /** The finger went down / came up on the paper with a brush — the crayon scratch loop hangs off this. */
  onStrokeStart?: (tool: Tool) => void
  onStrokeEnd?: (tool: Tool) => void
}

const releaseCanvas = (c: HTMLCanvasElement | null) => {
  if (!c) return
  c.width = 0
  c.height = 0
}

const DrawingSurface: React.FC<DrawingSurfaceProps> = ({
  drawing,
  tool,
  color,
  stamp,
  stampUrls,
  disabled = false,
  mirrorX,
  onCommit,
  onStrokeStart,
  onStrokeEnd,
}) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const checkpointRef = useRef<HTMLCanvasElement | null>(null)
  const checkpointCount = useRef(0)
  const rendered = useRef<Stroke[]>([])
  const scaleRef = useRef(1)
  const patterns = useRef(new WeakMap<CanvasRenderingContext2D, Map<CrayonColor, CanvasPattern>>())
  const tiles = useRef(new Map<CrayonColor, HTMLCanvasElement>())
  const images = useRef(new Map<string, HTMLImageElement>())
  const drawingRef = useRef(drawing)
  drawingRef.current = drawing
  const mirrorRef = useRef(mirrorX)
  mirrorRef.current = mirrorX

  // The stroke in progress.
  const active = useRef<{ id: number; stroke: Stroke; points: number[]; painter: StrokePainter } | null>(null)
  const raf = useRef<number | null>(null)

  const envFor = useCallback((ctx: CanvasRenderingContext2D): BrushEnv => {
    let cache = patterns.current.get(ctx)
    if (!cache) {
      cache = new Map()
      patterns.current.set(ctx, cache)
    }
    const c = cache
    return {
      ctx,
      scale: scaleRef.current,
      mirrorX: mirrorRef.current,
      crayonPaint: (col) => {
        let p = c.get(col)
        if (!p) {
          let tile = tiles.current.get(col)
          if (!tile) {
            tile = makeCrayonTile(col)
            tiles.current.set(col, tile)
          }
          p = ctx.createPattern(tile, 'repeat') ?? undefined
          if (p) c.set(col, p)
        }
        return p ?? '#000'
      },
      stampImage: (id) => {
        const img = images.current.get(id)
        return img && img.complete && img.naturalWidth > 0 ? img : null
      },
    }
  }, [])

  /** Rebuild everything from the list: checkpoint ← strokes below `baked`, ink ← checkpoint + the rest. */
  // The strokes the checkpoint currently holds, by identity — so an undo inside the live window reuses
  // it instead of re-baking every older stroke on each tap (that made fast undo taps lag behind).
  const checkpointHolds = useRef<Stroke[]>([])
  const fullRedraw = useCallback((force = false) => {
    const ink = inkRef.current
    if (!ink || !ink.width) return
    const d = drawingRef.current
    let cp = checkpointRef.current
    if (!cp) {
      cp = document.createElement('canvas')
      checkpointRef.current = cp
    }
    let stale = force || checkpointHolds.current.length !== d.baked
    if (cp.width !== ink.width || cp.height !== ink.height) {
      cp.width = ink.width
      cp.height = ink.height
      stale = true
    }
    for (let i = 0; !stale && i < d.baked; i++) if (checkpointHolds.current[i] !== d.strokes[i]) stale = true
    if (stale) {
      const cctx = cp.getContext('2d')!
      cctx.clearRect(0, 0, cp.width, cp.height)
      const cenv = envFor(cctx)
      for (let i = 0; i < d.baked; i++) drawStroke(cenv, d.strokes[i])
      checkpointHolds.current = d.strokes.slice(0, d.baked)
    }
    checkpointCount.current = d.baked
    const ctx = ink.getContext('2d')!
    ctx.clearRect(0, 0, ink.width, ink.height)
    ctx.drawImage(cp, 0, 0)
    const env = envFor(ctx)
    for (let i = d.baked; i < d.strokes.length; i++) drawStroke(env, d.strokes[i])
    rendered.current = d.strokes
  }, [envFor])

  // Render the drawing whenever it changes: ONE appended stroke draws incrementally (the common case,
  // every pointer-up), anything else — an undo, a new paper, a resume — replays from the checkpoint.
  useLayoutEffect(() => {
    const ink = inkRef.current
    if (!ink || !ink.width) return
    const prev = rendered.current
    const next = drawing.strokes
    const appended = next.length === prev.length + 1 && prev.every((s, i) => s === next[i])
    if (appended) {
      const ctx = ink.getContext('2d')!
      drawStroke(envFor(ctx), next[next.length - 1])
      rendered.current = next
      // Fold strokes that just left the undo window into the checkpoint, so a later undo replays
      // from the right base. Cheap: usually exactly one stroke.
      if (drawing.baked > checkpointCount.current && checkpointRef.current) {
        const cctx = checkpointRef.current.getContext('2d')!
        const cenv = envFor(cctx)
        for (let i = checkpointCount.current; i < drawing.baked; i++) drawStroke(cenv, next[i])
        checkpointCount.current = drawing.baked
        checkpointHolds.current = next.slice(0, drawing.baked)
      }
    } else if (prev !== next) {
      fullRedraw()
    }
    const live = liveRef.current
    if (live && !active.current) live.getContext('2d')!.clearRect(0, 0, live.width, live.height)
  }, [drawing, envFor, fullRedraw])

  // Size the backing stores from the CSS box (capped at dpr 2) and repaint on every resize.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fit = () => {
      const r = host.getBoundingClientRect()
      if (!r.width || !r.height) return
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      const w = Math.round(r.width * dpr)
      const h = Math.round((r.width * dpr * PAPER_H) / PAPER_W)
      for (const c of [inkRef.current, liveRef.current]) {
        if (c && (c.width !== w || c.height !== h)) {
          c.width = w
          c.height = h
        }
      }
      scaleRef.current = w / PAPER_W
      patterns.current = new WeakMap()
      fullRedraw(true)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    return () => ro.disconnect()
  }, [fullRedraw])

  // Stamp images: load each once; a late load repaints so a resumed stamp appears.
  useEffect(() => {
    for (const [id, url] of Object.entries(stampUrls)) {
      if (images.current.has(id)) continue
      const img = new Image()
      img.decoding = 'async'
      // A late stamp image may belong to a stroke already baked in: re-bake, don't reuse.
      img.onload = () => fullRedraw(true)
      img.src = url
      images.current.set(id, img)
    }
  }, [stampUrls, fullRedraw])

  // Release every canvas on unmount — WebKit counts canvas memory against a hard total.
  useEffect(() => {
    const ink = inkRef.current
    const live = liveRef.current
    const tileCache = tiles.current
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      releaseCanvas(ink)
      releaseCanvas(live)
      releaseCanvas(checkpointRef.current)
      for (const t of tileCache.values()) releaseCanvas(t)
      tileCache.clear()
    }
  }, [])

  // No scroll, zoom, rubber-band or callout while drawing — the listeners must be NON-passive.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stop = (e: Event) => e.preventDefault()
    host.addEventListener('touchmove', stop, { passive: false })
    host.addEventListener('touchstart', stop, { passive: false })
    host.addEventListener('gesturestart', stop as EventListener, { passive: false })
    host.addEventListener('gesturechange', stop as EventListener, { passive: false })
    return () => {
      host.removeEventListener('touchmove', stop)
      host.removeEventListener('touchstart', stop)
      host.removeEventListener('gesturestart', stop as EventListener)
      host.removeEventListener('gesturechange', stop as EventListener)
    }
  }, [])

  // The paper's box is read ONCE per stroke (at pointerdown), never per move: a getBoundingClientRect
  // inside pointermove forces a layout on every event of a 60–240 Hz stream.
  const rectRef = useRef<DOMRect | null>(null)
  const toPaper = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = rectRef.current ?? hostRef.current!.getBoundingClientRect()
    return [
      quantise(((e.clientX - r.left) / r.width) * PAPER_W, PAPER_W),
      quantise(((e.clientY - r.top) / r.height) * PAPER_H, PAPER_H),
    ]
  }

  // Paint ONLY what is new since the last frame (`createPainter`), never the whole stroke again — that
  // made each frame cost O(stroke length) and a long scribble stuttered more the longer it ran.
  const paintLive = () => {
    raf.current = null
    const a = active.current
    const live = liveRef.current
    const ink = inkRef.current
    if (!a || !live || !ink) return
    // `destination-out` on the live layer would erase nothing visible, so the eraser works straight on
    // the ink; the commit repaints the same marks, which is idempotent at full alpha.
    const ctx = (a.stroke.tool === 'eraser' ? ink : live).getContext('2d')!
    a.painter.paint(envFor(ctx), false)
  }

  const schedule = () => {
    if (raf.current == null) raf.current = requestAnimationFrame(paintLive)
  }

  const allowed = (e: React.PointerEvent): boolean => {
    if (disabled) return false
    if (e.pointerType === 'pen') penSeen = true
    else if (e.pointerType === 'touch' && penSeen) return false
    return true
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (active.current || !allowed(e)) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    rectRef.current = hostRef.current!.getBoundingClientRect()
    const [x, y] = toPaper(e)
    if (tool === 'stamp') {
      if (!stamp) return
      onStrokeStart?.('stamp')
      onCommit({ tool: 'stamp', stamp, x, y, size: STAMP_SIZE, seed: seedFor(drawingRef.current.strokes.length) })
      onStrokeEnd?.('stamp')
      rectRef.current = null
      return
    }
    try {
      hostRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* a synthetic pointer may not be capturable */
    }
    // The live stroke and its painter share ONE points array: moves push into it, frames paint the tail.
    const seed = seedFor(drawingRef.current.strokes.length)
    const points = [x, y]
    const stroke: Stroke = tool === 'crayon' ? { tool, color, points, seed } : { tool, points, seed }
    active.current = { id: e.pointerId, stroke, points, painter: createPainter(stroke) }
    onStrokeStart?.(tool)
    schedule()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const a = active.current
    if (!a || e.pointerId !== a.id) return
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const evs = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    for (const ev of evs.length ? evs : [native]) {
      const [x, y] = toPaper(ev)
      const n = a.points.length
      // Drop sub-unit jitter: it only inflates the session copy.
      if (Math.abs(x - a.points[n - 2]) + Math.abs(y - a.points[n - 1]) < 2) continue
      a.points.push(x, y)
    }
    schedule()
  }

  const finish = (e: React.PointerEvent) => {
    const a = active.current
    if (!a || e.pointerId !== a.id) return
    active.current = null
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    try {
      hostRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    rectRef.current = null
    onStrokeEnd?.(a.stroke.tool)
    // The committed stroke is repainted whole on the ink layer by a fresh painter; the live layer is
    // cleared when the drawing re-renders.
    onCommit(a.stroke)
  }

  return (
    <Box
      ref={hostRef}
      data-krea-surface
      data-krea-strokes={drawing.strokes.length}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        cursor: disabled ? 'default' : 'crosshair',
        '& canvas': { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
      }}
    >
      <canvas ref={inkRef} data-krea-ink />
      <canvas ref={liveRef} data-krea-live />
    </Box>
  )
}

export default DrawingSurface
