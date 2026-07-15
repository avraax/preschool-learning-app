import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Typography,
  Card,
  Chip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { categoryThemes } from '../../config/categoryThemes'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import GameShell from '../common/GameShell'
import PromptStage, { HeroEmoji } from '../common/PromptStage'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { levelUpBus } from '../../services/levelUpBus'
import { stickerSetForSection } from '../../config/stickers'
import { englishThemes, EnglishWord } from '../../config/englishVocab'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

const ENGLISH_ACCENT = categoryThemes.english.accentColor
const EXPLORE_MILESTONE = 9 // award a sticker every N distinct English words tapped

// Lær Engelsk: free exploration. Browse a theme's words as cards (picture + English word
// + Danish translation), tap to hear the word in English (en-US Ava). Learning-based pattern:
// direct audio on tap, no entry-audio coordination. Exploring distinct words earns a
// milestone sticker (mirrors Lær Tal / Lær Alfabetet).
const EnglishLearning: React.FC = () => {
  const muiTheme = useTheme()
  const theme = categoryThemes.english
  const audio = useSimplifiedAudioHook({ componentId: 'EnglishLearning', autoInitialize: false })

  const [activeThemeId, setActiveThemeId] = useState(englishThemes[0].id)
  const [playingWord, setPlayingWord] = useState<string | null>(null)
  // Bloomed selection for the PromptStage (§6B) — defaults to the first word so the stage is never
  // empty. Reset whenever the theme changes so the bloom always matches the visible grid.
  const [selectedWord, setSelectedWord] = useState<EnglishWord>(englishThemes[0].words[0])

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

  // Award an exploration sticker when distinct-tap count crosses each milestone. Returns true when
  // it spoke the sticker line, so the caller skips the word echo (PRD-06 §3).
  const maybeAwardExploration = (): boolean => {
    const size = exploredRef.current.size
    const milestone = Math.floor(size / EXPLORE_MILESTONE)
    if (milestone > milestoneRef.current) {
      milestoneRef.current = milestone
      // Browse XP (Liveliness PRD-01): flat grant at each distinct-tap milestone (distinct-tap gate
      // is the anti-farm). Fire the level-up ceremony on a crossing; the app-root watcher backs it.
      const xp = progressStore.grantXp('english', 6, 'browse-milestone')
      if (xp.global.leveledUp) levelUpBus.emit({ level: xp.global.levelAfter, section: xp.section })
      const award = progressStore.awardSticker(stickerSetForSection('english'))
      setStickerAward(award)
      celebrateTier('sticker')
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
      stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
      // Speak the sticker name; on a milestone tap the Danish celebration line wins over the word.
      // Duplicate = shiny, not "new" — match the StickerReveal banner (PRD-09 P2).
      try {
        audio
          .speak(
            award.isNew
              ? `Nyt klistermærke! ${award.sticker.label}`
              : `Skinnende! ${award.sticker.label}`,
          )
          .catch(() => {})
      } catch {
        /* ignore */
      }
      return true
    }
    return false
  }

  const handleWordClick = async (word: EnglishWord) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    setSelectedWord(word)
    setPlayingWord(word.en)
    exploredRef.current.add(word.en)
    // On a milestone tap the Danish sticker line is the reward audio — don't also speak the word.
    if (maybeAwardExploration()) {
      setPlayingWord(null)
      return
    }
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
      intro={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        // Selected English word blooms (word + emoji) — §6B. chargeKey includes the theme id so
        // switching theme (which also resets the word) re-triggers the charge-in immediately.
        <PromptStage accent={theme.accentColor} chargeKey={`${activeThemeId}-${selectedWord.en}`}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.5, md: 1 }, [PHONE_LANDSCAPE]: { gap: 0 } }}>
            <HeroEmoji>{selectedWord.emoji}</HeroEmoji>
            <Typography
              sx={{
                fontWeight: 800,
                lineHeight: 1,
                color: muiTheme.scene.dark ? '#FFFFFF' : theme.accentColor,
                textShadow: muiTheme.scene.dark
                  ? '0 2px 10px rgba(0,0,0,0.5)'
                  : playingWord === selectedWord.en
                    ? `0 0 24px ${hexToRgba(theme.accentColor, 0.45)}`
                    : 'none',
                fontSize: 'clamp(1.8rem, 9vh, 3.4rem)',
                transition: 'text-shadow 0.3s ease',
                [PHONE_LANDSCAPE]: { fontSize: '1.1rem' },
              }}
            >
              {selectedWord.en}
            </Typography>
            {/* Danish translation — hidden on phone landscape (the ~90px stage budget there can't
                fit emoji + word + translation; the grid tile captions still show it). */}
            <Typography
              sx={{
                fontWeight: 600,
                color: muiTheme.scene.dark ? 'rgba(255,255,255,0.75)' : 'text.secondary',
                fontSize: 'clamp(1rem, 4vh, 1.4rem)',
                [PHONE_LANDSCAPE]: { display: 'none' },
              }}
            >
              {selectedWord.da}
            </Typography>
          </Box>
        </PromptStage>
      }
    >
        {/* Theme selector */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 0.75, md: 1 },
            mb: { xs: 1.5, md: 2 },
            flex: '0 0 auto',
            [PHONE_LANDSCAPE]: { gap: 0.5, mb: 0.75 }
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
                setSelectedWord(t.words[0])
              }}
              sx={{
                fontSize: { xs: '0.9rem', md: '1.05rem' },
                fontWeight: 700,
                py: 2.2,
                px: 0.5,
                minHeight: 44,
                [PHONE_LANDSCAPE]: { fontSize: '0.75rem', py: 1.6, minHeight: 36 },
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
              },
              [PHONE_LANDSCAPE]: { gap: '6px' }
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
                      borderColor: playingWord === word.en ? theme.accentColor : hexToRgba(theme.accentColor, muiTheme.scene.dark ? 0.55 : 0.34),
                      // Lifted-3D depth language (matches AnswerTile / LearningGrid): top-light
                      // surface, coloured edge lip beneath, soft ambient shadow; active = accent glow.
                      background: 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: { xs: 1, md: 1.5 },
                      minHeight: { xs: 96, md: 120 },
                      [PHONE_LANDSCAPE]: { minHeight: 64, p: 0.5 },
                      boxShadow: playingWord === word.en
                        ? `0 0 0 3px ${hexToRgba(theme.accentColor, 0.4)}, 0 6px 0 ${darken(theme.accentColor, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.5)' : '0 8px 18px rgba(0,0,0,0.15)'}`
                        : `0 6px 0 ${darken(theme.accentColor, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`,
                      transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.08s ease',
                      '&:active': {
                        transform: 'translateY(3px)',
                        boxShadow: `0 2px 0 ${darken(theme.accentColor, 0.28)}, ${muiTheme.scene.dark ? '0 4px 10px rgba(0,0,0,0.5)' : '0 4px 8px rgba(0,0,0,0.18)'}`
                      },
                      '@media (hover: hover) and (pointer: fine)': {
                        '&:hover': { borderColor: theme.hoverBorderColor, boxShadow: `0 9px 0 ${darken(theme.accentColor, 0.28)}, 0 14px 30px ${hexToRgba(theme.accentColor, 0.3)}` }
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, lineHeight: 1, [PHONE_LANDSCAPE]: { fontSize: '1.3rem' } }}>
                      {word.emoji}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: '1rem', md: '1.25rem' },
                        fontWeight: 700,
                        color: theme.accentColor,
                        textAlign: 'center',
                        lineHeight: 1.1,
                        mt: 0.5,
                        [PHONE_LANDSCAPE]: { fontSize: '0.8rem', mt: 0.25 }
                      }}
                    >
                      {word.en}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: '0.75rem', md: '0.9rem' },
                        color: 'text.secondary',
                        textAlign: 'center',
                        lineHeight: 1,
                        [PHONE_LANDSCAPE]: { fontSize: '0.65rem' }
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
