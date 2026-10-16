import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { KREA_COLOR_NAME, KREA_RAINBOW_NAME, NEW_PAPER_LINE } from '../../config/kreaPhrases'
import { PHONE_PORTRAIT } from '../../theme/phoneMedia'
import DrawingSurface from './canvas/DrawingSurface'
import {
  addStroke,
  canUndo,
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
import { swapPaper } from './studio/alive'

// Fri Tegning (`krea.draw`, Krea PRD-01 §2.2) — a free canvas: crayon, rainbow, stamps (a star among them), eraser,
// undo, and a fresh sheet. The vertical slice that sets the bar for Tegn med Mig and Farvelæg.
//
// IT EARNS NOTHING (§2.1.2). Lepper, Greene & Nisbett 1973 ran this exact setup on preschoolers with
// markers: an expected award made them draw LESS in free play afterwards. So there is no `useTaskRun`
// here, no XP, no ring movement — `kreaPhrases.test.ts` fails the build if one appears.
//
// There is NO finish line either (owner, 2026-10-16): the done ✓, the "comes alive" dance, the ta-da,
// the "Du har brugt {n} farver" line and the "next" button were all removed. A free canvas is never
// done; "Nyt papir" (upper right) is the one way on, through the spoken "Nyt papir?" confirm, and the
// old sheet visibly slides away. Tegn med Mig and Farvelæg keep their finish — those pieces end.
//
// The piece survives for the session only (`kreaSession`): a reload or a trip to the menu resumes it.

const GAME_ID = 'krea.draw'
const ITEM_ID = 'paper'
const SAVE_DEBOUNCE_MS = 500

const FriTegningGame: React.FC = () => {
  useOccludeWorld()
  const reduce = useReducedMotion()
  // The studio is a table seen from above, so the tools lie on it wherever they go. On a wide screen they
  // stand in a column beside the paper and the paper gets the height (a row under it cost ~35% of its
  // area in landscape); on a tall screen they lie in rows under it.
  const landscape = useMediaQuery('(orientation: landscape)')
  const audio = useSimplifiedAudioHook({ componentId: 'FriTegningGame', autoInitialize: false })
  const level = useDifficulty('krea')
  const palette = paletteFor(KREA_PALETTE[level].palette)

  const [drawing, setDrawing] = useState<Drawing>(() => deserialise(kreaSession.load(GAME_ID, ITEM_ID), STAMP_IDS) ?? emptyDrawing())
  const [tool, setTool] = useState<Tool>('crayon')
  const [color, setColor] = useState<CrayonColor>('roed')
  const [stamp, setStamp] = useState<string>(STAMPS[0].id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // A fresh sheet is sliding in (`swapPaper`): input waits for it.
  const [swapping, setSwapping] = useState(false)

  const paperRef = useRef<HTMLDivElement>(null)
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
  const drawingEnabled = !confirmOpen && !swapping

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

  // The crayon in hand is a colour OR the rainbow; tapping the crayon tool picks it back up, whichever
  // it was (the rainbow is a variant in the crayon row now, not a tool of its own).
  const [rainbowInHand, setRainbowInHand] = useState(false)
  const pickTool = (t: Tool) => {
    markInteracted()
    sfx.play('tap')
    setTool(t === 'crayon' && rainbowInHand ? 'rainbow' : t)
  }

  // Picking a crayon SAYS ITS NAME — every choice becomes a Farver lesson for free. Fire-and-forget: a
  // fast child picking four in a row cancels the earlier names (one audio at a time), which is right.
  const pickColor = (c: CrayonColor) => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-pick')
    setColor(c)
    setRainbowInHand(false)
    setTool('crayon')
    void audio.speak(KREA_COLOR_NAME[c]).catch(() => {})
  }

  const pickRainbow = () => {
    markInteracted()
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    sfx.play('krea-shimmer')
    setRainbowInHand(true)
    setTool('rainbow')
    void audio.speak(KREA_RAINBOW_NAME).catch(() => {})
  }

  const doUndo = () => {
    markInteracted()
    sfx.play('krea-undo')
    setDrawing((d) => undo(d))
  }

  const freshPaper = () => {
    sfx.play('krea-paper')
    kreaSession.clearItem(GAME_ID, ITEM_ID)
    setSwapping(true)
    void swapPaper(paperRef.current, reduce, () => {
      setDrawing(emptyDrawing())
      setTool(rainbowInHand ? 'rainbow' : 'crayon')
    }).then(() => setSwapping(false))
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

  const ink = hasInk(drawing)
  const crayonInHand = tool === 'crayon' || tool === 'rainbow'

  const side = (
    <Box
      sx={{
        gridArea: 'side',
        display: 'flex',
        flexDirection: landscape ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(8px, 2vmin, 16px)',
        minHeight: 0,
        minWidth: `calc(${BTN} * 1.5)`,
        [PHONE_PORTRAIT]: { minWidth: 0, px: 1 },
      }}
    >
      <Box sx={{ visibility: ink ? 'visible' : 'hidden' }}>
        <StudioButton dataId="new-paper" label="Nyt papir" size={`calc(${BTN} * 1.4)`} disabled={!drawingEnabled || !ink} onPress={askNewPaper}>
          <PICTURES.NewPaper />
        </StudioButton>
      </Box>
    </Box>
  )

  return (
    <GameShell categoryId="krea" title="Fri Tegning" backRoute="/krea" dense guide={false} lightScene>
      <StudioBackdrop />
      <Box
        data-krea-stage
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 'clamp(8px, 2vmin, 18px)',
          // Reserved space, never a tuned percentage: the tools and the side pair take what they need and
          // the paper is the remainder (layout-contract.md).
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gridTemplateRows: 'minmax(0, 1fr) auto auto',
          gridTemplateAreas: '"paper paper" "tools side" "pal pal"',
          '@media (orientation: landscape)': {
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gridTemplateRows: 'minmax(0, 1fr) auto',
            gridTemplateAreas: '"tools paper side" "pal pal pal"',
          },
          // A phone in portrait can't fit six tools AND the side pair on one 343 px row (measured: the
          // row hung 20 px off the left edge), so "Nyt papir" gets its own row.
          [PHONE_PORTRAIT]: {
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, 1fr) auto auto auto',
            gridTemplateAreas: '"paper" "side" "tools" "pal"',
          },
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <Box sx={{ gridArea: 'tools', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <ToolRow tool={tool} color={color} stampSrc={STAMP_URLS[stamp]} onTool={pickTool} onUndo={doUndo} canUndo={canUndo(drawing)} disabled={!drawingEnabled} direction={landscape ? 'column' : 'row'} />
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
        </Paper>
        {side}
        {/* The VARIANT row: the crayons for the crayon, the stamps for the stamp tool, and NOTHING for a
            tool with no variants (the eraser) — a row of crayons that does nothing for the eraser
            read as "pick one" (owner, 2026-10-16). Both trays are stacked in ONE grid cell and only
            hidden, never removed, so the row keeps its height and the paper never jumps size. */}
        <Box data-krea-variants={crayonInHand ? 'crayons' : tool === 'stamp' ? 'stamps' : 'none'} sx={{ gridArea: 'pal', display: 'grid', justifyItems: 'center', alignItems: 'end', '& > *': { gridArea: '1 / 1' } }}>
          <Box aria-hidden={!crayonInHand} sx={{ visibility: crayonInHand ? 'visible' : 'hidden' }}>
            <CrayonPalette colors={palette} color={color} inHand={tool === 'crayon' || tool === 'rainbow' ? tool : null} disabled={!drawingEnabled || !crayonInHand} onPick={pickColor} onPickRainbow={pickRainbow} />
          </Box>
          <Box aria-hidden={tool !== 'stamp'} sx={{ visibility: tool === 'stamp' ? 'visible' : 'hidden' }}>
            <StampTray stamps={STAMPS} stamp={stamp} disabled={!drawingEnabled || tool !== 'stamp'} onPick={(id) => { markInteracted(); sfx.play('tap'); setStamp(id) }} />
          </Box>
        </Box>
      </Box>
      <NewPaperConfirm open={confirmOpen} onFresh={confirmFresh} onKeep={confirmKeep} />
    </GameShell>
  )
}

export default FriTegningGame
