import React, { useState, useEffect } from 'react'
import { Box, Typography, Fab, Grid, Card, CardContent } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

// Draggable Construction Tool
const ConstructionTool = ({ tool }: any) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'tool',
    item: { tool },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }))

  return (
    <motion.div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        fontSize: '4rem',
        margin: '10px',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
      }}
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
    >
      {tool.emoji}
    </motion.div>
  )
}

// Drop Zone for Construction
const ConstructionZone = ({ onDrop, children, label }: any) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'tool',
    drop: (item: any) => onDrop(item.tool),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }))

  return (
    <motion.div
      ref={drop}
      style={{
        minHeight: '150px',
        border: `3px dashed ${isOver ? '#4ECDC4' : '#FFD700'}`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isOver ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 215, 0, 0.1)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }}
      whileHover={{ scale: 1.02 }}
      animate={isOver ? { 
        borderColor: '#4ECDC4',
        background: 'rgba(78, 205, 196, 0.3)'
      } : {}}
    >
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          fontWeight: 700,
          textAlign: 'center',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          mb: 1
        }}
      >
        {label}
      </Typography>
      {children}
    </motion.div>
  )
}

// Construction Vehicle Component
const ConstructionVehicle = ({ vehicle, position, delay }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        fontSize: '4rem',
        zIndex: 5
      }}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', bounce: 0.6 }}
      whileHover={{ scale: 1.1, rotate: 2 }}
    >
      <motion.div
        animate={{
          y: [0, -5, 0],
          rotate: [0, 2, -2, 0]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {vehicle}
      </motion.div>
    </motion.div>
  )
}

// Building Block Component
const BuildingBlock = ({ letter, number, color, delay }: any) => {
  return (
    <motion.div
      initial={{ y: -100, rotate: -45, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', bounce: 0.8 }}
      whileHover={{ scale: 1.1, rotate: 5 }}
      style={{
        background: `linear-gradient(135deg, ${color}80, ${color}40)`,
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.4)',
        padding: '15px',
        margin: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '60px',
        minHeight: '60px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
      }}
    >
      <Typography
        variant="h4"
        sx={{
          color: 'white',
          fontWeight: 700,
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          fontSize: '2rem'
        }}
      >
        {letter || number}
      </Typography>
    </motion.div>
  )
}

export const ConstructionSite: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [droppedTools, setDroppedTools] = useState<any[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const constructionTools = [
    { emoji: '🔨', name: 'Hammer', route: '/alphabet' },
    { emoji: '🔧', name: 'Skruenøgle', route: '/math' },
    { emoji: '🪚', name: 'Sav', route: '/farver' },
    { emoji: '🪛', name: 'Skruetrækker', route: '/memory' }
  ]

  const handleToolDrop = (tool: any) => {
    setDroppedTools([...droppedTools, tool])
    if (tool.route) {
      setTimeout(() => navigate(tool.route), 1000)
    }
  }

  const buildingProjects = [
    {
      title: 'Bogstav Bygning',
      description: 'Byg ord med konstruktionsklodser',
      route: '/alphabet',
      color: '#FF6B6B',
      tool: '🔤'
    },
    {
      title: 'Tal Tårn',
      description: 'Byg høje tårne med tal',
      route: '/math',
      color: '#4ECDC4',
      tool: '🔢'
    },
    {
      title: 'Farve Fabrik',
      description: 'Mal og dekorér bygninger',
      route: '/farver',
      color: '#FFD700',
      tool: '🎨'
    },
    {
      title: 'Puslespil Palads',
      description: 'Byg komplekse strukturer',
      route: '/memory',
      color: '#96CEB4',
      tool: '🧩'
    }
  ]

  return (
    <DndProvider backend={HTML5Backend}>
      <Box sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 50%, #d63031 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Crect x="0" y="0" width="30" height="30"/%3E%3Crect x="30" y="30" width="30" height="30"/%3E%3C/g%3E%3C/svg%3E")',
          zIndex: 1
        }
      }}>
        {/* Construction Vehicles */}
        <ConstructionVehicle vehicle="🚛" position={{ x: 5, y: 75 }} delay={0.2} />
        <ConstructionVehicle vehicle="🚜" position={{ x: 85, y: 80 }} delay={0.5} />
        <ConstructionVehicle vehicle="🏗️" position={{ x: 70, y: 15 }} delay={0.8} />

        {/* Building Blocks Animation */}
        <Box sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          display: 'flex',
          flexWrap: 'wrap',
          maxWidth: '300px',
          zIndex: 3
        }}>
          {['A', 'B', 'C', '1', '2', '3'].map((item, i) => (
            <BuildingBlock
              key={item}
              letter={isNaN(Number(item)) ? item : undefined}
              number={!isNaN(Number(item)) ? item : undefined}
              color={i < 3 ? '#74b9ff' : '#00b894'}
              delay={0.3 + i * 0.1}
            />
          ))}
        </Box>

        {/* Welcome Message */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
              transition={{ type: 'spring', bounce: 0.7 }}
              style={{
                position: 'absolute',
                top: '25%',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20
              }}
            >
              <Box sx={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                borderRadius: '32px',
                border: '3px solid rgba(255,255,255,0.4)',
                p: 4,
                textAlign: 'center',
                maxWidth: '500px',
                position: 'relative'
              }}>
                {/* Construction Helmet */}
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: '4rem',
                    mb: 2
                  }}
                >
                  ⛑️🚧
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'white',
                    fontWeight: 700,
                    mb: 2,
                    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }}
                >
                  Velkommen til Byggepladsen!
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                    lineHeight: 1.5,
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                  Klar til at bygge læring sammen! 🔨
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Construction Tools */}
        <Box sx={{
          position: 'absolute',
          top: '15%',
          right: '5%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 10
        }}>
          <Typography
            variant="h6"
            sx={{
              color: 'white',
              fontWeight: 700,
              textAlign: 'center',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              mb: 1
            }}
          >
            Træk værktøjer herned! 👇
          </Typography>
          {constructionTools.map((tool) => (
            <ConstructionTool
              key={tool.name}
              tool={tool}
              onDrop={handleToolDrop}
            />
          ))}
        </Box>

        {/* Building Projects */}
        <Box sx={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '1000px',
          zIndex: 15
        }}>
          <Grid container spacing={2}>
            {buildingProjects.map((project, index) => (
              <Grid size={{ xs: 6, md: 3 }} key={project.title}>
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.2, type: 'spring', bounce: 0.6 }}
                >
                  <ConstructionZone
                    onDrop={() => navigate(project.route)}
                    label={project.title}
                  >
                    <Card sx={{
                      background: `linear-gradient(135deg, ${project.color}80, ${project.color}40)`,
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      border: '2px solid rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      width: '100%',
                      minHeight: '120px',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.3)'
                      }
                    }}
                    onClick={() => navigate(project.route)}
                    >
                      <CardContent sx={{
                        textAlign: 'center',
                        p: 2
                      }}>
                        <Typography
                          variant="h3"
                          sx={{
                            fontSize: '3rem',
                            mb: 1
                          }}
                        >
                          {project.tool}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'white',
                            fontSize: 'clamp(0.8rem, 2vw, 1rem)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                          }}
                        >
                          {project.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </ConstructionZone>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Dropped Tools Display */}
        {droppedTools.length > 0 && (
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 25
          }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '20px',
                padding: '20px',
                textAlign: 'center'
              }}
            >
              <Typography variant="h5" sx={{ color: '#333', fontWeight: 700 }}>
                Godt arbejde! 🎉
              </Typography>
              <Typography variant="body1" sx={{ color: '#666' }}>
                Du brugte: {droppedTools.map(t => t.emoji).join(' ')}
              </Typography>
            </motion.div>
          </Box>
        )}

        {/* Navigation Controls */}
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
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(15px)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.4)',
              '&:hover': {
                background: 'rgba(255,255,255,0.3)',
                transform: 'scale(1.1) rotate(10deg)'
              }
            }}
          >
            🏠
          </Fab>
          <Fab
            onClick={() => setShowWelcome(!showWelcome)}
            sx={{
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(15px)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.4)',
              '&:hover': {
                background: 'rgba(255,255,255,0.3)',
                transform: 'scale(1.1) rotate(-10deg)'
              }
            }}
          >
            ⛑️
          </Fab>
        </Box>

        {/* Safety Warning */}
        <Box sx={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 30
        }}>
          <Box sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            borderRadius: '16px',
            border: '2px solid rgba(255,255,255,0.4)',
            px: 3,
            py: 1
          }}>
            <Typography sx={{
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem'
            }}>
              ⚠️ Sikkerhed først!
            </Typography>
          </Box>
        </Box>

        {/* Age Rating */}
        <Box sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 30
        }}>
          <Box sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            borderRadius: '16px',
            border: '2px solid rgba(255,255,255,0.4)',
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
    </DndProvider>
  )
}

export default ConstructionSite