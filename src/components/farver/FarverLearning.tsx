import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { SHADES, HUE_ORDER, COLOR_SWATCH, DANISH_OBJECTS } from '../../config/colorContent'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import GameShell from '../common/GameShell'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Farver — a calm browse (learning-based, no challenge). Tap a color to hear its name and see
// its shade family (lys/mellem/mørk) + example objects; tap a shade or an object to hear it too.
// Exploring distinct things earns a milestone sticker (mirrors Lær Tal / Lær Alfabetet / Lær
// Engelsk). Educational color data comes from colorContent (NOT themeable).

const COLORS_ACCENT = getCategoryTheme('colors').accentColor
const EXPLORE_MILESTONE = 9 // award a sticker every N distinct taps (colors + shades + objects)

const FarverLearning: React.FC = () => {
  const muiTheme = useTheme()
  const t = getCategoryTheme('colors')
  const dark = muiTheme.scene.dark
  const audio = useSimplifiedAudioHook({ componentId: 'FarverLearning', autoInitialize: false })

  const [currentHue, setCurrentHue] = useState<string>(HUE_ORDER[0])
  const [playing, setPlaying] = useState<string | null>(null)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Session-local exploration tracking → milestone stickers.
  const exploredRef = useRef<Set<string>>(new Set())
  const milestoneRef = useRef(0)
  const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
  const stickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const welcomeTriggered = useRef(false)
  const hasInteractedRef = useRef(false)

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 FarverLearning: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    if (audio.isAudioReady) playWelcome()
    return () => {
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) playWelcome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  const playWelcome = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('farvelaer')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
  }

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
      try {
        audio.speak(`Nyt klistermærke! ${award.sticker.label}`).catch(() => {})
      } catch { /* ignore */ }
    }
  }

  // Speak `text`, tracking `key` for exploration milestones. `setCurrent` swaps the detail panel.
  const tapSpeak = async (key: string, text: string, hue?: string) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    if (hue) setCurrentHue(hue)
    setPlaying(key)
    exploredRef.current.add(key)
    maybeAwardExploration()
    try {
      await audio.speak(text)
    } catch (error) {
      logError('Error speaking', { text, error: error?.toString() })
    } finally {
      setPlaying((p) => (p === key ? null : p))
    }
  }

  const shades = SHADES[currentHue] ?? []
  const examples = (DANISH_OBJECTS[currentHue] ?? []).slice(0, 4)

  // Lifted-3D color card (mirrors AnswerTile depth, but the surface IS the color).
  const colorCardShadow = (hex: string, active: boolean) =>
    active
      ? `0 0 0 4px ${hexToRgba(hex, 0.5)}, 0 6px 0 ${darken(hex, 0.28)}, ${dark ? '0 10px 24px rgba(0,0,0,0.5)' : '0 8px 18px rgba(0,0,0,0.15)'}`
      : `0 6px 0 ${darken(hex, 0.28)}, ${dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`

  return (
    <GameShell
      categoryId="colors"
      title="Lær Farver"
      backRoute="/farver"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {/* Detail panel: current color name + shade family + example objects. */}
      <Box sx={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: { xs: 1, md: 1.5 },
        mb: { xs: 1.5, md: 2 }
      }}>
        {/* Shade trio (tap each to hear lys/mellem/mørk). */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1.25, md: 2 } }}>
          {shades.map((shade, i) => {
            const big = i === 1 // middle = the canonical color, shown largest
            const dim = { xs: big ? 92 : 64, md: big ? 120 : 84 }
            const dimLand = big ? 84 : 60
            return (
              <Box key={shade.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Box
                    onClick={() => tapSpeak(`shade-${shade.name}`, shade.name, currentHue)}
                    sx={{
                      width: { xs: dim.xs, md: dim.md },
                      height: { xs: dim.xs, md: dim.md },
                      '@media (orientation: landscape)': { width: dimLand, height: dimLand },
                      borderRadius: '50%',
                      backgroundColor: shade.hex,
                      backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%)',
                      border: '4px solid white',
                      cursor: 'pointer',
                      boxShadow: colorCardShadow(shade.hex, playing === `shade-${shade.name}`),
                      transition: 'box-shadow 0.25s ease'
                    }}
                  />
                </motion.div>
                <Typography sx={{
                  fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                  fontWeight: big ? 800 : 600,
                  fontSize: big ? 'clamp(1rem, 3.4vw, 1.4rem)' : 'clamp(0.7rem, 2.2vw, 0.92rem)',
                  color: dark ? '#FFFFFF' : (big ? t.accentColor : 'text.secondary'),
                  lineHeight: 1.1,
                  textAlign: 'center'
                }}>
                  {shade.name}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Example objects in this color. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
          {examples.map((obj) => (
            <motion.div key={obj.objectName} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Box
                onClick={() => tapSpeak(`obj-${currentHue}-${obj.objectName}`, `${obj.objectNameDefinite} er ${currentHue}`)}
                sx={{
                  width: { xs: 44, md: 54 },
                  height: { xs: 44, md: 54 },
                  '@media (orientation: landscape)': { width: 42, height: 42 },
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)',
                  border: `2px solid ${hexToRgba(t.accentColor, dark ? 0.55 : 0.32)}`,
                  boxShadow: dark ? '0 6px 16px rgba(0,0,0,0.45)' : '0 5px 12px rgba(0,0,0,0.12)'
                }}
              >
                <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' }, lineHeight: 1, userSelect: 'none' }}>
                  {obj.emoji}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>

      {/* Color picker grid — tap a color to explore it. */}
      <Box sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
        '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(6, 1fr)' },
        gap: { xs: 1, md: 1.5 },
        alignContent: 'center',
        justifyItems: 'center',
        minHeight: 0,
        px: { xs: 1, md: 2 }
      }}>
        {HUE_ORDER.map((hue) => {
          const hex = COLOR_SWATCH[hue]
          const active = hue === currentHue
          return (
            <motion.div key={hue} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ width: '100%' }}>
              <Box
                onClick={() => tapSpeak(`color-${hue}`, hue, hue)}
                sx={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  maxWidth: { xs: 96, md: 120 },
                  mx: 'auto',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  pb: 0.75,
                  cursor: 'pointer',
                  backgroundColor: hex,
                  backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 45%)',
                  border: active ? '4px solid white' : '3px solid rgba(255,255,255,0.85)',
                  boxShadow: colorCardShadow(hex, active),
                  transition: 'box-shadow 0.25s ease'
                }}
              >
                <Typography sx={{
                  fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                  fontWeight: 800,
                  fontSize: 'clamp(0.8rem, 2.6vw, 1.05rem)',
                  color: '#FFFFFF',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  userSelect: 'none'
                }}>
                  {hue}
                </Typography>
              </Box>
            </motion.div>
          )
        })}
      </Box>

      {/* Exploration-milestone sticker reveal. */}
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
            background: 'rgba(0,0,0,0.45)'
          }}
        >
          <StickerReveal award={stickerAward} accent={COLORS_ACCENT} size={140} />
        </Box>
      )}
    </GameShell>
  )
}

export default FarverLearning
