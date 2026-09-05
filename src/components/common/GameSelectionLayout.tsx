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
import RewardRing from './RewardRing'
import ProfileChip from './ProfileChip'
import SceneObjectField, { type SceneFieldItem } from './scene/SceneObjectField'
import { softShadow } from '../../theme/depth'
import { idleFloat } from '../../theme/idleMotion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTransitionNav } from '../../hooks/useTransitionNav'
import { useTransitionContext } from './transition/TransitionProvider'
import { useIdleAttract } from '../../hooks/useIdleAttract'
import { PHONE_ANY, PHONE_LANDSCAPE } from '../../theme/phoneMedia'

interface Game {
  id: string
  title: string
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
  const { rewardNumber } = useProgress()
  const rewardCount = rewardNumber()
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
  // The section landmark's vertical-only idle float — CSS keyframes, not a framer `repeat: Infinity`
  // loop (Performance PRD-01 W1). Same 10px / 5.5s it always had, and still vertical-only so it stays
  // inside its own flex track.
  const landmarkFloat = idleFloat(reduce, { distance: 10, durationS: 5.5 })

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
        {/* BACK + WHERE (left) · progress then WHO (right) — the same arrangement home uses, so the
            child meets ONE header on every surface (owner, 2026-09-05). */}
        <Toolbar sx={{ minHeight: '56px !important', gap: 2, [PHONE_LANDSCAPE]: { minHeight: '44px !important' } }}>
          {/* Shared animated back button — reverses the themed wipe (PRD-02 §8). */}
          <BackButton to="/" variant="menu" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: '0 0 auto', minWidth: 0 }}>
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

          {/* The ring is on every section menu so progress is visible everywhere — and since Reward
              Horizon PRD-01 D3 it is also THE DOOR to Min Bog, on home and here. There is no second
              entrance anywhere; the shelf that used to be one is deleted. It is ALONE in this corner
              again (§2.1): one circular control, the child's book at its centre. */}
          <Box sx={{ flexGrow: 1 }} />
          {/* 28px between the two, not 10 — see HomePage's header for why the gap is load-bearing.
              The eye groups by RELATIVE proximity, so the separator has to beat the widest gap inside
              either control or the pair reads as one compound thing. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3.5, flex: '0 0 auto', minWidth: 0, [PHONE_LANDSCAPE]: { gap: 2.5 } }}>
            <RewardRing
              size={44}
              onTap={() => navigateWithTransition('/album')}
              ariaLabel={`Min Bog — ${rewardCount} klistermærker`}
            />
            {/* WHO IS PLAYING, OUTERMOST — past the ring, in the corner. */}
            <ProfileChip />
          </Box>
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
          /* LANDMARK COLUMN + tile flow, as SIBLINGS IN A ROW (owner's call). The landmark owns a
             reserved left column and the tiles take everything to its right, both vertically centred
             on the same axis, so the section object reads as part of the place rather than as a
             leftover object parked in a corner.
             It must stay a SIBLING, never `position:absolute` as it originally was (`left:2%;top:54%`
             while the flow sized itself independently) — that overlapped the tiles as soon as the flow
             got wide or wrapped (measured 106×46px into "Lær Tal" at 1254×872 and 79×116px into
             "Sammenlign Tal" at 768×1024), and no set of percentages can fix that, because the flow's
             extent depends on game COUNT × viewport × orientation.
             The cost of the column is width: it takes ~1.8 tiles' worth, which is enough to wrap Tal og
             Regning's 7 tiles. `flowSize` is therefore a touch smaller here than the free-standing flow
             would use, and when 7 tiles DO wrap they must wrap 4+3, never 6+1 — the same orphan row the
             quiz grids refuse. Both are verified by measuring every section on every reference viewport
             (the landmark carries `data-bl-landmark` for that probe); re-run it after touching this. */
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 1, md: 2 },
              minHeight: 0,
            }}
          >
            {/* Enlarged section landmark resting large in the framed scene — reinforces "you are in
                the reading/counting place." Decorative (we're already here → non-interactive). Hidden
                on phones, where there is no width to spare and the compact flow owns the screen. The
                idle float is vertical-only, so it stays inside this column. */}
            <Box
              aria-hidden
              // Layout hook for the clearance probe — the landmark has no text or role to select by.
              data-bl-landmark=""
              {...landmarkFloat.props}
              sx={[
                {
                  flex: '0 0 auto',
                  alignSelf: 'center',
                  ml: { xs: '1%', md: '2%' },
                  width: 'clamp(100px, 19vh, 190px)',
                  pointerEvents: 'none',
                  opacity: 0.96,
                  [PHONE_ANY]: { display: 'none' },
                },
                landmarkFloat.sx,
              ]}
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
            {/* `maxWidth` is an ORPHAN BRAKE, not a cosmetic cap. Flex wrap fills each line greedily,
                so a row that is *almost* wide enough for all 7 Tal og Regning tiles drops exactly one
                onto a second line — the orphan the quiz grids refuse. Narrowing the track forces the
                break earlier and the wrap comes out balanced (5+2 / 4+3) instead. */}
            <Box data-bl-tileflow="" sx={{ flex: '1 1 auto', minWidth: 0, maxWidth: 860 }}>
              <SceneObjectField
                items={tileItems}
                frozen={frozen}
                burstMotion={burstMotion}
                attractKey={attractKey}
                float={darkScene}
                flowSize="clamp(62px, 10.5vh, 100px)"
                flowGapX="clamp(10px, 2vw, 26px)"
              />
            </Box>
          </Box>
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
                      <GameTileIcon section={categoryId} id={game.id} />
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
