import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  AppBar,
  Toolbar
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { sectionIconImages } from '../../assets/themes/icons'
import ThemeMascot from './ThemeMascot'
import LivingCard from './LivingCard'
import GameTileIcon from './GameTileIcon'
import BackButton from './BackButton'
import LevelRingMini from './LevelRingMini'
import { useTransitionNav } from '../../hooks/useTransitionNav'
import { useTransitionContext } from './transition/TransitionProvider'
import { useIdleAttract } from '../../hooks/useIdleAttract'
import { PHONE_ANY, PHONE_LANDSCAPE } from '../../theme/phoneMedia'

interface Game {
  id: string
  title: string
  emoji: string
  route: string
  gradient: string
}

interface GameSelectionLayoutProps {
  categoryId: 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
  games: Game[]
}

const GameSelectionLayout: React.FC<GameSelectionLayoutProps> = ({
  categoryId,
  games
}) => {
  const { navigateWithTransition } = useTransitionNav()
  const transitionPhase = useTransitionContext()?.phase ?? 'idle'
  const frozen = transitionPhase !== 'idle'
  // Category colors/content (active skin) + the built theme for themed title/cards. The world
  // layer (scene + ambient + mascot + parallax) is rendered once, app-wide, by <PersistentWorld/>.
  const catTheme = getCategoryTheme(categoryId)
  const theme = useTheme()
  // Authored world for this skin → immersive treatments (glassy cards, title treatment). Flat
  // skins keep the original category-gradient look.
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light header text
  const burstMotion = theme.scene.ambient.motion
  // Glass card surface. Dark worlds (Rummet) need a MORE opaque light glass: the home recipe
  // (62→46% white) blurs to a muddy grey over a dark scene and kills accent-text contrast, so
  // dark scenes get a lighter frosted card to keep the PRD's "cards stay light & readable".
  const cardGlass = darkScene
    ? 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.46) 100%)'

  // Idle / attract loop (PRD-02 §6): after ~8s idle, wiggle the mascot + exactly one tile.
  const [attractIndex, setAttractIndex] = useState(-1)
  const [attractOn, setAttractOn] = useState(false)
  const attractCounter = useRef(0)
  const attractTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onAttract = useCallback(() => {
    const i = games.length ? attractCounter.current % games.length : 0
    attractCounter.current += 1
    setAttractIndex(i)
    setAttractOn(true)
    if (attractTimer.current) clearTimeout(attractTimer.current)
    attractTimer.current = setTimeout(() => setAttractOn(false), 1300)
  }, [games.length])
  useIdleAttract({ onAttract })
  useEffect(() => () => { if (attractTimer.current) clearTimeout(attractTimer.current) }, [])

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100dvh',
        overflow: 'hidden',
        // Immersive skins: transparent so the app-wide <PersistentWorld/> scene shows through.
        // Flat skins keep the bold category gradient.
        background: immersive ? 'transparent' : catTheme.gradient,
        display: 'flex',
        flexDirection: 'column',
        // Keep the header clear of the iOS status bar / notch (standalone PWA).
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Compact App Bar — content sits above the persistent world */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ backgroundColor: 'transparent', flex: '0 0 auto', position: 'relative', zIndex: 2 }}
      >
        <Toolbar sx={{ minHeight: '56px !important', gap: 2, [PHONE_LANDSCAPE]: { minHeight: '44px !important' } }}>
          {/* Shared animated back button — reverses the themed wipe (PRD-02 §8). */}
          <BackButton to="/" variant="menu" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {/* Soft-3D section icon (theme-constant) replaces the flat emoji. */}
            <Box
              component="img"
              src={sectionIconImages[categoryId]}
              alt=""
              draggable={false}
              sx={{
                width: 40,
                height: 40,
                objectFit: 'contain',
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.22))',
                userSelect: 'none'
              }}
            />
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontFamily: theme.titleFontFamily,
                fontWeight: 700,
                color: darkScene ? '#FFFFFF' : catTheme.accentColor,
                textShadow: darkScene
                  ? '0 0 16px rgba(120,170,255,0.6), 0 2px 8px rgba(0,0,0,0.55)'
                  : immersive
                    ? '0 1px 0 rgba(255,255,255,0.7), 0 0 14px rgba(255,255,255,0.5), 0 2px 6px rgba(0,30,50,0.3)'
                    : 'none',
                letterSpacing: '0.01em'
              }}
            >
              {catTheme.name}
            </Typography>
          </Box>

          {/* Level is primary (Liveliness PRD-04 §7): the shared cross-game ring on the section menu
              too, so progress is visible everywhere. No in-game flourish here — a level-up crossed on
              this surface is celebrated by the app-root ceremony (LevelUpOverlay), not a mini burst. */}
          <Box sx={{ flexGrow: 1 }} />
          <LevelRingMini size={44} />
        </Toolbar>
      </AppBar>

      {/* Main Content — fills remaining height, never scrolls */}
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          py: { xs: 2, md: 3 },
          [PHONE_LANDSCAPE]: { py: 0.5 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 270px))', md: 'repeat(3, minmax(0, 270px))' },
            gridAutoRows: 'auto',
            gap: '16px',
            justifyContent: 'center',
            alignItems: 'center',
            '@media (orientation: landscape)': {
              gridTemplateColumns: games.length <= 4 ? 'repeat(2, minmax(0, 270px))' : 'repeat(3, minmax(0, 270px))'
            },
            [PHONE_LANDSCAPE]: {
              gap: '10px',
              gridTemplateColumns: games.length <= 4
                ? `repeat(${games.length}, minmax(0, 180px))`
                : 'repeat(4, minmax(0, 180px))',
            },
          }}
        >
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ scale: 1.03 }}
              style={{ width: '100%' }}
            >
              <LivingCard
                index={index}
                frozen={frozen}
                attract={attractOn && attractIndex === index}
                burstMotion={burstMotion}
                onActivate={() => navigateWithTransition(game.route)}
                sx={{ width: '100%' }}
              >
                <Card
                  sx={{
                    width: '100%',
                    aspectRatio: '16 / 10',
                    border: '3px solid',
                    borderColor: catTheme.borderColor,
                    // Immersive worlds: frosted glass so the scene shows through (matches the
                    // home section cards). Flat skins keep the bold per-game gradient.
                    background: immersive ? cardGlass : game.gradient,
                    backdropFilter: immersive ? 'blur(16px) saturate(1.1)' : undefined,
                    WebkitBackdropFilter: immersive ? 'blur(16px) saturate(1.1)' : undefined,
                    // Immersive glass cards: AA-guaranteed label colour (fixes warm-accent legibility).
                    color: immersive ? catTheme.onCardColor : 'white',
                    borderRadius: '16px',
                    '@media (hover: hover) and (pointer: fine)': {
                      '&:hover': {
                        borderColor: catTheme.hoverBorderColor,
                        boxShadow: immersive ? `0 8px 32px ${alpha(catTheme.accentColor, 0.3)}` : 6,
                        transform: 'translateY(-4px)'
                      }
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <CardContent sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: { xs: 0.5, md: 0.75 },
                    p: { xs: 1, md: 1.5 },
                    '&:last-child': { pb: { xs: 1, md: 1.5 } }
                  }}>
                    {/* Unified soft-3D-styled icon (matches home section icons). Keyed
                        <section>.<id> so per-game art can't collide across sections (W4.1). */}
                    <GameTileIcon section={categoryId} id={game.id} fallbackEmoji={game.emoji} />
                    <Typography
                      sx={{
                        fontWeight: 700,
                        // Glass cards carry dark themed text (no shadow); gradient cards keep
                        // white text with a soft drop shadow for contrast.
                        textShadow: immersive ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)',
                        fontSize: 'clamp(0.85rem, 2.4vh, 1.2rem)',
                        lineHeight: 1.1
                      }}
                    >
                      {game.title}
                    </Typography>
                  </CardContent>
                </Card>
              </LivingCard>
            </motion.div>
          ))}
        </Box>
      </Container>

      {/* Small idle mascot, bottom-left corner — rendered INSIDE the page (like the in-game
          Mascot) rather than in the persistent world layer, which avoids the hover-compositing
          flicker. parallaxDepth 0 → stays put. */}
      <ThemeMascot
        parallaxDepth={0}
        attract={attractOn}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 4px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 84, sm: 96, md: 112 },
          height: { xs: 84, sm: 96, md: 112 },
          // Phones: keep the buddy out of the card grid (it overlapped bottom-row cards).
          [PHONE_ANY]: { width: 52, height: 52 },
        }}
      />
    </Box>
  )
}

export default GameSelectionLayout
