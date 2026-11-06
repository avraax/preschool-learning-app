import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
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
import { BLOCK_SPECIAL_NAME, KREA_COLOR_NAME, NEW_ISLAND_LINE, NEW_ISLAND_TITLE } from '../../config/kreaPhrases'
import { BLOCK_ISLANDS, FREE_ISLAND_PREFIX, FREE_ISLANDS_LABEL, islandById, islandItemId, type BlockIslandDef } from '../../config/kreaBlocks'
import { KREA_ART } from '../../assets/games/krea'
import { CRAYON_HEX } from './canvas/brushes'
import { PlusBadge, pressHandlers, StudioButton } from './studio/StudioControls'
import { StudioBackdrop } from './studio/StudioScene'
import { KreaPicker } from './studio/KreaPicker'
import NewPaperConfirm from './studio/NewPaperConfirm'
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
  SPECIAL_KINDS,
  targetCell,
  undo,
  whyNot,
  type BlockKind,
  type BlockWorld,
  type Held,
  type Target,
} from './blocks/blockWorld'
import { CAMERA, canZoom, towardsCamera, zoomBy, type Pose } from './blocks/cameraRig'

// Byggeklodser (`krea.blocks`, Krea PRD-03), staging-only behind `blocksGate.ts`. W2: free build is
// complete — three islands (græs, sne, strand) on a picker, cubes in the 13 crayon colours plus the four
// specials (tag, vindue, dør, hjul), eraser, undo, "Ny ø?". The look is CODE-DRAWN until the owner's
// Gemini art lands (sky, island textures, special faces); models and narration-led hints come in W3–W4.
//
// Owner, 2026-11-06, after the first iPad look: the island fills the WHOLE screen with the controls
// floating on top; every level turns and zooms the same way (only the island size differs).
//
// ONE RESOLVER, TWO GESTURES (§4.3): a tap on a face with the held block, and a drag of a tray chip onto
// the stage, both land in `place()` — the only caller of `resolvePlacement` (`blocks.test.ts`). A drop
// does NOT change the held selection (a drag is one-off; tapping a chip is the sticky pick).
//
// Free build EARNS NOTHING and has NO finish (Lepper 1973, games-krea.md): no `useTaskRun` here, ever —
// the model mode (W4) brings XP, for a finished model only.

const GAME_ID = 'krea.blocks'
const SAVE_DEBOUNCE_MS = 500
/** On touch the drop aims this far ABOVE the finger, so the fingertip doesn't hide the cell (§4.3). */
const TOUCH_AIM_LIFT_PX = 56
const CHIP = 'clamp(44px, 6.4vmin, 58px)'
const SIDE_BTN = 'clamp(44px, 7.6vmin, 68px)'
/** Air between the floating panel and the island's free area / the header. */
const PANEL_GAP_PX = 8

type Tool = 'block' | 'eraser'

/** A picker/deep-link id → the island it opens (W2: only the free islands exist). */
const islandOfItem = (id: string | null): BlockIslandDef | null =>
  id?.startsWith(FREE_ISLAND_PREFIX) ? islandById(id.slice(FREE_ISLAND_PREFIX.length)) ?? null : null

const ByggeklodserGame: React.FC = () => {
  useOccludeWorld()
  const audio = useSimplifiedAudioHook({ componentId: 'ByggeklodserGame', autoInitialize: false })
  const [params, setParams] = useSearchParams()
  const [itemId, setItemId] = useState<string | null>(() => (islandOfItem(params.get('motiv')) ? params.get('motiv') : null))
  const island = islandOfItem(itemId)

  // The welcome, once, as soon as audio can speak (the Krea games' shape).
  const welcomed = useRef(false)
  useEffect(() => {
    if (!audio.isAudioReady || welcomed.current) return
    welcomed.current = true
    void audio.playGameWelcome('kreablocks').catch(() => {})
  }, [audio, audio.isAudioReady])

  const setMotiv = (id: string | null) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      if (id) n.set('motiv', id)
      else n.delete('motiv')
      return n
    }, { replace: true })

  const openItem = (id: string) => {
    welcomed.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-paper')
    setItemId(id)
    setMotiv(id)
  }
  const toPicker = () => {
    sfx.play('tap')
    audio.cancelCurrentAudio()
    setItemId(null)
    setMotiv(null)
  }

  if (!island || !itemId) {
    const cards = BLOCK_ISLANDS.map((def) => ({
      id: islandItemId(def.id),
      label: def.name,
      group: FREE_ISLANDS_LABEL,
      picture: <IslandPicture island={def} />,
    }))
    return (
      <GameShell categoryId="krea" title="Byggeklodser" dense guide={false} lightScene>
        <StudioBackdrop />
        <KreaPicker scrollKey={GAME_ID} items={cards} onPick={openItem} />
      </GameShell>
    )
  }
  return <BlockStudio key={itemId} itemId={itemId} island={island} onBack={toPicker} audio={audio} />
}

/** The open island: the full-screen 3D stage and the floating panel. */
const BlockStudio: React.FC<{
  itemId: string
  island: BlockIslandDef
  onBack: () => void
  audio: ReturnType<typeof useSimplifiedAudioHook>
}> = ({ itemId, island, onBack, audio }) => {
  const level = useDifficulty('krea')
  const tuning = KREA_BLOCKS[level]

  const fresh = useCallback(() => emptyWorld(tuning.island, tuning.heightCap), [tuning.island, tuning.heightCap])
  const [world, setWorldState] = useState<BlockWorld>(() => restoreWorld(fresh(), kreaSession.load(GAME_ID, itemId)))
  // The handlers judge against the world as it is NOW — two taps in one render must not both see the old one.
  const worldRef = useRef(world)
  const setWorld = (w: BlockWorld) => {
    worldRef.current = w
    setWorldState(w)
  }
  const [held, setHeld] = useState<Held>({ kind: 'cube', color: 'roed' })
  const [tool, setTool] = useState<Tool>('block')
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

  // A level change reshapes the island (12 / 14 / 16): replay what still fits.
  useEffect(() => {
    setWorld(restoreWorld(fresh(), kreaSession.load(GAME_ID, itemId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // ----- session only (§4.12): the action list, debounced -----------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (world.actions.length) kreaSession.save(GAME_ID, itemId, serialiseWorld(world))
      else kreaSession.clearItem(GAME_ID, itemId)
    }, SAVE_DEBOUNCE_MS)
  }, [world, itemId])
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // Leaving mid-debounce must not lose the last block.
    const w = worldRef.current
    if (w.actions.length) kreaSession.save(GAME_ID, itemId, serialiseWorld(w))
  }, [itemId])

  const touched = () => audio.updateUserInteraction()
  /** The camera's nearest horizontal axis: a special placed on top or on the island faces it (§4.6). */
  const facingNow = () => towardsCamera(stage.current?.getPose() ?? CAMERA.home)

  // ----- THE resolver: every block a gesture adds comes through here ------------------------------------
  const place = (target: Target | null, item: Held): boolean => {
    if (!target) return false
    const r = resolvePlacement(worldRef.current, target, item, facingNow())
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
    if (confirmOpen) return
    if (tool === 'eraser') erase(target)
    else place(target, held)
  }

  // Picking speaks its name (§2.2.8), fire-and-forget: a fast picker cancels the earlier name, correctly.
  const say = (line: string) => {
    audio.cancelCurrentAudio()
    void audio.speak(line).catch(() => {})
  }
  /** A colour: the cube in that colour — or, while a ROOF is held, the roof takes the colour (§2.2.7). */
  const pickColor = (c: CrayonColor) => {
    touched()
    setHeld((h) => ({ kind: h.kind === 'roof' ? 'roof' : 'cube', color: c }))
    setTool('block')
    sfx.play('krea-pick')
    say(KREA_COLOR_NAME[c])
  }
  const pickSpecial = (k: Exclude<BlockKind, 'cube'>) => {
    touched()
    setHeld((h) => ({ kind: k, color: h.color }))
    setTool('block')
    sfx.play('krea-pick')
    say(BLOCK_SPECIAL_NAME[k])
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

  // ----- "Ny ø?" (§2.2.12): spoken, asked only when there is something to lose ---------------------------
  const askNewIsland = () => {
    touched()
    sfx.play('tap')
    setConfirmOpen(true)
    say(NEW_ISLAND_LINE)
  }
  const confirmFresh = () => {
    audio.cancelCurrentAudio()
    setConfirmOpen(false)
    sfx.play('krea-paper')
    kreaSession.clearItem(GAME_ID, itemId)
    setWorld(fresh())
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- zoom buttons (every level turns with a finger; the buttons zoom) --------------------------------
  const zoom = (dir: 1 | -1) => {
    const s = stage.current
    if (!s) return
    touched()
    const next = zoomBy(s.getPose(), dir)
    s.setPose(next)
    sfx.play('tap')
  }

  // ----- the floating controls (owner 2026-11-06: the building area fullscreen, controls on top) --------
  // The island is fitted to the screen MINUS the header and the panel, measured, never a tuned percentage:
  // the panel's rect says which edge it covers (right in landscape, bottom in portrait).
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
      const sideways = panel.height >= panel.width
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

  /** `chip:<colour>` is a cube (or a roof while one is held); `special:<kind>` a special in the held colour. */
  const itemOfDrag = (id: string): Held | null => {
    if (id.startsWith('chip:')) {
      const c = id.slice(5) as CrayonColor
      return PALETTE_13.includes(c) ? { kind: held.kind === 'roof' ? 'roof' : 'cube', color: c } : null
    }
    if (id.startsWith('special:')) {
      const k = id.slice(8) as BlockKind
      return (SPECIAL_KINDS as readonly string[]).includes(k) ? { kind: k, color: held.color } : null
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
        const t = aimTarget()
        const ok = t && !whyNot(worldRef.current, t, item)
        stage.current?.setGhost(ok ? targetCell(t) : null, item)
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
      sfx.play('bead-back')
      return
    }
    place(aimTarget(), item)
  }

  // ----- render -----------------------------------------------------------------------------------------
  const blocks = useMemo(() => blockList(world), [world])
  const canUndo = world.actions.length > 0
  const hasBlocks = blockCount(world) > 0
  const newIslandPicture = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box sx={{ position: 'absolute', inset: '6%' }}>
        <IslandPicture island={island} />
      </Box>
      <PlusBadge />
    </Box>
  )

  return (
    <GameShell categoryId="krea" title="Byggeklodser" guide={false} lightScene fullBleed onBackWithin={onBack}>
      <DndContext sensors={sensors} collisionDetection={kidCollision} autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={endDrag}>
        {/* THE STAGE IS THE WHOLE SCREEN (owner 2026-11-06). The header floats over it (GameShell
            `fullBleed`) and the controls float in the panel below; the island centres in what they leave. */}
        <Box
          data-krea-stage
          data-krea-item={itemId}
          data-blocks-count={blockCount(world)}
          // Probe hook: the world as sorted `x,y,z:colour` (rung 1/2 drivers read it; a few hundred bytes).
          data-blocks-cells={Object.entries(world.cells).map(([k, b]) => `${k}:${b.color}`).sort().join(' ')}
          data-blocks-kinds={Object.entries(world.cells).map(([k, b]) => `${k}:${b.kind}:${b.facing}`).sort().join(' ')}
          data-blocks-level={level}
          data-blocks-held={`${held.kind}:${held.color}`}
          sx={{ position: 'fixed', inset: 0, zIndex: 1, background: `linear-gradient(180deg, ${island.sky[0]} 0%, ${island.sky[1]} 70%, ${island.sky[2]} 100%)` }}
        >
          {/* ONE droppable: the whole stage. The cell comes from the raycast, not from dnd-kit. */}
          <DroppableZone id="stage" overColor="transparent" style={{ position: 'absolute', inset: 0 }}>
            <BlockStage
              ref={stage}
              islandSize={tuning.island}
              heightCap={tuning.heightCap}
              island={island}
              insets={insets}
              blocks={blocks}
              onTap={onStageTap}
              onPose={onPose}
            />
          </DroppableZone>
        </Box>
        {/* The panel's lane: fixed down the right edge (along the bottom in portrait). The lane lets
            touches through to the island; only the panel catches them. NO transform on any ancestor of a
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
              // A soft see-through card: the island stays readable under it. No backdrop-filter (cost).
              background: 'rgba(255, 250, 242, 0.78)',
              boxShadow: '0 6px 18px rgba(60, 40, 20, 0.18)',
              '@media (orientation: landscape)': { flexDirection: 'column', flexWrap: 'nowrap' },
              [PHONE_LANDSCAPE]: { gap: '6px', p: '8px' },
            }}
          >
            {/* The 13 colours, then the 4 specials on their own row (held tools on the right, owner rule).
                Tap = the sticky pick; drag = one block. */}
            <Box data-blocks-tray sx={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CHIP})`, gap: '6px', '@media (orientation: landscape)': { gridTemplateColumns: `repeat(3, ${CHIP})` }, [PHONE_LANDSCAPE]: { gridTemplateColumns: `repeat(4, ${CHIP})`, gap: '4px' } }}>
              {PALETTE_13.map((c) => (
                <DraggableItem key={c} id={`chip:${c}`} inline onActivate={() => pickColor(c)} lift={{ scale: 1.12, rotate: 0 }}>
                  <ClayChip color={c} selected={tool === 'block' && held.color === c && (held.kind === 'cube' || held.kind === 'roof')} />
                </DraggableItem>
              ))}
              {SPECIAL_KINDS.map((k, i) => (
                <Box key={k} sx={i === 0 ? { gridColumnStart: 1 } : undefined}>
                  <DraggableItem id={`special:${k}`} inline onActivate={() => pickSpecial(k)} lift={{ scale: 1.12, rotate: 0 }}>
                    <SpecialChip kind={k} color={held.color} selected={tool === 'block' && held.kind === k} />
                  </DraggableItem>
                </Box>
              ))}
            </Box>
            {/* Eraser, undo, zoom in, zoom out: a 2x2 block (ONE row on a phone in landscape), then "Ny ø". */}
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(2, ${SIDE_BTN})`, gap: '10px', justifyItems: 'center', [PHONE_LANDSCAPE]: { gridTemplateColumns: `repeat(5, ${SIDE_BTN})`, gap: '6px' } }}>
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
              <Box sx={{ gridColumn: '1 / -1', visibility: hasBlocks ? 'visible' : 'hidden', [PHONE_LANDSCAPE]: { gridColumn: 'auto' } }}>
                <StudioButton dataId="new-island" label="Ny ø" size={SIDE_BTN} disabled={!hasBlocks || confirmOpen} onPress={askNewIsland}>
                  {newIslandPicture}
                </StudioButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </DndContext>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} keepPicture="krea.blocks" title={NEW_ISLAND_TITLE} freshPicture={newIslandPicture} />
    </GameShell>
  )
}

// ----- small pieces (code-drawn stand-ins until the art pass) -------------------------------------------

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

/** A special block as a chip, drawn in code: the roof in the held colour, the others as themselves. */
const SpecialChip: React.FC<{ kind: Exclude<BlockKind, 'cube'>; color: CrayonColor; selected: boolean }> = ({ kind, color, selected }) => (
  <Box aria-label={BLOCK_SPECIAL_NAME[kind]} aria-pressed={selected} data-blocks-special={kind} sx={[chipSx(selected), { background: '#FBF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }]}>
    <svg viewBox="0 0 48 48" width="78%" height="78%" aria-hidden>
      {kind === 'roof' ? <path d="M4 40 L24 8 L44 40 Z" fill={CRAYON_HEX[color]} stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinejoin="round" /> : null}
      {kind === 'window' ? (
        <g>
          <rect x="6" y="6" width="36" height="36" rx="5" fill="#F2EEE6" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
          <rect x="10" y="10" width="28" height="28" rx="3" fill="#6BB6E6" />
          <rect x="22.5" y="10" width="3" height="28" fill="#F2EEE6" />
          <rect x="10" y="22.5" width="28" height="3" fill="#F2EEE6" />
        </g>
      ) : null}
      {kind === 'door' ? (
        <g>
          <path d="M10 44 V14 a14 10 0 0 1 28 0 V44 Z" fill="#9A5E2E" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <circle cx="32" cy="30" r="2.6" fill="#E8C060" />
        </g>
      ) : null}
      {kind === 'wheel' ? (
        <g>
          <circle cx="24" cy="24" r="19" fill="#2E2B2A" />
          <circle cx="24" cy="24" r="8" fill="#C9C4BC" />
        </g>
      ) : null}
    </svg>
  </Box>
)

/** An island as a picker card / "Ny ø" picture: its sky with a flattened clay diamond — drawn in code. */
const IslandPicture: React.FC<{ island: BlockIslandDef }> = ({ island }) => (
  <Box sx={{ position: 'absolute', inset: 0, borderRadius: '18%', overflow: 'hidden', background: `linear-gradient(180deg, ${island.sky[0]}, ${island.sky[2]})` }}>
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      <path d="M50 38 L88 58 L50 78 L12 58 Z" transform="translate(0 7)" fill={island.soil} />
      <path d="M50 38 L88 58 L50 78 L12 58 Z" transform="translate(0 3)" fill={island.side} />
      <path d="M50 38 L88 58 L50 78 L12 58 Z" fill={island.top} />
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

const PlusMinus: React.FC<{ plus: boolean }> = ({ plus }) => (
  <svg viewBox="0 0 48 48" width="55%" height="55%" aria-hidden>
    <rect x="8" y="20" width="32" height="8" rx="4" fill="#5A8F3A" />
    {plus ? <rect x="20" y="8" width="8" height="32" rx="4" fill="#5A8F3A" /> : null}
  </svg>
)

export default ByggeklodserGame
