import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Container, Card, CardContent, Typography, Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { useProgress } from '../../hooks/useProgress'
import { useTransitionNav } from '../../hooks/useTransitionNav'
import { useTransitionContext } from '../common/transition/TransitionProvider'
import { useIdleAttract } from '../../hooks/useIdleAttract'
import { PHONE_ANY, PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { sectionIconImages } from '../../assets/themes/icons'
import { defaultHomeAnchors, SCENE_SECTION_ORDER } from '../../theme/tokens/helpers'
import type { SceneSectionId } from '../../theme/tokens/types'
import RewardRing from '../common/RewardRing'
import ThemeMascot from '../common/ThemeMascot'
import LivingCard from '../common/LivingCard'
import SceneObjectField, { type SceneFieldItem } from '../common/scene/SceneObjectField'
import appLogo from '../../assets/logo.webp'

// Home base (Liveliness PRD-02 §10; RESKINNED by PRD-05 W3 into the "Structured World"). For
// IMMERSIVE skins the frosted card grid is replaced by the 5 section objects seated in the world
// (SceneObjectField at theme.scene.homeAnchors). FLAT/unregistered skins keep the original card
// grid untouched. Content/layout config only; all styling comes from theme tokens.
//
// **There is no Min Bog shelf here any more** (Reward Horizon PRD-01 D3/§4.2). The corner ring is the
// ONE door to the book: two objects at opposite ends of the same screen, both meaning "your rewards",
// is the confusion the whole PRD exists to remove — and home gets the space back for the world. Do not
// re-add a second entrance; `rewardSurfaces.test.ts` fails the build if one appears.
type HomeCardId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'

// Section → its menu route (the SectionId `colors` lives at `/farver`).
const SECTION_ROUTES: Record<SceneSectionId, string> = {
  alphabet: '/alphabet',
  math: '/math',
  colors: '/farver',
  english: '/english',
  ordleg: '/ordleg',
}

const homeCards: Array<{
  id: HomeCardId
  route: string
  initial: { opacity: number; x?: number; y?: number }
  delay: number
}> = [
  { id: 'alphabet', route: '/alphabet', initial: { opacity: 0, x: -30 }, delay: 0 },
  { id: 'math', route: '/math', initial: { opacity: 0, y: -30 }, delay: 0.1 },
  { id: 'colors', route: '/farver', initial: { opacity: 0, x: 30 }, delay: 0.2 },
  { id: 'english', route: '/english', initial: { opacity: 0, y: 30 }, delay: 0.3 },
  { id: 'ordleg', route: '/ordleg', initial: { opacity: 0, x: 30 }, delay: 0.4 },
]

const HomePage: React.FC = () => {
  const theme = useTheme()
  const { navigateWithTransition } = useTransitionNav()
  const transitionPhase = useTransitionContext()?.phase ?? 'idle'
  // Pause the breathe while a wipe covers the home (menu no longer foreground).
  const frozen = transitionPhase !== 'idle'
  // This theme has an authored world → use immersive treatments (objects seated in the scene). The
  // world itself (parallax scene + ambient + mascot) is rendered once, app-wide, by <PersistentWorld/>.
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light title + floating objects
  const burstMotion = theme.scene.ambient.motion
  const { rewardNumber } = useProgress()
  // THE number — rewards handed over, the same one the ring badge and the book header show.
  const rewardsOwned = rewardNumber()

  // The 5 section objects, built FROM the theme's home anchors so item ↔ anchor stay index-aligned
  // regardless of the authored order. Each is a tappable soft-3D object that lives in the world.
  const anchors = theme.scene.homeAnchors ?? defaultHomeAnchors()
  const sceneItems: SceneFieldItem[] = anchors.map((a) => {
    const cat = getCategoryTheme(a.section)
    return {
      key: a.section,
      art: sectionIconImages[a.section],
      label: cat.name,
      accent: cat.accentColor,
      rotate: a.rotate,
      onActivate: () => navigateWithTransition(SECTION_ROUTES[a.section]),
    }
  })

  // Idle / attract loop (PRD-02 §6): after ~8s idle, wiggle the mascot + exactly one object/card
  // (rotate the target each cycle). `attractOn` toggles true→false so the same one re-fires next cycle.
  const [attractIndex, setAttractIndex] = useState(-1)
  const [attractOn, setAttractOn] = useState(false)
  const attractCounter = useRef(0)
  const attractTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onAttract = useCallback(() => {
    const i = attractCounter.current % homeCards.length
    attractCounter.current += 1
    setAttractIndex(i)
    setAttractOn(true)
    if (attractTimer.current) clearTimeout(attractTimer.current)
    attractTimer.current = setTimeout(() => setAttractOn(false), 1300)
  }, [])
  useIdleAttract({ onAttract })
  useEffect(() => () => { if (attractTimer.current) clearTimeout(attractTimer.current) }, [])
  const attractKey = attractOn ? (SCENE_SECTION_ORDER[attractIndex] ?? null) : null

  return (
    <Box
      className="interactive-area"
      sx={{
        position: 'relative',
        height: 'calc(var(--vh, 1vh) * 100)',
        '@supports (height: 100dvh)': { height: '100dvh' },
        background: immersive ? 'transparent' : `${theme.decor.pageBackground},\n${theme.decor.dots}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        touchAction: 'pan-x pan-down pinch-zoom',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        '&::before': {
          content: '""',
          display: immersive ? 'none' : 'block',
          position: 'absolute',
          bottom: -100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150%',
          height: 400,
          background: theme.decor.rainbow,
          borderRadius: '50%',
          opacity: 0.9,
          animation: 'rainbowShimmer 8s ease-in-out infinite alternate',
          zIndex: 0,
        },
        '@keyframes rainbowShimmer': {
          '0%': { opacity: 0.8, transform: 'translateX(-50%) scale(1)' },
          '100%': { opacity: 1, transform: 'translateX(-50%) scale(1.05)' },
        },
      }}
    >
      {/* IMMERSIVE: the 5 section objects seated in the world, spanning the full scene (behind the
          header chrome, which sits in the top safe band the anchors keep clear). On phones/portrait
          this falls back to a centred tactile flow (never a card grid). */}
      {immersive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // In flow mode (phones) keep the band clear of the header (top) and the mascot + corner
            // gear (bottom) — the Min Bog shelf that used to claim the bottom band is gone.
            py: { xs: 'clamp(72px, 16vh, 120px)', md: 0 },
          }}
        >
          <SceneObjectField
            items={sceneItems}
            anchors={anchors}
            frozen={frozen}
            burstMotion={burstMotion}
            attractKey={attractKey}
            float={darkScene}
          />
        </Box>
      )}

      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          position: 'relative',
          zIndex: 3,
          // Immersive: the middle is the world's seating area — let taps fall through to the objects
          // there; only the header row is interactive.
          pointerEvents: immersive ? 'none' : 'auto',
          [PHONE_LANDSCAPE]: { py: 0.75 },
        }}
      >
        {/* Header row: brand lockup (left) + the reward ring (right). */}
        <Box sx={{ position: 'relative', zIndex: 2, pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: { xs: 1.5, md: 2 }, [PHONE_LANDSCAPE]: { mb: 0.75 } }}>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, md: 2 } }}>
              <Box
                component="img"
                src={appLogo}
                alt=""
                draggable={false}
                sx={{
                  width: { xs: 44, sm: 52, md: 60 },
                  height: { xs: 44, sm: 52, md: 60 },
                  borderRadius: '24%',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  userSelect: 'none',
                  flexShrink: 0,
                  [PHONE_LANDSCAPE]: { width: 32, height: 32 },
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontFamily: theme.titleFontFamily,
                  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
                  fontWeight: 700,
                  [PHONE_LANDSCAPE]: { fontSize: '1.3rem' },
                  color: darkScene ? '#FFFFFF' : theme.decor.titleColor,
                  textShadow: darkScene
                    ? '0 0 18px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.55)'
                    : immersive
                      ? '0 1px 0 rgba(255,255,255,0.7), 0 0 16px rgba(255,255,255,0.5), 0 3px 8px rgba(0,30,50,0.35)'
                      : `2px 2px 8px ${alpha(theme.decor.titleColor, 0.25)}`,
                  letterSpacing: '0.02em',
                }}
              >
                Børnelæring
              </Typography>
            </Box>
          </motion.div>

          {/* The NEXT REWARD, exactly as the section menus and every game header show it — same object,
              same corner, on every screen. Tapping it OPENS MIN BOG: the ring is the door (D3), which
              is why the tap no longer just speaks the count. The count is spoken on ARRIVAL in the book
              instead, where the numeral is actually on screen while it is read aloud. */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <RewardRing
              size={immersive ? 52 : 48}
              onTap={() => navigateWithTransition('/album')}
              ariaLabel={`Min Bog — ${rewardsOwned} klistermærker`}
              sx={{ [PHONE_LANDSCAPE]: { width: 36, height: 36 } }}
            />
          </motion.div>
        </Box>

        {/* FLAT skins keep the original frosted card grid (no world to seat objects in). */}
        {!immersive && (
          <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
            <Box
              sx={{
                mb: { xs: 2, md: 3 },
                width: '100%',
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 270px))', md: 'repeat(3, minmax(0, 270px))' },
                gridAutoRows: 'auto',
                gap: '16px',
                justifyContent: 'center',
                alignItems: 'center',
                '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(3, minmax(0, 270px))' },
                [PHONE_LANDSCAPE]: { gap: '10px', gridTemplateColumns: 'repeat(5, minmax(0, 150px))', mb: 1 },
              }}
            >
              {homeCards.map((card, index) => {
                const cat = theme.categories[card.id]
                const content = categoryThemes[card.id]
                return (
                  <motion.div
                    key={card.id}
                    initial={card.initial}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.6, delay: card.delay }}
                    whileHover={{ scale: 1.02 }}
                    style={{ width: '100%' }}
                  >
                    <LivingCard
                      index={index}
                      frozen={frozen}
                      attract={attractOn && attractIndex === index}
                      burstMotion={burstMotion}
                      onActivate={() => navigateWithTransition(card.route)}
                      sx={{ width: '100%' }}
                    >
                      <Card
                        sx={{
                          width: '100%',
                          aspectRatio: '16 / 10',
                          border: '2px solid',
                          borderColor: cat.border,
                          display: 'flex',
                          flexDirection: 'column',
                          background: cat.cardSurface,
                          backdropFilter: cat.cardBlur,
                          WebkitBackdropFilter: cat.cardBlur,
                          '&:hover': {
                            borderColor: cat.hoverBorder,
                            boxShadow: `0 8px 32px ${alpha(cat.accent, 0.3)}`,
                            transform: 'translateY(-2px)',
                          },
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <CardContent
                          sx={{
                            p: { xs: 1, md: 1.5 },
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: { xs: 0.5, md: 0.75 },
                          }}
                        >
                          <Box
                            component="img"
                            src={sectionIconImages[card.id]}
                            alt=""
                            draggable={false}
                            sx={{
                              display: 'block',
                              width: { xs: 42, sm: 48, md: 56 },
                              height: { xs: 42, sm: 48, md: 56 },
                              objectFit: 'contain',
                              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
                              userSelect: 'none',
                            }}
                          />
                          <Typography sx={{ fontWeight: 700, fontSize: 'clamp(0.85rem, 2.4vh, 1.2rem)', lineHeight: 1.1, color: cat.onCard }}>
                            {content.name}
                          </Typography>
                        </CardContent>
                      </Card>
                    </LivingCard>
                  </motion.div>
                )
              })}
            </Box>
          </Box>
        )}

        {/* Immersive: a flexible spacer fills the middle (the world's seating area shows through). */}
        {immersive && <Box sx={{ flex: 1, minHeight: 0 }} />}

      </Container>

      {/* Per-world mascot — rendered INSIDE the page (flicker-safe). Idle-attract nudges it. */}
      <ThemeMascot
        parallaxDepth={0}
        attract={attractOn}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 6px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 128, sm: 156, md: 184 },
          height: { xs: 128, sm: 156, md: 184 },
          [PHONE_ANY]: { width: 64, height: 64 },
        }}
      />
    </Box>
  )
}

export default HomePage
