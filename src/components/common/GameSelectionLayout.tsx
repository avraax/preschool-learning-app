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
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { sectionIconImages } from '../../assets/themes/icons'
import { gameIconImages } from '../../assets/themes/icons/games'
import ThemeMascot from './ThemeMascot'
import LivingCard from './LivingCard'
import GameTileIcon from './GameTileIcon'
import BackButton from './BackButton'
import LevelRingMini from './LevelRingMini'
import SceneObjectField, { type SceneFieldItem } from './scene/SceneObjectField'
import { softShadow } from '../../theme/depth'
import { useReducedMotion } from '../../hooks/useReducedMotion'
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
  const reduce = useReducedMotion()
  // Category colors/content (active skin) + the built theme for themed title/cards. The world layer
  // (scene + ambient + mascot + parallax) is rendered once, app-wide, by <PersistentWorld/>, which
  // ALSO frames the scene on this section's locale + applies the accent tint (PRD-05 W4).
  const catTheme = getCategoryTheme(categoryId)
  const theme = useTheme()
  // Authored world for this skin → immersive treatment (objects seated in the framed scene). Flat
  // skins keep the original category-gradient card grid.
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light header text + floating tiles
  const burstMotion = theme.scene.ambient.motion

  // Game tiles as tactile soft-3D objects seated on the framed scene (immersive). Built with the
  // per-game icon art (B2 registry, keyed <section>.<id>), falling back to the section object.
  const tileItems: SceneFieldItem[] = games.map((game) => ({
    key: game.id,
    art: gameIconImages[`${categoryId}.${game.id}`] ?? sectionIconImages[categoryId],
    label: game.title,
    accent: catTheme.accentColor,
    onActivate: () => navigateWithTransition(game.route),
  }))

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
  const attractKey = attractOn ? (games[attractIndex]?.id ?? null) : null

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100dvh',
        overflow: 'hidden',
        // Immersive skins: transparent so the app-wide framed <PersistentWorld/> shows through.
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
        sx={{ backgroundColor: 'transparent', flex: '0 0 auto', position: 'relative', zIndex: 3 }}
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
                // Readable-on-white accent on light scenes (onTileColor); white on dark scenes.
                color: darkScene ? '#FFFFFF' : catTheme.onTileColor,
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
              too, so progress is visible everywhere. */}
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
        {immersive ? (
          <>
            {/* Enlarged section landmark resting large in the framed scene — reinforces "you are in
                the reading/counting place." Decorative (we're already here → non-interactive). Hidden
                on phones to keep the compact layout uncluttered. */}
            <Box
              aria-hidden
              component={motion.div}
              animate={reduce ? undefined : { y: [0, -10, 0] }}
              transition={reduce ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              sx={{
                position: 'absolute',
                left: '2%',
                top: '54%',
                transform: 'translateY(-50%)',
                width: 'clamp(120px, 22vh, 230px)',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 0.96,
                [PHONE_ANY]: { display: 'none' },
              }}
            >
              <Box
                component="img"
                src={sectionIconImages[categoryId]}
                alt=""
                draggable={false}
                sx={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', filter: softShadow(2.4), userSelect: 'none' }}
              />
            </Box>

            {/* Game tiles as tactile soft-3D objects in a count-aware tactile flow (never a grid). */}
            <Box sx={{ position: 'relative', zIndex: 1, width: '100%' }}>
              <SceneObjectField
                items={tileItems}
                frozen={frozen}
                burstMotion={burstMotion}
                attractKey={attractKey}
                float={darkScene}
                flowSize="clamp(66px, 12vh, 116px)"
              />
            </Box>
          </>
        ) : (
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
                      background: game.gradient,
                      color: 'white',
                      borderRadius: '16px',
                      '@media (hover: hover) and (pointer: fine)': {
                        '&:hover': {
                          borderColor: catTheme.hoverBorderColor,
                          boxShadow: 6,
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
                      <GameTileIcon section={categoryId} id={game.id} fallbackEmoji={game.emoji} />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
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
        )}
      </Container>

      {/* Small idle mascot, bottom-left corner — rendered INSIDE the page (like the in-game Mascot)
          rather than in the persistent world layer, which avoids the hover-compositing flicker. */}
      <ThemeMascot
        parallaxDepth={0}
        attract={attractOn}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 4px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 84, sm: 96, md: 112 },
          height: { xs: 84, sm: 96, md: 112 },
          // Phones: keep the buddy out of the tile flow.
          [PHONE_ANY]: { width: 52, height: 52 },
        }}
      />
    </Box>
  )
}

export default GameSelectionLayout
