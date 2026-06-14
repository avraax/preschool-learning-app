import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Paper,
  AppBar,
  Toolbar
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Add, Remove } from '@mui/icons-material'
import { ArrowLeft } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import GameMotif from '../common/GameMotif'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { isIOS } from '../../utils/deviceDetection'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Unified addition/subtraction game. Behaviour and difficulty ranges are preserved
// exactly from the previous AdditionGame/SubtractionGame; only the operator,
// problem generation, spoken prompt, title and welcome differ by `operation`.
interface MathOperationGameProps {
  operation: 'addition' | 'subtraction'
}

const MathOperationGame: React.FC<MathOperationGameProps> = ({ operation }) => {
  const navigate = useNavigate()
  const muiTheme = useTheme()
  const isAddition = operation === 'addition'
  const title = isAddition ? 'Plus Opgaver' : 'Minus Opgaver'
  const OperatorIcon = isAddition ? Add : Remove

  const [num1, setNum1] = useState<number | null>(null)
  const [num2, setNum2] = useState<number | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [options, setOptions] = useState<number[]>([])

  const audio = useSimplifiedAudioHook({
    componentId: isAddition ? 'AdditionGame' : 'SubtractionGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const hasInitialized = useRef(false)

  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ${isAddition ? 'AdditionGame' : 'SubtractionGame'}: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    mathTeacher.setCharacter('fox')
    mathTeacher.wave()

    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
      hasInitialized.current = true
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady, audioInitialized])

  const playWelcomeAndStart = async () => {
    try {
      await audio.playGameWelcome(operation)
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        setGameReady(true)
        generateNewProblem()
      }, delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      setGameReady(true)
      generateNewProblem()
    }
  }

  const generateNewProblem = () => {
    let firstNum: number
    let secondNum: number
    let answer: number

    if (isAddition) {
      // Two numbers that add up to max 20
      firstNum = Math.floor(Math.random() * 10) + 1 // 1-10
      const maxSecondNum = Math.min(20 - firstNum, 10) // ensure sum ≤ 20
      secondNum = Math.floor(Math.random() * maxSecondNum) + 1 // 1 to maxSecondNum
      answer = firstNum + secondNum
    } else {
      // Subtraction with a non-negative result
      firstNum = Math.floor(Math.random() * 10) + 1 // 1-10
      secondNum = Math.floor(Math.random() * firstNum) + 1 // 1 to firstNum
      answer = firstNum - secondNum // 0-9
    }

    setNum1(firstNum)
    setNum2(secondNum)
    setCorrectAnswer(answer)

    // Generate 4 answer options
    const answerOptions = new Set([answer])
    while (answerOptions.size < 4) {
      const wrongAnswer = isAddition
        ? Math.floor(Math.random() * 20) + 1 // 1-20
        : Math.floor(Math.random() * 11) // 0-10
      if (wrongAnswer !== answer) {
        answerOptions.add(wrongAnswer)
      }
    }

    setOptions(Array.from(answerOptions).sort(() => Math.random() - 0.5))

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const delay = isIOS() ? 100 : 500
    timeoutRef.current = setTimeout(() => {
      speakProblem(firstNum, secondNum)
    }, delay)
  }

  const speakProblem = async (a: number, b: number) => {
    try {
      audio.updateUserInteraction()
      if (isAddition) {
        await audio.speakAdditionProblem(a, b, 'primary')
      } else {
        await audio.speakSubtractionProblem(a, b, 'primary')
      }
    } catch (error: any) {
      logError('Error speaking problem', { num1: a, num2: b, error: error?.toString() })
    }
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (correctAnswer === null) return

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const isCorrect = selectedAnswer === correctAnswer

    try {
      await audio.speakNumber(selectedAnswer)
    } catch (error) {
      // ignore number audio errors
    }

    if (isCorrect) {
      incrementScore()
      celebrate()
      mathTeacher.wave()
    } else {
      mathTeacher.think()
    }

    setTimeout(async () => {
      try {
        await audio.playCelebrationWithStandardTiming({
          isCorrect,
          celebrate,
          stopCelebration,
          incrementScore: undefined,
          nextAction: isCorrect ? generateNewProblem : undefined,
          teacherCharacter: mathTeacher
        })
      } catch (error: any) {
        logError('Error in centralized celebration', {
          selectedAnswer,
          correctAnswer,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150)
  }

  const repeatProblem = async () => {
    if (num1 === null || num2 === null) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakProblem(num1, num2)
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
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
        background: categoryThemes.math.gradient
      }}
    >
      {/* Calm P4 motif behind the game content. */}
      <GameMotif categoryId="math" />
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton
            onClick={() => navigate('/math')}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)', transform: 'scale(1.05)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>

          <MathScoreChip
            score={score}
            disabled={isScoreNarrating}
            onClick={handleScoreClick}
          />
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          overflow: 'hidden'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <LottieCharacter
                character={mathTeacher.character}
                state={mathTeacher.state}
                size={80}
                onClick={mathTeacher.wave}
              />
              <Typography
                variant="h3"
                sx={{
                  fontFamily: muiTheme.titleFontFamily,
                  color: muiTheme.scene.dark ? '#FFFFFF' : categoryThemes.math.accentColor,
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  textShadow: muiTheme.scene.dark
                    ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
                    : 'none'
                }}
              >
                <OperatorIcon fontSize="large" /> {title}
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🧮</Typography>
            </Box>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4, fontSize: { xs: '1rem', md: '1.25rem' } }}>
            Hvad bliver svaret? 🤔
          </Typography>
        </Box>

        {gameReady && num1 !== null && num2 !== null && options.length > 0 && (
          <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
            <Paper
              elevation={8}
              sx={{
                maxWidth: 500,
                mx: 'auto',
                p: { xs: 2, md: 4 },
                borderRadius: 4,
                border: '2px solid',
                borderColor: 'primary.200',
                mb: 3,
                '@media (orientation: landscape)': {
                  p: { xs: 1.5, md: 2.5 },
                  mb: 1.5
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 3 }, mb: 3 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 700, color: 'primary.dark' }}>
                  {num1}
                </Typography>
                <OperatorIcon sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, color: 'secondary.main' }} />
                <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 700, color: 'primary.dark' }}>
                  {num2}
                </Typography>
                <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, fontWeight: 700, color: 'text.secondary' }}>
                  =
                </Typography>
                <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 700, color: 'secondary.main' }}>
                  ?
                </Typography>
              </Box>

              <MathRepeatButton onClick={repeatProblem} disabled={false} />
            </Paper>
          </Box>
        )}

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: 'auto',
              gap: { xs: '16px', sm: '20px', md: '24px' },
              width: '100%',
              maxWidth: { xs: '400px', sm: '500px', md: '600px' },
              justifyContent: 'center',
              alignItems: 'center',
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '80px', sm: '90px', md: '100px' },
                maxHeight: { xs: '120px', sm: '140px', md: '160px' },
                width: '100%'
              },
              '@media (orientation: landscape)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
                maxWidth: { xs: '600px', sm: '700px', md: '800px' },
                '& > *': {
                  aspectRatio: '4/3',
                  minHeight: { xs: '60px', sm: '70px', md: '80px' },
                  maxHeight: { xs: '100px', sm: '110px', md: '120px' }
                }
              }
            }}
          >
            {gameReady && options.length > 0 ? options.map((option, index) => (
              <motion.div
                key={`${option}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ height: '100%' }}
              >
                <Card
                  onClick={() => handleAnswerClick(option)}
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: 'primary.200',
                    bgcolor: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    boxShadow: muiTheme.scene.dark
                      ? '0 12px 30px rgba(0,0,0,0.45)'
                      : '0 6px 18px rgba(0,0,0,0.12)',
                    outline: 'none',
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main'
                    },
                    '@media (hover: hover) and (pointer: fine)': {
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50',
                        boxShadow: 12,
                        transform: 'translateY(-2px)'
                      }
                    }
                  }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: { xs: 1.5, sm: 2, md: 2.5 },
                      textAlign: 'center'
                    }}
                  >
                    <Typography
                      variant="h1"
                      sx={{
                        fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                        fontWeight: 700,
                        color: 'primary.dark',
                        userSelect: 'none',
                        lineHeight: 1,
                        '@media (orientation: landscape)': {
                          fontSize: 'clamp(2rem, 6vw, 3.5rem)'
                        }
                      }}
                    >
                      {option}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            )) : null}
          </Box>
        </Box>
      </Container>

      <CelebrationEffect
        show={showCelebration}
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default MathOperationGame
