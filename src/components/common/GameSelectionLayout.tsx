import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { ArrowLeft } from 'lucide-react'
import { getCategoryTheme } from '../../config/categoryThemes'
import { sectionIconImages } from '../../assets/themes/icons'
import ThemeMascot from './ThemeMascot'

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
  const navigate = useNavigate()
  // Category colors/content (active skin) + the built theme for themed title/cards. The world
  // layer (scene + ambient + mascot + parallax) is rendered once, app-wide, by <PersistentWorld/>.
  const catTheme = getCategoryTheme(categoryId)
  const theme = useTheme()
  // Authored world for this skin → immersive treatments (glassy cards, title treatment). Flat
  // skins keep the original category-gradient look.
  const immersive = theme.scene.layers.length > 0
  const darkScene = theme.scene.dark // dark backdrop (e.g. Rummet) → light header text
  // Glass card surface. Dark worlds (Rummet) need a MORE opaque light glass: the home recipe
  // (62→46% white) blurs to a muddy grey over a dark scene and kills accent-text contrast, so
  // dark scenes get a lighter frosted card to keep the PRD's "cards stay light & readable".
  const cardGlass = darkScene
    ? 'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.68) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.46) 100%)'

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
        flexDirection: 'column'
      }}
    >
      {/* Compact App Bar — content sits above the persistent world */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        // Transparent so the scene runs edge-to-edge; the back button carries its own circular
        // background and the title has the glow/halo treatment, so no header band is needed.
        sx={{ backgroundColor: 'transparent', flex: '0 0 auto', position: 'relative', zIndex: 2 }}
      >
        <Toolbar sx={{ minHeight: '56px !important' }}>
          <IconButton
            edge="start"
            onClick={() => navigate('/')}
            sx={{
              mr: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
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
                // Title treatment mirrors home: dark scenes get light text + glow; light
                // immersive scenes get a soft white halo; flat skins keep the accent color.
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
        </Toolbar>
      </AppBar>

      {/* Main Content — fills remaining height, never scrolls */}
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          py: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2
        }}
      >
        {/* Games grid. One continuous rule (no card-count branching): rows always divide the
            available height (`1fr`) so the menu NEVER scrolls and shrinks as games multiply,
            while each card carries a max width/height + is centered in its cell — so a few
            games render as scene-framed tiles (capped) and many games shrink below the cap to
            fit. Grid width is capped + centered so 2-col layouts don't spread too wide. */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            maxWidth: 1000,
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gridAutoRows: 'minmax(0, 1fr)',
            gap: { xs: 1.5, md: 2.5 },
            alignContent: 'center',
            justifyContent: 'center',
            '@media (orientation: landscape)': {
              gridTemplateColumns: games.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'
            }
          }}
        >
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              // Fill the cell but center a max-capped card inside it (cap applies when few
              // games leave the row tall; the card shrinks with the row when there are many).
              style={{ height: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Card
                onClick={() => navigate(game.route)}
                sx={{
                  height: '100%',
                  width: '100%',
                  maxHeight: 300,
                  maxWidth: 460,
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: catTheme.borderColor,
                  // Immersive worlds: frosted glass so the scene shows through (matches the
                  // home section cards). Flat skins keep the bold per-game gradient.
                  background: immersive ? cardGlass : game.gradient,
                  backdropFilter: immersive ? 'blur(16px) saturate(1.1)' : undefined,
                  WebkitBackdropFilter: immersive ? 'blur(16px) saturate(1.1)' : undefined,
                  color: immersive ? catTheme.accentColor : 'white',
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
                  gap: { xs: 0.5, md: 1 },
                  p: { xs: 1.5, md: 2 },
                  '&:last-child': { pb: { xs: 1.5, md: 2 } }
                }}>
                  <Typography sx={{
                    fontSize: 'clamp(2rem, 9vh, 4.5rem)',
                    lineHeight: 1
                  }}>
                    {game.emoji}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      // Glass cards carry dark themed text (no shadow); gradient cards keep
                      // white text with a soft drop shadow for contrast.
                      textShadow: immersive ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)',
                      fontSize: 'clamp(0.95rem, 3.2vh, 1.5rem)',
                      lineHeight: 1.1
                    }}
                  >
                    {game.title}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
      </Container>

      {/* Small idle mascot, bottom-left corner — rendered INSIDE the page (like the in-game
          GameGuide) rather than in the persistent world layer, which avoids the hover-compositing
          flicker. parallaxDepth 0 → stays put. */}
      <ThemeMascot
        parallaxDepth={0}
        sx={{
          left: 'calc(env(safe-area-inset-left) + 4px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
          width: { xs: 84, sm: 96, md: 112 },
          height: { xs: 84, sm: 96, md: 112 }
        }}
      />
    </Box>
  )
}

export default GameSelectionLayout
