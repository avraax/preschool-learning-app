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
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { KREA_BLOCKS } from '../../config/difficulty'
import { PALETTE_13, type CrayonColor } from '../../config/kreaPalette'
import { BLOCK_MATERIAL_NAME, BLOCK_SPECIAL_NAME, KREA_COLOR_NAME, NEW_BUILD_LINE, NEW_BUILD_TITLE } from '../../config/kreaPhrases'
import { BLOCK_PLATE, BLOCK_STUDIO } from '../../config/kreaBlocks'
import { KREA_ART } from '../../assets/games/krea'
import { BLOCK_FACE_ART } from '../../assets/games/krea/blocks'
import { CRAYON_HEX } from './canvas/brushes'
import { PlusBadge, pressHandlers, StudioButton } from './studio/StudioControls'
import { reportBlocksBuilt } from '../../services/usagePing'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { DEV } from '../../utils/devHarness'
import BlockStage, { type BlockStageHandle } from './blocks/BlockStage'
import { MATERIAL_BASE, materialChipUrl } from './blocks/materialArt'
import {
  blockCount,
  blockList,
  emptyWorld,
  isMaterial,
  MATERIAL_KINDS,
  moveBlock,
  previewCells,
  removeBlock,
  resolvePlacement,
  restoreWorld,
  serialiseWorld,
  SPECIAL_KINDS,
  undo,
  wholeBlockCells,
  type BlockKind,
  type BlockWorld,
  type Cell,
  type Held,
  type MaterialKind,
  type Target,
} from './blocks/blockWorld'
import { CAMERA, canZoom, towardsCamera, zoomBy, type Pose } from './blocks/cameraRig'

// Byggeklodser (`krea.blocks`, Krea PRD-03), staging-only behind `blocksGate.ts`. Free build: cubes in
// the 13 crayon colours, five material boxes (træ, mursten, sten, metal, glas), vindue and dør; eraser, undo, "Ny byggeplade?". Models come in W3–W4.
//
// Owner, 2026-11-06, after two iPad looks:
//   - the plate fills the WHOLE screen in a calm STUDIO, with the controls floating on top (GameShell
//     `fullBleed`); no floating island in a painted landscape, no entry picker — tapping the tile builds
//     at once. ONE plate: the themes and the roof went on 2026-11-07 (J8PYR, "not needed in v1");
//   - every level turns and zooms the same way (only the plate size differs);
//   - a door is 1×2 and a window a pane, both set INTO a wall when tapped onto one; no wheels;
//   - while a finger is down, a ghost shows where the block will land; lifting places it.
//
// ONE RESOLVER, TWO GESTURES (§4.3): a tap on a face with the held block, and a drag of a tray chip onto
// the stage, both land in `place()` — the only caller of `resolvePlacement` (`blocks.test.ts`). A drop
// does NOT change the held selection (a drag is one-off; tapping a chip is the sticky pick).
//
// Free build EARNS NOTHING and has NO finish (Lepper 1973, games-krea.md): no `useTaskRun` here, ever —
// the model mode (W4) brings XP, for a finished model only. The usage count `krea:built_blocks` is NOT a
// finish: the child never sees it and nothing changes when it fires; it only tells "opened and left" from
// "really built" (`BUILT_AT` placements in one opening, counted once).

const GAME_ID = 'krea.blocks'
/** The session's one free build. */
const ITEM_ID = 'fri'
/** Placements in one opening that count as "really built" for the usage counter (once per opening). */
const BUILT_AT = 5
const SAVE_DEBOUNCE_MS = 500
/** On touch the drop aims this far ABOVE the finger, so the fingertip doesn't hide the cell (§4.3). */
const TOUCH_AIM_LIFT_PX = 56
const CHIP = 'clamp(44px, 6.4vmin, 58px)'
const SIDE_BTN = 'clamp(44px, 7.6vmin, 68px)'
/** Air between the floating panel and the plate's free area / the header. */
const PANEL_GAP_PX = 8
/** What the ghost wears for the fixed-look specials and for the eraser's pick. */
const GHOST_LOOK: Record<'window' | 'door' | 'erase', string> = { window: '#BFE3F7', door: '#9A5E2E', erase: '#FFFFFF' }

type Tool = 'block' | 'eraser'

const ByggeklodserGame: React.FC = () => {
  useOccludeWorld()
  const audio = useSimplifiedAudioHook({ componentId: 'ByggeklodserGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const tuning = KREA_BLOCKS[level]

  // The welcome, once, as soon as audio can speak (the Krea games' shape).
  const welcomed = useRef(false)
  useEffect(() => {
    if (!audio.isAudioReady || welcomed.current) return
    welcomed.current = true
    void audio.playGameWelcome('kreablocks').catch(() => {})
  }, [audio, audio.isAudioReady])

  const fresh = useCallback(() => emptyWorld(tuning.island, tuning.heightCap), [tuning.island, tuning.heightCap])
  const [world, setWorldState] = useState<BlockWorld>(() => restoreWorld(fresh(), kreaSession.load(GAME_ID, ITEM_ID)))
  // The handlers judge against the world as it is NOW — two taps in one render must not both see the old one.
  const worldRef = useRef(world)
  const setWorld = (w: BlockWorld) => {
    worldRef.current = w
    setWorldState(w)
  }
  const [held, setHeld] = useState<Held>({ kind: 'cube', color: 'roed' })
  const heldRef = useRef(held)
  heldRef.current = held
  const [tool, setTool] = useState<Tool>('block')
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Only what the buttons need, as PRIMITIVES: a turn reports its pose ~60×/s, and React bails out on an
  // unchanged boolean — a pose object here re-rendered the whole game every frame of a turn (measured:
  // 85% busy at a 4× CPU throttle).
  const [canIn, setCanIn] = useState(() => canZoom(CAMERA.home, 1))
  const [canOut, setCanOut] = useState(() => canZoom(CAMERA.home, -1))
  const onPose = useCallback((p: Pose) => {
    setCanIn(canZoom(p, 1))
    setCanOut(canZoom(p, -1))
  }, [])
  const [drag, setDrag] = useState<Held | null>(null)
  const stage = useRef<BlockStageHandle>(null)
  // DEV/harness probe hook: where a cell is on screen, so rung 1/2 drivers aim at real squares on every
  // viewport (a guessed aim point measured the probe, not the game). Absent from a deploy build.
  useEffect(() => {
    if (!DEV) return
    const w = window as unknown as { __blocks?: unknown }
    w.__blocks = { project: (x: number, y: number, z: number, fy = 0) => stage.current?.projectClient({ x, y, z }, fy) ?? null, size: tuning.island }
    return () => {
      delete w.__blocks
    }
  }, [tuning.island])

  // A level change reshapes the plate (12 / 14 / 16): replay what still fits.
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
  /** The camera's nearest horizontal axis: a special placed on top or on the plate faces it (§4.6). */
  const facingNow = () => towardsCamera(stage.current?.getPose() ?? CAMERA.home)

  // ----- THE resolver: every block a gesture adds comes through here ------------------------------------
  const placedCount = useRef(0)
  const place = (target: Target | null, item: Held): boolean => {
    if (!target) return false
    const r = resolvePlacement(worldRef.current, target, item, facingNow())
    if ('placed' in r) {
      setWorld(r.placed)
      sfx.play('block-place')
      placedCount.current += 1
      if (placedCount.current === BUILT_AT) reportBlocksBuilt()
      return true
    }
    // A bounce: a soft sound, the world untouched — never a buzzer (§5).
    sfx.play('block-back')
    return false
  }

  const erase = (target: Target | null) => {
    if (!target || target.on !== 'block') return
    const next = removeBlock(worldRef.current, target.cell)
    if (!next) return
    setWorld(next)
    sfx.play('block-remove')
  }

  const onStageTap = (target: Target | null) => {
    touched()
    if (confirmOpen) return
    if (tool === 'eraser') erase(target)
    else place(target, held)
  }

  // ----- press and HOLD a block to move it (owner T59B2) ------------------------------------------------
  // The block itself travels with the finger — the world is DRAWN as if it had already landed there — in
  // a faint halo, so the child sees exactly what is moving and where it will go. Lifting commits it as one
  // action (undo puts it back); a spot it can't go shows it back home. Only with a block tool, not the eraser.
  const [movePreview, setMovePreview] = useState<BlockWorld | null>(null)
  const moving = useRef<{ from: Cell; drawn: Cell[] } | null>(null)
  const HALO = '#FFFFFF'
  const moveTo = (p: { x: number; y: number }) => {
    const m = moving.current
    if (!m) return null
    const target = stage.current?.pickStage(p.x, p.y, m.drawn) ?? null
    return target ? moveBlock(worldRef.current, m.from, target, facingNow()) : null
  }
  const onHoldStart = (t: Target): boolean => {
    if (t.on !== 'block' || toolRef.current !== 'block' || confirmOpen) return false
    const cells = wholeBlockCells(worldRef.current, t.cell)
    if (!cells.length) return false
    touched()
    moving.current = { from: cells[0], drawn: cells }
    sfx.play('krea-pick')
    stage.current?.setGhost(cells, HALO, true)
    return true
  }
  const onHoldMove = (p: { x: number; y: number }) => {
    const m = moving.current
    if (!m) return
    const r = moveTo(p)
    if (r && 'placed' in r) {
      m.drawn = wholeBlockCells(r.placed, r.cell)
      setMovePreview(r.placed)
    } else {
      // Nowhere it can go: it waits at home.
      m.drawn = wholeBlockCells(worldRef.current, m.from)
      setMovePreview(null)
    }
    stage.current?.setGhost(m.drawn, HALO, true)
  }
  const onHoldEnd = (p: { x: number; y: number } | null) => {
    const r = p ? moveTo(p) : null
    moving.current = null
    setMovePreview(null)
    stage.current?.setGhost(null, null)
    if (r && 'placed' in r) {
      setWorld(r.placed)
      sfx.play('block-place')
    } else sfx.play('block-back')
  }

  // ----- the preview: where the block will land while the finger is down (owner, JYJ5F) -----------------
  const lookOf = (h: Held): string => (h.kind === 'cube' ? CRAYON_HEX[h.color] : isMaterial(h.kind) ? MATERIAL_BASE[h.kind] : GHOST_LOOK[h.kind])
  const showPreview = (target: Target | null, item: Held | null, erasing: boolean) => {
    const s = stage.current
    if (!s) return
    if (!target || (!item && !erasing)) return s.setGhost(null, null)
    if (erasing) {
      if (target.on !== 'block') return s.setGhost(null, null)
      // A door goes whole: show all of it.
      const cells = wholeBlockCells(worldRef.current, target.cell)
      return s.setGhost(cells.length ? cells : null, GHOST_LOOK.erase)
    }
    const cells = previewCells(worldRef.current, target, item!, facingNow())
    s.setGhost(cells, cells ? lookOf(item!) : null)
  }
  const onStagePreview = (target: Target | null) => {
    if (confirmOpen) return showPreview(null, null, false)
    showPreview(target, heldRef.current, toolRef.current === 'eraser')
  }

  // Picking speaks its name (§2.2.8), fire-and-forget: a fast picker cancels the earlier name, correctly.
  const say = (line: string) => {
    audio.cancelCurrentAudio()
    void audio.speak(line).catch(() => {})
  }
  /** A colour: the cube in that colour. */
  const pickColor = (c: CrayonColor) => {
    touched()
    setHeld({ kind: 'cube', color: c })
    setTool('block')
    sfx.play('krea-pick')
    say(KREA_COLOR_NAME[c])
  }
  /** A special (window, door) or a material box: a fixed look, so the held colour just rides along. */
  const pickSpecial = (k: Exclude<BlockKind, 'cube'>) => {
    touched()
    setHeld((h) => ({ kind: k, color: h.color }))
    setTool('block')
    sfx.play('krea-pick')
    say(isMaterial(k) ? BLOCK_MATERIAL_NAME[k] : BLOCK_SPECIAL_NAME[k])
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

  // ----- "Ny byggeplade?" (§2.2.12): spoken, asked only when there is something to lose ------------------
  const askNewBuild = () => {
    touched()
    sfx.play('tap')
    stage.current?.setGhost(null, null)
    setConfirmOpen(true)
    say(NEW_BUILD_LINE)
  }
  const confirmFresh = () => {
    audio.cancelCurrentAudio()
    setConfirmOpen(false)
    sfx.play('krea-paper')
    kreaSession.clearItem(GAME_ID, ITEM_ID)
    setWorld(fresh())
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- zoom buttons (every level turns with a finger; the buttons zoom) --------------------------------
  /** Horizon: glide back to the middle, at the starting angle (the way home after panning far out). */
  const goHome = () => {
    const s = stage.current
    if (!s) return
    touched()
    sfx.play('tap')
    s.animateTo({ ...CAMERA.home, tx: 0, tz: 0 })
  }

  const zoom = (dir: 1 | -1) => {
    const s = stage.current
    if (!s) return
    touched()
    const next = zoomBy(s.getPose(), dir)
    s.setPose(next)
    sfx.play('tap')
  }

  // ----- the floating controls (owner 2026-11-06: the building area fullscreen, controls on top) --------
  // The plate is fitted to the screen MINUS the header and the panel, measured, never a tuned percentage:
  // the orientation says which edge the panel covers (right in landscape, bottom in portrait), its rect how much.
  const panelRef = useRef<HTMLDivElement>(null)
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  const [headerBottom, setHeaderBottom] = useState(0)
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('[data-game-header]')
      const top = header ? Math.round(header.getBoundingClientRect().bottom) : 0
      setHeaderBottom(top)
      const panel = panelRef.current?.getBoundingClientRect()
      if (!panel) return
      // The lane's side follows the ORIENTATION, like its CSS — never the panel's shape (on a phone in
      // landscape the panel is wider than tall, and reading that as "bottom" shrank the plate to a stamp).
      const sideways = window.innerWidth > window.innerHeight
      const next = {
        top,
        right: sideways ? Math.round(window.innerWidth - panel.left + PANEL_GAP_PX) : 0,
        bottom: sideways ? 0 : Math.round(window.innerHeight - panel.top + PANEL_GAP_PX),
        left: 0,
      }
      setInsets((p) => (p.top === next.top && p.right === next.right && p.bottom === next.bottom ? p : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (panelRef.current) ro.observe(panelRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

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

  /** `chip:<colour>` is a cube; `special:<kind>` a window, a door or a material box. */
  const itemOfDrag = (id: string): Held | null => {
    if (id.startsWith('chip:')) {
      const c = id.slice(5) as CrayonColor
      return PALETTE_13.includes(c) ? { kind: 'cube', color: c } : null
    }
    if (id.startsWith('special:')) {
      const k = id.slice(8) as BlockKind
      return (SPECIAL_KINDS as readonly string[]).includes(k) || isMaterial(k) ? { kind: k, color: held.color } : null
    }
    return null
  }

  const onDragStart = (e: DragStartEvent) => {
    const item = itemOfDrag(String(e.active.id))
    if (!item || confirmOpen) return
    touched()
    const ev = e.activatorEvent as PointerEvent | null
    const p = { x: ev?.clientX ?? 0, y: ev?.clientY ?? 0 }
    live.current = { ...p, start: p, lift: ev?.pointerType === 'mouse' ? 0 : TOUCH_AIM_LIFT_PX }
    setDrag(item)
    sfx.play('krea-pick')
    unlisten.current?.()
    const track = (pe: PointerEvent) => {
      live.current.x = pe.clientX
      live.current.y = pe.clientY
      // The ghost follows at most once a frame — a raycast per pointermove is wasted work on the A10X.
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        showPreview(aimTarget(), item, false)
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
    setDrag(null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const item = drag
    const id = String(e.active.id)
    endDrag()
    if (!item) return
    const { x, y, start } = live.current
    // A tap the finger smeared past the drag threshold is still a tap: the sticky pick.
    if (wasWobbledTap({ x: x - start.x, y: y - start.y }) && !e.over) {
      if (id.startsWith('chip:')) pickColor(item.color)
      else pickSpecial(item.kind as Exclude<BlockKind, 'cube'>)
      return
    }
    if (e.over?.id !== 'stage') {
      sfx.play('block-back')
      return
    }
    place(aimTarget(), item)
  }

  // ----- render -----------------------------------------------------------------------------------------
  const blocks = useMemo(() => blockList(movePreview ?? world), [world, movePreview])
  const canUndo = world.actions.length > 0
  const hasBlocks = blockCount(world) > 0
  /** Tool buttons in the panel: eraser, undo, zoom in/out, Ny — and on the horizon the way home. */
  const tools = tuning.horizon ? 6 : 5
  const newBuildPicture = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box sx={{ position: 'absolute', inset: '6%' }}>
        <PlatePicture />
      </Box>
      <PlusBadge />
    </Box>
  )

  return (
    <GameShell categoryId="krea" title="Byggeklodser" guide={false} lightScene fullBleed>
      <DndContext sensors={sensors} collisionDetection={kidCollision} autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={endDrag}>
        {/* THE STAGE IS THE WHOLE SCREEN (owner 2026-11-06), a calm studio. The header floats over it
            (GameShell `fullBleed`) and the controls float in the panel below; the plate centres in what
            they leave. Its colour is the studio wall, so a lost GPU context shows the same calm room. */}
        <Box
          data-krea-stage
          data-krea-item={ITEM_ID}
          data-blocks-count={blockCount(world)}
          // Probe hook: the world as sorted `x,y,z:colour` (rung 1/2 drivers read it; a few hundred bytes).
          data-blocks-cells={Object.entries(world.cells).map(([k, b]) => `${k}:${b.color}`).sort().join(' ')}
          data-blocks-kinds={Object.entries(world.cells).map(([k, b]) => `${k}:${b.kind}:${b.facing}${b.anchor ? ':part' : ''}`).sort().join(' ')}
          data-blocks-level={level}
          data-blocks-held={`${held.kind}:${held.color}`}
          sx={{ position: 'fixed', inset: 0, zIndex: 1, background: BLOCK_STUDIO.wall }}
        >
          {/* ONE droppable: the whole stage. The cell comes from the raycast, not from dnd-kit. */}
          <DroppableZone id="stage" overColor="transparent" style={{ position: 'absolute', inset: 0 }}>
            <BlockStage
              ref={stage}
              islandSize={tuning.island}
              heightCap={tuning.heightCap}
              horizon={tuning.horizon}
              faces={BLOCK_FACE_ART}
              insets={insets}
              blocks={blocks}
              onTap={onStageTap}
              onPreview={onStagePreview}
              onHoldStart={onHoldStart}
              onHoldMove={onHoldMove}
              onHoldEnd={onHoldEnd}
              onPose={onPose}
            />
          </DroppableZone>
        </Box>
        {/* The panel's lane: fixed down the right edge (along the bottom in portrait). The lane lets
            touches through to the plate; only the panel catches them. NO transform on any ancestor of a
            DraggableItem (WebKit drag drift, drag-and-drop.md). */}
        <Box
          sx={{
            position: 'fixed',
            zIndex: 3,
            pointerEvents: 'none',
            display: 'flex',
            left: 'calc(env(safe-area-inset-left) + 12px)',
            right: 'calc(env(safe-area-inset-right) + 12px)',
            bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            justifyContent: 'center',
            '@media (orientation: landscape)': {
              left: 'auto',
              top: `${headerBottom + PANEL_GAP_PX}px`,
              alignItems: 'center',
            },
          }}
        >
          <Box
            ref={panelRef}
            data-blocks-panel
            sx={{
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              p: '10px',
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '24px',
              // A soft card on the studio wall. No backdrop-filter (cost).
              background: 'rgba(255, 252, 247, 0.92)',
              boxShadow: '0 6px 18px rgba(60, 40, 20, 0.14)',
              '@media (orientation: landscape)': { flexDirection: 'column', flexWrap: 'nowrap' },
              // A phone in landscape is too short for tray-over-tools: the tools stand in a column beside the tray.
              [PHONE_LANDSCAPE]: { gap: '6px', p: '8px', flexDirection: 'row' },
            }}
          >
            {/* The 13 colours, then the 5 materials and the 2 specials on their own row (held tools on the right, owner rule).
                Tap = the sticky pick; drag = one block. */}
            <Box data-blocks-tray sx={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CHIP})`, gap: '6px', '@media (orientation: landscape)': { gridTemplateColumns: `repeat(4, ${CHIP})` }, [PHONE_LANDSCAPE]: { gridTemplateColumns: `repeat(5, ${CHIP})`, gap: '4px' } }}>
              {PALETTE_13.map((c) => (
                <DraggableItem key={c} id={`chip:${c}`} inline onActivate={() => pickColor(c)} lift={{ scale: 1.12, rotate: 0 }}>
                  <ClayChip color={c} selected={tool === 'block' && held.color === c && held.kind === 'cube'} />
                </DraggableItem>
              ))}
              {MATERIAL_KINDS.map((k, i) => (
                <Box key={k} sx={i === 0 ? { gridColumnStart: 1 } : undefined}>
                  <DraggableItem id={`special:${k}`} inline onActivate={() => pickSpecial(k)} lift={{ scale: 1.12, rotate: 0 }}>
                    <MaterialChip kind={k} selected={tool === 'block' && held.kind === k} />
                  </DraggableItem>
                </Box>
              ))}
              {SPECIAL_KINDS.map((k) => (
                <Box key={k}>
                  <DraggableItem id={`special:${k}`} inline onActivate={() => pickSpecial(k)} lift={{ scale: 1.12, rotate: 0 }}>
                    <SpecialChip kind={k} selected={tool === 'block' && held.kind === k} />
                  </DraggableItem>
                </Box>
              ))}
            </Box>
            {/* Eraser, undo, zoom in, zoom out, then "Ny": a 2x2 block in a landscape column; ONE row in
                portrait; ONE column beside the tray on a phone in landscape (too short to stack them). */}
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(2, ${SIDE_BTN})`, gap: '10px', justifyItems: 'center', '@media (orientation: portrait)': { gridTemplateColumns: `repeat(${tools}, ${SIDE_BTN})`, gap: '8px' }, [PHONE_LANDSCAPE]: { gridTemplateColumns: `repeat(${tuning.horizon ? 2 : 1}, ${SIDE_BTN})`, gap: '6px' } }}>
              <StudioButton dataId="eraser" label="Viskelæder" selected={tool === 'eraser'} size={SIDE_BTN} onPress={pickEraser}>
                <Img src={KREA_ART.eraser} />
              </StudioButton>
              <StudioButton dataId="undo" label="Fortryd" size={SIDE_BTN} disabled={!canUndo} onPress={doUndo}>
                <Img src={KREA_ART.undo} />
              </StudioButton>
              <IconPress label="Zoom ind" dataId="zoom-in" disabled={!canIn} onPress={() => zoom(1)}>
                <PlusMinus plus />
              </IconPress>
              <IconPress label="Zoom ud" dataId="zoom-out" disabled={!canOut} onPress={() => zoom(-1)}>
                <PlusMinus plus={false} />
              </IconPress>
              {tuning.horizon ? (
                <IconPress label="Tilbage til midten" dataId="home" onPress={goHome}>
                  <HomeMark />
                </IconPress>
              ) : null}
              <Box sx={{ gridColumn: tuning.horizon ? 'auto' : '1 / -1', visibility: hasBlocks ? 'visible' : 'hidden', '@media (orientation: portrait)': { gridColumn: 'auto' }, [PHONE_LANDSCAPE]: { gridColumn: 'auto' } }}>
                <StudioButton dataId="new-build" label="Ny byggeplade" size={SIDE_BTN} disabled={!hasBlocks || confirmOpen} onPress={askNewBuild}>
                  {newBuildPicture}
                </StudioButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </DndContext>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onClose={confirmKeep} title={NEW_BUILD_TITLE} freshPicture={newBuildPicture} freshLabel="Ja, ny byggeplade" />
    </GameShell>
  )
}

// ----- small pieces -------------------------------------------------------------------------------------

const Img: React.FC<{ src: string }> = ({ src }) => (
  <Box component="img" src={src} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
)

const chipSx = (selected: boolean) => ({
  width: CHIP,
  height: CHIP,
  borderRadius: '22%',
  boxShadow: selected
    ? '0 0 0 4px #fff, 0 0 0 7px rgba(255,190,60,0.95), 0 6px 10px rgba(60,40,20,0.35)'
    : 'inset 0 -5px 0 rgba(0,0,0,0.18), 0 3px 5px rgba(60,40,20,0.3)',
  touchAction: 'none',
  cursor: 'grab',
})

/** A colour as a little clay cube face — drawn in code. */
const ClayChip: React.FC<{ color: CrayonColor; selected: boolean }> = ({ color, selected }) => (
  <Box
    aria-label={KREA_COLOR_NAME[color]}
    aria-pressed={selected}
    data-blocks-chip={color}
    sx={[chipSx(selected), { background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0) 55%), ${CRAYON_HEX[color]}` }]}
  />
)

/** A material box as a chip: the same painting the 3D box wears (`materialArt.ts`). */
const MaterialChip: React.FC<{ kind: MaterialKind; selected: boolean }> = ({ kind, selected }) => (
  <Box
    aria-label={BLOCK_MATERIAL_NAME[kind]}
    aria-pressed={selected}
    data-blocks-special={kind}
    sx={[chipSx(selected), { backgroundColor: MATERIAL_BASE[kind], backgroundImage: `url(${materialChipUrl(kind)})`, backgroundSize: 'cover' }]}
  />
)

/** A special block (window, door) as a chip, drawn in code. */
const SpecialChip: React.FC<{ kind: (typeof SPECIAL_KINDS)[number]; selected: boolean }> = ({ kind, selected }) => (
  <Box aria-label={BLOCK_SPECIAL_NAME[kind]} aria-pressed={selected} data-blocks-special={kind} sx={[chipSx(selected), { background: '#FBF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }]}>
    <svg viewBox="0 0 48 48" width="78%" height="78%" aria-hidden>
      {kind === 'window' ? (
        <g>
          <rect x="8" y="8" width="32" height="32" rx="4" fill="#F2EEE6" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
          <rect x="12" y="12" width="24" height="24" rx="2" fill="#6BB6E6" />
          <rect x="22.5" y="12" width="3" height="24" fill="#F2EEE6" />
          <rect x="12" y="22.5" width="24" height="3" fill="#F2EEE6" />
        </g>
      ) : null}
      {kind === 'door' ? (
        // A door is 2 wide x 3 tall (owner 6BC2N).
        <g>
          <path d="M11 46 V14 a13 9 0 0 1 26 0 V46 Z" fill="#9A5E2E" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <circle cx="32" cy="31" r="2.4" fill="#E8C060" />
        </g>
      ) : null}
    </svg>
  </Box>
)

/** The plate as a little picture (the "Ny byggeplade" button and its confirm) — drawn in code. */
const PlatePicture: React.FC = () => (
  <Box sx={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', background: BLOCK_STUDIO.wall }}>
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      <ellipse cx="50" cy="80" rx="40" ry="7" fill="rgba(80,60,40,0.12)" />
      <path d="M50 34 L92 56 L50 78 L8 56 Z" transform="translate(0 6)" fill={BLOCK_PLATE.bottom} />
      <path d="M50 34 L92 56 L50 78 L8 56 Z" fill={BLOCK_PLATE.top} stroke="rgba(0,0,0,0.08)" />
    </svg>
  </Box>
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

/** The way home on the horizon ground: a little house, drawn in code. */
const HomeMark: React.FC = () => (
  <svg viewBox="0 0 48 48" width="58%" height="58%" aria-hidden>
    <path d="M8 24 L24 9 L40 24" fill="none" stroke="#5A8F3A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 22 V39 H35 V22" fill="none" stroke="#5A8F3A" strokeWidth="5" strokeLinejoin="round" />
    <rect x="21" y="29" width="6" height="10" rx="1.5" fill="#5A8F3A" />
  </svg>
)

const PlusMinus: React.FC<{ plus: boolean }> = ({ plus }) => (
  <svg viewBox="0 0 48 48" width="55%" height="55%" aria-hidden>
    <rect x="8" y="20" width="32" height="8" rx="4" fill="#5A8F3A" />
    {plus ? <rect x="20" y="8" width="8" height="32" rx="4" fill="#5A8F3A" /> : null}
  </svg>
)

export default ByggeklodserGame
