import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { DndContext, DragEndEvent, DragStartEvent, MeasuringStrategy } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { useDragActive } from '../common/dnd/useDragActive'
import { wasWobbledTap } from '../common/dnd/dragActivation'
import GameShell from '../common/GameShell'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathRepeatButton } from '../common/RepeatButton'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useTaskRun } from '../../hooks/useTaskRun'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useDifficulty } from '../../hooks/useDifficulty'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { progressStore } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { boatCountText, boatLoadedText, fillBoatPrompt } from '../../config/gamePhrases'
import { BOAT_RECENT_WINDOW, pickBoatNumber } from '../../config/mathProblems'
import { MATH_BOAT } from '../../config/difficulty'
import { DWELL_CORRECT } from '../../theme/motion'
import { idleFloat } from '../../theme/idleMotion'
import { DEV } from '../../utils/devHarness'
import { useOccludeWorld } from '../common/scene/worldOcclusion'
import {
  BAY_SLOTS,
  EMPTY_DECK,
  deckValue,
  ghostFor,
  isDeckEmpty,
  loadDeck,
  unloadDeck,
  type CargoKind,
  type DeckState,
} from './boat/boatDeck'
import Boat, { type BundleFx } from './boat/Boat'
import { BOAT_LOOKS, boxColumns } from './boat/boatLooks'
import Quay from './boat/Quay'
import { HarbourBackdrop, HarbourFrontWater } from './boat/HarbourScene'

// Fyld Båden (`math.boat`, Harbour PRD-01) — hear "Fyld båden med {tal} fisk", BUILD it on a boat from
// boxes of ten fish and single fish, and blow the horn. The learning act IS the game action:
// "syvogtredive" needs three boxes and seven fish, so the inverted word has to be decoded to load at all, and
// the numeral appears on the sail only AFTER a correct send — word → quantity → symbol.
//
// Endless, live per-task XP (one task = one correct send), the ceremony at the seam after the boat sails
// out. A wrong send only breaks first-try: the narrator names what IS loaded, then re-asks the target;
// after two wrong sends the exact target load appears as ghost outlines (never-fail hint).
//
// Both gestures run ONE resolve path: `load(kind)` for a tap on a quay pile or a drag onto the deck,
// `unload(kind)` for a tap on a loaded item or a drag back to the quay (drag-and-drop.md).

type Phase = 'arriving' | 'loading' | 'sending' | 'sailing'

/**
 * Beat between naming a wrong load and re-asking the target — a fixed step, never an awaited clip.
 * Measured (ffmpeg silencedetect): the longest "Der er … fisk" ends speaking at 1.53s, plus ~0.25s for
 * the <audio> element to start; 2.3s leaves a short pause before "Fyld båden med …".
 */
const REASK_MS = 2300
/** How long the packing show holds input (the ten fish gather, the box pops in). */
const BUNDLE_MS = 800

const FyldBaadenGame: React.FC = () => {
  const reduce = useReducedMotion()
  useOccludeWorld() // the harbour covers the whole world — stop drawing it underneath
  const sensors = useDragOnlySensors()
  const audio = useSimplifiedAudioHook({ componentId: 'FyldBaadenGame', autoInitialize: false })
  const run = useTaskRun({ tasksInRound: 8, gameId: 'math.boat' })
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()
  const { hint, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<number>(2)

  const [gameReady, setGameReady] = useState(false)
  const [target, setTarget] = useState(0)
  const [deck, setDeck] = useState<DeckState>(EMPTY_DECK)
  const [phase, setPhase] = useState<Phase>('arriving')
  const [boatNo, setBoatNo] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [bundle, setBundle] = useState<BundleFx | null>(null)
  const [bundling, setBundling] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  // Bumped per successful load of a kind — remounts that pile's top unit (see Quay's `refill`).
  const [refills, setRefills] = useState<Record<CargoKind, number>>({ box: 0, fish: 0 })
  // Boxes taken off the jetty and not put back. The jetty's piles RUN DOWN as cargo is loaded (owner,
  // 2026-10-15): the box stack holds what the level can ever ask for, the fish heap ten — and a box
  // PACKED on deck from ten fish never came off the stack, so it is not counted here.
  const [boxesOut, setBoxesOut] = useState(0)
  const boxesOutRef = useRef(0)
  const setBoxesOutBoth = (n: number) => {
    boxesOutRef.current = n
    setBoxesOut(n)
  }
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)

  // Refs mirror what a same-tick second gesture must see (a double tap reads stale state otherwise).
  const deckRef = useRef<DeckState>(EMPTY_DECK)
  const targetRef = useRef(0)
  const recentRef = useRef<number[]>([])
  const phaseRef = useRef<Phase>('arriving')
  const isAdvancing = useRef(false)
  const bundlingRef = useRef(false)
  const firstAttemptRef = useRef(true)
  const welcomeDoneRef = useRef(false)
  const welcomeTriggered = useRef(false)
  const hasInteractedRef = useRef(false)
  const arrivedRef = useRef(false)
  const hasInitialized = useRef(false)
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

  // The harbour's sound bed (owner, 2026-10-15): gulls and water, very low, for as long as the game is
  // on screen — the menu music has already faded out on entry. It fades out on leaving.
  useEffect(() => {
    sfx.startLoop('harbour-ambience', 2000)
    return () => sfx.stopLoop('harbour-ambience', 600)
  }, [])

  // Unmount hygiene: every timer, in its own empty-dep effect (game-development.md).
  useEffect(() => () => {
    for (const t of Object.values(timers.current)) if (t) clearTimeout(t)
  }, [])

  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    later('guide', 1100, () => setGuideReaction(null))
  }

  const setDeckBoth = (d: DeckState) => {
    deckRef.current = d
    setDeck(d)
  }
  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  const speakPrompt = () => {
    if (!targetRef.current) return
    audio.updateUserInteraction()
    void audio.speak(fillBoatPrompt(targetRef.current)).catch(() => {})
  }

  // A new boat chugs in from behind the quay with an empty deck and a new number.
  const newBoat = () => {
    const level = progressStore.difficultyFor('math')
    const n = pickBoatNumber(level, recentRef.current)
    recentRef.current = [...recentRef.current, n].slice(-BOAT_RECENT_WINDOW)
    targetRef.current = n
    setTarget(n)
    setDeckBoth(EMPTY_DECK)
    setBoxesOutBoth(0)
    setRevealed(false)
    setBundle(null)
    resetHint()
    firstAttemptRef.current = true
    arrivedRef.current = false
    setBoatNo((b) => b + 1)
    setPhaseBoth('arriving')
    // The motor swells in as the boat comes round the jetty and dies away as it stops (arrival 1.5 s).
    sfx.swell('boat-motor', { fadeInMs: 400, holdMs: 700, fadeOutMs: 1000 })
  }

  const onArrived = () => {
    arrivedRef.current = true
    isAdvancing.current = false
    setPhaseBoth('loading')
    if (welcomeDoneRef.current) speakPrompt()
  }

  const playWelcome = async () => {
    if (welcomeTriggered.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('boat')
    } catch {
      /* the prompt below still plays */
    }
    welcomeDoneRef.current = true
    // The first prompt waits for whichever finishes last: the welcome or the boat's arrival — unless
    // the child is already playing, in which case it would talk over them.
    if (!hasInteractedRef.current && arrivedRef.current && phaseRef.current === 'loading') speakPrompt()
  }

  // The first gesture IN the game ends the welcome's chance to play. Audio only becomes ready on a
  // gesture, so on a cold deep link the welcome would otherwise fire on the child's first fish and
  // re-speak the prompt over whatever they just did (audio-report probe, 2026-10-13). It also lets
  // every later boat speak its prompt on arrival even if the welcome never ran.
  const markInteracted = () => {
    hasInteractedRef.current = true
    welcomeTriggered.current = true
    welcomeDoneRef.current = true
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    setGameReady(true)
    newBoat()
    if (audio.isAudioReady) void playWelcome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) void playWelcome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Live difficulty: a level change re-asks the current boat at the new level (no new boat needed). It
  // applies while the boat is still ARRIVING too — the prompt hasn't been spoken yet, so nothing is
  // contradicted (a probe set Let mid-arrival and got asked for 38).
  const difficultyLevel = useDifficulty('math')
  const prevDifficultyRef = useRef(difficultyLevel)
  // Boxes are drawn as big as the level's most boxes allow (boatLooks `boxColumns`); deck and quay agree.
  const boxCols = boxColumns(MATH_BOAT[difficultyLevel].max)
  /** The jetty's box stack: as many as this level's biggest number needs (Let 2, Normal 5, Svær 10). */
  const boxStock = Math.ceil(MATH_BOAT[difficultyLevel].max / 10)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    const p = phaseRef.current
    if (p !== 'loading' && p !== 'arriving') return
    const n = pickBoatNumber(difficultyLevel, recentRef.current)
    recentRef.current = [...recentRef.current.slice(0, -1), n]
    targetRef.current = n
    setTarget(n)
    setDeckBoth(EMPTY_DECK)
    setBoxesOutBoth(0)
    resetHint()
    if (p === 'loading') speakPrompt()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // The running count after every load or unload — "tolv fisk" (owner, 2026-10-15). Fire and forget:
  // the next load cancels it (one audio at a time), so a fast child hears only the latest total.
  const speakCount = (n: number) => {
    if (n > 0) void audio.speak(boatCountText(n)).catch(() => {})
  }

  const canAct = () => gameReady && phaseRef.current === 'loading' && !isAdvancing.current && !bundlingRef.current

  // The boat settles under what was loaded: a box of ten dips it visibly more than one fish, so the
  // weight difference backs up "ten vs one" without a word. WAAPI transform only (GPU), tiny amplitude.
  const bumpRef = useRef<HTMLDivElement>(null)
  const bump = (kind: CargoKind, delayMs = 0) => {
    const el = bumpRef.current
    if (reduce || !el || typeof el.animate !== 'function') return
    const [d, a] = kind === 'box' ? [5, 0.9] : [2, 0.35]
    el.animate(
      [
        { transform: 'translateY(0px) rotate(0deg)' },
        { transform: `translateY(${d}px) rotate(${a}deg)` },
        { transform: `translateY(${-d * 0.2}px) rotate(${-a * 0.3}deg)` },
        { transform: 'translateY(0px) rotate(0deg)' },
      ],
      { duration: kind === 'box' ? 700 : 500, delay: delayMs, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' },
    )
  }

  // ── THE resolve path, both gestures ───────────────────────────────────────────────────────────
  const load = (kind: CargoKind, viaTap = false) => {
    if (!canAct()) return
    markInteracted()
    audio.updateUserInteraction()
    cancel('reask') // the child is already fixing it
    if (viaTap) sfx.play('tap')
    const r = loadDeck(deckRef.current, kind)
    if (r.outcome === 'full' || (kind === 'box' && boxesOutRef.current >= boxStock)) {
      sfx.play('spring-back')
      return
    }
    setDeckBoth(r.deck)
    if (kind === 'box') setBoxesOutBoth(boxesOutRef.current + 1)
    setRefills((f) => ({ ...f, [kind]: f[kind] + 1 }))
    speakCount(deckValue(r.deck))
    if (r.outcome === 'bundled') {
      // Ten single fish are packed into ONE box — the place-value moment, given its own beat.
      sfx.play('bundle')
      bump('box', 380)
      bundlingRef.current = true
      setBundling(true)
      setBundle({ key: Date.now(), box: r.deck.boxes - 1 })
      later('bundle', BUNDLE_MS, () => {
        bundlingRef.current = false
        setBundling(false)
      })
    } else {
      sfx.play(kind === 'box' ? 'box-land' : 'fish-land')
      bump(kind)
    }
  }

  const unload = (kind: CargoKind, viaTap = false) => {
    if (!canAct()) return
    markInteracted()
    audio.updateUserInteraction()
    cancel('reask')
    if (viaTap) sfx.play('tap')
    const r = unloadDeck(deckRef.current, kind)
    if (r.outcome === 'empty') return
    setDeckBoth(r.deck)
    if (kind === 'box') setBoxesOutBoth(Math.max(0, boxesOutRef.current - 1))
    sfx.play('pick-up')
    speakCount(deckValue(r.deck))
  }

  const sendBoat = () => {
    if (!canAct() || isDeckEmpty(deckRef.current)) return
    markInteracted()
    audio.cancelCurrentAudio()
    audio.updateUserInteraction()
    cancel('reask')
    sfx.play('tap')
    const loaded = deckValue(deckRef.current)
    const n = targetRef.current
    if (loaded === n) {
      // Correct: lock, paint the numeral on the sail, say the number, then sail out on a FIXED dwell.
      isAdvancing.current = true
      setPhaseBoth('sending')
      setRevealed(true)
      resetHint()
      sfx.play('horn')
      celebrateTier('micro')
      reactGuide('cheer')
      void audio.speakNumber(n).catch(() => {})
      later('sail', DWELL_CORRECT(), () => {
        sfx.play('splash')
        // …and opens up again as it leaves (departure 1.8 s), fading as it goes off-screen.
        sfx.swell('boat-motor', { fadeInMs: 300, holdMs: 500, fadeOutMs: 1400 })
        setPhaseBoth('sailing')
      })
      return
    }
    // Wrong: the boat bobs back, the narrator names what IS loaded, then re-asks the target.
    firstAttemptRef.current = false
    sfx.play('spring-back')
    setShakeKey((k) => k + 1)
    reactGuide('think')
    void audio.speak(boatLoadedText(loaded)).catch(() => {})
    later('reask', REASK_MS, speakPrompt)
    if (registerHintWrong(() => n)) mascotBus.emit('hint')
  }

  // THE SEAM (Endless Play PRD-01 §4.1): the boat has left; bank the task, play any ceremony, and only
  // then does the next boat arrive.
  const onSailedOut = () => {
    stopCelebration()
    const r = run.completeTask(firstAttemptRef.current)
    if (r.streak > 0 && r.streak % 3 === 0 && !r.crossedLevel) {
      celebrateTier('streak')
      mascotBus.emit('streak')
    }
    run.thenContinue(newBoat)
  }

  const onBoatAnimationComplete = () => {
    if (phaseRef.current === 'arriving') onArrived()
    else if (phaseRef.current === 'sailing') onSailedOut()
  }

  // ── Drag ──────────────────────────────────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    markInteracted()
    audio.cancelCurrentAudio()
    cancel('reask')
    setActiveId(String(event.active.id))
    sfx.play('pick-up')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event
    clearActive()
    const data = active.data.current as { kind: CargoKind; from: 'quay' | 'deck' } | undefined
    if (!data) return
    const overKey = over ? String(over.id) : null
    if (data.from === 'quay') {
      if (overKey === 'deck') load(data.kind)
      else if (!overKey && wasWobbledTap(delta)) load(data.kind, true)
    } else {
      if (overKey === 'quay') unload(data.kind)
      else if (!overKey && wasWobbledTap(delta)) unload(data.kind, true)
    }
  }

  const interactive = gameReady && phase === 'loading' && !bundling
  // No-sound degraded mode (narrationHealth.ts): the board is unanswerable in silence, so the number
  // shows on the sail from the start. It reverts by itself the moment a clip sounds.
  const degradedReveal = audio.narrationHealthy ? undefined : target
  const sailNumber = revealed ? target : (degradedReveal ?? null)
  const ghost = hint !== null ? ghostFor(hint) : null
  const overDeck = overId === 'deck' && !!activeId?.startsWith('src-')
  const overQuay = overId === 'quay' && !!activeId?.startsWith('deck-')
  // The moored boat BOBS (vertical only) — it used to rock ±1.5°, which on a long boat with a tall
  // wheelhouse read as "about to tip over" (owner, 2026-10-14). It holds still while anything is dragged:
  // a moving ancestor bends the drag offset (a deck fish drifted ~12px, real-mouse probe).
  const rock = idleFloat(reduce || phase === 'sailing' || phase === 'arriving' || activeId !== null, { distance: 3, durationS: 3.4 })

  // A full `transform` STRING with tween easing, never framer's `x` shorthand: Motion hands `transform`
  // to WAAPI, which Safari 17 runs on the GPU compositor, while `x`/`y`/`scale` tick on the main thread
  // every frame (motion.dev/docs/performance; WebKit KeyframeEffect gates — Harbour PRD-01 §10).
  const boatAnimate =
    phase === 'sailing'
      ? reduce ? { opacity: 0 } : { transform: 'translateX(120vw)' }
      : reduce ? { opacity: 1 } : { transform: 'translateX(0vw)' }
  const boatTransition =
    phase === 'sailing'
      ? { duration: reduce ? 0.3 : 1.8, ease: 'easeIn' as const }
      : { duration: reduce ? 0.3 : 1.5, ease: 'easeOut' as const }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearActive}
      collisionDetection={kidCollision}
      // The deck MOVES (the moored boat rocks), so droppable rects are re-measured continuously.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <GameShell
        categoryId="math"
        title="Fyld Båden"
        backRoute="/math"
        dense
        // The corner companion would stand IN THE SEA here (owner, 2026-10-14) — the same mascot stands on
        // the jetty as harbour master instead. `guideReaction` still reaches it through mascotBus.
        guide={false}
        guideReaction={guideReaction}
        celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      >
        <HarbourBackdrop reduce={reduce} />
        {/* The stage is a size container, so ONE slot unit (--s) scales the quay and the boat together. */}
        {/* `data-boat-target`/`-loaded` exist for the DEV harness only — absent from a deploy build. */}
        <Box
          data-boat-stage
          data-boat-target={DEV ? target : undefined}
          data-boat-loaded={DEV ? deckValue(deck) : undefined}
          data-boat-phase={DEV ? phase : undefined}
          sx={{ flex: 1, minHeight: 0, containerType: 'size', position: 'relative' }}>
          {/* "Hør igen" sits centred right under the title (owner, 2026-10-15), over the empty sky — not
              inside the jetty column, where it competed with the cargo. */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3, pointerEvents: 'none', '& > *': { pointerEvents: 'auto' } }}>
            <MathRepeatButton onClick={() => { markInteracted(); speakPrompt() }} disabled={!gameReady} />
          </Box>
          <Box
            sx={{
              // Landscape: quay (5.8) | boat art (12.9, ≈7.9 tall at its 849:519 aspect) side by side.
              // Portrait: the quay is a pier ABOVE the moored boat (15 wide), so the boat gets the full
              // width instead of half a screen of empty sky. `--bw` is the boat's width — the Boat sizes
              // everything inside from it.
              // The jetty got more of the width (owner, 2026-10-15: room for the harbour master and both
              // piles) — 5.8 + 12.9 — and its bollard end reaches 0.4 further, toward the boat's stern.
              '--s': 'min(calc(100cqw / 19.2), calc(100cqh / 9), 80px)',
              '--bw': 'calc(var(--s) * 12.9)',
              '--jetty-reach': 'calc(var(--s) * 0.4)',
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              '@media (orientation: portrait)': {
                '--s': 'min(calc(100cqw / 15.6), calc(100cqh / 17), 80px)',
                '--bw': 'calc(var(--s) * 15)',
                '--jetty-reach': '0px',
                flexDirection: 'column',
                // The pier sits right above the moored boat, not stranded at the top of the sea.
                justifyContent: 'flex-end',
              },
            }}
          >
            {/* Quay first in z-order terms: the next boat arrives from BEHIND it. */}
            <Box
              sx={{
                flex: '0 0 calc(var(--s) * 5.8)',
                position: 'relative',
                zIndex: 1,
                minHeight: 0,
                '@media (orientation: portrait)': { flex: '0 0 auto', width: 'calc(var(--s) * 9)' },
              }}
            >
              <Quay
                interactive={interactive}
                overQuay={overQuay}
                onLoad={(kind) => load(kind, true)}
                refills={refills}
                counts={{ box: Math.max(0, boxStock - boxesOut), fish: BAY_SLOTS - deck.fish }}
                stock={{ box: boxStock, fish: BAY_SLOTS }}
                boxCols={boxCols}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                // Lift the boat so the front wave band (HarbourFrontWater, 7dvh) covers only the bottom of
                // the hull — on a phone the band is taller than the whole hull and hid the bottom row of
                // deck slots (WebKit phone-portrait probe, 2026-10-13). 0.06·bw ≈ the lowest 10% of the art.
                pb: 'max(0px, calc(7dvh - var(--bw) * 0.06 - 10px))',
                // Landscape: the boat stops a little right of centre, clear of the jetty's end, with only
                // the very tip of the bow past the screen edge (owner, 2026-10-15).
                pl: 'calc(var(--s) * 0.9)',
                '@media (orientation: portrait)': { flex: '0 0 auto', pl: 0 },
              }}
            >
              {gameReady && target > 0 && (
                <motion.div
                  key={boatNo}
                  initial={reduce ? { opacity: 0 } : { transform: 'translateX(-115vw)' }}
                  animate={boatAnimate}
                  transition={boatTransition}
                  onAnimationComplete={onBoatAnimationComplete}
                >
                  {/* Idle rock is its own CSS layer, nested inside the framer travel (animation rule §2). */}
                  <Box {...rock.props} sx={[{ transformOrigin: '50% 100%' }, rock.sx]}>
                    <Box ref={bumpRef} sx={{ position: 'relative', transformOrigin: '50% 90%' }}>
                    <Boat
                      look={(boatNo - 1) % BOAT_LOOKS.length}
                      deck={deck}
                      ghost={ghost}
                      sailNumber={sailNumber}
                      bundle={bundle}
                      interactive={interactive}
                      reduce={reduce}
                      overDeck={overDeck}
                      onUnload={(kind) => unload(kind, true)}
                      hornEnabled={interactive && !isDeckEmpty(deck)}
                      onHorn={sendBoat}
                      shakeKey={shakeKey}
                      departing={phase === 'sailing'}
                      dragging={activeId !== null}
                      boxCols={boxCols}
                    />
                    </Box>
                  </Box>
                </motion.div>
              )}
            </Box>
          </Box>
        </Box>
        <HarbourFrontWater reduce={reduce} />
      </GameShell>
    </DndContext>
  )
}

export default FyldBaadenGame
