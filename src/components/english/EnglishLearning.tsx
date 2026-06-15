import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Typography,
  Card,
  Chip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { englishThemes, EnglishWord } from '../../config/englishVocab'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

const ENGLISH_ACCENT = categoryThemes.english.accentColor
const EXPLORE_MILESTONE = 9 // award a sticker every N distinct English words tapped

// Lær Engelsk: free exploration. Browse a theme's words as cards (picture + English word
// + Danish translation), tap to hear the word in British English. Learning-based pattern:
// direct audio on tap, no entry-audio coordination. Exploring distinct words earns a
// milestone sticker (mirrors Lær Tal / Lær Alfabetet).
const EnglishLearning: React.FC = () => {
  const muiTheme = useTheme()
  const theme = categoryThemes.english
  const audio = useSimplifiedAudioHook({ componentId: 'EnglishLearning', autoInitialize: false })

  const [activeThemeId, setActiveThemeId] = useState(englishThemes[0].id)
  const [playingWord, setPlayingWord] = useState<string | null>(null)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Session-local exploration tracking → milestone stickers.
  const exploredRef = useRef<Set<string>>(new Set())
  const milestoneRef = useRef(0)
  const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
  const stickerTimer = useRef<NodeJS.Timeout | null>(null)

  const activeTheme = englishThemes.find(t => t.id === activeThemeId) || englishThemes[0]

  useEffect(() => {
    return () => {
      if (stickerTimer.current) {
        clearTimeout(stickerTimer.current)
        stickerTimer.current = null
      }
    }
  }, [])

  // Award an exploration sticker when distinct-tap count crosses each milestone.
  const maybeAwardExploration = () => {
    const size = exploredRef.current.size
    const milestone = Math.floor(size / EXPLORE_MILESTONE)
    if (milestone > milestoneRef.current) {
      milestoneRef.current = milestone
      const award = progressStore.awardSticker()
      setStickerAward(award)
      celebrateTier('sticker')
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
      stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
      // Speak the sticker name; on a milestone tap the Danish celebration line wins over the word.
      try {
        audio.speak(`Nyt klistermærke! ${award.sticker.label}`).catch(() => {})
      } catch {
        /* ignore */
      }
    }
  }

  const handleWordClick = async (word: EnglishWord) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    setPlayingWord(word.en)
    exploredRef.current.add(word.en)
    maybeAwardExploration()
    try {
      await audio.speakEnglish(word.en)
    } catch (error) {
      // ignore audio errors
    } finally {
      setPlayingWord(null)
    }
  }

  return (
    <GameShell
      categoryId="english"
      title="Lær Engelsk"
      backRoute="/english"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
        {/* Theme selector */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 0.75, md: 1 },
            mb: { xs: 1.5, md: 2 },
            flex: '0 0 auto'
          }}
        >
          {englishThemes.map(t => (
            <Chip
              key={t.id}
              label={`${t.emoji} ${t.title}`}
              onClick={() => {
                audio.updateUserInteraction()
                audio.cancelCurrentAudio()
                setActiveThemeId(t.id)
              }}
              sx={{
                fontSize: { xs: '0.9rem', md: '1.05rem' },
                fontWeight: 700,
                py: 2.2,
                px: 0.5,
                minHeight: 44,
                cursor: 'pointer',
                bgcolor: t.id === activeThemeId ? theme.accentColor : 'rgba(255,255,255,0.85)',
                color: t.id === activeThemeId ? 'white' : theme.accentColor,
                border: `2px solid ${theme.borderColor}`,
                '&:hover': { bgcolor: t.id === activeThemeId ? theme.hoverBorderColor : 'white' }
              }}
            />
          ))}
        </Box>

        {/* Word cards grid */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
              gap: { xs: '10px', md: '16px' },
              width: '100%',
              maxWidth: 900,
              '@media (orientation: landscape)': {
                gridTemplateColumns: { xs: 'repeat(5, 1fr)', md: 'repeat(5, 1fr)' }
              }
            }}
          >
            <AnimatePresence mode="popLayout">
              {activeTheme.words.map((word, index) => (
                <motion.div
                  key={`${activeTheme.id}-${word.en}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ delay: index * 0.03, duration: 0.25 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card
                    onClick={() => handleWordClick(word)}
                    sx={{
                      cursor: 'pointer',
                      border: '3px solid',
                      borderColor: playingWord === word.en ? theme.accentColor : theme.borderColor,
                      bgcolor: 'white',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: { xs: 1, md: 1.5 },
                      minHeight: { xs: 96, md: 120 },
                      boxShadow: playingWord === word.en
                        ? `0 0 18px ${theme.accentColor}66`
                        : muiTheme.scene.dark
                          ? '0 12px 30px rgba(0,0,0,0.45)'
                          : '0 6px 18px rgba(0,0,0,0.12)',
                      transition: 'all 0.25s ease',
                      '@media (hover: hover) and (pointer: fine)': {
                        '&:hover': { borderColor: theme.hoverBorderColor, boxShadow: 6 }
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, lineHeight: 1 }}>
                      {word.emoji}
                    </Typography>
                    <Typography
                      sx={{
                                                fontSize: { xs: '1rem', md: '1.25rem' },
                        fontWeight: 700,
                        color: theme.accentColor,
                        textAlign: 'center',
                        lineHeight: 1.1,
                        mt: 0.5
                      }}
                    >
                      {word.en}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: '0.75rem', md: '0.9rem' },
                        color: 'text.secondary',
                        textAlign: 'center',
                        lineHeight: 1
                      }}
                    >
                      {word.da}
                    </Typography>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        </Box>

        {/* Exploration-milestone sticker reveal. Auto-dismisses; tap to close early. */}
        {stickerAward && (
          <Box
            onClick={() => setStickerAward(null)}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
            }}
          >
            <StickerReveal award={stickerAward} accent={ENGLISH_ACCENT} size={140} />
          </Box>
        )}
    </GameShell>
  )
}

export default EnglishLearning
