import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { useDragActive } from '../common/dnd/useDragActive'
import { getCategoryTheme } from '../../config/categoryThemes'
import { tileSurface } from '../../theme/tokens/helpers'
import { softShadow } from '../../theme/depth'
import GameShell from '../common/GameShell'
import PromptFocus from '../common/PromptFocus'
import { HeroArt } from '../common/PromptArt'
import TactileTile from '../common/TactileTile'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { useTaskRun } from '../../hooks/useTaskRun'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useDifficulty } from '../../hooks/useDifficulty'
import { shuffle } from '../../utils/shuffle'
import { progressStore } from '../../services/progressStore'
import { practiceLedger } from '../../services/practiceLedger'
import { ORDLEG_SPELL } from '../../config/difficulty'
import { type OrdlegWord } from '../../config/ordlegWords'
import { SPELLING_ROUND, ordlegWordKey, spellingPromptPool } from '../../config/promptPools'
import { spellingHintLine } from '../../config/hintLines'
import { usePromptBag } from '../../hooks/usePromptBag'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { isIOS } from '../../utils/deviceDetection'
import { ordlegArt } from '../../assets/games/ordleg'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Visual uplift (PRD-10 §3.4): the prompt PICTURE is a baked soft-3D word-picture (§4) grounded in
// PromptFocus — `art` is the ASCII art id (Danish glyphs aliased: æg→aeg, ræv→raev, bær→baer,
// løg→loeg, ål→aal, sø→soe), resolved via `ordlegArt(w.art)`. EVERY word is baked (PRD-12 Phase B):
// the abstract ones reuse cross-section art via `ordlegArt`'s shared/english fallback — hej→`hello`,
// arm→`arm`, ben→`leg`, fod→`foot`, mor→`mom`, far→`dad`, hul→`hul` — so the emoji fallback is retired.
// The letter TILES + SLOTS + spelled letters stay type (the lesson).
//
// **Difficulty is a NEW lever here** (Difficulty PRD-01 W5): this game ignored the Sværhedsgrad setting
// completely. Now `ORDLEG_SPELL[level]` sets both the word length band (Let 2 · Normal 2–3 · Svær 3–4)
// and the number of distractor letter tiles (1 · 3 · 4). The word lists live in
// `src/config/ordlegWords.ts` because this game SPEAKS the word — a list stranded in a `.tsx` can't be
// enumerated for prebake, which is why most of these words were on live Azure until now.

const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z', 'Æ', 'Ø', 'Å']

interface LetterTile {
  id: string
  letter: string
}

const SpellingGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  // Drag as well as tap (owner, 2026-08-03): a letter can be DRAGGED onto the word row, or tapped
  // exactly as before. The drop target is the whole ROW rather than a per-letter slot, because this
  // game is strictly sequential — a tile always fills the next empty slot — so a per-slot target
  // would invent a choice the game does not have (and would make dropping on the "right" letter's
  // slot out of order a new kind of wrong). Both gestures land on `handleTileClick`, so scoring, the
  // hint counter and the advance-lock are untouched.
  const sensors = useDragOnlySensors()
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()

  // Current word and its uppercase letters
  const [current, setCurrent] = useState<{ word: string; emoji?: string; art?: string } | null>(null)
  const [targetLetters, setTargetLetters] = useState<string[]>([])
  const [filledCount, setFilledCount] = useState(0)
  const [tiles, setTiles] = useState<LetterTile[]>([])
  const [usedTileIds, setUsedTileIds] = useState<Set<string>>(new Set())
  const [shakeTileId, setShakeTileId] = useState<string | null>(null)
  // Next-letter hint: after 2 wrong taps on the current slot the correct tile pulses (never-fail
  // scaffold). The wrong tap that triggered it already broke first-try, so the hint costs a star.
  // Reset per word AND per correctly-placed letter (each slot starts fresh). Unlike the color games,
  // Stav Ordet deliberately does NOT nudge the mascot on hint.
  const { hint: hintTileId, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(2)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'SpellingGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame) so the board is never stranded when audio isn't
  // unlocked at mount; the welcome plays at most once.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  // Prompt words come from a BAG (Practice Loop PRD-01 W1). The old `previousWord` ref is DELETED, not
  // kept beside it: avoiding only the immediately-previous word bounded adjacency, so a round of 8 could
  // still ask 5 of Let's 8 words twice each.
  // `gameId` also wires W2's re-ask + front-load (order only — never the level). This game is
  // hand-rolled, so it records its own attempts — see the wrong-slot branch in handleTileClick.
  const wordBag = usePromptBag<OrdlegWord>({
    key: ordlegWordKey,
    window: SPELLING_ROUND,
    gameId: 'ordleg.spelling',
  })
  const isAdvancing = useRef(false)
  // Bumps every word so tile React keys never collide across words. Without it two consecutive
  // words that share an index+letter (e.g. a distractor, or S) reuse the same motion.div, and
  // Framer `layout`-animates it from its old position to the new one — the "floating" tiles.
  const wordSeq = useRef(0)
  // Live current word (so it can be voiced after the welcome) + interaction guard (so a late
  // welcome never talks over active play).
  const wordRef = useRef<string | null>(null)
  const hasInteractedRef = useRef(false)

  // Centralized game state management
  const { incrementScore } = useGameState()

  // Endless task play (Endless Play PRD-01 W2). ONE constant, two jobs: the `taskXp` normaliser AND
  // the bag's no-repeat window (Practice Loop PRD-01 W1).
  const run = useTaskRun({ tasksInRound: SPELLING_ROUND, gameId: 'ordleg.spelling' })
  const firstAttemptRef = useRef(true)

  // Timeout ref for cleanup (per-word prompt timer)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // The two nested post-completion timers (PRD-02 P4): the echo delay and the advance delay. Tracked
  // so they're cleared on unmount and never speak/advance over the next screen.
  // When the final correct letter was tapped (drives the concurrent celebration window in completeWord).
  const completedAtRef = useRef(0)
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // False after unmount — checked inside the async completion callback (which awaits the word echo)
  // so it never schedules the advance / speaks after the child has navigated away.
  const mountedRef = useRef(true)

  // Celebration management (corner guide reacts via guideReaction)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Cue the corner guide, clearing the reaction a beat later so it settles + re-fires.
  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 SpellingGame: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenWord()
    }

    // Empty-dep effect → this cleanup runs once, on unmount: clear every pending timer so no
    // prompt/echo/advance callback speaks or advances over the next screen. (The mounted flag is
    // owned by its own effect below so StrictMode's dev remount restores it.)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current)
        completeTimerRef.current = null
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Owns the mounted flag on its own (PRD-02): sets true on (re)mount and false on unmount, so
  // StrictMode's dev mount→cleanup→remount cycle leaves it TRUE (a shared init cleanup would strand
  // it false and freeze the completion advance). The async word-echo callback checks it before
  // scheduling the advance so it never speaks/advances over the next screen.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcomeThenWord so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenWord()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the playable board RIGHT AWAY without voicing the word yet — the welcome
  // narrates over the visible board and the spoken word follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewWord(false)
  }

  // Play the welcome over the already-visible board, then voice the first word. Self-guards; skips
  // the trailing word if the child already started tapping.
  const playWelcomeThenWord = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('spelling')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (wordRef.current && !hasInteractedRef.current) speakWord(wordRef.current)
  }

  // Build a shuffled tile pool: the word's letters + `distractorCount` distractor letters (the level's
  // second axis — Let 1, Normal 3, Svær 4).
  const buildTiles = (letters: string[], distractorCount: number): LetterTile[] => {
    const wordLetterSet = new Set(letters)
    const distractorPool = DANISH_ALPHABET.filter(l => !wordLetterSet.has(l))
    const distractors: string[] = []
    const shuffledPool = shuffle(distractorPool)
    for (let i = 0; i < distractorCount && i < shuffledPool.length; i++) {
      distractors.push(shuffledPool[i])
    }

    const all = [...letters, ...distractors]
    return shuffle(
      all.map((letter, index) => ({ id: `tile-${wordSeq.current}-${index}-${letter}`, letter }))
    )
  }

  // `voice=false` renders the board without voicing the word (used for the first word, which is
  // voiced after the welcome instead).
  const generateNewWord = (voice = true) => {
    isAdvancing.current = false
    wordSeq.current += 1 // fresh key namespace for this word's tiles (see wordSeq)

    // Draw from the LEVEL's pool as a bag pass (W1) — `spellingPromptPool` is the same function the
    // measured simulation samples, so the guard can't drift from what the game asks.
    const level = progressStore.difficultyFor('ordleg')
    const next = wordBag.draw(spellingPromptPool(level))
    wordRef.current = next.word

    const letters = next.word.toUpperCase().split('')

    setCurrent(next)
    setTargetLetters(letters)
    setFilledCount(0)
    setUsedTileIds(new Set())
    setShakeTileId(null)
    setTiles(buildTiles(letters, ORDLEG_SPELL[level].distractors))
    // Fresh word → fresh first-try flag + hint state.
    firstAttemptRef.current = true
    resetHint()

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!voice) return

    const delay = isIOS() ? 200 : 500
    timeoutRef.current = setTimeout(() => {
      speakWord(next.word)
    }, delay)
  }

  const speakWord = async (word: string) => {
    try {
      audio.updateUserInteraction()
      await audio.speak(word)
    } catch (error) {
      logError('Error speaking word', { word, error: error?.toString() })
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(String(event.active.id))
    sfx.play('pick-up')
  }

  // A drop anywhere on the word row = the same answer as tapping the tile. `kidCollision` returns
  // nothing when the pointer is over nothing, so an abortive drag springs back without scoring.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    clearActive()
    if (!over || over.id !== 'word-row') return
    const tile = tiles.find((t) => t.id === String(active.id))
    if (tile) void handleTileClick(tile, true)
  }

  const handleTileClick = async (tile: LetterTile, viaDrag = false) => {
    if (!gameReady || !current || isAdvancing.current) return
    if (usedTileIds.has(tile.id)) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS) —
    // matching UnifiedQuizGame so the interaction language is consistent app-wide. A DROP already
    // sounded its press on pick-up, so it skips the tick rather than stacking a third cue.
    if (!viaDrag) sfx.play('tap')

    const expectedLetter = targetLetters[filledCount]

    if (tile.letter === expectedLetter) {
      // Correct letter: place it in the next slot. The next slot starts fresh (no hint yet).
      const newFilled = filledCount + 1
      setUsedTileIds(prev => new Set(prev).add(tile.id))
      setFilledCount(newFilled)
      resetHint()

      // P3 (PRD-02): the final correct letter completes the word — engage the advance-lock NOW,
      // BEFORE the echo await below. Otherwise a tap on a leftover distractor tile during the ~1s
      // echo slips past the top-of-handler guard, hits the wrong branch (expectedLetter is
      // undefined) and steals the just-earned star.
      if (newFilled === targetLetters.length) {
        isAdvancing.current = true
        // Stamp the completing tap: the word-complete celebration window is measured FROM HERE, so the
        // letter echo + the read-back run CONCURRENTLY with it instead of all end-to-end (see
        // completeWord). Measured before the fix: 7.3s from the final letter to the next word.
        completedAtRef.current = Date.now()
      }

      // Echo the placed letter (identification). No win/lose narration.
      try {
        await audio.speakLetter(tile.letter)
      } catch (error) {
        // ignore letter audio errors
      }

      // Navigated away during the letter echo → don't complete/advance (PRD-02 P4): completeWord
      // would schedule the completion echo + advance over the next screen.
      if (!mountedRef.current) return

      if (newFilled === targetLetters.length) {
        // Word complete
        completeWord()
      }
    } else {
      // Wrong letter: gentle SFX + shake, leave it in the pool, break the first-try flag.
      // Practice ledger (Practice Loop PRD-01 W2) — this game is hand-rolled, so it records its own
      // miss here, at the branch that already knows first-try. The miss is on the WORD (the prompt), not
      // on the letter tapped: the word is what the bag can re-ask. Recorded on the FIRST wrong letter
      // only, so a 4-letter word can't count four misses for one question. The `seen` counterpart is in
      // `completeWord`.
      if (firstAttemptRef.current) practiceLedger.recordAttempt('ordleg.spelling', current.word, false)
      firstAttemptRef.current = false
      sfx.play('wrong')
      setShakeTileId(tile.id)
      reactGuide('think')
      setTimeout(() => setShakeTileId(null), 450)

      // After 2 wrong taps on this slot, point at the correct tile (never-fail scaffold) — and SAY the
      // letter (Practice Loop PRD-01 W3). Unlike the other games this game deliberately does NOT nudge
      // the mascot on hint, and that stays; the spoken letter name is the whole addition. It is exactly
      // what placing a letter already echoes (`speakLetter`), so no new narration.
      // NOTE it is the letter NAME, not "K som Kat" — PRD §5.2 asked for the latter, but that template
      // asserts the word STARTS with the letter, which is false for a letter mid-word ("O som ko").
      if (
        registerHintWrong(
          () => tiles.find(t => !usedTileIds.has(t.id) && t.letter === targetLetters[filledCount])?.id ?? null,
        )
      ) {
        const nextLetter = targetLetters[filledCount]
        if (nextLetter) void audio.speak(spellingHintLine(nextLetter)).catch(() => {})
      }
    }
  }

  const completeWord = () => {
    // isAdvancing was already engaged by the final correct tap (see handleTileClick, P3) so the
    // guard only needs the current-word check; it's still called exactly once per word.
    if (!current) return
    isAdvancing.current = true

    // The `seen` counterpart of the wrong-slot branch's miss (W2): only a word spelled with no wrong
    // letter counts as seen — one record per word either way.
    if (firstAttemptRef.current) practiceLedger.recordAttempt('ordleg.spelling', current.word, true)

    incrementScore()
    celebrateTier('micro')
    reactGuide('cheer')

    // Read the completed word back (identification of what was spelled), then advance. No
    // win/lose narration. Both timers are tracked + the mounted guard stops the chain if the child
    // navigates away during the echo, so nothing speaks/advances over the next screen (PRD-02 P4).
    completeTimerRef.current = setTimeout(async () => {
      completeTimerRef.current = null
      if (!mountedRef.current) return // navigated away before the echo → don't speak/advance
      try {
        await audio.speak(current.word)
      } catch (error) {
        // ignore
      }
      if (!mountedRef.current) return // navigated away during the echo → don't advance/speak
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()
        // THE SEAM (Endless Play PRD-01 §4.1). This one sits two timers deep behind `mountedRef`; the
        // hook's own cancellation supersedes that check (it never resolves after unmount), and the
        // existing guard above is left in place rather than unpicked here.
        const r = run.completeTask(firstAttemptRef.current)
        // Suppressed on a crossing: one loud payoff, not two celebrations in the same 200ms.
        if (r.streak > 0 && r.streak % 3 === 0 && !r.crossedLevel) {
          celebrateTier('streak')
          mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
        }
        run.thenContinue(() => generateNewWord())
        // The celebration window, measured FROM THE COMPLETING TAP rather than bolted on after the
        // letter echo + the 400ms beat + the word read-back. Those three already ran serially, so
        // adding a further full 2s made the finished-word pause ~7s — long enough that a child assumes
        // the game is stuck. Subtracting the elapsed time never truncates the read-back: if it outran
        // the window, the remainder is 0 and we advance the moment it ends.
      }, Math.max(0, (isIOS() ? 1500 : 2000) - (Date.now() - completedAtRef.current)))
    }, 400)
  }

  const repeatWord = async () => {
    if (!current) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakWord(current.word)
    } catch (error) {
      console.error('🎵 SpellingGame: Error repeating word:', error)
    }
  }

  // Live difficulty (Difficulty PRD-01 W5): pick a fresh word at the new level when the adult changes
  // it in the "Til de voksne" menu — no refresh. Every other calibrated game already had this effect;
  // Stav Ordet didn't, because it ignored the setting entirely. Skips the first mount.
  const difficultyLevel = useDifficulty('ordleg')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (!gameReady) return
    generateNewWord()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live, skin-aware ordleg theme (§3.6) — the static `categoryThemes.ordleg` shows kid-skin colours
  // on Havet/Rummet/Dino. Re-runs on skin change (muiTheme drives the re-render).
  const theme = getCategoryTheme('ordleg')
  const dark = muiTheme.scene.dark
  const availableTiles = tiles.filter(t => !usedTileIds.has(t.id))
  const promptArt = current?.art ? ordlegArt(current.art) : undefined

  return (
    <GameShell
      categoryId="ordleg"
      title="Stav Ordet"
      backRoute="/ordleg"
      dense
      guideReaction={guideReaction}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        !(gameReady && current) ? undefined : (
          // The word's PICTURE rests in the focal zone on its light-pool + contact shadow (§3.4):
          // a baked soft-3D word-picture (every word is baked now — PRD-12). Grounds the picture in
          // the world like the menu it launched from; the slots + tiles read directly beneath it
          // (picture→slots→tiles order preserved).
          <PromptFocus
            accent={theme.accentColor}
            chargeKey={current.word}
            subject={promptArt ? <HeroArt src={promptArt} /> : null}
            repeat={<OrdlegRepeatButton onClick={repeatWord} disabled={false} />}
          />
        )
      }
    >
        {gameReady && current && (
          <DndContext
            sensors={sensors}
            collisionDetection={kidCollision}
            onDragStart={handleDragStart}
            onDragOver={onDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={clearActive}
          >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              // Slots+tiles rise toward the top of the answer zone (PRD-14 W1) so they sit under the
              // prompt instead of hugging the bottom edge (kills the dead mid-band). Phone-landscape
              // keeps them centred (tight split preserved).
              justifyContent: 'flex-start',
              alignItems: 'center',
              pt: { xs: 1, md: 2 },
              gap: { xs: 1.5, md: 2.5 },
              '@media (orientation: landscape)': { gap: 1 },
              [PHONE_LANDSCAPE]: { justifyContent: 'center', pt: 0 },
            }}
          >
            {/* Letter slots — grounded, still type. Dashed "fill me" targets keep the accent border +
                green-fill-on-placed, but sit on the tactile clay surface (tileSurface + softShadow)
                so they stop reading as bare MUI boxes (§3.4). No baked art — the answer is the letters.
                The whole ROW is the drop target (one `word-row` zone, not one per slot — the game is
                sequential, see the note at the top of the component); it lifts a ring while a letter
                hovers it. `overColor` is transparent because the visible cue is that ring: a white wash
                behind dashed slots on a light skin reads as a rendering glitch. */}
            <DroppableZone
              id="word-row"
              overColor="transparent"
              style={{ padding: '10px', borderRadius: '24px', flex: '0 0 auto' }}
            >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: { xs: 1, md: 1.5 },
                flex: '0 0 auto',
                borderRadius: '18px',
                outline: overId === 'word-row' ? `4px solid ${theme.accentColor}` : '4px solid transparent',
                outlineOffset: '8px',
                transition: 'outline-color 0.2s ease',
              }}
            >
              {targetLetters.map((letter, index) => {
                const filled = index < filledCount
                return (
                  <Box
                    key={index}
                    sx={{
                      width: { xs: 56, sm: 64, md: 80 },
                      height: { xs: 56, sm: 64, md: 80 },
                      borderRadius: '18px',
                      border: '3px dashed',
                      borderColor: filled ? 'success.main' : theme.borderColor,
                      background: filled ? undefined : tileSurface(theme.accentColor, dark),
                      bgcolor: filled ? 'success.light' : undefined,
                      filter: filled ? undefined : softShadow(dark ? 1 : 0.7),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                        fontWeight: 700,
                        color: filled ? 'white' : 'transparent',
                        userSelect: 'none'
                      }}
                    >
                      {filled ? letter : ''}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
            </DroppableZone>

            {/* Scrambled letter tiles — tactile clay (TactileTile), NOT the old keyboard-lip Paper.
                TactileTile owns the wrong-shake (state='wrong') + hint-breathe/ring (hint) + press
                internally, so the game only feeds it `state` (from shakeTileId) + `hint` (from
                useNeverFailHint) and keeps the sfx('wrong')/setShakeTileId + hint wiring. The letter
                stays Comic Sans type (the lesson). */}
            <Box
              sx={{
                flex: '0 1 auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 0,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: { xs: 1.5, md: 2 },
                  maxWidth: 560
                }}
              >
                {/* No layout/exit animation: a consumed tile just unmounts and flex reflows
                    instantly — no floating toward the slots, no leftover gaps. Unique per-word
                    keys (see wordSeq) mean a new word swaps the whole set cleanly. The entrance
                    pop is one-shot; the shake/hint/press are TactileTile's own (nested layer). */}
                {availableTiles.map((tile) => {
                    const isHint = tile.id === hintTileId
                    const isShaking = shakeTileId === tile.id
                    // Grabbed tile LIFTS, matching the Farver games' shared drag juice (§6C).
                    const isLifted = activeId === tile.id && !reduce
                    return (
                    <motion.div
                      key={tile.id}
                      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: isLifted ? 1.12 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Box
                        sx={{
                          width: { xs: 56, sm: 64, md: 76 },
                          height: { xs: 56, sm: 64, md: 76 },
                        }}
                      >
                        {/* Draggable wrapper, tap unchanged: the TactileTile keeps its own `onActivate`
                            (that is what gives it the press animation and the button semantics), and
                            DraggableItem's capture-phase guard swallows the trailing click of a real
                            drag so one gesture can never place two letters. Hence no `onActivate` here. */}
                        <DraggableItem
                          id={tile.id}
                          inline
                          disabled={!gameReady || usedTileIds.has(tile.id) || isAdvancing.current}
                          data={tile}
                        >
                        <TactileTile
                          onActivate={() => handleTileClick(tile)}
                          accent={theme.accentColor}
                          state={isShaking ? 'wrong' : 'idle'}
                          hint={isHint}
                          variant="tile"
                          domProps={{ 'data-letter-tile': '', 'data-tile-state': isShaking ? 'wrong' : 'idle' }}
                        >
                          <Typography
                            sx={{
                              fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                              fontWeight: 700,
                              // Readable-on-white letter-tile glyph (onTileColor) — Ordleg's orange
                              // accent on Rummet/Dino was illegible on the white tile. See onTileColor.
                              color: theme.onTileColor
                            }}
                          >
                            {tile.letter}
                          </Typography>
                        </TactileTile>
                        </DraggableItem>
                      </Box>
                    </motion.div>
                    )
                  })}
              </Box>
            </Box>
          </Box>
          </DndContext>
        )}
    </GameShell>
  )
}

export default SpellingGame
