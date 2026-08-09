import React, { useEffect, useRef, useState } from 'react'
import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import { motion } from 'framer-motion'
import BackButton from '../common/BackButton'
import ProfileBadge from '../common/ProfileBadge'
import { REWARD_CHAPTERS, CHAPTER_COUNT, type Reward } from '../../config/stickers'
import { CHAPTER_SIZE, chapterOfSlot } from '../../config/progression'
import { collectedCountLine } from '../../config/danish-phrases'
import { Check } from 'lucide-react'
import { rewardArt } from '../../assets/rewards'
import { uiArt } from '../../assets/ui'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { sfx } from '../../services/sfxClient'
import { hexToRgba, tileSurface, onTileColor } from '../../theme/tokens/helpers'
import { softShadow, contactShadow } from '../../theme/depth'
import { idlePulse } from '../../theme/idleMotion'
import { devNyt } from '../../utils/devHarness'

// Min Bog (Reward Book PRD-01 W5) at /album — the other half of the model the corner ring shows, and
// since Reward Horizon PRD-01 D3 the ONLY thing the ring's tap leads to.
//
// Slots render in PATH ORDER in exactly three states:
//   • collected — full-colour art + Danish label,
//   • next      — the SAME silhouette treatment as the corner ring, plus an accent glow + slow pulse.
//                 Exactly ONE slot in the whole book is ever in this state,
//   • locked    — a blank tactile plate. Deliberately blank: the old version showed every uncollected
//                 sticker greyed-out with a "?", which spoiled the whole path and made the next one
//                 unremarkable. Anticipation needs exactly one visible target.
//
// There is no gold/duplicate state any more (the gold pass is deleted, §3.5), and the header count has
// **no denominator**: it is the child's ever-rising number, never a distance. The chapter chips are
// ICON-ONLY so the strip scales past 8 chapters without wrapping; the active one auto-opens where the
// child is, and chapters not yet reached stay dimmed BUT TAPPABLE — seeing that there is more book to
// come is the horizon. Full-viewport no-scroll, themed across all skins.

const COMIC = '"Comic Sans MS", "Comic Neue", sans-serif'
// Arrival beat: speak the count once, after the wipe has cleared (never awaited, never repeated).
const SPEAK_COUNT_DELAY_MS = 400

const StickerAlbum: React.FC = () => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { state, markStickersSeen, rewardNumber, nextReward } = useProgress()
  const audio = useSimplifiedAudioHook({ componentId: 'StickerAlbum', autoInitialize: false })
  const [poppedId, setPoppedId] = useState<string | null>(null)
  const [wiggleId, setWiggleId] = useState<string | null>(null)
  const forceNyt = devNyt()

  const immersive = theme.scene.layers.length > 0
  const dark = theme.scene.dark
  const collected = state.stickers.collected
  const newIds = state.stickers.newIds
  const accent = theme.palette.primary.main
  // THE number — rewards handed over, identical to the ring badge (no duplicates exist, so this is
  // also the count of distinct pictures in the book).
  const totalCollected = rewardNumber()
  const next = nextReward()

  // Auto-open at the chapter the child is actually working on. Held in state (not derived) so tapping
  // another chip to browse ahead sticks — it only seeds the initial view. Clamped for the full-book
  // case, where the cursor sits one past the last chapter.
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(CHAPTER_COUNT - 1, chapterOfSlot(totalCollected)),
  )
  const activeChapter = REWARD_CHAPTERS[activeIndex]

  const collectedInChapter = activeChapter.rewards.filter((r) => collected[r.id]).length
  const chapterComplete = collectedInChapter === activeChapter.rewards.length

  // Opening the book marks the "new" rewards as seen (the badges clear on the next visit). The
  // ?nyt=1 harness keeps them so the badge is capturable.
  useEffect(() => {
    if (forceNyt) return
    const t = window.setTimeout(() => markStickersSeen(), 1600)
    return () => window.clearTimeout(t)
  }, [forceNyt, markStickersSeen])

  // Speak the count ONCE on arrival — "Du har treogtyve klistermærker!". This is the one moment the
  // numeral is on screen as a TOTAL while it is read aloud, which is the whole justification for
  // showing a numeral to a pre-reader at all. Delayed past the themed wipe, ref-guarded so a re-render
  // can't re-speak it, and skipped at 0 (there is no count worth announcing on a fresh book).
  const spokenRef = useRef(false)
  useEffect(() => {
    if (spokenRef.current || totalCollected <= 0) return
    spokenRef.current = true
    const t = window.setTimeout(() => {
      try {
        audio.updateUserInteraction()
        audio.speak(collectedCountLine(totalCollected)).catch(() => {})
      } catch {
        /* audio best-effort */
      }
    }, SPEAK_COUNT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [audio, totalCollected])

  const titleColor = dark ? '#FFFFFF' : theme.decor.titleColor

  const handleSlotTap = (reward: Reward, owned: boolean) => {
    if (!owned) {
      // Not yet earned. A silent no-op reads as "broken" at 5 — give a gentle wiggle + a soft tap
      // cue instead. Never a sad/wrong sound; the slot just nudges.
      setWiggleId(reward.id)
      sfx.play('tap')
      window.setTimeout(() => setWiggleId((cur) => (cur === reward.id ? null : cur)), 500)
      return
    }
    setPoppedId(reward.id)
    sfx.play('drop-snap')
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    audio.speak(reward.label).catch(() => {})
    window.setTimeout(() => setPoppedId((cur) => (cur === reward.id ? null : cur)), 600)
  }

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Consistent safe-area top gap (matches GameShell + menus + home).
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        // The page panel now grows into whatever is left, so the bottom inset has to be real padding
        // — otherwise the last row of slots sits under the home indicator.
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)',
        background: immersive
          ? 'transparent'
          : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
      }}
    >
      {/* Header: back (left) + THE number (right). No denominator: "{n} / 72" is a DISTANCE, and a
          5-year-old reads neither the fraction nor the ratio — only the ring's fill signals nearness.
          The honest "how far is left" lives in the adult pane, where the literate party is. */}
      <AppBar position="static" color="transparent" elevation={0}>
        {/* Compact toolbar: a back button + one pill never needed the default 64px row, and every px
            spent here comes straight out of the reward page below it. */}
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            py: 0.5,
            minHeight: '56px !important',
            color: titleColor,
            [PHONE_LANDSCAPE]: { py: 0.25, minHeight: '44px !important' },
          }}
        >
          {/* Shared themed back button — reverses the wipe, consistent with every other surface. */}
          <BackButton to="/" variant="menu" />

          {/* Whose book this is. It matters most HERE — the album is the one screen that is entirely
              one child's property — so the badge sits OUTERMOST past the number, the same ordering
              every other surface uses past the ring. Static and untappable; switching stays behind
              the adult PIN. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <StatPill label={`${totalCollected}`} icon={uiArt.book} accent={accent} />
            <ProfileBadge size={44} />
          </Box>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="md"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: { xs: 0.75, md: 1.25 }, overflow: 'hidden' }}
      >
        {/* Title — one name for one thing (the home card says "Min Bog" too). */}
        <Typography
          sx={{
            textAlign: 'center',
            fontFamily: theme.titleFontFamily,
            fontWeight: 700,
            fontSize: { xs: '1.6rem', md: '2.1rem' },
            color: titleColor,
            textShadow: dark
              ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
              : `1px 1px 2px ${hexToRgba(theme.decor.titleColor, 0.2)}`,
            mb: { xs: 0.75, md: 1 },
            flex: '0 0 auto',
            [PHONE_LANDSCAPE]: { fontSize: '1.05rem', mb: 0.25 },
          }}
          component="h1"
        >
          <Box
            component="img"
            src={uiArt.book}
            alt=""
            aria-hidden
            draggable={false}
            sx={{
              width: { xs: '1.7rem', md: '2.2rem' },
              height: { xs: '1.7rem', md: '2.2rem' },
              objectFit: 'contain',
              verticalAlign: '-0.35em',
              mr: 0.75,
              [PHONE_LANDSCAPE]: { width: '1.1rem', height: '1.1rem', mr: 0.5 },
            }}
          />
          Min Bog
        </Typography>

        {/* Chapter chips — ICON ONLY. The old text tabs were measured to *just* fit one landscape row
            at 5 chapters (274→906 of 1180 on iPad); 8 do not, and wrapping pushes the page panel down
            into the space the 3×3 grid is sized from. A 44px round chip showing the chapter's first
            reward costs 8×44 + gaps ≈ 400px — inside iPad landscape, phone landscape AND 390px
            portrait — and keeps scaling to 12+ chapters, which is the point.
            `flexWrap` stays on as the SAFETY NET it always was: a nowrap row silently CLIPS the end
            chips off the screen edges, and an unreachable chapter is the one thing this must never do.
            The chapter's NAME moved into the progress line below (it was the only thing lost). */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: { xs: 0.75, md: 1 },
            justifyContent: 'center',
            mb: { xs: 0.75, md: 1 },
            flex: '0 0 auto',
            [PHONE_LANDSCAPE]: { mb: 0.5, gap: 0.5 },
            [PHONE_PORTRAIT]: { gap: 0.5, rowGap: 0.5 },
          }}
        >
          {REWARD_CHAPTERS.map((chapter, i) => {
            const done = chapter.rewards.every((r) => collected[r.id])
            const active = i === activeIndex
            // "Not reached yet" = nothing in it is collected. Dimmed, NEVER locked: a 5-year-old gets
            // no walls, and seeing that the book keeps going IS the horizon this PRD is about.
            const reached = chapter.rewards.some((r) => collected[r.id])
            return (
              <Box
                key={chapter.id}
                component="button"
                aria-label={chapter.title}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  sfx.play('tap')
                  setActiveIndex(i)
                }}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  border: '2px solid',
                  borderColor: active ? accent : hexToRgba(accent, 0.3),
                  borderRadius: '999px',
                  p: 0,
                  width: 44,
                  height: 44,
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: reached || active ? 1 : 0.45,
                  transform: active ? 'scale(1.12)' : 'none',
                  color: active ? '#fff' : dark ? '#fff' : theme.palette.text.primary,
                  background: active
                    ? accent
                    : dark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.8)',
                  boxShadow: active ? `0 4px 14px ${hexToRgba(accent, 0.45)}` : 'none',
                  transition: 'all 0.2s ease',
                  // The chip is already at the 44px minimum, so phone variants keep the TARGET and
                  // only shrink the art — never the box.
                  [PHONE_LANDSCAPE]: { width: 44, height: 44 },
                }}
              >
                {/* Chip icon = the chapter's FIRST reward's art (Hund / Bil / Æble / …) — already the
                    subject the chapter stands for, so the strip costs no extra render. */}
                <Box
                  component="img"
                  src={rewardArt(chapter.rewards[0].id)}
                  alt=""
                  draggable={false}
                  sx={{ width: 26, height: 26, objectFit: 'contain', flex: '0 0 auto', userSelect: 'none' }}
                />
                {/* Chapter complete — a UI affordance, so lucide, not baked art (PRD D2/§4 W3). */}
                {done && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: accent,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} strokeWidth={3.5} />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Per-chapter progress — and the chapter's NAME, which the icon-only chips gave up. */}
        <Typography
          sx={{
            textAlign: 'center',
            fontFamily: COMIC,
            fontWeight: 700,
            color: dark ? '#FFE7A8' : accent,
            fontSize: 'clamp(0.9rem, 2.8vw, 1.1rem)',
            mb: { xs: 0.5, md: 0.75 },
            flex: '0 0 auto',
            [PHONE_LANDSCAPE]: { mb: 0.25, fontSize: '0.75rem' },
          }}
        >
          {activeChapter.title} · {collectedInChapter} / {CHAPTER_SIZE} samlet
        </Typography>

        {/* Chapter-complete payoff — a shining ribbon when every reward on the page is collected. */}
        {chapterComplete && (
          <Box
            component={motion.div}
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 16 }}
            sx={{
              alignSelf: 'center',
              px: 2,
              py: 0.4,
              mb: { xs: 0.75, md: 1 },
              borderRadius: '999px',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #FFD86B 0%, #FFB300 100%)',
              border: '2px solid #FF9800',
              boxShadow: '0 4px 14px rgba(255,152,0,0.45)',
              flex: '0 0 auto',
              [PHONE_LANDSCAPE]: { py: 0.2, mb: 0.25 },
              ...(reduce
                ? {}
                : {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)',
                      transform: 'translateX(-120%)',
                      animation: 'albumSetShine 3.2s ease-in-out infinite',
                    },
                    '@keyframes albumSetShine': {
                      '0%': { transform: 'translateX(-120%)' },
                      '60%, 100%': { transform: 'translateX(120%)' },
                    },
                  }),
            }}
          >
            <Typography sx={{ fontFamily: COMIC, fontWeight: 800, color: '#5A3A00', fontSize: 'clamp(0.85rem, 2.8vw, 1.05rem)', position: 'relative', zIndex: 1, [PHONE_LANDSCAPE]: { fontSize: '0.72rem' } }}>
              Hele siden er samlet!
            </Typography>
          </Box>
        )}

        {/* Reward grid (3 columns) — seated on a soft "page" panel so the collection reads as a
            treasured book page inside the world, not a bare floating grid.
            The panel is sized off the LEFTOVER space in BOTH axes: the wrapper is a size container,
            so `min(100cqw, 100cqh)` makes the page the largest square that fits what's actually left
            after the header/title/tabs/count. A width-only cap (the old `maxWidth: 520` + square
            cells) had no idea how tall the leftover was, so the third row was simply clipped off the
            bottom of the viewport on anything shorter than ~880px — and, because the wrapper centres
            its overflow, the panel also grew UP over the "x / 9 samlet" line. */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            containerType: 'size',
          }}
        >
          <Box
            data-album-panel
            sx={{
              position: 'relative',
              // Panel aspect ratio = the grid's shape (3x3 square; the phone-landscape 5x2 override
              // below re-points it). Uniform padding keeps the inner content box square too, so the
              // 1fr rows/columns come out as squares without per-cell aspect ratios.
              '--album-ar': '1',
              width: 'min(100cqw, calc(100cqh * var(--album-ar)), 600px)',
              aspectRatio: 'var(--album-ar)',
              boxSizing: 'border-box',
              p: { xs: 1.5, sm: 2, md: 2.75 },
              borderRadius: '26px',
              border: '1px solid',
              borderColor: dark ? 'rgba(255,255,255,0.16)' : hexToRgba(accent, 0.18),
              background: dark
                ? 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.44) 100%)',
              backdropFilter: immersive ? 'blur(10px) saturate(1.05)' : 'none',
              WebkitBackdropFilter: immersive ? 'blur(10px) saturate(1.05)' : 'none',
              boxShadow: dark
                ? '0 14px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)'
                : '0 14px 40px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.7)',
              // Phone landscape has ~230px of leftover height: a square page would shrink the slots to
              // ~70px, so the page turns wide (5 columns x 2 rows) instead. 5*s+4*gap by 2*s+gap plus
              // the uniform padding ≈ 2.4:1 whatever s resolves to.
              [PHONE_LANDSCAPE]: { '--album-ar': '2.4', p: 1, borderRadius: '18px' },
            }}
          >
          <Box
            data-album-grid
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: { xs: '10px', sm: '14px', md: '18px' },
              width: '100%',
              height: '100%',
              [PHONE_LANDSCAPE]: {
                gridTemplateColumns: 'repeat(5, 1fr)',
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: '8px',
              },
            }}
          >
            {activeChapter.rewards.map((reward, i) => {
              const entry = collected[reward.id]
              // ?nyt=1 harness: force the first slot owned+new so the badge is capturable.
              const forcedHere = forceNyt && i === 0
              const owned = !!entry || forcedHere
              const isNew = forcedHere || newIds.includes(reward.id)
              const isNext = !owned && next?.reward.id === reward.id
              const popped = poppedId === reward.id
              const wiggling = wiggleId === reward.id
              const art = rewardArt(reward.id)
              // The next slot gets the SAME silhouette treatment as the corner ring, so the two
              // surfaces are unmistakably showing one object. Locked slots show NOTHING.
              const silhouette = dark
                ? { filter: 'brightness(0) invert(1)', opacity: 0.45 }
                : { filter: 'brightness(0)', opacity: 0.3 }
              return (
                <Box
                  key={reward.id}
                  component={motion.button}
                  type="button"
                  onClick={() => handleSlotTap(reward, owned)}
                  // The "next prize" breathe used to be the fall-through branch of this framer animate
                  // on a 2.2s `repeat: Infinity` — a JS loop running on an idle album page (PRD-01 W1).
                  // It is now a CSS keyframe animation in the `sx` below. Sharing an element with framer
                  // is safe HERE and only here, because the two are mutually exclusive by construction
                  // (`isNext && !popped && !wiggling`) — a running CSS animation outranks framer's
                  // inline transform in the cascade, so an overlap would silently swallow the pop.
                  animate={
                    reduce
                      ? { scale: 1 }
                      : popped
                        ? { scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }
                        : wiggling
                          ? { rotate: [0, -7, 7, -5, 5, 0] }
                          : { scale: 1 }
                  }
                  transition={{ duration: 0.5 }}
                  sx={[idlePulse(reduce || !isNext || popped || wiggling, { peak: 1.045, durationS: 2.2 }).sx, {
                    position: 'relative',
                    border: '3px solid',
                    borderColor: owned
                      ? hexToRgba(accent, 0.55)
                      : isNext
                        ? accent
                        : hexToRgba(dark ? '#FFFFFF' : '#000000', 0.12),
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: owned ? 'pointer' : 'default',
                    // Same soft-3D clay material as TactileTile in the games (no more #ECF1F8).
                    background: owned
                      ? tileSurface(accent, dark)
                      : dark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.45)',
                    boxShadow: owned
                      ? `0 6px 0 ${hexToRgba(accent, 0.5)}, 0 8px 18px rgba(0,0,0,0.15)`
                      : isNext
                        ? `0 0 0 4px ${hexToRgba(accent, 0.28)}, 0 6px 18px ${hexToRgba(accent, 0.35)}`
                        : 'inset 0 2px 8px rgba(0,0,0,0.08)',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }]}
                >
                  {/* Grounding contact shadow under a collected reward — the shell's clay language. */}
                  {owned && !reduce && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        bottom: 6,
                        left: '18%',
                        width: '64%',
                        height: 10,
                        borderRadius: '50%',
                        background: contactShadow(accent, 0.7),
                        filter: 'blur(3px)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* The reward itself — full colour when collected, a silhouette for the NEXT one,
                      and nothing at all for a locked slot (a blank plate). */}
                  {(owned || isNext) && (
                    <Box
                      component="img"
                      src={art}
                      alt=""
                      draggable={false}
                      sx={{
                        position: 'relative',
                        width: '62%',
                        height: '62%',
                        objectFit: 'contain',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        filter: owned && !reduce ? softShadow(1) : undefined,
                        ...(isNext ? silhouette : {}),
                      }}
                    />
                  )}

                  {/* "nyt!" badge on a freshly collected reward (clears on the next visit). */}
                  {owned && isNew && (
                    <Box
                      data-nyt-badge
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -6,
                        px: 0.9,
                        py: 0.15,
                        borderRadius: '999px',
                        background: 'linear-gradient(180deg, #FF6B6B 0%, #E53935 100%)',
                        color: '#fff',
                        fontFamily: COMIC,
                        fontWeight: 800,
                        fontSize: 'clamp(0.6rem, 2vw, 0.8rem)',
                        boxShadow: '0 2px 8px rgba(229,57,53,0.5)',
                        transform: 'rotate(-8deg)',
                        zIndex: 2,
                      }}
                    >
                      nyt!
                    </Box>
                  )}
                  {owned && (
                    <Typography
                      sx={{
                        position: 'relative',
                        fontFamily: COMIC,
                        fontWeight: 700,
                        fontSize: 'clamp(0.6rem, 2vw, 0.85rem)',
                        // Accent-on-white surface → the AA-safe variant, never the raw accent.
                        color: onTileColor(accent),
                        lineHeight: 1.1,
                        mt: 0.25,
                      }}
                    >
                      {reward.label}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

const StatPill: React.FC<{ label: string; accent: string; icon?: string }> = ({ label, accent, icon }) => (
  <Box
    sx={{
      px: 1.5,
      py: 0.5,
      borderRadius: '999px',
      bgcolor: accent,
      color: '#fff',
      fontFamily: COMIC,
      fontWeight: 700,
      fontSize: '1rem',
      boxShadow: `0 4px 14px ${hexToRgba(accent, 0.4)}`,
      display: 'flex',
      alignItems: 'center',
      gap: 0.6,
    }}
  >
    {icon && (
      <Box
        component="img"
        src={icon}
        alt=""
        aria-hidden
        draggable={false}
        sx={{ width: '1.2rem', height: '1.2rem', objectFit: 'contain', flex: '0 0 auto' }}
      />
    )}
    {label}
  </Box>
)

export default StickerAlbum
