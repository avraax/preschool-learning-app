import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { kidCollision } from '../common/dnd/kidCollision'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { wasWobbledTap } from '../common/dnd/dragActivation'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useDifficulty } from '../../hooks/useDifficulty'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { KREA_BEADS } from '../../config/difficulty'
import { BEAD_BOARDS, BEAD_LAYOUT, beadPalette, boardMask, type BeadBoardDef } from '../../config/kreaBeads'
import { PALETTE_12 } from '../../config/kreaPalette'
import { KREA_COLOR_NAME, NEW_BOARD_LINE, NEW_BOARD_TITLE } from '../../config/kreaPhrases'
import { PHONE_ANY, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import {
  beadCount,
  freeBoard,
  landed,
  pegAt,
  placeBead,
  removeBead,
  restoreBeads,
  serialiseBeads,
  type BeadBoard,
  type BeadColor,
  type PlaceResult,
} from './beads/beadBoard'
import { BoardArt, geometryOf, Pegboard, pegBox, PlacedBeads } from './beads/Pegboard'
import { BeadBowls } from './beads/BeadBowls'
import { DragGhost, TweezersHolder } from './beads/Tweezers'
import { StudioBackdrop } from './studio/StudioScene'
import { PlusBadge, StudioButton } from './studio/StudioControls'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { swapPaper } from './studio/alive'
import { KreaPicker } from './studio/KreaPicker'
import { PickerButton } from './studio/PieceStudio'

// Perleplade (`krea.beads`, Krea PRD-02) — Hama beads, one at a time, onto a pegboard.
//
// ONE RESOLVER, TWO GESTURES (house rule, drag-and-drop.md): drag a bead out of a bowl onto a peg, or tap
// a bowl (one bead lifts into the tweezers) and then tap a peg. Both end in `resolve()`, the only caller
// of `placeBead` here — `kreaBeads`/`kreaPhrases` tests fail the build if a second path appears. A placed
// bead comes off the same two ways: drag it back to the bowls, or tap it with empty tweezers (it lifts
// into them; tap its bowl or the tweezers to put it away, or another peg to move it).
//
// This slice (W2) is the FREE BOARD: five shaped boards, anything goes anywhere. Like Fri Tegning it
// EARNS NOTHING and HAS NO FINISH (owner, 2026-10-16, applied to the free board the same day): no
// `useTaskRun`, no ✓, no pop-off — "Ny plade" + the spoken confirm is the way on. Copy-a-pattern (W3)
// is the mode that finishes and earns.
//
// Session-only resume per board (`kreaSession`). The tweezers never hold a bead across a resume.

const GAME_ID = 'krea.beads'
const SAVE_DEBOUNCE_MS = 500
/** The bead in the finger floats this many pitches above it (§4.2): the finger never hides the peg. */
const LIFT_PITCHES = 1
/** Free boards' picker/deep-link ids are prefixed, so they never collide with a pattern's (hjerte…). */
const FREE_PREFIX = 'fri-'

type Item = { kind: 'free'; def: BeadBoardDef }
const itemById = (id: string | null): Item | null => {
  if (!id?.startsWith(FREE_PREFIX)) return null
  const def = BEAD_BOARDS.find((b) => b.id === id.slice(FREE_PREFIX.length))
  return def ? { kind: 'free', def } : null
}

type Grab = { from: 'bowl'; colour: BeadColor } | { from: 'peg'; peg: number; colour: BeadColor } | null

const PerlepladeGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  const landscape = useMediaQuery('(orientation: landscape)')
  const phone = useMediaQuery(PHONE_ANY)
  const audio = useSimplifiedAudioHook({ componentId: 'PerlepladeGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const tuning = KREA_BEADS[level]
  const palette = beadPalette(level)

  const [params, setParams] = useSearchParams()
  const [itemId, setItemId] = useState<string | null>(() => (itemById(params.get('motiv')) ? params.get('motiv') : null))
  const item = itemById(itemId)

  const freshBoard = useCallback((it: Item): BeadBoard => freeBoard(tuning.board, boardMask(it.def, level)), [tuning.board, level])
  const loadBoard = useCallback(
    (id: string): BeadBoard | null => {
      const it = itemById(id)
      return it ? restoreBeads(freshBoard(it), kreaSession.load(GAME_ID, id), PALETTE_12) : null
    },
    [freshBoard],
  )

  const [board, setBoardState] = useState<BeadBoard | null>(() => (itemId ? loadBoard(itemId) : null))
  // A mirror of the board for the gesture handlers, which must judge against the board as it is NOW —
  // two taps inside one render would otherwise both see the old one.
  const boardRef = useRef<BeadBoard | null>(board)
  const setBoard = (b: BeadBoard | null) => {
    boardRef.current = b
    setBoardState(b)
  }
  const [held, setHeld] = useState<BeadColor | null>(null)
  const [grab, setGrab] = useState<Grab>(null)
  const [lastPlaced, setLastPlaced] = useState<{ peg: number; n: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [swapping, setSwapping] = useState(false)

  const hitRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const boardEl = useRef<HTMLDivElement>(null)
  const startPt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // The finger's REAL position during a drag, read from the pointer events themselves. dnd-kit's own
  // delta is measured off the dragged node, and in WebKit that drifted from the finger (Pegboard/BeadBowls
  // notes) — the bead in the finger and its landing peg must follow the finger, so they read this.
  const livePt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const unlisten = useRef<(() => void) | null>(null)
  const [beadPx, setBeadPx] = useState(48)

  const welcomeTriggered = useRef(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const later = (name: string, ms: number, fn: () => void) => {
    const t = timers.current[name]
    if (t) clearTimeout(t)
    timers.current[name] = setTimeout(() => {
      timers.current[name] = null
      fn()
    }, ms)
  }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      unlisten.current?.()
      for (const t of Object.values(pending)) if (t) clearTimeout(t)
    }
  }, [])

  // A level change re-shapes every board (7 / 10 / 13): reload the open one at the new size.
  useEffect(() => {
    if (!itemId) return
    setBoard(loadBoard(itemId))
    setHeld(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // ----- the welcome -------------------------------------------------------------------------------
  const markInteracted = () => {
    welcomeTriggered.current = true
  }
  useEffect(() => {
    if (!audio.isAudioReady || welcomeTriggered.current) return
    welcomeTriggered.current = true
    void audio.playGameWelcome('kreabeads').catch(() => {})
  }, [audio, audio.isAudioReady])

  // ----- session-only resume (§4.5) ----------------------------------------------------------------
  useEffect(() => {
    if (!itemId || !board) return
    later('save', SAVE_DEBOUNCE_MS, () => {
      if (beadCount(board)) kreaSession.save(GAME_ID, itemId, serialiseBeads(board, PALETTE_12))
      else kreaSession.clearItem(GAME_ID, itemId)
    })
  }, [board, itemId])

  // ----- THE resolver: every bead that lands on a peg, from either gesture, comes through here -------
  const resolve = (base: BeadBoard, colour: BeadColor, peg: number): PlaceResult => {
    const r = placeBead(base, colour, peg)
    setBoard(r.board)
    if (landed(r.result)) {
      sfx.play('bead-place')
      setLastPlaced((p) => ({ peg, n: (p?.n ?? 0) + 1 }))
    } else if (r.result !== 'outside') {
      // A bounce (W3's wrong colour) rolls the bead home — a soft sound, never a buzzer (§5).
      sfx.play('bead-back')
    }
    return r.result
  }

  const pickColour = (c: BeadColor) => {
    sfx.play('bead-pick')
    // Each pick names the colour (PRD-01 §2.2.6) — fire-and-forget; a fast child cancels the last one.
    audio.cancelCurrentAudio()
    void audio.speak(KREA_COLOR_NAME[c]).catch(() => {})
  }

  // ----- tap ---------------------------------------------------------------------------------------
  const enabled = !!board && !confirmOpen && !swapping

  const tapBowl = (c: BeadColor) => {
    if (!enabled) return
    markInteracted()
    audio.updateUserInteraction()
    if (held === c) {
      sfx.play('bead-back')
      setHeld(null)
      return
    }
    setHeld(c)
    pickColour(c)
  }

  const putBackHeld = () => {
    if (!held) return
    sfx.play('bead-back')
    setHeld(null)
  }

  const tapAt = (x: number, y: number) => {
    const b = boardRef.current
    if (!enabled || !b) return
    markInteracted()
    audio.updateUserInteraction()
    const g = geometryOf(hitRef.current, b.n)
    if (!g) return
    const peg = pegAt(g, x, y)
    if (held) {
      const r = resolve(b, held, peg)
      // A tap that missed the board keeps the bead in the tweezers; anything else used it up.
      if (r !== 'outside') setHeld(null)
      return
    }
    if (peg >= 0 && b.beads[peg]) {
      const lifted = removeBead(b, peg)
      setBoard(lifted.board)
      setHeld(lifted.colour)
      sfx.play('bead-pick')
      return
    }
    sfx.play('tap')
  }

  // ----- drag --------------------------------------------------------------------------------------
  const sensors = useDragOnlySensors()

  const pointOf = (e: Event | null): { x: number; y: number } => {
    const p = e as { clientX?: number; clientY?: number; touches?: TouchList } | null
    if (p && typeof p.clientX === 'number') return { x: p.clientX, y: p.clientY ?? 0 }
    const t = p?.touches?.[0]
    return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 }
  }

  /** Where a dragged bead would land: under the floating bead, a pitch above the finger. */
  const landingPeg = (x: number, y: number): number => {
    const b = boardRef.current
    const g = b && geometryOf(hitRef.current, b.n)
    if (!b || !g) return -1
    const peg = pegAt(g, x, y - LIFT_PITCHES * g.pitch)
    return peg >= 0 && b.mask[peg] ? peg : -1
  }

  const moveGhost = (x: number, y: number) => {
    const b = boardRef.current
    const g = b && geometryOf(hitRef.current, b.n)
    const lift = (g?.pitch ?? beadPx) * LIFT_PITCHES
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${x}px, ${y - lift}px)`
    const ring = ringRef.current
    if (!ring || !b) return
    const peg = landingPeg(x, y)
    if (peg < 0) {
      ring.style.display = 'none'
      return
    }
    Object.assign(ring.style, { display: 'block', ...pegBox(b.n, peg, tuning.bead) })
  }

  const onDragStart = (e: DragStartEvent) => {
    const b = boardRef.current
    if (!b || !enabled) return
    markInteracted()
    audio.updateUserInteraction()
    const p = pointOf(e.activatorEvent)
    startPt.current = p
    livePt.current = p
    unlisten.current?.()
    const track = (ev: PointerEvent) => {
      livePt.current = { x: ev.clientX, y: ev.clientY }
      moveGhost(ev.clientX, ev.clientY)
    }
    document.addEventListener('pointermove', track, { capture: true, passive: true })
    unlisten.current = () => document.removeEventListener('pointermove', track, { capture: true })
    const g = geometryOf(hitRef.current, b.n)
    if (g) setBeadPx(g.pitch * tuning.bead)
    const id = String(e.active.id)
    let next: Grab = null
    if (id.startsWith('bowl:')) {
      // One bead at a time: a bead already in the tweezers goes home first.
      if (held) setHeld(null)
      next = { from: 'bowl', colour: id.slice(5) as BeadColor }
      pickColour(next.colour)
    } else if (id === 'board-bead' && !held && g) {
      const peg = pegAt(g, p.x, p.y)
      const c = peg >= 0 ? b.beads[peg] : null
      if (c) {
        next = { from: 'peg', peg, colour: c }
        sfx.play('bead-pick')
      }
    }
    setGrab(next)
    if (next) moveGhost(p.x, p.y)
  }

  const endDrag = () => {
    unlisten.current?.()
    unlisten.current = null
    setGrab(null)
    if (ringRef.current) ringRef.current.style.display = 'none'
  }

  const onDragEnd = (e: DragEndEvent) => {
    const g = grab
    endDrag()
    const id = String(e.active.id)
    const { x, y } = livePt.current
    const wobbled = wasWobbledTap({ x: x - startPt.current.x, y: y - startPt.current.y })
    // A tap the finger smeared past the drag threshold is still a tap (dragActivation.ts).
    if (wobbled && (id === 'board-bead' || !e.over)) {
      if (id === 'board-bead') tapAt(startPt.current.x, startPt.current.y)
      else if (g?.from === 'bowl') tapBowl(g.colour)
      return
    }
    const b = boardRef.current
    if (!g || !b || !enabled) return
    const overBowls = e.over?.id === 'bowls'
    // The landing is judged where the floating BEAD is, not by `over`: the bead hovers a pitch above the
    // finger, so a drop onto the top row can have the finger below the board. Over nothing and off every
    // peg (`!over` / -1) springs back with nothing changed.
    const peg = overBowls ? -1 : landingPeg(x, y)
    if (g.from === 'bowl') {
      if (peg >= 0) resolve(b, g.colour, peg)
      else sfx.play('bead-back')
      return
    }
    if (overBowls) {
      setBoard(removeBead(b, g.peg).board)
      sfx.play('bead-back')
      return
    }
    if (peg < 0 || peg === g.peg) {
      sfx.play('bead-back')
      return
    }
    // A move is the same resolver on the board with this bead lifted; a move that doesn't land puts
    // the board back exactly as it was.
    const lifted = removeBead(b, g.peg).board
    if (!landed(resolve(lifted, g.colour, peg))) setBoard(b)
  }

  // ----- the grid and the way on -------------------------------------------------------------------
  const openItem = (id: string) => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-paper')
    setBoard(loadBoard(id))
    setHeld(null)
    setItemId(id)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('motiv', id)
      return n
    }, { replace: true })
  }

  const toPicker = () => {
    markInteracted()
    sfx.play('tap')
    audio.cancelCurrentAudio()
    setHeld(null)
    setItemId(null)
    setBoard(null)
    setConfirmOpen(false)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('motiv')
      return n
    }, { replace: true })
  }

  const askNewBoard = () => {
    markInteracted()
    sfx.play('tap')
    setHeld(null)
    setConfirmOpen(true)
    audio.cancelCurrentAudio()
    void audio.speak(NEW_BOARD_LINE).catch(() => {})
  }
  const confirmFresh = () => {
    audio.cancelCurrentAudio()
    setConfirmOpen(false)
    if (!item || !itemId) return
    sfx.play('krea-paper')
    kreaSession.clearItem(GAME_ID, itemId)
    setSwapping(true)
    void swapPaper(boardEl.current, reduce, () => setBoard(freshBoard(item))).then(() => {
      if (mounted.current) setSwapping(false)
    })
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- render ------------------------------------------------------------------------------------
  const cssVars = {
    '--bead-bowl': `${BEAD_LAYOUT.bowlPx}px`,
    '--bead-bowl-gap': `${BEAD_LAYOUT.bowlGapPx}px`,
    '--bead-side': `${BEAD_LAYOUT.sidePx}px`,
    '--bead-tweezers': '112px',
    // A phone is not the target device: the board simply takes what is left (measured 2026-10-16, WebKit:
    // pitch 42/30/24 px at Let/Normal/Svær on an 844×390 landscape phone — under the iPad's 40 px floor
    // above Let). No panning: a pannable board under a drag gesture would fight the drag.
    [PHONE_ANY]: { '--bead-bowl': '46px', '--bead-bowl-gap': '4px', '--bead-side': '104px', '--bead-tweezers': '60px' },
    // 12 bowls in two rows + the side row are wider than a portrait phone (two bowls hung off): 4 rows of 3.
    [PHONE_PORTRAIT]: { '--bead-bowl-rows': 4 },
  }

  if (!item || !board) {
    return (
      <GameShell categoryId="krea" title="Perleplade" backRoute="/krea" dense guide={false} lightScene>
        <StudioBackdrop />
        <KreaPicker
          items={BEAD_BOARDS.map((def) => {
            const id = `${FREE_PREFIX}${def.id}`
            const b = loadBoard(id)!
            return {
              id,
              label: def.name,
              picture: (
                <Box sx={{ position: 'absolute', inset: '7%' }}>
                  <BoardArt n={b.n} mask={b.mask} />
                  <PlacedBeads board={b} size={tuning.bead} />
                </Box>
              ),
            }
          })}
          onPick={openItem}
        />
      </GameShell>
    )
  }

  const orientation = landscape ? 'landscape' : 'portrait'
  const newBoardPicture = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box sx={{ position: 'absolute', inset: '12%' }}>
        <BoardArt n={4} mask={Array(16).fill(true)} />
      </Box>
      <PlusBadge />
    </Box>
  )

  return (
    <GameShell categoryId="krea" title="Perleplade" backRoute="/krea" dense guide={false} lightScene>
      <StudioBackdrop />
      <DndContext sensors={sensors} collisionDetection={kidCollision} autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={endDrag}>
        <Box
          data-krea-stage
          data-krea-item={itemId}
          sx={[
            cssVars,
            {
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gap: `${BEAD_LAYOUT.gapPx}px`,
              // Reserved space (layout-contract.md): the bowls and the side column take their fixed share
              // (`BEAD_LAYOUT`, the same numbers the pitch test reads) and the board is the remainder.
              // Portrait: the board takes the full width, so the row under it only has to fit the bowls
              // and the side controls side by side (measured: a 168 px side squeezed the tweezers to a sliver).
              gridTemplateColumns: 'auto auto',
              justifyContent: 'center',
              gridTemplateRows: 'minmax(0, 1fr) auto',
              gridTemplateAreas: '"board board" "bowls side"',
              '@media (orientation: landscape)': {
                gridTemplateColumns: 'auto minmax(0, 1fr) var(--bead-side)',
                justifyContent: 'stretch',
                gridTemplateRows: 'minmax(0, 1fr)',
                gridTemplateAreas: '"bowls board side"',
              },
              pb: 'env(safe-area-inset-bottom)',
            },
          ]}
        >
          <Box sx={{ gridArea: 'bowls', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <BeadBowls colours={palette} held={held} dragging={grab?.from === 'bowl' ? grab.colour : null} disabled={!enabled} orientation={orientation} onTap={tapBowl} />
          </Box>
          <Box sx={{ gridArea: 'board', minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
            <Box sx={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}>
              <Pegboard
                board={board}
                beadSize={tuning.bead}
                disabled={!enabled}
                liftedPeg={grab?.from === 'peg' ? grab.peg : null}
                lastPlaced={lastPlaced}
                reduce={reduce}
                hitRef={hitRef}
                ringRef={ringRef}
                boardRef={boardEl}
                onTapAt={tapAt}
              />
            </Box>
          </Box>
          <Box
            sx={{
              gridArea: 'side',
              display: 'flex',
              flexDirection: landscape ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
              gap: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <PickerButton gameId={GAME_ID} disabled={confirmOpen || swapping} onPress={toPicker} />
            <TweezersHolder held={held} disabled={!enabled} onPress={putBackHeld} />
            <Box sx={{ visibility: beadCount(board) ? 'visible' : 'hidden' }}>
              <StudioButton dataId="new-board" label="Ny plade" size={phone ? '48px' : '84px'} disabled={!enabled || !beadCount(board)} onPress={askNewBoard}>
                {newBoardPicture}
              </StudioButton>
            </Box>
          </Box>
        </Box>
        <DragGhost ghostRef={ghostRef} colour={grab?.colour ?? null} beadPx={beadPx} />
      </DndContext>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} keepPicture={GAME_ID} title={NEW_BOARD_TITLE} freshPicture={newBoardPicture} />
    </GameShell>
  )
}

export default PerlepladeGame
