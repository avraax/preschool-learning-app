import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material'
import { ArrowLeft, Palette, Shapes } from 'lucide-react'

// Import demo components
import ColorMixTargetDemo from './games/ColorMixTargetDemo'
import ColorMixTargetDemoOld from './games/ColorMixTargetDemoOld'
import ColorMixFreeDemo from './games/ColorMixFreeDemo'
import RainbowBuilderDemo from './games/RainbowBuilderDemo'
import ColorMemoryDemo from './games/ColorMemoryDemo'
import ShapeDetectiveDemo from './games/ShapeDetectiveDemo'
import ShapePuzzleDemo from './games/ShapePuzzleDemo'
import RollingShapesDemo from './games/RollingShapesDemo'
import ShapeSortingDemo from './games/ShapeSortingDemo'
import TangramAnimalsDemo from './games/TangramAnimalsDemo'

interface DemoGame {
  id: string
  name: string
  category: 'colors' | 'shapes'
  component: React.ComponentType<any>
  hasVariations?: boolean
}

const demoGames: DemoGame[] = [
  // Color Games
  {
    id: 'color-mix-target',
    name: 'Ram farven',
    category: 'colors',
    component: ColorMixTargetDemo,
    hasVariations: false
  },
  {
    id: 'color-mix-target-old',
    name: 'Ram farven - old',
    category: 'colors',
    component: ColorMixTargetDemoOld,
    hasVariations: false
  },
  {
    id: 'color-mix-free',
    name: 'Farvemixer',
    category: 'colors',
    component: ColorMixFreeDemo,
    hasVariations: false
  },
  {
    id: 'rainbow-builder',
    name: 'Rainbow Builder',
    category: 'colors',
    component: RainbowBuilderDemo,
    hasVariations: false
  },
  {
    id: 'color-memory',
    name: 'Color Memory',
    category: 'colors',
    component: ColorMemoryDemo,
    hasVariations: false
  },
  // Shape Games
  {
    id: 'shape-detective',
    name: 'Shape Detective',
    category: 'shapes',
    component: ShapeDetectiveDemo
  },
  {
    id: 'shape-puzzle',
    name: 'Shape Puzzle',
    category: 'shapes',
    component: ShapePuzzleDemo
  },
  {
    id: 'rolling-shapes',
    name: 'Rolling Shapes',
    category: 'shapes',
    component: RollingShapesDemo
  },
  {
    id: 'shape-sorting',
    name: 'Shape Sorting',
    category: 'shapes',
    component: ShapeSortingDemo
  },
  {
    id: 'tangram-animals',
    name: 'Tangram Animals',
    category: 'shapes',
    component: TangramAnimalsDemo
  }
]

const DemoPage: React.FC = () => {
  const navigate = useNavigate()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'colors' | 'shapes' | null>(null)

  const currentGame = demoGames.find(g => g.id === selectedGame)
  const GameComponent = currentGame?.component

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId)
  }

  const handleBackToList = () => {
    setSelectedGame(null)
  }

  const handleBackToCategories = () => {
    setSelectedCategory(null)
    setSelectedGame(null)
  }

  // Main category selection view
  if (!selectedCategory) {
    return (
      <Box sx={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* App Bar */}
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
            <IconButton 
              onClick={() => navigate('/')}
              color="primary"
              size="large"
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.8)', 
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(8px)',
                '&:hover': { 
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  transform: 'scale(1.05)'
                }
              }}
            >
              <ArrowLeft size={24} />
            </IconButton>
            <Typography variant="h6" color="text.secondary">
              Demo Page - Test af nye spilkategorier
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" sx={{ mb: 2, fontWeight: 700 }}>
              Vælg kategori at teste
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Test forskellige spilvariationer for 4-6 årige børn
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
            {/* Colors Category */}
            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setSelectedCategory('colors')}
                  sx={{ 
                    cursor: 'pointer',
                    height: 300,
                    background: 'linear-gradient(135deg, #FEE2E2 0%, #FDE68A 50%, #D9F99D 100%)',
                    border: '2px solid transparent',
                    '&:hover': {
                      borderColor: '#EF4444',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}>
                    <Palette size={80} color="#EF4444" />
                    <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                      Farver
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      5 spil om farver og farveblandinger
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Shapes Category */}
            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setSelectedCategory('shapes')}
                  sx={{ 
                    cursor: 'pointer',
                    height: 300,
                    background: 'linear-gradient(135deg, #DBEAFE 0%, #C7D2FE 50%, #A5B4FC 100%)',
                    border: '2px solid transparent',
                    '&:hover': {
                      borderColor: '#3B82F6',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}>
                    <Shapes size={80} color="#3B82F6" />
                    <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                      Former
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      5 spil om geometriske former
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>
    )
  }

  // Game list view
  if (!selectedGame) {
    const categoryGames = demoGames.filter(g => g.category === selectedCategory)
    
    return (
      <Box sx={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        background: selectedCategory === 'colors' 
          ? 'linear-gradient(135deg, #FEE2E2 0%, #FDE68A 50%, #D9F99D 100%)'
          : 'linear-gradient(135deg, #DBEAFE 0%, #C7D2FE 50%, #A5B4FC 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* App Bar */}
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
            <IconButton 
              onClick={handleBackToCategories}
              color="primary"
              size="large"
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.8)', 
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(8px)',
                '&:hover': { 
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  transform: 'scale(1.05)'
                }
              }}
            >
              <ArrowLeft size={24} />
            </IconButton>
            <Typography variant="h6" color="text.secondary">
              {selectedCategory === 'colors' ? 'Farve Spil' : 'Form Spil'}
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Vælg et spil at teste
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {categoryGames.map((game, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={game.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    onClick={() => handleGameSelect(game.id)}
                    sx={{ 
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: selectedCategory === 'colors' ? 'warning.200' : 'primary.200',
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      '&:hover': {
                        borderColor: selectedCategory === 'colors' ? 'warning.main' : 'primary.main',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {game.name}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    )
  }

  // Game demo view
  return (
    <Box sx={{ 
      height: 'calc(var(--vh, 1vh) * 100)',
      bgcolor: 'background.default',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* App Bar with controls */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              onClick={handleBackToList}
              color="primary"
              size="large"
            >
              <ArrowLeft size={24} />
            </IconButton>
            <Typography variant="h6">
              {currentGame?.name}
            </Typography>
          </Box>

        </Toolbar>
      </AppBar>

      {/* Game content */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f5f5f5' }}>
        {GameComponent && <GameComponent />}
      </Box>
    </Box>
  )
}

export default DemoPage