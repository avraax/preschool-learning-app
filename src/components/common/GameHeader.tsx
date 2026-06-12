import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import LottieCharacter, { useCharacterState } from './LottieCharacter'
import { CategoryTheme } from '../../config/categoryThemes'

interface GameHeaderProps {
  title: string
  titleIcon: string
  gameIcon?: string
  character: ReturnType<typeof useCharacterState>
  categoryTheme: CategoryTheme
  backPath: string
  scoreComponent: React.ReactNode
  onCharacterClick?: () => void
  removeDescription?: boolean
}

const GameHeader: React.FC<GameHeaderProps> = ({
  title,
  titleIcon,
  gameIcon,
  character,
  categoryTheme: _categoryTheme,
  backPath,
  scoreComponent,
  onCharacterClick,
}) => {
  const navigate = useNavigate()

  return (
    <>
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)' }}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton
            onClick={() => navigate(backPath)}
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.25)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.3)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.4)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>

          {scoreComponent}
        </Toolbar>
      </AppBar>

      {/* Game Title with Teacher Character */}
      <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
            <LottieCharacter
              character={character.character}
              state={character.state}
              size={80}
              onClick={onCharacterClick || character.wave}
            />
            <Typography
              variant="h3"
              sx={{
                color: 'white',
                fontWeight: 800,
                fontSize: { xs: '1.5rem', md: '2rem' },
                textShadow: '1px 2px 0px rgba(0,0,0,0.2)'
              }}
            >
              {titleIcon} {title}
            </Typography>
            {gameIcon && (
              <Typography sx={{ fontSize: '2.5rem' }}>{gameIcon}</Typography>
            )}
          </Box>
        </motion.div>
      </Box>
    </>
  )
}

export default GameHeader