import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { kidCollision } from '../common/dnd/kidCollision'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { wasWobbledTap } from '../common/dnd/dragActivation'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useDifficulty } from '../../hooks/useDifficulty'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { KREA_BLOCKS } from '../../config/difficulty'
import { PALETTE_13, type CrayonColor } from '../../config/kreaPalette'
import { KREA_COLOR_NAME } from '../../config/kreaPhrases'
import { KREA_ART } from '../../assets/games/krea'
import { CRAYON_HEX } from './canvas/brushes'
import { pressHandlers, SIDE_TOP_CLEARANCE, StudioButton } from './studio/StudioControls'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import BlockStage, { type BlockStageHandle } from './blocks/BlockStage'
import {
  blockCount,
  blockList,
  emptyWorld,
  removeBlock,
  resolvePlacement,
  restoreWorld,
  serialiseWorld,
  targetCell,
  undo,
  whyNot,
  type BlockWorld,
  type Held,
  type Target,
} from './blocks/blockWorld'
import { CAMERA, canZoom, stepAzimuth, zoomBy, type Pose } from './blocks/cameraRig'

// Byggeklodser (`krea.blocks`, Krea PRD-03) — W1, THE SPIKE: free build on one placeholder island (a plain
// green clay slab, plain rounded cubes in the 13 crayon colours), staging-only behind `blocksGate.ts`.
// It stops here for the owner's iPad: does it run smoothly and cool, can a 5-year-old aim a block and
// turn the view. Specials, the islands, the look, models and narration come in W2–W4.
//
// ONE RESOLVER, TWO GESTURES (§4.3): a tap on a face with the held colour, and a drag of a tray chip onto
// the stage, both land in `place()` — the only caller of `resolvePlacement` (`blocks.test.ts`). A drop
// does NOT change the held selection (a drag is one-off; tapping a chip is the sticky pick).
//
// Free build EARNS NOTHING and has NO finish (Lepper 1973, games-krea.md): no `useTaskRun` here, ever —
// the model mode (W4) brings XP, for a finished model only.

const GAME_ID = 'krea.blocks'
/** W1 has one free island; W2 adds sne and strand and the picker. */
const ITEM_ID = 'fri-graes'
const SAVE_DEBOUNCE_MS = 500
/** On touch the drop aims this far ABOVE the finger, so the fingertip doesn't hide the cell (§4.3). */
const TOUCH_AIM_LIFT_PX = 56
const CHIP = 'clamp(44px, 6.4vmin, 58px)'
const SIDE_BTN = 'clamp(44px, 7.6vmin, 68px)'

type Tool = 'block' | 'eraser'

const ByggeklodserGame: React.FC = () => {
  useOccludeWorld()
  const audio = useSimplifiedAudioHook({ componentId: 'ByggeklodserGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const reduce = useReducedMotion()
  const tuning = KREA_BLOCKS[level]

  const fresh = useCallback(() => emptyWorld(tuning.island, tuning.heightCap), [tuning.island, tuning.heightCap])
  const [world, setWorldState] = useState<BlockWorld>(() => restoreWorld(fresh(), kreaSession.load(GAME_ID, ITEM_ID)))
  // The handlers judge against the world as it is NOW — two taps in one render must not both see the old one.
  const worldRef = useRef(world)
  const setWorld = (w: BlockWorld) => {
    worldRef.current = w
    setWorldState(w)
  }
  const [held, setHeld] = useState<Held>({ kind: 'cube', color: 'roed' })
  const [tool, setTool] = useState<Tool>('block')
  // Only what the buttons need, as PRIMITIVES: a turn reports its pose ~60×/s, and React bails out on an
  // unchanged boolean — a pose object here re-rendered the whole game every frame of a turn (measured:
  // 85% busy at a 4× CPU throttle).
  const [canIn, setCanIn] = useState(() => canZoom(CAMERA.home, 1))
  const [canOut, setCanOut] = useState(() => canZoom(CAMERA.home, -1))
  const onPose = useCallback((p: Pose) => {
    setCanIn(canZoom(p, 1))
    setCanOut(canZoom(p, -1))
  }, [])
  const [dragColor, setDragColor] = useState<CrayonColor | null>(null)
  const stage = useRef<BlockStageHandle>(null)
  const turning = useRef(false)

  // A level change reshapes the island (6 / 8 / 10): replay what still fits.
  useEffect(() => {
    setWorld(restoreWorld(fresh(), kreaSession.load(GAME_ID, ITEM_ID)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // ----- session only (§4.12): the action list, debounced -----------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (world.actions.length) kreaSession.save(GAME_ID, ITEM_ID, serialiseWorld(world))
      else kreaSession.clearItem(GAME_ID, ITEM_ID)
    }, SAVE_DEBOUNCE_MS)
  }, [world])
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // Leaving mid-debounce must not lose the last block.
    const w = worldRef.current
    if (w.actions.length) kreaSession.save(GAME_ID, ITEM_ID, serialiseWorld(w))
  }, [])

  const touched = () => audio.updateUserInteraction()

  // ----- THE resolver: every block a gesture adds comes through here ------------------------------------
  const place = (target: Target | null, item: Held): boolean => {
    if (!target) return false
    const r = resolvePlacement(worldRef.current, target, item)
    if ('placed' in r) {
      setWorld(r.placed)
      sfx.play('bead-place')
      return true
    }
    // A bounce: a soft sound, the world untouched — never a buzzer (§5).
    sfx.play('bead-back')
    return false
  }

  const erase = (target: Target | null) => {
    if (!target || target.on !== 'block') return
    const next = removeBlock(worldRef.current, target.cell)
    if (!next) return
    setWorld(next)
    sfx.play('krea-undo')
  }

  const onStageTap = (target: Target | null) => {
    touched()
    if (tool === 'eraser') erase(target)
    else place(target, held)
  }

  const pickColor = (c: CrayonColor) => {
    touched()
    setHeld({ kind: 'cube', color: c })
    setTool('block')
    sfx.play('krea-pick')
    // Fire and forget: a fast picker cancels the earlier name, correctly (§4.9).
    audio.cancelCurrentAudio()
    void audio.speak(KREA_COLOR_NAME[c]).catch(() => {})
  }

  const pickEraser = () => {
    touched()
    sfx.play('tap')
    setTool((t) => (t === 'eraser' ? 'block' : 'eraser'))
  }

  const doUndo = () => {
    touched()
    const next = undo(worldRef.current)
    if (!next) return
    setWorld(next)
    sfx.play('krea-undo')
  }

  // ----- camera buttons ---------------------------------------------------------------------------------
  const step = (dir: 1 | -1) => {
    const s = stage.current
    if (!s || turning.current) return
    touched()
    sfx.play('tap')
    const to = stepAzimuth(s.getPose(), dir)
    // Reduced motion: the view snaps to the next side instead of swinging round.
    if (reduce) {
      s.setPose(to)
      return
    }
    turning.current = true
    s.animateTo(to, () => {
      turning.current = false
    })
  }
  const zoom = (dir: 1 | -1) => {
    const s = stage.current
    if (!s) return
    touched()
    const next = zoomBy(s.getPose(), dir)
    s.setPose(next)
    sfx.play('tap')
  }

  // ----- drag a chip onto the stage (§4.3): the cell comes from a raycast at the REAL pointer -----------
  const sensors = useDragOnlySensors()
  const live = useRef({ x: 0, y: 0, start: { x: 0, y: 0 }, lift: 0 })
  const unlisten = useRef<(() => void) | null>(null)
  const raf = useRef(0)
  useEffect(() => () => {
    unlisten.current?.()
    cancelAnimationFrame(raf.current)
  }, [])

  const aimTarget = (): Target | null => stage.current?.pickClient(live.current.x, live.current.y - live.current.lift) ?? null

  const onDragStart = (e: DragStartEvent) => {
    const c = String(e.active.id).replace('chip:', '') as CrayonColor
    if (!PALETTE_13.includes(c)) return
    touched()
    const ev = e.activatorEvent as PointerEvent | null
    const p = { x: ev?.clientX ?? 0, y: ev?.clientY ?? 0 }
    live.current = { ...p, start: p, lift: ev?.pointerType === 'mouse' ? 0 : TOUCH_AIM_LIFT_PX }
    setDragColor(c)
    sfx.play('krea-pick')
    unlisten.current?.()
    const track = (pe: PointerEvent) => {
      live.current.x = pe.clientX
      live.current.y = pe.clientY
      // The ghost follows at most once a frame — a raycast per pointermove is wasted work on the A10X.
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        const t = aimTarget()
        const ok = t && !whyNot(worldRef.current, t)
        stage.current?.setGhost(ok ? targetCell(t) : null, { kind: 'cube', color: c })
      })
    }
    document.addEventListener('pointermove', track, { capture: true, passive: true })
    unlisten.current = () => document.removeEventListener('pointermove', track, { capture: true })
  }

  const endDrag = () => {
    unlisten.current?.()
    unlisten.current = null
    cancelAnimationFrame(raf.current)
    raf.current = 0
    stage.current?.setGhost(null, null)
    setDragColor(null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const c = dragColor
    endDrag()
    if (!c) return
    const { x, y, start } = live.current
    // A tap the finger smeared past the drag threshold is still a tap: the sticky pick.
    if (wasWobbledTap({ x: x - start.x, y: y - start.y }) && !e.over) {
      pickColor(c)
      return
    }
    if (e.over?.id !== 'stage') {
      sfx.play('bead-back')
      return
    }
    place(aimTarget(), { kind: 'cube', color: c })
  }

  // ----- render -----------------------------------------------------------------------------------------
  const blocks = useMemo(() => blockList(world), [world])
  const canUndo = world.actions.length > 0
  // Every level zooms (the islands are 12–16 a side); only Let turns by the 90° arrows instead of a finger.
  const sideButtons = (
    <>
      {tuning.camera === 'steps' ? (
        <>
          <IconPress label="Drej til venstre" dataId="turn-left" onPress={() => step(-1)}>
            <Arrow dir="left" />
          </IconPress>
          <IconPress label="Drej til højre" dataId="turn-right" onPress={() => step(1)}>
            <Arrow dir="right" />
          </IconPress>
        </>
      ) : null}
      <IconPress label="Zoom ind" dataId="zoom-in" disabled={!canIn} onPress={() => zoom(1)}>
        <PlusMinus plus />
      </IconPress>
      <IconPress label="Zoom ud" dataId="zoom-out" disabled={!canOut} onPress={() => zoom(-1)}>
        <PlusMinus plus={false} />
      </IconPress>
    </>
  )

  return (
    <GameShell categoryId="krea" title="Byggeklodser" dense guide={false} lightScene>
      <DndContext sensors={sensors} collisionDetection={kidCollision} autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={endDrag}>
        <Box
          data-krea-stage
          data-krea-item={ITEM_ID}
          data-blocks-count={blockCount(world)}
          // Probe hook: the world as sorted `x,y,z:colour` (rung 1/2 drivers read it; a few hundred bytes).
          data-blocks-cells={Object.entries(world.cells).map(([k, b]) => `${k}:${b.color}`).sort().join(' ')}
          data-blocks-level={level}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gap: '10px',
            // The stage is the FLEX REMAINDER after the tray (§4.13): reserved, never a tuned percentage.
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, 1fr) auto',
            gridTemplateAreas: '"stage" "tray"',
            '@media (orientation: landscape)': {
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gridTemplateRows: 'minmax(0, 1fr)',
              gridTemplateAreas: '"stage tray"',
            },
            pb: 'env(safe-area-inset-bottom)',
          }}
        >
          <Box sx={{ gridArea: 'stage', position: 'relative', minWidth: 0, minHeight: 0, borderRadius: '24px', overflow: 'hidden', background: 'linear-gradient(180deg, #9FD6F5 0%, #D4EEFB 70%, #EAF6FD 100%)' }}>
            {/* ONE droppable: the whole stage. The cell comes from the raycast, not from dnd-kit. */}
            <DroppableZone id="stage" overColor="transparent" style={{ position: 'absolute', inset: 0 }}>
              <BlockStage
                ref={stage}
                islandSize={tuning.island}
                heightCap={tuning.heightCap}
                camera={tuning.camera}
                blocks={blocks}
                onTap={onStageTap}
                onPose={onPose}
              />
            </DroppableZone>
          </Box>
          <Box
            sx={{
              gridArea: 'tray',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              minHeight: 0,
              '@media (orientation: landscape)': { flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'flex-start', pt: SIDE_TOP_CLEARANCE },
              [PHONE_LANDSCAPE]: { pt: '8px', gap: '8px' },
            }}
          >
            {/* The 13 colours (held tools on the right, owner rule). Tap = the sticky pick; drag = one block. */}
            <Box data-blocks-tray sx={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CHIP})`, gap: '6px', '@media (orientation: landscape)': { gridTemplateColumns: `repeat(3, ${CHIP})` }, [PHONE_LANDSCAPE]: { gridTemplateColumns: `repeat(4, ${CHIP})`, gap: '4px' } }}>
              {PALETTE_13.map((c) => (
                <DraggableItem key={c} id={`chip:${c}`} inline onActivate={() => pickColor(c)} lift={{ scale: 1.12, rotate: 0 }}>
                  <ClayChip color={c} selected={tool === 'block' && held.color === c} />
                </DraggableItem>
              ))}
            </Box>
            {/* A phone in landscape has ~310 px of height: 13 chips in 3 columns plus two tool rows overflowed
                it (measured, WebKit 667×375). There the chips take 4 columns and the tools share ONE row. */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', '@media (orientation: portrait)': { flexDirection: 'row' }, [PHONE_LANDSCAPE]: { flexDirection: 'row', gap: '6px' } }}>
            <Box sx={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', [PHONE_LANDSCAPE]: { gap: '6px' } }}>
              <StudioButton dataId="eraser" label="Viskelæder" selected={tool === 'eraser'} size={SIDE_BTN} onPress={pickEraser}>
                <Img src={KREA_ART.eraser} />
              </StudioButton>
              <StudioButton dataId="undo" label="Fortryd" size={SIDE_BTN} disabled={!canUndo} onPress={doUndo}>
                <Img src={KREA_ART.undo} />
              </StudioButton>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(2, ${SIDE_BTN})`, gap: '10px', [PHONE_LANDSCAPE]: { gap: '6px' } }}>{sideButtons}</Box>
            </Box>
          </Box>
        </Box>
      </DndContext>
    </GameShell>
  )
}

// ----- small pieces (placeholders until W2's look pass) -------------------------------------------------

const Img: React.FC<{ src: string }> = ({ src }) => (
  <Box component="img" src={src} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
)

/** A colour as a little clay cube face — drawn in code; W2 renders the real chips from the 3D scene. */
const ClayChip: React.FC<{ color: CrayonColor; selected: boolean }> = ({ color, selected }) => (
  <Box
    aria-label={KREA_COLOR_NAME[color]}
    aria-pressed={selected}
    data-blocks-chip={color}
    sx={{
      width: CHIP,
      height: CHIP,
      borderRadius: '22%',
      background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0) 55%), ${CRAYON_HEX[color]}`,
      boxShadow: selected
        ? '0 0 0 4px #fff, 0 0 0 7px rgba(255,190,60,0.95), 0 6px 10px rgba(60,40,20,0.35)'
        : 'inset 0 -5px 0 rgba(0,0,0,0.18), 0 3px 5px rgba(60,40,20,0.3)',
      touchAction: 'none',
      cursor: 'grab',
    }}
  />
)

const IconPress: React.FC<{ label: string; dataId: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }> = ({ label, dataId, disabled, onPress, children }) => (
  <ButtonBase
    aria-label={label}
    data-krea-control={dataId}
    disabled={disabled}
    {...pressHandlers(onPress)}
    sx={{
      width: SIDE_BTN,
      height: SIDE_BTN,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #FFFFFF, #F1E6D6 70%)',
      boxShadow: 'inset 0 -4px 0 rgba(120,90,50,0.25), 0 3px 6px rgba(60,40,20,0.3)',
      opacity: disabled ? 0.4 : 1,
      touchAction: 'manipulation',
      '&:active': { transform: 'scale(0.94)' },
    }}
  >
    {children}
  </ButtonBase>
)

const Arrow: React.FC<{ dir: 'left' | 'right' }> = ({ dir }) => (
  <svg viewBox="0 0 48 48" width="62%" height="62%" aria-hidden style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}>
    <path d="M10 30 A15 15 0 1 1 34 30" fill="none" stroke="#5A8F3A" strokeWidth="6" strokeLinecap="round" />
    <path d="M27 31 L36 33 L37 23" fill="none" stroke="#5A8F3A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PlusMinus: React.FC<{ plus: boolean }> = ({ plus }) => (
  <svg viewBox="0 0 48 48" width="55%" height="55%" aria-hidden>
    <rect x="8" y="20" width="32" height="8" rx="4" fill="#5A8F3A" />
    {plus ? <rect x="20" y="8" width="8" height="32" rx="4" fill="#5A8F3A" /> : null}
  </svg>
)

export default ByggeklodserGame
