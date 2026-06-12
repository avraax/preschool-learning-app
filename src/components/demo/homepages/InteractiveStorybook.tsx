import React, { useState, useEffect } from 'react'
import { Box, Typography, Fab, IconButton } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface StoryPage {
  id: number
  title: string
  text: string
  characters: Array<{
    emoji: string
    name: string
    position: { x: number; y: number }
    route?: string
    animation?: any
  }>
  background: string
  effects?: Array<{
    type: 'float' | 'sparkle' | 'bounce'
    emoji: string
    count: number
  }>
}

const storyPages: StoryPage[] = [
  {
    id: 1,
    title: "Eventyrets Begyndelse",
    text: "Velkommen til det magiske eventyrland, hvor læring og magi mødes!",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    characters: [
      { emoji: "🧙‍♂️", name: "Læringsmesteren", position: { x: 50, y: 60 } },
      { emoji: "✨", name: "Magi", position: { x: 30, y: 40 } },
      { emoji: "📚", name: "Visdom", position: { x: 70, y: 40 } }
    ],
    effects: [
      { type: 'sparkle', emoji: '✨', count: 8 },
      { type: 'float', emoji: '🌟', count: 5 }
    ]
  },
  {
    id: 2,
    title: "Bogstavernes Rige",
    text: "I det første kongerige bor alle bogstaverne fra A til Å. Vil du besøge dem?",
    background: "linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)",
    characters: [
      { 
        emoji: "🅰️", 
        name: "Bogstav A", 
        position: { x: 25, y: 50 },
        route: "/alphabet",
        animation: { rotate: [0, 10, -10, 0] }
      },
      { 
        emoji: "🔤", 
        name: "Alfabetet", 
        position: { x: 50, y: 50 },
        route: "/alphabet",
        animation: { scale: [1, 1.2, 1] }
      },
      { 
        emoji: "📖", 
        name: "Læsebog", 
        position: { x: 75, y: 50 },
        route: "/alphabet",
        animation: { y: [0, -10, 0] }
      }
    ],
    effects: [
      { type: 'float', emoji: '📝', count: 6 },
      { type: 'bounce', emoji: '🔤', count: 4 }
    ]
  },
  {
    id: 3,
    title: "Tallenes Verden",
    text: "Her lever alle tallene fra 1 til 100. De elsker at tælle og regne sammen!",
    background: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)",
    characters: [
      { 
        emoji: "1️⃣", 
        name: "Tallet 1", 
        position: { x: 20, y: 50 },
        route: "/math",
        animation: { rotate: [0, 360] }
      },
      { 
        emoji: "🔢", 
        name: "Tallene", 
        position: { x: 50, y: 50 },
        route: "/math",
        animation: { scale: [1, 1.3, 1] }
      },
      { 
        emoji: "🧮", 
        name: "Kugleram", 
        position: { x: 80, y: 50 },
        route: "/math",
        animation: { x: [0, 5, -5, 0] }
      }
    ],
    effects: [
      { type: 'float', emoji: '➕', count: 5 },
      { type: 'sparkle', emoji: '🔢', count: 7 }
    ]
  },
  {
    id: 4,
    title: "Farvernes Paradis",
    text: "I dette regnbueland danser alle farverne sammen i harmoni. Kom og leg med dem!",
    background: "linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)",
    characters: [
      { 
        emoji: "🌈", 
        name: "Regnbuen", 
        position: { x: 50, y: 40 },
        route: "/farver",
        animation: { rotate: [0, 180, 360] }
      },
      { 
        emoji: "🎨", 
        name: "Kunstner", 
        position: { x: 30, y: 60 },
        route: "/farver",
        animation: { y: [0, -15, 0] }
      },
      { 
        emoji: "🖌️", 
        name: "Pensel", 
        position: { x: 70, y: 60 },
        route: "/farver",
        animation: { rotate: [0, 45, -45, 0] }
      }
    ],
    effects: [
      { type: 'float', emoji: '🌺', count: 8 },
      { type: 'sparkle', emoji: '🎨', count: 6 }
    ]
  },
  {
    id: 5,
    title: "Hukommelsens Tempel",
    text: "Det sidste stop er hukommelsens mystiske tempel, hvor gåder venter på at blive løst!",
    background: "linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)",
    characters: [
      { 
        emoji: "🧠", 
        name: "Hukommelsen", 
        position: { x: 50, y: 45 },
        route: "/memory",
        animation: { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }
      },
      { 
        emoji: "🧩", 
        name: "Puslespil", 
        position: { x: 25, y: 65 },
        route: "/memory",
        animation: { y: [0, -10, 0] }
      },
      { 
        emoji: "🎯", 
        name: "Fokus", 
        position: { x: 75, y: 65 },
        route: "/memory",
        animation: { rotate: [0, 360] }
      }
    ],
    effects: [
      { type: 'sparkle', emoji: '💭', count: 6 },
      { type: 'float', emoji: '⚡', count: 4 }
    ]
  }
]

const FloatingEffect = ({ effect, index }: { effect: any; index: number }) => {
  const getAnimation = () => {
    switch (effect.type) {
      case 'float':
        return {
          y: [0, -30, 0],
          x: [0, Math.sin(index) * 20, 0],
          rotate: [0, 360],
          transition: {
            duration: 3 + Math.random() * 2,
            repeat: Infinity
          }
        }
      case 'sparkle':
        return {
          scale: [0, 1.5, 0],
          opacity: [0, 1, 0],
          rotate: [0, 180],
          transition: {
            duration: 2,
            repeat: Infinity
          }
        }
      case 'bounce':
        return {
          y: [0, -40, 0],
          transition: {
            duration: 1.5,
            repeat: Infinity
          }
        }
      default:
        return {}
    }
  }

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        fontSize: '2rem',
        zIndex: 1
      }}
      animate={getAnimation()}
    >
      {effect.emoji}
    </motion.div>
  )
}

const Character = ({ character, onClick }: { character: any; onClick?: () => void }) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${character.position.x}%`,
        top: `${character.position.y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: '4rem',
        cursor: character.route ? 'pointer' : 'default',
        zIndex: 10
      }}
      animate={character.animation || {}}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      whileHover={{
        scale: 1.2,
        rotate: 10,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
    >
      <div style={{
        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
        position: 'relative'
      }}>
        {character.emoji}
        {character.route && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.8rem',
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 8px',
              borderRadius: '12px',
              color: '#333',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Klik mig!
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export const InteractiveStorybook: React.FC = () => {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(0)
  const [, ] = useState(true)

  useEffect(() => {
    if (currentPage === 0) {
      const timer = setTimeout(() => setCurrentPage(1), 2000)
      return () => clearTimeout(timer)
    }
  }, [currentPage])

  const currentStory = storyPages[currentPage - 1]

  const nextPage = () => {
    if (currentPage < storyPages.length) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleCharacterClick = (route: string) => {
    if (route) {
      navigate(route)
    }
  }

  if (currentPage === 0) {
    return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative'
      }}>
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.6 }}
        >
          <Box sx={{
            textAlign: 'center',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '32px',
            border: '3px solid rgba(255,255,255,0.3)',
            p: 6,
            maxWidth: '600px'
          }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: '4rem',
                mb: 3
              }}
            >
              📖✨
            </Typography>
            <Typography
              variant="h3"
              sx={{
                color: 'white',
                fontWeight: 700,
                mb: 3,
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              Den Interaktive Eventyrbog
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                lineHeight: 1.4,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              Hvor din rejse gennem læringens magiske verden begynder...
            </Typography>
            
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity 
              }}
              style={{ marginTop: '2rem' }}
            >
              <Typography sx={{ 
                color: 'white', 
                fontSize: '1.2rem',
                fontWeight: 500
              }}>
                Eventyret starter snart...
              </Typography>
            </motion.div>
          </Box>
        </motion.div>
      </Box>
    )
  }

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: currentStory?.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Background Effects */}
      {currentStory?.effects?.map((effect, effectIndex) => 
        [...Array(effect.count)].map((_, index) => (
          <FloatingEffect 
            key={`${effectIndex}-${index}`} 
            effect={effect} 
            index={effectIndex * effect.count + index} 
          />
        ))
      )}

      {/* Story Content */}
      <AnimatePresence mode="wait">
        {currentStory && (
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          >
            {/* Characters */}
            {currentStory.characters.map((character, index) => (
              <motion.div
                key={`character-${index}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.2, type: 'spring', bounce: 0.6 }}
              >
                <Character 
                  character={character} 
                  onClick={() => character.route && handleCharacterClick(character.route)}
                />
              </motion.div>
            ))}

            {/* Story Text */}
            <Box sx={{
              position: 'absolute',
              bottom: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: '800px'
            }}>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Box sx={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(25px)',
                  borderRadius: '24px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  p: 4,
                  textAlign: 'center'
                }}>
                  <Typography
                    variant="h4"
                    sx={{
                      color: 'white',
                      fontWeight: 700,
                      mb: 2,
                      fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {currentStory.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'rgba(255,255,255,0.95)',
                      fontSize: 'clamp(1rem, 3vw, 1.4rem)',
                      lineHeight: 1.6,
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    {currentStory.text}
                  </Typography>
                </Box>
              </motion.div>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <Box sx={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 30,
        display: 'flex',
        gap: 2
      }}>
        <Fab
          onClick={() => navigate('/demo/homepages')}
          sx={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            '&:hover': {
              background: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1) rotate(10deg)'
            }
          }}
        >
          🏠
        </Fab>
      </Box>

      {/* Page Controls */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        gap: 2,
        alignItems: 'center'
      }}>
        <IconButton
          onClick={prevPage}
          disabled={currentPage <= 1}
          sx={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            fontSize: '1.5rem',
            '&:hover': { 
              background: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1)'
            },
            '&:disabled': { 
              opacity: 0.5 
            }
          }}
        >
          ⬅️
        </IconButton>

        <Box sx={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(15px)',
          borderRadius: '20px',
          border: '2px solid rgba(255,255,255,0.3)',
          px: 3,
          py: 1
        }}>
          <Typography sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '1.1rem'
          }}>
            {currentPage} / {storyPages.length}
          </Typography>
        </Box>

        <IconButton
          onClick={nextPage}
          disabled={currentPage >= storyPages.length}
          sx={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            fontSize: '1.5rem',
            '&:hover': { 
              background: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1)'
            },
            '&:disabled': { 
              opacity: 0.5 
            }
          }}
        >
          ➡️
        </IconButton>
      </Box>

      {/* Age Rating */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 30
      }}>
        <Box sx={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(15px)',
          borderRadius: '16px',
          border: '2px solid rgba(255,255,255,0.3)',
          px: 3,
          py: 1
        }}>
          <Typography sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem'
          }}>
            👶 4-6 år
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default InteractiveStorybook