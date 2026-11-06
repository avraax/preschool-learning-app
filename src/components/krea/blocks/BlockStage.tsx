import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { TAP_SLOP_DISTANCE } from '../../common/dnd/dragActivation'
import { BlockScene } from './engine/BlockScene'
import { CAMERA, dragTurn, pinchZoom, type Pose } from './cameraRig'
import type { Block, Cell, Target } from './blockWorld'

// The 3D stage (Krea PRD-03 §4.4): one canvas, one BlockScene, and the gesture split on it.
//
//   - One pointer: down → once it has moved more than TAP_SLOP_DISTANCE it is a TURN for the rest of the
//     gesture. On up, a gesture that never became a turn is a TAP — and the tap acts on POINTER-UP, never
//     on down, or every turn would start by placing a block.
//   - Two pointers → pinch zoom. The pending tap is cancelled and nothing places until every finger lifts.
//   - Every level turns and zooms the same way (owner 2026-11-06); levels differ only by island size.
//
// `touch-action: none` + non-passive touchmove/gesture* preventDefault (iOS page zoom), as in the Krea
// canvas. The scene is created in the EFFECT, never in render (StrictMode's double mount, §4.1).

export interface BlockStageHandle {
  /** What a CLIENT point lands on (for the drag drop), or null. */
  pickClient: (clientX: number, clientY: number) => Target | null
  setGhost: (cell: Cell | null, block: Block | null) => void
  getPose: () => Pose
  setPose: (p: Pose) => void
  animateTo: (p: Pose, done?: () => void) => void
}

export interface BlockStageProps {
  islandSize: number
  heightCap: number
  /** CSS px of the stage covered by floating controls; the island centres in what is left. */
  insets: { top: number; right: number; bottom: number; left: number }
  blocks: { cell: Cell; block: Block }[]
  /** A tap that stayed a tap. `target` is null over the sky. */
  onTap: (target: Target | null) => void
  /** The camera moved by a gesture (for buttons that grey out at a clamp). */
  onPose?: (p: Pose) => void
  disabled?: boolean
}

type Pt = { x: number; y: number }

const BlockStage = React.forwardRef<BlockStageHandle, BlockStageProps>(function BlockStage(
  { islandSize, heightCap, insets, blocks, onTap, onPose, disabled },
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

  // ----- the scene: ONE per mount (and per island size), disposed on the way out ------------------------
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
        onContextLost: () => setLost(true),
        // Rebuild from the pure world: the GPU held nothing that isn't also there.
        onContextRestored: () => {
          setLost(false)
          scene.setBlocks(blocksRef.current)
        },
      })
    } catch (err) {
      // No WebGL at all (blocked, or a GPU-less browser): the sky stays, the app does not crash.
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
  }, [islandSize, heightCap])

  useEffect(() => {
    sceneRef.current?.setBlocks(blocks)
  }, [blocks])

  useEffect(() => {
    sceneRef.current?.setInsets(insets)
  }, [insets])

  useImperativeHandle(ref, () => ({
    pickClient: (cx, cy) => {
      const host = hostRef.current
      const scene = sceneRef.current
      if (!host || !scene) return null
      const r = host.getBoundingClientRect()
      if (cx < r.left || cy < r.top || cx > r.right || cy > r.bottom) return null
      return scene.pick(cx - r.left, cy - r.top)
    },
    setGhost: (cell, block) => sceneRef.current?.setGhost(cell, block),
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
  const gesture = useRef<{ start: Pt; pose: Pose; turning: boolean; multi: boolean; pinchD: number; pinchPose: Pose } | null>(null)

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

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
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
      gesture.current = { start: p, pose: scene.getPose(), turning: false, multi: false, pinchD: 0, pinchPose: scene.getPose() }
    } else if (gesture.current) {
      // A second finger: this is a pinch, never a tap.
      const [a, b] = [...pointers.current.values()]
      gesture.current.multi = true
      gesture.current.pinchD = Math.max(1, dist(a, b))
      gesture.current.pinchPose = scene.getPose()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    const scene = sceneRef.current
    if (!g || !scene || !pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (g.multi) {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      const next = pinchZoom(g.pinchPose, dist(a, b) / g.pinchD)
      scene.setPose(next)
      onPoseRef.current?.(next)
      return
    }
    if (!g.turning && dist(p, g.start) > TAP_SLOP_DISTANCE) {
      g.turning = true
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
    if (cancelled || g.multi || g.turning || disabled) return
    const scene = sceneRef.current
    if (!scene) return
    const p = local(e)
    onTap(scene.pick(p.x, p.y))
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
      sx={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' }}
    >
      {/* The canvas is appended by the effect above. It is transparent: the sky is the DOM backdrop
          behind it (§4.7), so a lost context shows the sky (the canvas is cleared on loss). */}
    </Box>
  )
})

export default BlockStage
