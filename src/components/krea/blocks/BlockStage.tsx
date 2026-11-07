import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { TAP_SLOP_DISTANCE } from '../../common/dnd/dragActivation'
import { BlockScene, type FaceArt } from './engine/BlockScene'
import { CAMERA, dragTurn, pinchZoom, type Pose } from './cameraRig'
import type { Block, Cell, Target } from './blockWorld'

// The 3D stage (Krea PRD-03 §4.4): one canvas, one BlockScene, and the gesture split on it.
//
//   - One pointer: down → once it has moved more than TAP_SLOP_DISTANCE it is a TURN for the rest of the
//     gesture. On up, a gesture that never became a turn is a TAP — and the tap acts on POINTER-UP, never
//     on down, or every turn would start by placing a block.
//   - While the finger is down and still a tap, `onPreview` shows WHERE the block will land (owner,
//     JYJ5F: "difficult to see where to put the blocks"); lifting places it, turning cancels it. A mouse
//     previews on hover.
//   - Two pointers → pinch zoom, and on the HORIZON ground (Svær) also a PAN: the two fingers grab the
//     ground and slide it (owner 2026-11-07, research: 4–6-year-olds manage two-finger gestures; a corner
//     joystick sits where small wrists rest). The pending tap is cancelled and nothing places until every
//     finger lifts. A mouse pans with the right button (desktop testing).
//   - Every level turns and zooms the same way (owner 2026-11-06); levels differ only by plate size.
//
// `touch-action: none` + non-passive touchmove/gesture* preventDefault (iOS page zoom), as in the Krea
// canvas. The scene is created in the EFFECT, never in render (StrictMode's double mount, §4.1).

export interface BlockStageHandle {
  /** What a CLIENT point lands on (for the drag drop), or null. `ignore`: cells to see through. */
  pickClient: (clientX: number, clientY: number, ignore?: Cell[]) => Target | null
  /** What a STAGE point lands on (the hold-to-move drag), seeing through `ignore`. */
  pickStage: (x: number, y: number, ignore?: Cell[]) => Target | null
  /** A cell point's CLIENT position (probe aid). */
  projectClient: (cell: Cell, fy?: number) => { x: number; y: number } | null
  /** Show cells as a ghost in `tint`, or hide it (null). */
  setGhost: (cells: Cell[] | null, tint: string | null, halo?: boolean) => void
  getPose: () => Pose
  setPose: (p: Pose) => void
  animateTo: (p: Pose, done?: () => void) => void
}

export interface BlockStageProps {
  islandSize: number
  heightCap: number
  faces: FaceArt
  /** Svær: the horizon ground, panned with two fingers. */
  horizon?: boolean
  /** CSS px of the stage covered by floating controls; the plate centres in what is left. */
  insets: { top: number; right: number; bottom: number; left: number }
  blocks: { cell: Cell; block: Block }[]
  /** A tap that stayed a tap. `target` is null over the studio. */
  onTap: (target: Target | null) => void
  /** What a finger (or a hovering mouse) is over right now, for the preview ghost; null = none. */
  onPreview?: (target: Target | null) => void
  /**
   * Press and HOLD on a block (owner T59B2): return true to start moving it — the finger then drags it
   * (`onHoldMove`, stage px) and lifting drops it (`onHoldEnd`); no tap and no turn happen in that gesture.
   */
  onHoldStart?: (target: Target) => boolean
  onHoldMove?: (p: { x: number; y: number }) => void
  onHoldEnd?: (p: { x: number; y: number } | null) => void
  /** The camera moved by a gesture (for buttons that grey out at a clamp). */
  onPose?: (p: Pose) => void
  disabled?: boolean
}

type Pt = { x: number; y: number }

/** How long a still finger on a block waits before it picks the block up (T59B2). Longer than a tap,
 * short enough not to feel stuck. */
export const HOLD_MS = 450

const BlockStage = React.forwardRef<BlockStageHandle, BlockStageProps>(function BlockStage(
  { islandSize, heightCap, faces, horizon, insets, blocks, onTap, onPreview, onHoldStart, onHoldMove, onHoldEnd, onPose, disabled },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BlockScene | null>(null)
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const insetsRef = useRef(insets)
  insetsRef.current = insets
  const [lost, setLost] = useState(false)
  const onPoseRef = useRef(onPose)
  onPoseRef.current = onPose
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview
  const holdRef = useRef({ onHoldStart, onHoldMove, onHoldEnd })
  holdRef.current = { onHoldStart, onHoldMove, onHoldEnd }

  // ----- the scene: ONE per mount (and per plate size), disposed on the way out -------------------------
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // A FRESH canvas per mount, made here. dispose() force-loses its context, and StrictMode's dev
    // double mount would otherwise hand the second renderer that same, already-lost context (three then
    // dies on a null shader-precision format) — the Farvelæg 0×0 trap in a new shape (§4.1).
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
    canvasRef.current = canvas
    host.appendChild(canvas)
    let scene: BlockScene
    try {
      scene = new BlockScene({
        canvas,
        islandSize,
        heightCap,
        faces,
        horizon,
        onContextLost: () => setLost(true),
        // Rebuild from the pure world: the GPU held nothing that isn't also there.
        onContextRestored: () => {
          setLost(false)
          scene.setBlocks(blocksRef.current)
        },
      })
    } catch (err) {
      // No WebGL at all (blocked, or a GPU-less browser): the studio colour stays, the app does not crash.
      console.warn('[Byggeklodser] WebGL unavailable', err)
      canvas.remove()
      setLost(true)
      return
    }
    setLost(false)
    sceneRef.current = scene
    const r = host.getBoundingClientRect()
    scene.resize(r.width, r.height)
    scene.setInsets(insetsRef.current)
    scene.setPose({ ...CAMERA.home })
    scene.setBlocks(blocksRef.current)
    onPoseRef.current?.(scene.getPose())
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) scene.resize(box.width, box.height)
    })
    ro.observe(host)
    return () => {
      ro.disconnect()
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandSize, heightCap, horizon])

  useEffect(() => {
    sceneRef.current?.setBlocks(blocks)
  }, [blocks])

  useEffect(() => {
    sceneRef.current?.setInsets(insets)
  }, [insets])

  useImperativeHandle(ref, () => ({
    pickClient: (cx, cy, ignore) => {
      const host = hostRef.current
      const scene = sceneRef.current
      if (!host || !scene) return null
      const r = host.getBoundingClientRect()
      if (cx < r.left || cy < r.top || cx > r.right || cy > r.bottom) return null
      return scene.pick(cx - r.left, cy - r.top, ignore)
    },
    pickStage: (x, y, ignore) => sceneRef.current?.pick(x, y, ignore) ?? null,
    projectClient: (cell, fy) => {
      const host = hostRef.current
      const scene = sceneRef.current
      if (!host || !scene) return null
      const r = host.getBoundingClientRect()
      const p = scene.project(cell, fy)
      return { x: r.left + p.x, y: r.top + p.y }
    },
    setGhost: (cells, tint, halo) => sceneRef.current?.setGhost(cells, tint, halo),
    getPose: () => sceneRef.current?.getPose() ?? { ...CAMERA.home },
    setPose: (p) => {
      sceneRef.current?.setPose(p)
      onPoseRef.current?.(p)
    },
    animateTo: (p, done) => {
      sceneRef.current?.animateTo(p, CAMERA.stepMs, () => {
        onPoseRef.current?.(p)
        done?.()
      })
    },
  }))

  // ----- gestures ----------------------------------------------------------------------------------------
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<{ start: Pt; pose: Pose; turning: boolean; multi: boolean; pinchD: number; pinchPose: Pose; mid: Pt; mousePan: boolean; holding: boolean; holdMoved: boolean } | null>(null)
  const hoverRaf = useRef(0)
  /** The press-and-hold timer (a still finger on a block for HOLD_MS picks it up). */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  useEffect(() => () => {
    cancelAnimationFrame(hoverRaf.current)
    clearHold()
  }, [])

  // iOS: block page zoom/scroll while a finger is on the stage (non-passive, so preventDefault holds).
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stop = (e: Event) => e.preventDefault()
    host.addEventListener('touchmove', stop, { passive: false })
    host.addEventListener('gesturestart', stop, { passive: false })
    host.addEventListener('gesturechange', stop, { passive: false })
    return () => {
      host.removeEventListener('touchmove', stop)
      host.removeEventListener('gesturestart', stop)
      host.removeEventListener('gesturechange', stop)
    }
  }, [])

  const local = (e: React.PointerEvent): Pt => {
    const r = hostRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const preview = (p: Pt | null) => onPreviewRef.current?.(p && sceneRef.current ? sceneRef.current.pick(p.x, p.y) : null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    const mousePan = e.pointerType === 'mouse' && e.button === 2 && !!sceneRef.current?.isHorizon
    if (e.pointerType === 'mouse' && e.button !== 0 && !mousePan) return
    const scene = sceneRef.current
    if (!scene) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* a synthetic or already-gone pointer: capture is a nicety, not the gesture */
    }
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) {
      gesture.current = { start: p, pose: scene.getPose(), turning: false, multi: mousePan, pinchD: 0, pinchPose: scene.getPose(), mid: p, mousePan, holding: false, holdMoved: false }
      if (!mousePan) {
        preview(p)
        clearHold()
        if (holdRef.current.onHoldStart) {
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null
            const g = gesture.current
            const sc = sceneRef.current
            if (!g || g.turning || g.multi || !sc || pointers.current.size !== 1) return
            const t = sc.pick(g.start.x, g.start.y)
            if (t?.on !== 'block' || !holdRef.current.onHoldStart?.(t)) return
            g.holding = true
            preview(null)
          }, HOLD_MS)
        }
      }
    } else if (gesture.current) {
      // A second finger: this is a pinch, never a tap — and never a move (a held block goes back).
      clearHold()
      if (gesture.current.holding) {
        gesture.current.holding = false
        holdRef.current.onHoldEnd?.(null)
      }
      const [a, b] = [...pointers.current.values()]
      gesture.current.multi = true
      gesture.current.pinchD = Math.max(1, dist(a, b))
      gesture.current.pinchPose = scene.getPose()
      gesture.current.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      preview(null)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    const scene = sceneRef.current
    // A mouse with no button down: hover preview, at most once a frame.
    if (!g && e.pointerType === 'mouse' && !disabled) {
      const p = local(e)
      if (!hoverRaf.current) hoverRaf.current = requestAnimationFrame(() => {
        hoverRaf.current = 0
        preview(p)
      })
      return
    }
    if (!g || !scene || !pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (g.holding) {
      // Still within the slop: the finger hasn't moved the block yet.
      if (!g.holdMoved && dist(p, g.start) <= TAP_SLOP_DISTANCE) return
      g.holdMoved = true
      holdRef.current.onHoldMove?.(p)
      return
    }
    if (g.mousePan) {
      const next = scene.pan(g.mid, p)
      g.mid = p
      onPoseRef.current?.(next)
      return
    }
    if (g.multi) {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      // Zoom from the pinch's start, but keep wherever the pan has got to.
      const zoom = pinchZoom(g.pinchPose, dist(a, b) / g.pinchD).zoom
      scene.setPose({ ...scene.getPose(), zoom })
      let next = scene.getPose()
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (scene.isHorizon) next = scene.pan(g.mid, mid)
      g.mid = mid
      onPoseRef.current?.(next)
      return
    }
    if (!g.turning && dist(p, g.start) > TAP_SLOP_DISTANCE) {
      clearHold()
      g.turning = true
      preview(null)
      // Measure the turn from HERE, so the view doesn't jump by the slop.
      g.start = p
      g.pose = scene.getPose()
    }
    if (g.turning) {
      const next = dragTurn(g.pose, p.x - g.start.x, p.y - g.start.y)
      scene.setPose(next)
      onPoseRef.current?.(next)
    }
  }

  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const g = gesture.current
    const had = pointers.current.delete(e.pointerId)
    if (!g || !had) return
    if (pointers.current.size > 0) return
    gesture.current = null
    clearHold()
    if (g.holding) {
      // A hold that never moved puts the block back where it was (no 1-cell nudge from the release).
      holdRef.current.onHoldEnd?.(cancelled || !g.holdMoved ? null : local(e))
      return
    }
    if (e.pointerType !== 'mouse') preview(null)
    if (cancelled || g.multi || g.turning || disabled) return
    const scene = sceneRef.current
    if (!scene) return
    const p = local(e)
    onTap(scene.pick(p.x, p.y))
    if (e.pointerType === 'mouse') preview(p)
  }

  return (
    <Box
      ref={hostRef}
      data-blocks-stage
      data-blocks-lost={lost ? '1' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && !gesture.current) preview(null)
      }}
      sx={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' }}
    >
      {/* The canvas is appended by the effect above. If the GPU is lost, the stage's studio colour shows. */}
    </Box>
  )
})

export default BlockStage
