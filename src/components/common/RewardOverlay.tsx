import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { progressStore, type RewardGrant } from '../../services/progressStore'
import { progressSync } from '../../services/progressSync'
import { rewardBus, type RewardEvent } from '../../services/rewardBus'
import { mascotBus } from '../../services/mascotBus'
import { sfx } from '../../services/sfxClient'
import { rewardLine, CHAPTER_DONE_LINE, BOOK_DONE_LINE } from '../../config/danish-phrases'
import { onTileColor } from '../../theme/tokens/helpers'
import { useCelebration } from './CelebrationEffect'
import CelebrationEffect from './CelebrationEffect'
import ProgressionCompanion from './ProgressionCompanion'
import StickerReveal from './StickerReveal'

// The reward ceremony (Reward Book PRD-01 W4, re-cut by Reward Pacing PRD-01 D6) — a dedicated
// full-screen overlay mounted once at app root so ANY play context (round-result, browse, memory)
// fires it via `rewardBus`.
//
// **ONE PICTURE ON A SOLID SCREEN.** A chapter close used to stack eight things in one column —
// banner · sticker · label · a 3×3 dot grid · the count disc · the companion · "Hele siden er samlet!"
// · confetti — over a scrim you could read the menu's game tiles through. The plain grant was the same
// minus two. The evidence points one way (§2.6: badges and symbolic instrumentation are the elements
// that produce stress in preschoolers; the picture is not), so the ceremony now carries the picture
// and sheds the instrumentation around it:
//
//   • the scrim is near-solid — the moment is its own screen, not a layer over the menu
//   • the sticker is ~230px (was 150 in a 768px-tall viewport)
//   • the "Nyt klistermærke!" banner is gone — two texts around one picture IS the clutter, and the
//     spoken line already says it
//   • the 3×3 dot grid is gone — a 5-year-old cannot read "4th of 9", and Min Bog is one tap away
//     and shows it properly
//   • the count is FOLDED INTO the sticker's frame as a corner badge, same flat-disc grammar as the
//     ring's. It is NOT deleted: the grant happens at the start of the beats effect, so the ring
//     behind the scrim has already ticked by dismiss — the number would change while nobody was
//     looking, which is the one failure mode Reward Horizon D6 exists to prevent.
//   • chapter/book completion is a SECOND BEAT rather than more rows in the same column (§6.3)
//
// Auto-dismisses or on tap; on dismiss it advances the celebrated-level cursor so it never re-fires
// (reload/cross-tab safe). Reduced motion → no confetti/growth animation, but the reward + the spoken
// line are kept.

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'

// How long the sticker beat holds. MEASURED, not guessed (§6.4 / `.claude/rules/audio-system.md`):
// `ffmpeg silencedetect=noise=-45dB:d=0.04` over all 72 prebaked `rewardLine` clips puts the longest
// spoken end at **3.054s** ("Nyt klistermærke! Mariehøne"; the mp3 is 3.96s, the rest is Azure's
// padding), and the shared <audio> element takes ~250ms more to start producing sound. 3.054 + 0.25 =
// 3.304 → 3400. The old 3200 cut the longest names off ON SCREEN (the audio itself survived, because
// nothing stops the controller when the overlay unmounts).
const STICKER_MS = 3400
// The chapter/book beat that replaces it. Its own dwell, so the sticker never has to share a column.
const CHAPTER_BEAT_MS = 2400
// Extra owed slots (rare — a fast-tier round crossing two, or a browse binge) trail in fast, silently.
const TRAIL_MS = 400
// The number's count-up: let the sticker land before it starts, then one step per owed reward.
const COUNT_START_MS = 700
const COUNT_STEP_MS = 420

/**
 * The child-facing number, counting up to its new value with one spring pop on the final digit.
 *
 * Owns its own timers rather than driving them from the ceremony's beats effect, so mounting it IS
 * arming it — there is no second place where the count can get out of step with the reveal. Plain by
 * design (flat disc, one numeral, no depth), exactly like the ring badge.
 *
 * Since D6 it renders INSIDE `StickerReveal`'s frame as a corner badge rather than as its own row:
 * one object with a number on it, exactly like the ring, so the child reads it as the same thing —
 * and the ceremony loses a row without losing the beat.
 */
const RewardCounter: React.FC<{
  from: number
  to: number
  fill: string
  size: number
  reduce: boolean
}> = ({ from, to, fill, size, reduce }) => {
  const [n, setN] = useState(reduce ? to : from)
  useEffect(() => {
    if (reduce || n >= to) return
    const t = setTimeout(() => setN((v) => v + 1), n === from ? COUNT_START_MS : COUNT_STEP_MS)
    return () => clearTimeout(t)
  }, [n, to, from, reduce])

  const landed = n >= to
  return (
    <Box
      data-reward-count
      component={motion.div}
      animate={landed && !reduce ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      sx={{
        position: 'relative',
        zIndex: 12002,
        minWidth: size,
        height: size,
        px: n >= 100 ? 1 : 0,
        borderRadius: '999px',
        bgcolor: fill,
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: COMIC,
        fontWeight: 800,
        fontSize: Math.round(size * 0.56),
        lineHeight: 1,
      }}
    >
      {n}
    </Box>
  )
}

const RewardOverlay: React.FC = () => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  // Prop-level compact, NOT a `transform: scale()`: a transform shrinks pixels but leaves the layout
  // box full height, so the old tallest variant (a chapter close = reward + strip + companion +
  // banner, all one column) overflowed a 390px-tall phone-landscape viewport — the banner fell off
  // the bottom and the reward was clipped at the top. Real sizes keep the column inside the viewport.
  // D6 splitting that column into two beats removed most of the risk; growing the sticker to 230
  // spends it again, so the phone-landscape sizes here are RE-MEASURED, never `230 × ratio`.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))
  const audio = useSimplifiedAudioHook({ componentId: 'RewardOverlay', autoInitialize: false })
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [event, setEvent] = useState<RewardEvent | null>(null)
  // Every reward this ceremony hands over. Normally exactly one; more when a single round crossed two
  // fast-tier slots. Granted ONCE per ceremony (grantedRef), cleared on dismiss.
  const [grants, setGrants] = useState<RewardGrant[]>([])
  // Which BEAT is on screen (D6 §6.3). A plain grant never leaves 'sticker'.
  const [beat, setBeat] = useState<'sticker' | 'chapter'>('sticker')
  const grantedRef = useRef(false)
  const spokenRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to the bus. While an overlay is already showing, a further emit keeps the HIGHEST level
  // (a multi-slot jump collapses to one climactic ceremony).
  useEffect(() => {
    return rewardBus.subscribe((e) => {
      setEvent((prev) =>
        prev ? { level: Math.max(prev.level, e.level), section: e.section ?? prev.section } : e,
      )
    })
  }, [])

  const dismiss = () => {
    if (!event) return
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = null
    if (beatTimer.current) clearTimeout(beatTimer.current)
    beatTimer.current = null
    // Advance the celebrated cursor so neither this tab nor another re-fires for this level.
    progressStore.markLevelCelebrated(event.level)
    // The reward the child just saw is the moment a parent is most likely to check the other iPad, so
    // this one gets an immediate push rather than waiting for the 8s commit debounce (§6.4).
    void progressSync.push('ceremony')
    setEvent(null)
    setGrants([])
    setBeat('sticker')
    grantedRef.current = false
    spokenRef.current = false
  }

  // Run the ceremony beats when an event appears.
  useEffect(() => {
    if (!event) return
    // Hand over EVERY owed slot in one commit (once per ceremony).
    let owed: RewardGrant[] = grants
    if (!grantedRef.current) {
      grantedRef.current = true
      owed = progressStore.grantPendingRewards()
      setGrants(owed)
    }
    // THE EMPTY-CEREMONY GUARD (accounts PRD §6.3, guard 2). With nothing owed there is no reward to
    // reveal, yet everything below would still fire: `sfx.play('level-up')`, `mascotBus.emit('round')`,
    // `celebrateTier('levelup')` and a CONTENTLESS overlay held for DISMISS_MS — confetti about
    // nothing. Only the spoken line was guarded (by `if (headline)`). A cross-device merge can create
    // that state easily, so bail out and just advance the cursor.
    if (owed.length === 0) {
      progressStore.markLevelCelebrated(event.level)
      dismiss()
      return
    }

    const headline = owed[0]
    const chapterDone = owed.some((g) => g.chapterCompleted)
    const bookDone = owed.some((g) => g.bookCompleted)

    // Fanfare + mascot cheer (SFX is a separate channel; safe over the spoken line). The sticker beat
    // is always 'levelup'; a chapter close escalates on its OWN beat, below, so the two celebrations
    // no longer land on top of each other.
    sfx.play('level-up')
    mascotBus.emit('round')
    celebrateTier('levelup')

    // Exactly ONE spoken line, still — a single TTS channel with no queue means anything more cancels
    // itself. Closing a chapter/book speaks THAT instead of the reward's name.
    //
    // THIS IS §6.4's EXPLICIT FALLBACK, taken on the measurement. Splitting the beats made it possible
    // to speak the name on beat 1 and the chapter line on beat 2, but that requires beat 1 to outlast
    // the name clip: measured max 3.054s + ~250ms element startup = 3.304s, over the PRD's own ~3s
    // bar, which would have made a chapter ceremony 6.5s+ of two utterances. The PRD says take the
    // fallback rather than ship a truncation — so beat 2 is SILENT and the chapter line plays across
    // both beats (nothing stops the controller when a beat unmounts, so it simply finishes).
    if (!spokenRef.current && headline) {
      spokenRef.current = true
      const line = bookDone
        ? BOOK_DONE_LINE
        : chapterDone
          ? CHAPTER_DONE_LINE
          : rewardLine(headline.reward.label)
      audio.updateUserInteraction()
      audio.speakReward(line).catch(() => {})
    }

    if (chapterDone || bookDone) {
      // Beat 1 holds the sticker alone, then beat 2 REPLACES it with the companion + the headline.
      beatTimer.current = setTimeout(() => {
        setBeat('chapter')
        // Chapter completion is the ONE extra tier (Reward Book D6) → 'page'. A finished BOOK skips
        // back to the biggest tier for its one-time finale.
        celebrateTier(bookDone ? 'levelup' : 'page')
        dismissTimer.current = setTimeout(() => dismiss(), CHAPTER_BEAT_MS)
      }, STICKER_MS)
    } else {
      dismissTimer.current = setTimeout(() => dismiss(), STICKER_MS)
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = null
      if (beatTimer.current) clearTimeout(beatTimer.current)
      beatTimer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.level])

  const dark = theme.scene?.dark
  const headline = grants[0] ?? null
  // Only `bookDone` is needed for RENDER now — which of the two headlines beat 2 shows. Whether a
  // chapter closed at all is a BEATS decision, and it lives in the effect that owns the timers.
  const bookDone = grants.some((g) => g.bookCompleted)
  const accent = dark ? '#FFD86B' : '#C77800'

  return (
    <AnimatePresence>
      {event && (
        <Box
          component={motion.div}
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: phoneLandscape ? 0.75 : { xs: 1.5, md: 2.5 },
            textAlign: 'center',
            cursor: 'pointer',
            // NEAR-SOLID scrim (D6). It was 0.86/0.92 with a radial falloff, and the menu's game
            // tiles, back button, corner mascot and reward ring all stayed readable through it —
            // cream-on-cream on the light skins especially. The moment has to be its own screen, not
            // a layer over the one it interrupted. Warm on light worlds, deep on dark worlds; the
            // gradient stays (flat colour banded on the big surface) but both stops are opaque.
            background: dark
              ? 'radial-gradient(circle at 50% 42%, rgba(24,34,72,0.995) 0%, rgba(6,10,30,1) 100%)'
              : 'radial-gradient(circle at 50% 42%, rgba(255,250,235,0.995) 0%, rgba(255,232,178,1) 100%)',
          }}
        >
          {/* Confetti, layered above the scrim — tier chosen in the beats effect above. */}
          <CelebrationEffect
            show={showCelebration}
            intensity={celebrationIntensity}
            duration={celebrationDuration}
            onComplete={stopCelebration}
            sx={{ zIndex: 12001 }}
          />

          {/* BEAT 1 — THE REWARD, and nothing else. */}
          {beat === 'sticker' && headline && (
            <Box sx={{ position: 'relative', zIndex: 12002 }}>
              <StickerReveal
                award={headline}
                accent={accent}
                delay={reduce ? 0 : 0.15}
                // Grown 150 → 230 (D6). Phone-landscape is RE-MEASURED against a 390px-tall viewport,
                // not `230 × ratio` — splitting the beats freed the height the tall variant used to
                // spend, and growing the sticker spends it again (§6.5).
                size={phoneLandscape ? 120 : 230}
                badge={
                  <RewardCounter
                    from={Math.max(0, progressStore.rewardNumber() - grants.length)}
                    to={progressStore.rewardNumber()}
                    fill={onTileColor(accent)}
                    size={phoneLandscape ? 30 : 54}
                    reduce={reduce}
                  />
                }
              />
            </Box>
          )}

          {/* THE 3×3 DOT GRID IS DELETED (D6). It answered "where did it go on this page?", which a
              5-year-old cannot read off nine dots — precise 0–100 magnitude is a 6–8-year-old
              competence — and Min Bog is one tap away and answers it properly, in the book, with the
              pictures. The NUMBER survives, folded into the frame above: deleting it would let the
              count change while nobody is looking (the grant happens at the start of the beats effect,
              so the ring behind the scrim has already ticked by dismiss). */}

          {/* Extra owed rewards (rare — a fast-tier double, or a cross-device merge; unreachable from
              ordinary play past slot 9 since a max round is 62 XP against a 120 XP slot) trail in fast
              behind the headline, with no extra speech. */}
          {beat === 'sticker' && grants.length > 1 && (
            <Box sx={{ position: 'relative', zIndex: 12002, display: 'flex', gap: 1.5 }}>
              {grants.slice(1).map((g, i) => (
                <StickerReveal
                  key={g.reward.id}
                  award={g}
                  accent={accent}
                  delay={reduce ? 0 : 0.6 + ((i + 1) * TRAIL_MS) / 1000}
                  size={phoneLandscape ? 54 : 74}
                />
              ))}
            </Box>
          )}

          {/* BEAT 2 — chapter / book completion, on its OWN screen (D6 §6.3). It used to be two more
              rows stacked under the reveal, the dots and the counter; that column is the owner's
              screenshot. The companion steps up INSIDE this beat, so "a page is full" and "my
              companion grew" are still one event — just not one event among six. */}
          {beat === 'chapter' && (
            <>
              <Box sx={{ position: 'relative', zIndex: 12002 }}>
                <ProgressionCompanion
                  interactive={false}
                  showBadge={false}
                  celebrating={!reduce}
                  size={phoneLandscape ? 96 : 190}
                />
              </Box>
              <Typography
                component={motion.div}
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                // Short delay: this beat is no longer queued behind a reveal, so it lands at once.
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
                sx={{
                  position: 'relative',
                  zIndex: 12002,
                  fontFamily: theme.titleFontFamily ?? COMIC,
                  fontWeight: 800,
                  fontSize: 'clamp(1.6rem, 6vw, 2.8rem)',
                  [PHONE_LANDSCAPE]: { fontSize: '1.3rem' },
                  color: dark ? '#FFFFFF' : '#6B3F00',
                  textShadow: dark ? '0 0 18px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {bookDone ? 'Hele bogen er samlet!' : 'Hele siden er samlet!'}
              </Typography>
            </>
          )}
        </Box>
      )}
    </AnimatePresence>
  )
}

export default RewardOverlay
