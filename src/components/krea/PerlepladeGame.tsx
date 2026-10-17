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
import { useTaskRun } from '../../hooks/useTaskRun'
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { reportKreaFinished } from '../../services/usagePing'
import { KREA_BEADS } from '../../config/difficulty'
import {
  BEAD_BOARDS,
  BEAD_LAYOUT,
  BEAD_PATTERNS,
  beadPalette,
  boardMask,
  legendCounts,
  patternById,
  patternCells,
  type BeadBoardDef,
  type BeadPatternDef,
} from '../../config/kreaBeads'
import { KREA_TASKS_IN_ROUND } from '../../config/kreaSubjects'
import { PALETTE_12 } from '../../config/kreaPalette'
import { NEW_BOARD_LINE, NEW_BOARD_TITLE } from '../../config/kreaPhrases'
import { PHONE_ANY, PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import { idlePulse } from '../../theme/idleMotion'
import {
  beadCount,
  finishedPattern,
  freeBoard,
  isComplete,
  landed,
  patternBoard,
  pegAt,
  pegCentre,
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
import { DragGhost } from './beads/HeldBead'
import { PatternCard } from './beads/PatternCard'
import { flyHome, popOff } from './beads/beadMotion'
import { StudioBackdrop } from './studio/StudioScene'
import { PICTURES, PlusBadge, SIDE_TOP_CLEARANCE, StudioButton } from './studio/StudioControls'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { swapPaper } from './studio/alive'
import { KreaPicker } from './studio/KreaPicker'

// Perleplade (`krea.beads`, Krea PRD-02) — Hama beads, one at a time, onto a pegboard.
//
// ONE RESOLVER, TWO GESTURES (house rule, drag-and-drop.md): drag a bead out of a bowl onto a peg, or tap
// a bowl (one bead lifts out of it, in hand) and then tap a peg. Both end in `resolve()`, the only caller
// of `placeBead` here — `perleplade.test.ts` fails the build if a second path appears. A placed bead comes
// off the same two ways: drag it back to the bowls, or tap it with nothing in hand (it lifts off; tap a
// bowl to put it away, or another peg to move it). All by hand — no tweezers (owner, 2026-10-16).
//
// Two kinds of item on the picture grid:
//   - COPY A PATTERN (§2.3): a card beside the board. A peg takes only its pattern colour; anything else
//     rolls home to its bowl — no buzzer, no red, no "forkert". After 2 misses on one peg the right bowl
//     glows. Complete → the ✓ → the piece pops off and wobbles + its describing line → one task of XP (on
//     the press) → the ceremony at the seam → "next" back to the grid.
//   - FREE BOARD: five shaped boards, anything goes anywhere. Like Fri Tegning it EARNS NOTHING and HAS NO
//     FINISH (owner, 2026-10-16): "Ny plade" + the spoken confirm is the way on.
//
// Session-only resume per item (`kreaSession`). Nothing is ever held across a resume.

const GAME_ID = 'krea.beads'
const SAVE_DEBOUNCE_MS = 500
/**
 * How far the bead in the finger sits above the touch point, in pitches (§4.2). A full pitch kept the
 * peg visible but felt detached — not like picking a bead up (owner, 2026-10-16). Half a pitch lets the
 * bead peek out just above the fingertip, which is where a pinched bead is. A mouse hides nothing, so
 * there it sits right under the pointer.
 */
const TOUCH_LIFT_PITCHES = 0.45
/** Free boards' picker/deep-link ids are prefixed, so they never collide with a pattern's (hjerte…). */
const FREE_PREFIX = 'fri-'

type Item = { kind: 'free'; def: BeadBoardDef } | { kind: 'pattern'; def: BeadPatternDef }
const itemById = (id: string | null): Item | null => {
  if (!id) return null
  if (id.startsWith(FREE_PREFIX)) {
    const def = BEAD_BOARDS.find((b) => b.id === id.slice(FREE_PREFIX.length))
    return def ? { kind: 'free', def } : null
  }
  const def = patternById(id)
  return def ? { kind: 'pattern', def } : null
}

type Grab = { from: 'bowl'; colour: BeadColor } | { from: 'peg'; peg: number; colour: BeadColor } | null
type Stage = 'building' | 'finished' | 'alive' | 'shown'

const PerlepladeGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  const landscape = useMediaQuery('(orientation: landscape)')
  const phone = useMediaQuery(PHONE_ANY)
  const audio = useSimplifiedAudioHook({ componentId: 'PerlepladeGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const tuning = KREA_BEADS[level]
  const palette = beadPalette(level)
  // XP for a finished PATTERN only — one task per piece. The free board never calls it (Lepper 1973).
  const run = useTaskRun({ tasksInRound: KREA_TASKS_IN_ROUND, gameId: GAME_ID })

  const [params, setParams] = useSearchParams()
  const [itemId, setItemId] = useState<string | null>(() => (itemById(params.get('motiv')) ? params.get('motiv') : null))
  const item = itemById(itemId)

  const freshBoard = useCallback(
    (it: Item): BeadBoard => (it.kind === 'free' ? freeBoard(tuning.board, boardMask(it.def, level)) : patternBoard(tuning.board, patternCells(it.def, level))),
    [tuning.board, level],
  )
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
  const [hint, setHint] = useState<BeadColor | null>(null)
  const [legendGlow, setLegendGlow] = useState<{ colour: BeadColor; n: number } | null>(null)
  const [done, setDone] = useState(false)
  const [shown, setShown] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [swapping, setSwapping] = useState(false)

  const hitRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const boardEl = useRef<HTMLDivElement>(null)
  const piecesEl = useRef<HTMLDivElement>(null)
  const startPt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // The finger's REAL position during a drag, read from the pointer events themselves. dnd-kit's own
  // delta is measured off the dragged node, and in WebKit that drifted from the finger (Pegboard/BeadBowls
  // notes) — the bead in the finger and its landing peg must follow the finger, so they read this.
  const livePt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const unlisten = useRef<(() => void) | null>(null)
  const liftPitches = useRef(TOUCH_LIFT_PITCHES)
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

  // A level change re-shapes every board (10 / 13 / 16) and every pattern: reload the open one.
  useEffect(() => {
    if (!itemId) return
    setBoard(loadBoard(itemId))
    setHeld(null)
    setHint(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const complete = !!board && isComplete(board)
  const stage: Stage = !complete ? 'building' : !done ? 'finished' : shown ? 'shown' : 'alive'

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
      setHint(null)
    } else if (r.result !== 'outside') {
      // A bounce rolls the bead home to its bowl — a soft sound, never a buzzer (§5). The 2nd miss on one
      // peg makes the right bowl glow (the never-fail hint).
      sfx.play('bead-back')
      const g = geometryOf(hitRef.current, r.board.n)
      if (g) flyHome(colour, pegCentre(g, peg), g.pitch * tuning.bead, reduce)
      if (r.hint) setHint(r.hint)
    }
    return r.result
  }

  // Picking a bead is SILENT apart from its click — no colour name (owner, 2026-10-17: a name on every one
  // of ~100 beads is noise). The legend chips still speak their numbers.
  const pickColour = (_c: BeadColor) => {
    sfx.play('bead-pick')
  }

  // ----- tap ---------------------------------------------------------------------------------------
  const enabled = !!board && !confirmOpen && !swapping && !done

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
      // A tap that missed the board keeps the bead in hand; anything else used it up.
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

  // A legend chip: say the number, and make the board's beads of that colour glow — counting as play.
  const tapChip = (c: BeadColor, count: number) => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    void audio.speakNumber(count).catch(() => {})
    setLegendGlow((p) => ({ colour: c, n: (p?.n ?? 0) + 1 }))
  }

  // ----- drag --------------------------------------------------------------------------------------
  const sensors = useDragOnlySensors()

  const pointOf = (e: Event | null): { x: number; y: number } => {
    const p = e as { clientX?: number; clientY?: number; touches?: TouchList } | null
    if (p && typeof p.clientX === 'number') return { x: p.clientX, y: p.clientY ?? 0 }
    const t = p?.touches?.[0]
    return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 }
  }

  /** Where a dragged bead would land: under the floating bead, just above the finger. */
  const landingPeg = (x: number, y: number): number => {
    const b = boardRef.current
    const g = b && geometryOf(hitRef.current, b.n)
    if (!b || !g) return -1
    const peg = pegAt(g, x, y - liftPitches.current * g.pitch)
    return peg >= 0 && b.mask[peg] ? peg : -1
  }

  const moveGhost = (x: number, y: number) => {
    const b = boardRef.current
    const g = b && geometryOf(hitRef.current, b.n)
    const lift = (g?.pitch ?? beadPx) * liftPitches.current
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
    liftPitches.current = (e.activatorEvent as PointerEvent | null)?.pointerType === 'mouse' ? 0 : TOUCH_LIFT_PITCHES
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
      // One bead at a time: a bead already in hand goes home first.
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
    // The landing is judged where the floating BEAD is, not by `over`: the bead hovers above the finger,
    // so a drop onto the top row can have the finger below the board. Off every peg → it rolls home.
    const peg = overBowls ? -1 : landingPeg(x, y)
    const lift = (geometryOf(hitRef.current, b.n)?.pitch ?? beadPx) * liftPitches.current
    if (g.from === 'bowl') {
      if (peg >= 0) resolve(b, g.colour, peg)
      else {
        sfx.play('bead-back')
        flyHome(g.colour, { x, y: y - lift }, beadPx, reduce)
      }
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
    setHint(null)
    setDone(false)
    setShown(false)
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
    setHint(null)
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
    setHint(null)
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

  // A finished PATTERN: XP on the press (leaving mid-wobble must not lose it); the piece pops off its
  // pegs and wobbles with its describing line; the ceremony waits for the seam, then "next".
  const onDone = () => {
    if (item?.kind !== 'pattern' || stage !== 'finished') return
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('bead-popoff')
    run.completeTask(true)
    reportKreaFinished('beads')
    setDone(true)
    setShown(false)
    setHeld(null)
    audio.cancelCurrentAudio()
    void audio.speak(item.def.doneLine).catch(() => {})
    void popOff(piecesEl.current, reduce).then(() => {
      if (!mounted.current) return
      run.thenContinue(() => {
        if (mounted.current) setShown(true)
      })
    })
  }
  const onNext = () => {
    if (itemId) kreaSession.clearItem(GAME_ID, itemId)
    setDone(false)
    setShown(false)
    toPicker()
  }

  // ----- render ------------------------------------------------------------------------------------
  const cssVars = {
    '--bead-bowl': `${BEAD_LAYOUT.bowlPx}px`,
    '--bead-bowl-gap': `${BEAD_LAYOUT.bowlGapPx}px`,
    '--bead-bowl-rows': BEAD_LAYOUT.portraitBowlRows,
    '--bead-side': `${BEAD_LAYOUT.sidePx}px`,
    '--bead-card-pic': '120px',
    '--bead-chip': '22px',
    '--bead-chip-font': '1.25rem',
    // A phone is not the target device: the board simply takes what is left (measured 2026-10-16, WebKit).
    // No panning: a pannable board under a drag gesture would fight the drag.
    [PHONE_ANY]: { '--bead-bowl': '46px', '--bead-bowl-gap': '4px', '--bead-side': '104px', '--bead-card-pic': '64px', '--bead-chip': '14px', '--bead-chip-font': '0.85rem' },
    // 12 bowls in 2 columns are 6 rows — taller than a landscape phone: 3 columns.
    [PHONE_LANDSCAPE]: { '--bead-bowl-cols': 3 },
    // 12 bowls in a few rows + the side are wider than a portrait phone: 4 rows of 3.
    [PHONE_PORTRAIT]: { '--bead-bowl-rows': 4 },
  }

  if (!item || !board) {
    const cards = [
      ...BEAD_PATTERNS.map((def) => {
        const b = loadBoard(def.id)!
        return {
          id: def.id,
          label: def.name,
          // The picture to copy, faint, with the child's own beads on it if the piece is in progress.
          picture: (
            <Box sx={{ position: 'absolute', inset: '7%' }}>
              <Box sx={{ position: 'absolute', inset: 0, opacity: beadCount(b) ? 0.3 : 1 }}>
                <PlacedBeads board={finishedPattern(b.n, patternCells(def, level))} size={tuning.bead} />
              </Box>
              <PlacedBeads board={b} size={tuning.bead} />
            </Box>
          ),
        }
      }),
      ...BEAD_BOARDS.map((def) => {
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
      }),
    ]
    return (
      <GameShell categoryId="krea" title="Perleplade" dense guide={false} lightScene>
        <StudioBackdrop />
        <KreaPicker items={cards} onPick={openItem} />
      </GameShell>
    )
  }

  const orientation = landscape ? 'landscape' : 'portrait'
  const isPattern = item.kind === 'pattern'
  // "Choose another board" is a small copy of the grid it opens: four white cards, each a finished
  // bead picture. A lone tile icon, and then a pile of empty cream boards, read as decoration rather
  // than a door (owner, 2026-10-16 — the same lesson as Fri Tegning's "Nyt papir").
  const pickerPicture = (
    <Box sx={{ width: '100%', height: '100%', p: '6%', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8%' }}>
      {(['hjerte', 'stjerne', 'fisk', 'blomst'] as const).map((id, i) => (
        <Box key={id} sx={{ position: 'relative', background: '#FFFEFB', borderRadius: '14%', boxShadow: '0 2px 4px rgba(80,50,20,0.3)', transform: `rotate(${[-4, 3, 2, -3][i]}deg)` }}>
          <Box sx={{ position: 'absolute', inset: '6%' }}>
            <PlacedBeads board={finishedPattern(10, patternCells(patternById(id)!, 'let'))} size={0.96} />
          </Box>
        </Box>
      ))}
    </Box>
  )
  // Landscape with the pattern card in the side column: the two controls give it room. Portrait: the two
  // stand stacked beside the bowls, so together they must not be taller than the bowls' 3 rows (208 px) —
  // at 120 + 120 they were, and the board lost 40 px (measured, WebKit 768×1024).
  const big = phone ? '56px' : landscape && !isPattern ? '120px' : '96px'
  const newBoardPicture = (
    // Board 12–88 % + the corner badge to 102 %: shifted so their union is centred in the column, like "Nyt papir".
    <Box sx={{ position: 'relative', width: '100%', height: '100%', transform: 'translate(-7%, 5%)' }}>
      <Box sx={{ position: 'absolute', inset: '12%' }}>
        <BoardArt n={4} mask={Array(16).fill(true)} />
      </Box>
      <PlusBadge />
    </Box>
  )
  const pulse = idlePulse(reduce, { peak: 1.07, durationS: 1.4 })
  const wayOn =
    stage === 'finished' ? (
      <Box {...pulse.props} sx={[{ display: 'flex' }, pulse.sx]}>
        <StudioButton dataId="done" label="Færdig" size={big} onPress={onDone}>
          <PICTURES.Done />
        </StudioButton>
      </Box>
    ) : stage === 'shown' ? (
      <StudioButton dataId="next" label="Næste" size={big} onPress={onNext}>
        <PICTURES.Next />
      </StudioButton>
    ) : (
      <Box sx={{ visibility: stage === 'building' && beadCount(board) ? 'visible' : 'hidden' }}>
        <StudioButton dataId="new-board" label="Ny plade" size={big} disabled={!enabled || !beadCount(board)} onPress={askNewBoard}>
          {newBoardPicture}
        </StudioButton>
      </Box>
    )
  const card = isPattern ? (
    <PatternCard
      id={item.def.id}
      n={board.n}
      target={board.target ?? []}
      legend={legendCounts(board.target ?? [])}
      direction={landscape || phone ? 'column' : 'row'}
      disabled={confirmOpen || swapping}
      onChip={tapChip}
    />
  ) : null

  return (
    <GameShell categoryId="krea" title="Perleplade" dense guide={false} lightScene>
      <StudioBackdrop />
      <DndContext sensors={sensors} collisionDetection={kidCollision} autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={endDrag}>
        <Box
          data-krea-stage
          data-krea-item={itemId}
          data-krea-piece={stage}
          sx={[
            cssVars,
            {
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gap: `${BEAD_LAYOUT.gapPx}px`,
              // Reserved space (layout-contract.md): the bowls, the card and the side take their fixed
              // share (`BEAD_LAYOUT`, the same numbers the pitch test reads) and the board is the remainder.
              // Portrait: the board takes the full width; the row under it holds the bowls (3 rows), the
              // card and the two controls side by side.
              gridTemplateColumns: 'auto auto auto',
              justifyContent: 'center',
              alignItems: 'center',
              gridTemplateRows: 'minmax(0, 1fr) auto',
              gridTemplateAreas: '"board board board" "bowls card side"',
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
            <BeadBowls colours={palette} held={held} glow={hint} dragging={grab?.from === 'bowl' ? grab.colour : null} disabled={!enabled} orientation={orientation} onTap={tapBowl} />
          </Box>
          <Box sx={{ gridArea: 'board', minWidth: 0, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
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
                piecesRef={piecesEl}
                glow={legendGlow}
                guideMode={tuning.guide}
                onTapAt={tapAt}
              />
            </Box>
          </Box>
          {!landscape && card ? <Box sx={{ gridArea: 'card', display: 'flex', minWidth: 0 }}>{card}</Box> : null}
          <Box
            sx={{
              gridArea: 'side',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              gap: 1,
              minHeight: 0,
              minWidth: 0,
              height: landscape ? '100%' : 'auto',
              // Clear of the reward ring above, like the drawing games' right column (owner, 2026-10-17).
              pt: landscape ? SIDE_TOP_CLEARANCE : 0,
            }}
          >
            <StudioButton dataId="to-picker" label="Vælg en anden plade" size={big} disabled={confirmOpen || swapping || stage === 'alive'} onPress={toPicker}>
              {pickerPicture}
            </StudioButton>
            {landscape ? card : null}
            {wayOn}
          </Box>
        </Box>
        <DragGhost ghostRef={ghostRef} colour={grab?.colour ?? null} beadPx={beadPx} />
      </DndContext>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} keepPicture={GAME_ID} title={NEW_BOARD_TITLE} freshPicture={newBoardPicture} />
    </GameShell>
  )
}

export default PerlepladeGame
