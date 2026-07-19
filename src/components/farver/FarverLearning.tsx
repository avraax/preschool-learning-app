import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getCategoryTheme } from '../../config/categoryThemes'
import { SHADES, HUE_ORDER, COLOR_SWATCH, DANISH_OBJECTS, spokenColor } from '../../config/colorContent'
import { hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import GameShell from '../common/GameShell'
import PromptFocus from '../common/PromptFocus'
import ObjectArt from './farverArt'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Farver — a calm browse (learning-based, no challenge). Tap a color to hear its name and see
// its shade family (lys/mellem/mørk) + example objects; tap a shade or an object to hear it too.
// Exploring distinct items feeds the shared cross-game level (per-new-item browse XP, PRD-04).
// Educational color data comes from colorContent (NOT themeable).

const FarverLearning: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const dark = muiTheme.scene.dark
  const audio = useSimplifiedAudioHook({ componentId: 'FarverLearning', autoInitialize: false })

  const [currentHue, setCurrentHue] = useState<string>(HUE_ORDER[0])
  const [playing, setPlaying] = useState<string | null>(null)
  // W4 (PRD-16): one-time gentle idle-pulse on the example objects at first mount, signalling they're
  // tappable. Fires once for the opening ~2s, then never again (not per hue change).
  const [pulseExamples, setPulseExamples] = useState(true)

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

  // Stop the first-mount example pulse after it has played once.
  useEffect(() => {
    const id = setTimeout(() => setPulseExamples(false), 2000)
    return () => clearTimeout(id)
  }, [])

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

  // PRD-09 §3.0 colour-surface grounding: a soft accent-tinted clay shadow (no hard keyboard lip);
  // the card fill stays the true educational hex.
  const colorCardShadow = (hex: string, active: boolean) =>
    active
      ? `0 0 0 4px ${hexToRgba(hex, 0.5)}, 0 8px 20px ${hexToRgba(hex, 0.38)}, 0 3px 8px rgba(0,0,0,0.14)`
      : `0 8px 20px ${hexToRgba(hex, dark ? 0.5 : 0.3)}, 0 3px 8px rgba(0,0,0,${dark ? 0.4 : 0.12})`

  return (
    <GameShell
      categoryId="colors"
      title="Lær Farver"
      backRoute="/farver"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        // Selected hue blooms with its name + shade trio + example objects, now RESTING in the
        // frozen world via PromptFocus (no frosted card). chargeKey gives the charge-in per hue.
        // Educational color hexes stay DATA (colorContent.ts) — only label text uses the themed
        // accent for guaranteed contrast; every swatch/shade/object keeps its true hex.
        <PromptFocus accent={t.accentColor} chargeKey={currentHue} subject={
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
              // Hue headline on the focal-zone light-pool: readable-on-white accent on light scenes
              // (Farver's accent fails on white across skins), white on dark scenes. See onTileColor.
              color: dark ? '#FFFFFF' : t.onTileColor,
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
                      // Middle (canonical) shade name uses the readable-on-white accent on light scenes.
                      color: dark ? '#FFFFFF' : (big ? t.onTileColor : 'text.secondary'),
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

            {/* W4: Lys → Mørk direction cue — pre-teaches the ordering direction Nuancer tests
                (continuity across the section). Icon-led (language-light); hidden on phone landscape
                like the headline/objects (stage budget too short there). */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, [PHONE_LANDSCAPE]: { display: 'none' } }}>
              <Box aria-hidden sx={{ display: 'flex', color: '#F59E0B', '& svg': { width: '1.2rem', height: 'auto' } }}>
                <Sun strokeWidth={2.5} />
              </Box>
              <Typography sx={{
                fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(0.8rem, 2.4vw, 1rem)',
                color: dark ? 'rgba(255,255,255,0.85)' : 'text.secondary'
              }}>
                lys → mørk
              </Typography>
              <Box aria-hidden sx={{ display: 'flex', color: dark ? '#CBD5E1' : '#64748B', '& svg': { width: '1.2rem', height: 'auto' } }}>
                <Moon strokeWidth={2.5} />
              </Box>
            </Box>

            {/* Example objects in this color. Hidden on phone landscape (see note above). */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 }, [PHONE_LANDSCAPE]: { display: 'none' } }}>
              {examples.map((obj, i) => {
                // One-time first-mount pulse (W4): a gentle staggered bob so the objects read as
                // tappable content, not decoration. Reduced-motion keeps them static.
                const doPulse = pulseExamples && !reduce
                return (
                <motion.div
                  key={obj.objectName}
                  animate={doPulse ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                  transition={doPulse ? { duration: 1, delay: 0.4 + i * 0.14, ease: 'easeInOut' } : { duration: 0.2 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {/* PRD-09/16: bigger baked example object resting in the world (no holder), grounded
                      by a stronger contact shadow (elevation 2) so it reads as a real, tappable thing. */}
                  <Box
                    onClick={() => tapSpeak(`obj-${currentHue}-${obj.objectName}`, `${obj.objectNameDefinite} er ${spokenColor(currentHue, obj.neuter)}`)}
                    sx={{
                      width: { xs: 56, md: 64 },
                      height: { xs: 56, md: 64 },
                      [PHONE_LANDSCAPE]: { width: 44, height: 44 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ObjectArt art={obj.art} size="100%" elevation={2} alt={obj.objectName} />
                  </Box>
                </motion.div>
                )
              })}
            </Box>
          </Box>
        } />
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
