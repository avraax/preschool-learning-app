import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useDifficulty } from '../../hooks/useDifficulty'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTaskRun } from '../../hooks/useTaskRun'
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { KREA_GUIDE } from '../../config/difficulty'
import { paletteFor } from '../../config/kreaPalette'
import { KREA_COLOR_NAME, KREA_RAINBOW_NAME, NEW_PAPER_LINE } from '../../config/kreaPhrases'
import { KREA_SUBJECTS, KREA_TASKS_IN_ROUND, MIRROR_AXIS, subjectById, type KreaSubject } from '../../config/kreaSubjects'
import { SUBJECT_VIEWBOX, mirrorShape, shapePath, subjectXToPaper } from '../../config/kreaShapes'
import DrawingSurface from './canvas/DrawingSurface'
import { addStroke, deserialise, emptyDrawing, serialise, type CrayonColor, type Drawing, type Stroke, type Tool } from './canvas/strokeModel'
import { judgeStep, toleranceInPaper } from './canvas/guideMatch'
import { undoPiece, type Piece } from './canvas/guidedPiece'
import { StudioBackdrop, Paper } from './studio/StudioScene'
import { CrayonPalette, ToolRow } from './studio/StudioControls'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { playAlive, swapPaper } from './studio/alive'
import { GuideLayer, DemoPencil } from './studio/GuideLayer'
import { InkThumb, KreaPicker } from './studio/KreaPicker'
import { PickerButton, PieceStudio, PieceWayOn, type PieceStage } from './studio/PieceStudio'

// Tegn med Mig (`krea.guide`, Krea PRD-01 §2.2.7, §4.3) — pick a subject from a picture grid, then draw
// it ONE STEP AT A TIME on a thick dotted guide. Each step is spoken and names a shape ("Tegn en stor
// cirkel til hovedet"); it counts when the child has drawn roughly along the guide (`guideMatch`, a
// lenient coverage rule that can never fail). The child's own wobbly line is the picture — nothing is
// snapped, redrawn or judged, and there is no "outside the line", ever.
//
// Unlike Fri Tegning, a guided piece ENDS (§2.2.9, still true after the owner's 2026-10-16 review):
// when the last step is drawn the done ✓ appears; done → the picture comes alive with its describing
// line, the piece earns task XP (one task per finished piece), the ceremony plays at the seam if a
// slot was crossed, and the big "next" → returns to the grid.
//
// Session-only resume per subject (`kreaSession`): the grid card shows the partial work, so switching
// subjects never needs a confirm.

const GAME_ID = 'krea.guide'
const SAVE_DEBOUNCE_MS = 500
/** Stalled this long on a step → the guide pulses and the step line repeats once (§4.3). */
const STALL_MS = 8000

const freshPiece = (): Piece => ({ drawing: emptyDrawing(), step: 0, start: 0, starts: [], done: false })

function loadPiece(id: string): Piece | null {
  const raw = kreaSession.load(GAME_ID, id)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as { v?: number; d?: string; step?: number; start?: number; starts?: unknown; done?: boolean }
    const drawing = deserialise(p.d) ?? emptyDrawing()
    const steps = subjectById(id)?.steps.length ?? 0
    const step = Math.max(0, Math.min(steps, Number(p.step) || 0))
    const start = Math.max(0, Math.min(drawing.strokes.length, Number(p.start) || 0))
    // `starts` must be one per completed step, ascending and inside the drawing — anything else (an
    // older session copy) degrades to [] and undo simply stops at the current step's start.
    const raw0 = Array.isArray(p.starts) ? p.starts.map(Number) : []
    const ok = raw0.length === step && raw0.every((n, i) => Number.isInteger(n) && n >= 0 && n <= start && (i === 0 || n >= raw0[i - 1]))
    return { drawing, step, start, starts: ok ? raw0 : [], done: !!p.done && step >= steps }
  } catch {
    return null
  }
}

const savePiece = (id: string, p: Piece) =>
  kreaSession.save(GAME_ID, id, JSON.stringify({ v: 1, d: serialise(p.drawing), step: p.step, start: p.start, starts: p.starts, done: p.done }))

/** A subject's finished line drawing for its grid card: every step's guide, mirror halves included. */
const SubjectCard: React.FC<{ subject: KreaSubject; drawing: Drawing | null }> = ({ subject, drawing }) => {
  const paths = useMemo(
    () =>
      subject.steps.flatMap((st) => [
        ...st.shapes.map(shapePath),
        ...(st.mirror ? st.shapes.map((s) => shapePath(mirrorShape(s, MIRROR_AXIS))) : []),
      ]),
    [subject],
  )
  return (
    <Box sx={{ position: 'absolute', inset: '8%' }}>
      <svg viewBox={SUBJECT_VIEWBOX} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <g fill="none" stroke={drawing ? '#B9C2D0' : '#5D6B82'} strokeWidth={drawing ? 10 : 14} strokeLinecap="round" strokeLinejoin="round">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
      <InkThumb drawing={drawing} viewBox={SUBJECT_VIEWBOX} />
    </Box>
  )
}

const TegnMedMigGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  const landscape = useMediaQuery('(orientation: landscape)')
  const audio = useSimplifiedAudioHook({ componentId: 'TegnMedMigGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const tuning = KREA_GUIDE[level]
  const palette = paletteFor(tuning.palette)
  const run = useTaskRun({ tasksInRound: KREA_TASKS_IN_ROUND, gameId: GAME_ID })

  // Deep link: `?motiv=kat` opens a subject straight away (§4.10).
  const [params, setParams] = useSearchParams()
  const [subjectId, setSubjectId] = useState<string | null>(() => subjectById(params.get('motiv'))?.id ?? null)
  const subject = subjectById(subjectId)
  const [piece, setPiece] = useState<Piece>(() => (subjectId ? loadPiece(subjectId) : null) ?? freshPiece())
  const [tool, setTool] = useState<Tool>('crayon')
  const [color, setColor] = useState<CrayonColor>('roed')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)
  const [hint, setHint] = useState(false)
  // The demo pencil's run key: a new value replays it (Let only, once per step).
  const [demoKey, setDemoKey] = useState<string | null>(null)

  const paperRef = useRef<HTMLDivElement>(null)
  const pictureRef = useRef<HTMLDivElement>(null)
  const welcomeTriggered = useRef(false)
  const hintSpoken = useRef(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const later = (name: string, ms: number, fn: () => void) => {
    const t = timers.current[name]
    if (t) clearTimeout(t)
    timers.current[name] = setTimeout(() => {
      timers.current[name] = null
      fn()
    }, ms)
  }
  const cancel = (name: string) => {
    const t = timers.current[name]
    if (t) clearTimeout(t)
    timers.current[name] = null
  }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      for (const t of Object.values(pending)) if (t) clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!palette.includes(color)) setColor(palette[0])
  }, [palette, color])

  const steps = subject?.steps ?? []
  const current = subject && !piece.done && piece.step < steps.length ? steps[piece.step] : null
  const allDrawn = !!subject && piece.step >= steps.length
  const stage: PieceStage = !allDrawn ? 'drawing' : !piece.done ? 'finished' : shown ? 'shown' : 'alive'
  const stepKey = subject ? `${subject.id}:${piece.step}` : ''

  // ----- speech ------------------------------------------------------------------------------------
  const markInteracted = () => {
    welcomeTriggered.current = true
  }
  const speak = useCallback(
    (line: string) => {
      audio.cancelCurrentAudio()
      void audio.speak(line).catch(() => {})
    },
    [audio],
  )

  // The welcome (on the grid) — or, on a deep link straight into a subject, the current step's line.
  useEffect(() => {
    if (!audio.isAudioReady || welcomeTriggered.current) return
    welcomeTriggered.current = true
    if (current) speak(current.line)
    else void audio.playGameWelcome('kreaguide').catch(() => {})
  }, [audio, audio.isAudioReady, current, speak])

  // ----- the stall hint ----------------------------------------------------------------------------
  const armStall = useCallback(() => {
    cancel('stall')
    if (!current) return
    later('stall', STALL_MS, () => {
      if (!mounted.current) return
      setHint(true)
      if (!hintSpoken.current) {
        hintSpoken.current = true
        speak(current.line)
      }
    })
  }, [current, speak])

  // A new step: fresh hint state, the demo pencil at Let, and the stall clock.
  useEffect(() => {
    setHint(false)
    hintSpoken.current = false
    setDemoKey(current && tuning.demo ? `${stepKey}:${Date.now()}` : null)
    armStall()
    return () => cancel('stall')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, tuning.demo])

  // ----- session-only resume (§4.6) ----------------------------------------------------------------
  useEffect(() => {
    if (!subjectId) return
    later('save', SAVE_DEBOUNCE_MS, () => {
      if (piece.drawing.strokes.length || piece.done) savePiece(subjectId, piece)
      else kreaSession.clearItem(GAME_ID, subjectId)
    })
  }, [piece, subjectId])

  // ----- the grid ----------------------------------------------------------------------------------
  const openSubject = (id: string) => {
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-paper')
    const p = loadPiece(id) ?? freshPiece()
    setPiece(p)
    setShown(p.done)
    setSubjectId(id)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('motiv', id)
      return n
    }, { replace: true })
    const s = subjectById(id)
    const st = s && !p.done && p.step < s.steps.length ? s.steps[p.step] : null
    if (st) speak(st.line)
  }

  const toPicker = () => {
    markInteracted()
    sfx.play('tap')
    audio.cancelCurrentAudio()
    setSubjectId(null)
    setConfirmOpen(false)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('motiv')
      return n
    }, { replace: true })
  }

  // ----- drawing -----------------------------------------------------------------------------------
  // A finished piece is shown, not drawn on: the dance and "next" follow the done ✓.
  const drawingEnabled = !confirmOpen && !busy && !piece.done

  const onCommit = useCallback(
    (s: Stroke) => {
      setPiece((p) => {
        const drawing = addStroke(p.drawing, s)
        const sub = subjectById(subjectId)
        if (!sub || p.done || p.step >= sub.steps.length) return { ...p, drawing }
        const step = sub.steps[p.step]
        const ink = drawing.strokes.slice(p.start).flatMap((x) => (x.tool === 'stamp' || x.tool === 'eraser' ? [] : [x.points]))
        const w = paperRef.current?.getBoundingClientRect().width ?? 0
        const verdict = judgeStep(step, ink, toleranceInPaper(tuning.tolerancePx, w))
        // Three strokes in a row far from the guide: they stay on the paper but don't count — show the
        // way again (demo pencil + pulse + the step's line) instead of waving the step through.
        if (verdict.help) helpWanted.current = true
        if (!verdict.passed) return { ...p, drawing }
        return { ...p, drawing, step: p.step + 1, start: drawing.strokes.length, starts: [...p.starts, p.start] }
      })
    },
    [subjectId, tuning.tolerancePx],
  )

  // A passed step: the soft twinkle, and the next step's line (never awaited — the coverage rule drives
  // the advance, the line is fire-and-forget).
  const lastStep = useRef<string>('')
  useEffect(() => {
    if (!subject) return
    const key = `${subject.id}:${piece.step}`
    const prev = lastStep.current
    lastStep.current = key
    if (!prev.startsWith(`${subject.id}:`) || prev === key) return
    if (Number(prev.split(':')[1]) !== piece.step - 1) return
    sfx.play('krea-twinkle')
    if (current) speak(current.line)
  }, [subject, piece.step, current, speak])

  const onStrokeStart = (t: Tool) => {
    markInteracted()
    audio.updateUserInteraction()
    cancel('stall')
    setHint(false)
    setDemoKey(null)
    if (t === 'rainbow') sfx.play('krea-shimmer')
  }
  const onStrokeEnd = () => {
    armStall()
  }

  // Help after far strokes (`judgeStep`'s `help`), raised from the commit and acted on here — the state
  // updater may run twice under StrictMode, so it only sets a flag.
  const helpWanted = useRef(false)
  useEffect(() => {
    if (!helpWanted.current || !current) return
    helpWanted.current = false
    setDemoKey(`${stepKey}:help:${Date.now()}`)
    setHint(true)
    speak(current.line)
  }, [piece, current, stepKey, speak])

  // Picking a crayon SAYS ITS NAME (a Farver lesson for free); fire-and-forget, a fast child's earlier
  // names are cancelled (one audio at a time).
  const pickColor = (c: CrayonColor) => {
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-pick')
    setColor(c)
    setTool('crayon')
    speak(KREA_COLOR_NAME[c])
  }
  // The one tool here is the crayon; tapping it keeps whichever crayon is in hand (colour or rainbow).
  const pickTool = () => {
    markInteracted()
    sfx.play('tap')
  }

  const pickRainbow = () => {
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-shimmer')
    setTool('rainbow')
    speak(KREA_RAINBOW_NAME)
  }

  // Undo reaches back only to the start of the current step: a passed step stays passed.
  // Undo takes back the LAST LINE, always — also the one that finished a step: the step then goes back
  // with it (its guide returns). Only a finished, shown piece can't be undone.
  const canUndoStep = !piece.done && (piece.drawing.strokes.length > piece.start || piece.starts.length > 0)
  const doUndo = () => {
    markInteracted()
    sfx.play('krea-undo')
    setPiece((p) => undoPiece(p))
  }

  // ----- "Nyt papir?" — start this subject over (unfinished work only) ----------------------------
  const askNewPaper = () => {
    markInteracted()
    sfx.play('tap')
    setConfirmOpen(true)
    speak(NEW_PAPER_LINE)
  }
  const confirmFresh = () => {
    audio.cancelCurrentAudio()
    setConfirmOpen(false)
    sfx.play('krea-paper')
    if (subjectId) kreaSession.clearItem(GAME_ID, subjectId)
    setBusy(true)
    void swapPaper(paperRef.current, reduce, () => {
      setPiece(freshPiece())
      lastStep.current = ''
    }).then(() => {
      if (!mounted.current) return
      setBusy(false)
      const first = subject?.steps[0]
      if (first) speak(first.line)
    })
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- done → comes alive → XP → next (§2.2.9, §4.5) ----------------------------------------------
  const onDone = () => {
    if (!subject || stage !== 'finished') return
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-tada')
    setHint(false)
    // XP on the press, not after the dance: leaving mid-dance must not lose the piece's reward. The
    // CEREMONY still waits for the seam after the alive moment.
    run.completeTask(true)
    setPiece((p) => ({ ...p, done: true }))
    setShown(false)
    speak(subject.doneLine)
    void playAlive(pictureRef.current, subject.alive, reduce).then(() => {
      if (!mounted.current) return
      run.thenContinue(() => {
        if (mounted.current) setShown(true)
      })
    })
  }

  const onNext = () => {
    if (subjectId) kreaSession.clearItem(GAME_ID, subjectId)
    toPicker()
  }

  // ----- render ------------------------------------------------------------------------------------
  if (!subject) {
    return (
      <GameShell categoryId="krea" title="Tegn med Mig" dense guide={false} lightScene inlineTitle>
        <StudioBackdrop />
        <KreaPicker
          items={KREA_SUBJECTS.map((s) => ({ id: s.id, label: s.name, picture: <SubjectCard subject={s} drawing={loadPiece(s.id)?.drawing ?? null} /> }))}
          onPick={openSubject}
        />
      </GameShell>
    )
  }

  const crayonInHand = tool === 'crayon' || tool === 'rainbow'
  return (
    <GameShell categoryId="krea" title="Tegn med Mig" dense guide={false} lightScene inlineTitle>
      <StudioBackdrop />
      <PieceStudio
        landscape={landscape}
        tools={
          // The same left column as Fri Tegning: tools only — here the crayon (in hand) and undo.
          <ToolRow tool={tool} color={color} available={['crayon']} onTool={pickTool} onUndo={doUndo} canUndo={canUndoStep} disabled={!drawingEnabled} direction={landscape ? 'column' : 'row'} />
        }
        paper={
          <Paper paperRef={paperRef}>
            <Box data-krea-step={piece.step} data-krea-steps={steps.length} data-krea-piece={stage} sx={{ position: 'absolute', inset: 0 }}>
              <GuideLayer step={current} stepKey={stepKey} hint={hint} reduce={reduce} />
              <Box ref={pictureRef} data-krea-picture sx={{ position: 'absolute', inset: 0 }}>
                <DrawingSurface
                  drawing={piece.drawing}
                  tool={tool}
                  color={color}
                  stamp={null}
                  stampUrls={{}}
                  disabled={!drawingEnabled}
                  mirrorX={current?.mirror ? subjectXToPaper(MIRROR_AXIS) : undefined}
                  onCommit={onCommit}
                  onStrokeStart={onStrokeStart}
                  onStrokeEnd={onStrokeEnd}
                />
              </Box>
              {/* The demo runs at every step at Let, and at any level as HELP after three far strokes. */}
              {demoKey && <DemoPencil step={current} runKey={demoKey} reduce={reduce} />}
            </Box>
          </Paper>
        }
        side={
          <>
            <PieceWayOn
              stage={stage}
              hasInk={piece.drawing.strokes.length > 0}
              disabled={confirmOpen || busy}
              reduce={reduce}
              onNewPaper={askNewPaper}
              onDone={onDone}
              onNext={onNext}
            />
            <PickerButton gameId={GAME_ID} disabled={confirmOpen || busy} onPress={toPicker} />
          </>
        }
        palette={
          <Box aria-hidden={!crayonInHand || piece.done} sx={{ visibility: crayonInHand && !piece.done ? 'visible' : 'hidden' }}>
            <CrayonPalette colors={palette} color={color} inHand={tool === 'crayon' || tool === 'rainbow' ? tool : null} disabled={!drawingEnabled} onPick={pickColor} onPickRainbow={pickRainbow} />
          </Box>
        }
      />
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} keepPicture="krea.guide" />
    </GameShell>
  )
}

export default TegnMedMigGame
