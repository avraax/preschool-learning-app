import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Typography, Chip } from '@mui/material'
import { PawPrint, Apple, Blocks, Hash, Palette, PersonStanding, Users, Trees, Hand, type LucideIcon } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba } from '../../theme/tokens/helpers'
import { softShadow } from '../../theme/depth'
import GameShell from '../common/GameShell'
import PromptFocus from '../common/PromptFocus'
import TactileTile from '../common/TactileTile'
import { HeroArt, HeroEmoji } from '../common/PromptArt'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { englishThemes, EnglishWord } from '../../config/englishVocab'
import { englishArt, englishArtId } from '../../assets/games/english'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Engelsk: free exploration. Browse a theme's words as cards (picture + English word
// + Danish translation), tap to hear the word in English (en-US Ava). Learning-based pattern:
// direct audio on tap, no entry-audio coordination. Exploring distinct words earns per-new-item
// browse XP (mirrors Lær Tal / Lær Alfabetet).
//
// Games Visual Uplift (PRD-11 §3.5): the bloom rests in the calm frozen world via PromptFocus (no
// frosted PromptStage card), and the word cards are the shell's tactile clay (TactileTile) — the
// legacy #ECF1F8 gradient + hard keyboard lip are retired. Concrete words show a baked soft-3D
// picture; never-baked words (greetings/body/family) keep their emoji via the art-gated fallback.
// Per-theme Lucide icon for the theme-selector chips (PRD-12 §2C — controls, not subjects, so a
// clean icon replaces the old emoji chip glyph). Keyed by the englishVocab theme id.
const THEME_ICONS: Record<string, LucideIcon> = {
  animals: PawPrint,
  food: Apple,
  objects: Blocks,
  numbers: Hash,
  colors: Palette,
  body: PersonStanding,
  family: Users,
  nature: Trees,
  greetings: Hand,
}

const EnglishLearning: React.FC = () => {
  const muiTheme = useTheme()
  const theme = getCategoryTheme('english')
  const audio = useSimplifiedAudioHook({ componentId: 'EnglishLearning', autoInitialize: false })

  const [activeThemeId, setActiveThemeId] = useState(englishThemes[0].id)
  const [playingWord, setPlayingWord] = useState<string | null>(null)
  // Bloomed selection for the focal zone (§3.5) — defaults to the first word so the bloom is never
  // empty. Reset whenever the theme changes so the bloom always matches the visible grid.
  const [selectedWord, setSelectedWord] = useState<EnglishWord>(englishThemes[0].words[0])

  const { showCelebration, celebrationIntensity, celebrationDuration, stopCelebration } = useCelebration()

  // Per-new-item browse XP (Liveliness PRD-04) — replaces the old milestone sticker. Each newly
  // explored English word feeds the shared cross-game level + ticks the header ring.
  const awardBrowseXp = useBrowseXp('english')

  const activeTheme = englishThemes.find(t => t.id === activeThemeId) || englishThemes[0]

  const handleWordClick = async (word: EnglishWord) => {
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    setSelectedWord(word)
    setPlayingWord(word.en)
    // Per-new-item browse XP (Liveliness PRD-04): first visit to this word feeds the level + ticks
    // the ring. We always still speak the word.
    awardBrowseXp(word.en)
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
      promptStage={
        // Selected word blooms in the calm world via PromptFocus (§3.5) — the baked soft-3D object
        // (or emoji fallback) rests on its light-pool + contact shadow, with the English word + the
        // Danish caption beneath. chargeKey includes the theme id so switching theme (which also
        // resets the word) re-triggers the charge-in immediately.
        (() => {
          const art = englishArt(englishArtId(selectedWord.en))
          return (
            <PromptFocus
              accent={theme.accentColor}
              chargeKey={`${activeThemeId}-${selectedWord.en}`}
              subject={
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.5, md: 1 }, width: '100%', height: '100%', [PHONE_LANDSCAPE]: { gap: 0 } }}>
                  {/* Baked soft-3D picture (PRD-11); emoji is the art-gated fallback. */}
                  {art ? <HeroArt src={art} /> : <HeroEmoji>{selectedWord.emoji}</HeroEmoji>}
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
                      fontSize: 'clamp(1.6rem, 8vh, 3rem)',
                      transition: 'text-shadow 0.3s ease',
                      [PHONE_LANDSCAPE]: { fontSize: '1.1rem' },
                    }}
                  >
                    {selectedWord.en}
                  </Typography>
                  {/* Danish translation — hidden on phone landscape (the ~90px stage budget there
                      can't fit picture + word + translation; the grid tile captions still show it). */}
                  <Typography
                    sx={{
                      fontWeight: 600,
                      color: muiTheme.scene.dark ? 'rgba(255,255,255,0.75)' : 'text.secondary',
                      fontSize: 'clamp(0.95rem, 3.5vh, 1.3rem)',
                      [PHONE_LANDSCAPE]: { display: 'none' },
                    }}
                  >
                    {selectedWord.da}
                  </Typography>
                </Box>
              }
            />
          )
        })()
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
          {englishThemes.map(t => {
            const ThemeIcon = THEME_ICONS[t.id] ?? Blocks
            return (
            <Chip
              key={t.id}
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                  <ThemeIcon size={18} strokeWidth={2.5} aria-hidden />
                  {t.title}
                </Box>
              }
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
            )
          })}
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
              {activeTheme.words.map((word, index) => {
                // Baked soft-3D card picture (PRD-11); emoji is the art-gated fallback. A concrete
                // theme's grid is all-clay-art, an abstract theme's grid all-emoji — uniform within
                // any single visible grid (the child switches themes to change grids).
                const art = englishArt(englishArtId(word.en))
                return (
                  <motion.div
                    key={`${activeTheme.id}-${word.en}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ delay: index * 0.03, duration: 0.25 }}
                    style={{ height: '100%' }}
                  >
                    {/* Shell clay tile (§3.5) — retires the #ECF1F8 gradient + hard lip. The
                        `playingWord` accent glow rides TactileTile's `hint` (accent ring + gentle
                        pulse; static ring under reduced motion). */}
                    <TactileTile
                      variant="card"
                      accent={theme.accentColor}
                      interactive
                      onActivate={() => handleWordClick(word)}
                      hint={playingWord === word.en}
                      breathe={false}
                      sx={{ minHeight: { xs: 96, md: 120 }, [PHONE_LANDSCAPE]: { minHeight: 64 } }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                        {art ? (
                          <Box
                            component="img"
                            src={art}
                            alt=""
                            aria-hidden
                            draggable={false}
                            sx={{
                              height: { xs: '2.25rem', md: '3rem' },
                              width: 'auto',
                              maxWidth: '100%',
                              objectFit: 'contain',
                              filter: softShadow(1),
                              userSelect: 'none',
                              pointerEvents: 'none',
                              [PHONE_LANDSCAPE]: { height: '1.3rem' },
                            }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, lineHeight: 1, [PHONE_LANDSCAPE]: { fontSize: '1.3rem' } }}>
                            {word.emoji}
                          </Typography>
                        )}
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
                      </Box>
                    </TactileTile>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </Box>
        </Box>
    </GameShell>
  )
}

export default EnglishLearning
