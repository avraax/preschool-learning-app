import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { SHADES, HUE_ORDER, COLOR_SWATCH, DANISH_OBJECTS, spokenColor } from '../../config/colorContent'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import GameShell from '../common/GameShell'
import PromptStage from '../common/PromptStage'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Farver — a calm browse (learning-based, no challenge). Tap a color to hear its name and see
// its shade family (lys/mellem/mørk) + example objects; tap a shade or an object to hear it too.
// Exploring distinct items feeds the shared cross-game level (per-new-item browse XP, PRD-04).
// Educational color data comes from colorContent (NOT themeable).

const FarverLearning: React.FC = () => {
  const muiTheme = useTheme()
  const t = getCategoryTheme('colors')
  const dark = muiTheme.scene.dark
  const audio = useSimplifiedAudioHook({ componentId: 'FarverLearning', autoInitialize: false })

  const [currentHue, setCurrentHue] = useState<string>(HUE_ORDER[0])
  const [playing, setPlaying] = useState<string | null>(null)

  const { showCelebration, celebrationIntensity, celebrationDuration, stopCelebration } = useCelebration()

  // Per-new-item browse XP (Liveliness PRD-04) — replaces the old milestone sticker. Each newly
  // explored color/shade/object feeds the shared cross-game level + ticks the header ring.
  const awardBrowseXp = useBrowseXp('colors')

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

  // Speak `text`, feeding per-new-item browse XP for `key`. `hue` swaps the detail panel.
  const tapSpeak = async (key: string, text: string, hue?: string) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    if (hue) setCurrentHue(hue)
    setPlaying(key)
    // Per-new-item browse XP (Liveliness PRD-04): first visit to this item feeds the level + ticks
    // the ring. We always still speak the item.
    awardBrowseXp(key)
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
      promptStage={
        // Selected hue blooms with its name + shade trio + example objects (§6C). PromptStage's own
        // chargeKey gives the gentle charge-in on every new hue (reduced-motion parity built in).
        // Educational color hexes stay DATA (colorContent.ts) — only label text uses the themed
        // accent for guaranteed contrast; every swatch/shade/object keeps its true hex.
        <PromptStage accent={t.accentColor} chargeKey={currentHue}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 0.5, md: 1 },
              width: '100%',
              height: '100%',
            }}
          >
            {/* Hue name headline. Hidden on phone landscape — the shade trio's own middle label
                already reads as the hue name (e.g. "rød"), and the ~90px stage budget there can't
                fit headline + shades + objects at once (verified via screenshot — it was clipping
                silently under PromptStage's overflow:hidden). */}
            <Typography sx={{
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              lineHeight: 1,
              color: dark ? '#FFFFFF' : t.accentColor,
              textShadow: dark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
              fontSize: 'clamp(1.3rem, 5.5vh, 2.2rem)',
              [PHONE_LANDSCAPE]: { display: 'none' },
            }}>
              {currentHue}
            </Typography>

            {/* Shade trio (tap each to hear lys/mellem/mørk). */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, md: 1.5 }, [PHONE_LANDSCAPE]: { gap: 0.75 } }}>
              {shades.map((shade, i) => {
                const big = i === 1 // middle = the canonical color, shown largest
                const dim = { xs: big ? 78 : 56, md: big ? 100 : 74 }
                const dimLand = big ? 56 : 40
                return (
                  <Box key={shade.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                      <Box
                        onClick={() => tapSpeak(`shade-${shade.name}`, shade.name, currentHue)}
                        sx={{
                          width: { xs: dim.xs, md: dim.md },
                          height: { xs: dim.xs, md: dim.md },
                          [PHONE_LANDSCAPE]: { width: dimLand, height: dimLand },
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
                      fontSize: big ? 'clamp(0.9rem, 3vw, 1.25rem)' : 'clamp(0.65rem, 2vw, 0.85rem)',
                      color: dark ? '#FFFFFF' : (big ? t.accentColor : 'text.secondary'),
                      lineHeight: 1.1,
                      textAlign: 'center',
                      [PHONE_LANDSCAPE]: { fontSize: big ? '0.75rem' : '0.6rem' },
                    }}>
                      {shade.name}
                    </Typography>
                  </Box>
                )
              })}
            </Box>

            {/* Example objects in this color. Hidden on phone landscape (see note above). */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.25 }, [PHONE_LANDSCAPE]: { display: 'none' } }}>
              {examples.map((obj) => (
                <motion.div key={obj.objectName} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Box
                    onClick={() => tapSpeak(`obj-${currentHue}-${obj.objectName}`, `${obj.objectNameDefinite} er ${spokenColor(currentHue, obj.neuter)}`)}
                    sx={{
                      width: { xs: 40, md: 48 },
                      height: { xs: 40, md: 48 },
                      [PHONE_LANDSCAPE]: { width: 36, height: 36 },
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
                    <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.7rem' }, lineHeight: 1, userSelect: 'none' }}>
                      {obj.emoji}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </Box>
        </PromptStage>
      }
    >
      {/* Color picker grid — tap a color to explore it. Centred within the answer zone beneath the
          bloom (mirrors the pre-PromptStage centring). */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, width: '100%' }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
          '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(6, 1fr)' },
          gap: { xs: 1.25, md: 2 },
          alignContent: 'center',
          justifyItems: 'center',
          width: '100%',
          maxWidth: 900,
          mx: 'auto',
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
                    maxWidth: { xs: 110, sm: 128, md: 150 },
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
      </Box>
    </GameShell>
  )
}

export default FarverLearning
