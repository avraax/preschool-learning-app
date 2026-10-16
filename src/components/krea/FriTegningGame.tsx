import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import GameShell from '../common/GameShell'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useDifficulty } from '../../hooks/useDifficulty'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { sfx } from '../../services/sfxClient'
import { kreaSession } from '../../services/kreaSession'
import { KREA_PALETTE } from '../../config/difficulty'
import { paletteFor } from '../../config/kreaPalette'
import { KREA_COLOR_NAME, NEW_PAPER_LINE, colorsUsedLine } from '../../config/kreaPhrases'
import { hintPulse } from '../../theme/idleMotion'
import { DEV } from '../../utils/devHarness'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import DrawingSurface from './canvas/DrawingSurface'
import {
  addStroke,
  canUndo,
  colorsUsed,
  deserialise,
  emptyDrawing,
  hasInk,
  serialise,
  undo,
  type CrayonColor,
  type Drawing,
  type Stroke,
  type Tool,
} from './canvas/strokeModel'
import { StudioBackdrop, Paper } from './studio/StudioScene'
import { BTN, CrayonPalette, PICTURES, StampTray, StudioButton, ToolRow } from './studio/StudioControls'
import NewPaperConfirm from './studio/NewPaperConfirm'
import { STAMPS, STAMP_IDS, STAMP_URLS } from './studio/stamps'
import { ALIVE_MS, playAlive } from './studio/alive'

// Fri Tegning (`krea.draw`, Krea PRD-01 §2.2) — a free canvas: crayon, rainbow, glitter, stamps, eraser,
// undo, and a fresh sheet. The vertical slice that sets the bar for Tegn med Mig and Farvelæg.
//
// IT EARNS NOTHING (§2.1.2). Lepper, Greene & Nisbett 1973 ran this exact setup on preschoolers with
// markers: an expected award made them draw LESS in free play afterwards. So there is no `useTaskRun`
// here, no XP, no ring movement — `kreaPhrases.test.ts` fails the build if one appears. The reward is
// the picture coming alive, plus ONE line that describes it ("Du har brugt fire farver!").
//
// Flow: draw → done (appears once there is ink) → the picture sways with a "ta-da" and the line → it
// stays on the paper to admire, and a big "next" gives a fresh sheet (no confirm: the child said they
// were finished). Throwing away UNFINISHED work goes through the spoken "Nyt papir?" confirm.
//
// The piece survives for the session only (`kreaSession`): a reload or a trip to the menu resumes it.

const GAME_ID = 'krea.draw'
const ITEM_ID = 'paper'
const SAVE_DEBOUNCE_MS = 500

type Phase = 'drawing' | 'alive' | 'admire'

const FriTegningGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  // A phone on its side is the one place the paper must win over "everything lies on the table": with
  // two rows under it the paper was 252×189 at 844×390, so there the tools stand in columns beside it.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE)
  const audio = useSimplifiedAudioHook({ componentId: 'FriTegningGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const palette = paletteFor(KREA_PALETTE[level].palette)

  const [drawing, setDrawing] = useState<Drawing>(() => deserialise(kreaSession.load(GAME_ID, ITEM_ID), STAMP_IDS) ?? emptyDrawing())
  const [tool, setTool] = useState<Tool>('crayon')
  const [color, setColor] = useState<CrayonColor>('roed')
  const [stamp, setStamp] = useState<string>(STAMPS[0].id)
  const [phase, setPhase] = useState<Phase>('drawing')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const paperRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
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

  // Unmount hygiene: every timer, and the scratch loop, in their own empty-dep effect.
  useEffect(
    () => () => {
      for (const t of Object.values(timers.current)) if (t) clearTimeout(t)
      sfx.stopLoop('krea-crayon', 0)
    },
    [],
  )

  // A level change can take the chosen crayon off the table (12 → 8): fall back to the first one.
  useEffect(() => {
    if (!palette.includes(color)) setColor(palette[0])
  }, [palette, color])

  // ----- the welcome -------------------------------------------------------------------------------
  // The first stroke ends the welcome's chance to play — audio only unlocks on a gesture, so on a cold
  // deep link it would otherwise speak the title over the child's first line (Fyld Båden's lesson).
  const markInteracted = () => {
    welcomeTriggered.current = true
  }
  const playWelcome = useCallback(() => {
    if (welcomeTriggered.current) return
    welcomeTriggered.current = true
    void audio.playGameWelcome('kreadraw').catch(() => {})
  }, [audio])
  useEffect(() => {
    if (audio.isAudioReady) playWelcome()
  }, [audio.isAudioReady, playWelcome])

  // ----- session-only resume (§4.6) ----------------------------------------------------------------
  useEffect(() => {
    later('save', SAVE_DEBOUNCE_MS, () => {
      if (drawing.strokes.length) kreaSession.save(GAME_ID, ITEM_ID, serialise(drawing))
      else kreaSession.clearItem(GAME_ID, ITEM_ID)
    })
  }, [drawing])

  // ----- drawing -----------------------------------------------------------------------------------
  const drawingEnabled = phase === 'drawing' && !confirmOpen

  const onCommit = useCallback((s: Stroke) => setDrawing((d) => addStroke(d, s)), [])

  const onStrokeStart = (t: Tool) => {
    markInteracted()
    audio.updateUserInteraction()
    if (t === 'stamp') sfx.play('krea-stamp')
    else if (t === 'glitter') sfx.play('krea-twinkle')
    else {
      if (t === 'rainbow') sfx.play('krea-shimmer')
      sfx.startLoop('krea-crayon', 60)
    }
  }
  const onStrokeEnd = (t: Tool) => {
    if (t !== 'stamp' && t !== 'glitter') sfx.stopLoop('krea-crayon', 120)
  }

  const pickTool = (t: Tool) => {
    markInteracted()
    sfx.play('tap')
    setTool(t)
  }

  // Picking a crayon SAYS ITS NAME — every choice becomes a Farver lesson for free. Fire-and-forget: a
  // fast child picking four in a row cancels the earlier names (one audio at a time), which is right.
  const pickColor = (c: CrayonColor) => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-pick')
    setColor(c)
    setTool('crayon')
    void audio.speak(KREA_COLOR_NAME[c]).catch(() => {})
  }

  const doUndo = () => {
    markInteracted()
    sfx.play('krea-undo')
    setDrawing((d) => undo(d))
  }

  const freshPaper = () => {
    sfx.play('krea-paper')
    kreaSession.clearItem(GAME_ID, ITEM_ID)
    setDrawing(emptyDrawing())
    setTool('crayon')
    setPhase('drawing')
  }

  // ----- "Nyt papir?" (unfinished work only) -------------------------------------------------------
  const askNewPaper = () => {
    markInteracted()
    sfx.play('tap')
    setConfirmOpen(true)
    audio.cancelCurrentAudio()
    void audio.speak(NEW_PAPER_LINE).catch(() => {})
  }
  const confirmFresh = () => {
    audio.cancelCurrentAudio()
    setConfirmOpen(false)
    freshPaper()
  }
  const confirmKeep = () => {
    audio.cancelCurrentAudio()
    sfx.play('tap')
    setConfirmOpen(false)
  }

  // ----- done → comes alive → admire → next --------------------------------------------------------
  const done = () => {
    if (phase !== 'drawing') return
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    setPhase('alive')
    sfx.play('krea-tada')
    void playAlive(reduce ? glowRef.current : paperRef.current, reduce ? 'glow' : 'sway')
    // One DESCRIBING line, never praise. Fire-and-forget; the admire beat is a fixed timer, not the clip.
    void audio.speak(colorsUsedLine(colorsUsed(drawing))).catch(() => {})
    later('admire', reduce ? ALIVE_MS.glow : ALIVE_MS.sway, () => setPhase('admire'))
  }

  const next = () => {
    markInteracted()
    audio.cancelCurrentAudio()
    freshPaper()
  }

  const ink = hasInk(drawing)
  const nextPulse = useMemo(() => hintPulse(reduce), [reduce])

  const side = (
    <Box
      sx={{
        gridArea: 'side',
        display: 'flex',
        flexDirection: phoneLandscape ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(8px, 2vmin, 16px)',
        minHeight: 0,
        minWidth: `calc(${BTN} * 1.5)`,
        [PHONE_PORTRAIT]: { minWidth: 0, px: 1 },
      }}
    >
      <Box sx={{ visibility: phase === 'drawing' && ink ? 'visible' : 'hidden' }}>
        <StudioButton dataId="new-paper" label="Nyt papir" disabled={!drawingEnabled || !ink} onPress={askNewPaper}>
          <PICTURES.Paper />
        </StudioButton>
      </Box>
      {phase === 'admire' ? (
        <Box {...nextPulse.props} sx={nextPulse.sx}>
          <StudioButton dataId="next" label="Videre" size={`calc(${BTN} * 1.5)`} onPress={next}>
            <PICTURES.Next />
          </StudioButton>
        </Box>
      ) : (
        <Box sx={{ visibility: phase === 'drawing' && ink ? 'visible' : 'hidden' }}>
          <StudioButton dataId="done" label="Færdig" size={`calc(${BTN} * 1.4)`} disabled={!drawingEnabled || !ink} onPress={done}>
            <PICTURES.Done />
          </StudioButton>
        </Box>
      )}
    </Box>
  )

  return (
    <GameShell categoryId="krea" title="Fri Tegning" backRoute="/krea" dense guide={false} lightScene>
      <StudioBackdrop />
      <Box
        data-krea-stage
        data-krea-phase={DEV ? phase : undefined}
        data-krea-colors={DEV ? colorsUsed(drawing) : undefined}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 'clamp(8px, 2vmin, 18px)',
          // Reserved space, never a tuned percentage: the tools and the side column take what they
          // need and the paper is the remainder (layout-contract.md).
          // Every tool LIES ON THE TABLE, in both orientations: paper above, then the tools and the
          // crayons in rows across the table top. A tool column beside the paper floated over the wall
          // and the window in landscape (owner review of the integrated art, 2026-10-16).
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gridTemplateRows: 'minmax(0, 1fr) auto auto',
          gridTemplateAreas: '"paper paper" "tools side" "pal pal"',
          // A phone in portrait can't fit six tools AND the side pair on one 343 px row (measured: the
          // row hung 20 px off the left edge), so "Nyt papir" and done get their own row.
          [PHONE_LANDSCAPE]: {
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gridTemplateRows: 'minmax(0, 1fr) auto',
            gridTemplateAreas: '"tools paper side" "pal pal pal"',
          },
          [PHONE_PORTRAIT]: {
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, 1fr) auto auto auto',
            gridTemplateAreas: '"paper" "side" "tools" "pal"',
          },
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <Box sx={{ gridArea: 'tools', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <ToolRow tool={tool} color={color} onTool={pickTool} onUndo={doUndo} canUndo={canUndo(drawing)} disabled={!drawingEnabled} direction={phoneLandscape ? 'column' : 'row'} />
        </Box>
        <Paper paperRef={paperRef}>
          <DrawingSurface
            drawing={drawing}
            tool={tool}
            color={color}
            stamp={stamp}
            stampUrls={STAMP_URLS}
            disabled={!drawingEnabled}
            onCommit={onCommit}
            onStrokeStart={onStrokeStart}
            onStrokeEnd={onStrokeEnd}
          />
          {/* Reduced motion's "alive": a warm glow that brightens and fades, nothing moves. */}
          <Box
            ref={glowRef}
            aria-hidden
            sx={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 40px 12px rgba(255,200,60,0.75)' }}
          />
        </Paper>
        {side}
        <Box sx={{ gridArea: 'pal', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: `calc(${BTN} * 1.25)` }}>
          {tool === 'stamp' ? (
            <StampTray stamps={STAMPS} stamp={stamp} disabled={!drawingEnabled} onPick={(id) => { markInteracted(); sfx.play('tap'); setStamp(id) }} />
          ) : (
            <CrayonPalette colors={palette} color={color} active={tool === 'crayon'} disabled={!drawingEnabled} onPick={pickColor} />
          )}
        </Box>
      </Box>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} />
    </GameShell>
  )
}

export default FriTegningGame
