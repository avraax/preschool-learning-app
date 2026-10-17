import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { reportKreaFinished } from '../../services/usagePing'
import { KREA_PALETTE } from '../../config/difficulty'
import { paletteFor } from '../../config/kreaPalette'
import { KREA_COLOR_NAME, NEW_PAPER_LINE } from '../../config/kreaPhrases'
import { KREA_PAGES, pageById } from '../../config/kreaPages'
import { KREA_TASKS_IN_ROUND } from '../../config/kreaSubjects'
import { PAGE_REGIONS } from '../../config/kreaPageRegions'
import { PAGE_ART } from '../../assets/games/krea/pages'
import FillSurface from './canvas/FillSurface'
import { CRAYON_HEX } from './canvas/brushes'
import { allFilled, decodeLabels, deserialiseFills, fillsOf, serialiseFills, unfilled, type FillAction } from './canvas/regionFill'
import type { CrayonColor, Tool } from './canvas/strokeModel'
import { StudioBackdrop, Paper } from './studio/StudioScene'
import { CrayonPalette, ToolRow } from './studio/StudioControls'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { playAlive, swapPaper } from './studio/alive'
import { KreaPicker } from './studio/KreaPicker'
import { PickerButton, PieceStudio, PieceWayOn, type PieceStage } from './studio/PieceStudio'

// Farvelæg (`krea.color`, Krea PRD-01 §2.2.8, §4.4) — pick a page from a picture grid, then TAP a region
// to fill it with the crayon in hand. A tap never leaks: the regions were labelled once by
// `scripts/krea-regions.mjs`, and a tap paints exactly one of them. The eraser (tap) clears a region,
// undo takes back the last fill.
//
// A page FINISHES when every region has a colour — any colour counts, white too (§2.2.9). Then the done
// ✓ appears; done → the picture comes alive with its describing line, one task of XP, the ceremony at
// the seam if a slot was crossed, and "next" → back to the grid. With ≤ 3 regions left and 6 s idle the
// waiting regions pulse softly — the last-region problem (§4.4), not a judgement.
//
// The level touches only the palette (8 / 12) — `EXEMPT` in difficulty.ts. Session-only resume per page.

const GAME_ID = 'krea.color'
const SAVE_DEBOUNCE_MS = 500
const PULSE_IDLE_MS = 6000
const PULSE_MAX_LEFT = 3

interface Piece {
  actions: FillAction[]
  done: boolean
}

const freshPiece = (): Piece => ({ actions: [], done: false })

function loadPiece(id: string): Piece | null {
  const raw = kreaSession.load(GAME_ID, id)
  const info = PAGE_REGIONS[id]
  if (!raw || !info) return null
  try {
    const p = JSON.parse(raw) as { f?: string; done?: boolean }
    const actions = deserialiseFills(p.f, info.count)
    return { actions, done: !!p.done && allFilled(actions, info.count) }
  } catch {
    return null
  }
}

const savePiece = (id: string, p: Piece) => kreaSession.save(GAME_ID, id, JSON.stringify({ f: serialiseFills(p.actions), done: p.done }))

/**
 * A page's grid card: its line art, with the child's fills if the page is in progress — painted once
 * into a small canvas from the label map, then the full-size decode is dropped.
 */
const PageCard: React.FC<{ id: string; actions: FillAction[] | null }> = ({ id, actions }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const art = PAGE_ART[id]
  const info = PAGE_REGIONS[id]
  useEffect(() => {
    const cv = ref.current
    if (!cv || !actions?.length || !info) return
    let live = true
    const img = new Image()
    img.onload = () => {
      if (!live) return
      const big = document.createElement('canvas')
      big.width = info.w
      big.height = info.h
      const g = big.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0)
      const lab = decodeLabels(g.getImageData(0, 0, info.w, info.h).data)
      const out = g.createImageData(info.w, info.h)
      const fills = fillsOf(actions)
      const rgb = new Map([...fills].map(([r, c]) => [r, CRAYON_HEX[c]]))
      for (let i = 0; i < lab.length; i++) {
        const hex = rgb.get(lab[i])
        if (!hex) continue
        out.data[i * 4] = parseInt(hex.slice(1, 3), 16)
        out.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16)
        out.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16)
        out.data[i * 4 + 3] = 255
      }
      g.putImageData(out, 0, 0)
      const s = cv.getContext('2d')!
      s.clearRect(0, 0, cv.width, cv.height)
      s.drawImage(big, 0, 0, cv.width, cv.height)
      big.width = 0
      big.height = 0
    }
    img.src = art.regions
    return () => {
      live = false
    }
  }, [actions, art, info])
  return (
    <Box sx={{ position: 'absolute', inset: '5%', '& > *': { position: 'absolute', inset: 0, width: '100%', height: '100%' } }}>
      {actions?.length ? <canvas ref={ref} width={192} height={192} /> : null}
      <Box component="img" src={art.line} alt="" draggable={false} sx={{ pointerEvents: 'none' }} />
    </Box>
  )
}

const FarvelaegGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  const landscape = useMediaQuery('(orientation: landscape)')
  const audio = useSimplifiedAudioHook({ componentId: 'FarvelaegGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const palette = paletteFor(KREA_PALETTE[level].palette)
  const run = useTaskRun({ tasksInRound: KREA_TASKS_IN_ROUND, gameId: GAME_ID })

  const [params, setParams] = useSearchParams()
  const [pageId, setPageId] = useState<string | null>(() => pageById(params.get('motiv'))?.id ?? null)
  const page = pageById(pageId)
  const info = pageId ? PAGE_REGIONS[pageId] : undefined
  const [piece, setPiece] = useState<Piece>(() => (pageId ? loadPiece(pageId) : null) ?? freshPiece())
  const [tool, setTool] = useState<'crayon' | 'eraser'>('crayon')
  const [color, setColor] = useState<CrayonColor>('roed')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)
  const [pulse, setPulse] = useState<number[] | null>(null)

  const paperRef = useRef<HTMLDivElement>(null)
  const pictureRef = useRef<HTMLDivElement>(null)
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
      for (const t of Object.values(pending)) if (t) clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!palette.includes(color)) setColor(palette[0])
  }, [palette, color])

  const count = info?.count ?? 0
  const complete = !!info && allFilled(piece.actions, count)
  const stage: PieceStage = !complete ? 'drawing' : !piece.done ? 'finished' : shown ? 'shown' : 'alive'

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

  useEffect(() => {
    if (!audio.isAudioReady || welcomeTriggered.current) return
    welcomeTriggered.current = true
    void audio.playGameWelcome('kreacolor').catch(() => {})
  }, [audio, audio.isAudioReady])

  // ----- the last-region hint: ≤ 3 waiting + 6 s idle → they pulse; any press clears it --------------
  useEffect(() => {
    setPulse(null)
    if (!info || piece.done) return
    const left = unfilled(piece.actions, count)
    if (!left.length || left.length > PULSE_MAX_LEFT) return
    later('pulse', PULSE_IDLE_MS, () => {
      if (mounted.current) setPulse(left)
    })
    const pending = timers.current
    return () => {
      if (pending.pulse) clearTimeout(pending.pulse)
      pending.pulse = null
    }
  }, [piece, info, count])

  // ----- session-only resume (§4.6) ----------------------------------------------------------------
  useEffect(() => {
    if (!pageId) return
    later('save', SAVE_DEBOUNCE_MS, () => {
      if (piece.actions.length || piece.done) savePiece(pageId, piece)
      else kreaSession.clearItem(GAME_ID, pageId)
    })
  }, [piece, pageId])

  // ----- the grid ----------------------------------------------------------------------------------
  const openPage = (id: string) => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-paper')
    const p = loadPiece(id) ?? freshPiece()
    setPiece(p)
    setShown(p.done)
    setPageId(id)
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
    setPageId(null)
    setConfirmOpen(false)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('motiv')
      return n
    }, { replace: true })
  }

  // ----- colouring ---------------------------------------------------------------------------------
  const enabled = !confirmOpen && !busy && !piece.done

  const onTap = (id: number) => {
    markInteracted()
    audio.updateUserInteraction()
    setPulse(null)
    if (!id) {
      sfx.play('tap')
      return
    }
    const c = tool === 'eraser' ? null : color
    // A fill that changes nothing (same colour again, or erasing an empty region) is felt, not stored.
    if ((fillsOf(piece.actions).get(id) ?? null) === c) {
      sfx.play('tap')
      return
    }
    sfx.play(c ? 'krea-fill' : 'krea-undo')
    setPiece((p) => ({ ...p, actions: [...p.actions, [id, c]] }))
  }

  const pickColor = (c: CrayonColor) => {
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-pick')
    setColor(c)
    setTool('crayon')
    speak(KREA_COLOR_NAME[c])
  }
  // Same as Fri Tegning: a tap on a tool picks THAT tool (no toggling), and the crayon row follows it.
  const pickTool = (t: Tool) => {
    markInteracted()
    sfx.play('tap')
    if (t === 'crayon' || t === 'eraser') setTool(t)
  }

  const doUndo = () => {
    markInteracted()
    sfx.play('krea-undo')
    setPiece((p) => (p.actions.length && !p.done ? { ...p, actions: p.actions.slice(0, -1) } : p))
  }

  // ----- "Nyt papir?" — start this page over --------------------------------------------------------
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
    if (pageId) kreaSession.clearItem(GAME_ID, pageId)
    setBusy(true)
    void swapPaper(paperRef.current, reduce, () => setPiece(freshPiece())).then(() => {
      if (mounted.current) setBusy(false)
    })
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- done → comes alive → XP → next ------------------------------------------------------------
  const onDone = () => {
    if (!page || stage !== 'finished') return
    markInteracted()
    audio.updateUserInteraction()
    sfx.play('krea-tada')
    setPulse(null)
    // XP on the press (leaving mid-dance must not lose it); the CEREMONY waits for the seam after it.
    run.completeTask(true)
    reportKreaFinished('color')
    setPiece((p) => ({ ...p, done: true }))
    setShown(false)
    speak(page.doneLine)
    void playAlive(pictureRef.current, page.alive, reduce).then(() => {
      if (!mounted.current) return
      run.thenContinue(() => {
        if (mounted.current) setShown(true)
      })
    })
  }

  const onNext = () => {
    if (pageId) kreaSession.clearItem(GAME_ID, pageId)
    toPicker()
  }

  // ----- render ------------------------------------------------------------------------------------
  if (!page || !info) {
    return (
      <GameShell categoryId="krea" title="Farvelæg" dense guide={false} lightScene inlineTitle>
        <StudioBackdrop />
        <KreaPicker items={KREA_PAGES.map((p) => ({ id: p.id, label: p.name, picture: <PageCard id={p.id} actions={loadPiece(p.id)?.actions ?? null} /> }))} onPick={openPage} />
      </GameShell>
    )
  }

  return (
    <GameShell categoryId="krea" title="Farvelæg" dense guide={false} lightScene inlineTitle onBackWithin={toPicker}>
      <StudioBackdrop />
      <PieceStudio
        landscape={landscape}
        tools={
          // The same left column as Fri Tegning: the crayon (in hand), the eraser and undo — and, as there,
          // the crayon row shows only while the crayon is picked (empty for the eraser).
          <ToolRow tool={tool} color={color} available={['crayon', 'eraser']} onTool={pickTool} onUndo={doUndo} canUndo={piece.actions.length > 0} disabled={!enabled} direction={landscape ? 'column' : 'row'} />
        }
        paper={
          <Paper paperRef={paperRef} aspect={1}>
            <Box data-krea-page={page.id} data-krea-regions={count} data-krea-piece={stage} sx={{ position: 'absolute', inset: 0 }}>
              <Box ref={pictureRef} data-krea-picture sx={{ position: 'absolute', inset: 0 }}>
                <FillSurface art={PAGE_ART[page.id]} info={info} actions={piece.actions} disabled={!enabled} pulse={pulse} reduce={reduce} onTap={onTap} />
              </Box>
            </Box>
          </Paper>
        }
        side={
          <>
            <PickerButton gameId={GAME_ID} disabled={confirmOpen || busy} onPress={toPicker} />
            <PieceWayOn stage={stage} hasInk={piece.actions.length > 0} disabled={confirmOpen || busy} reduce={reduce} onNewPaper={askNewPaper} onDone={onDone} onNext={onNext} />
          </>
        }
        palette={
          <Box aria-hidden={tool !== 'crayon' || piece.done} sx={{ visibility: tool === 'crayon' && !piece.done ? 'visible' : 'hidden' }}>
            <CrayonPalette colors={palette} color={color} inHand={tool === 'crayon' ? 'crayon' : null} disabled={!enabled} onPick={pickColor} />
          </Box>
        }
      />
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} keepPicture="krea.color" keepContent={<PageCard id={page.id} actions={piece.actions} />} />
    </GameShell>
  )
}

export default FarvelaegGame
