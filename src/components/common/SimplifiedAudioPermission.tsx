import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Button, Typography, Paper, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { VolumeUp, TouchApp, Close } from '@mui/icons-material'
import { useSimplifiedAudio } from '../../contexts/SimplifiedAudioContext'
import { audioDebugSession } from '../../utils/remoteConsole'
import { devNoGate } from '../../utils/devHarness'
import { useAuthContext } from '../../contexts/AuthContext'
import { shouldRenderAudioPrompt } from '../../contexts/audioPromptPolicy'

const SimplifiedAudioPermission: React.FC = () => {
  const theme = useTheme()
  const { state, initializeAudio, hidePrompt } = useSimplifiedAudio()
  const auth = useAuthContext()

  // The whole show/hide decision is the pure, unit-tested `shouldRenderAudioPrompt` — including
  // ?nogate=1 (DEV screenshot harness) and `authUiOpen` (one blocking overlay at a time; this modal
  // was painting over the mandatory PIN setup and "who is playing?"). See audioPromptPolicy.ts.
  if (
    !shouldRenderAudioPrompt({
      showPrompt: state.showPrompt,
      authUiOpen: auth?.authUiOpen ?? false,
      devNoGate: devNoGate(),
    })
  ) {
    return null
  }

  const handleEnableAudio = () => {
    // [audio-unlock] diagnostic (captured in bug-report diagnostics ring) — proves the tap handler
    // actually fired (rules out the framer-motion wrapper swallowing the tap).
    console.warn('[audio-unlock] "Start lyd nu" tapped')
    audioDebugSession.addLog('SIMPLIFIED_PERMISSION_CLICKED', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent.substring(0, 100)
    })

    // Dismiss SYNCHRONOUSLY & immediately — never gate the close on the async unlock resolving. iOS
    // resume() can lag or hang; previously an awaited init could leave the button "unresponsive".
    // hidePrompt() also kicks initializeAudio() via updateUserInteraction, in the SAME gesture, so
    // the in-gesture priming (see SimplifiedAudioContext) still happens.
    hidePrompt()

    // Explicit call is de-duped by initPromiseRef; used only to log the unlock outcome.
    initializeAudio()
      .then((result) => {
        console.warn('[audio-unlock] initializeAudio result:', result)
        audioDebugSession.addLog('SIMPLIFIED_PERMISSION_RESULT', { success: result, timestamp: Date.now() })
      })
      .catch((error) => {
        console.warn('[audio-unlock] initializeAudio error:', error)
        audioDebugSession.addLog('SIMPLIFIED_PERMISSION_ERROR', {
          error: error instanceof Error ? error.message : error?.toString(),
          timestamp: Date.now(),
        })
      })
  }

  return (
    <AnimatePresence>
      {state.showPrompt && (
        <Box
          // A tap ANYWHERE on this overlay dismisses it, on `click`. Two reasons, both load-bearing:
          // (1) the overlay covers the viewport, so every tap while it is up lands on it — with the
          //     async hide removed from initializeAudio (see SimplifiedAudioContext), a tap on the
          //     scrim or the card body would otherwise unlock audio and leave the modal standing;
          // (2) `click` is the only safe event to close on. The gesture's touchstart already unlocked
          //     audio via the document-wide listener, and closing any earlier than the click makes the
          //     tap fall through to whatever was behind the modal.
          onClick={hidePrompt}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ 
              type: 'spring', 
              stiffness: 300, 
              damping: 30,
              duration: 0.3
            }}
            style={{ width: '100%', maxWidth: '400px' }}
          >
            <Paper
              elevation={12}
              sx={{
                p: 4,
                borderRadius: 4,
                textAlign: 'center',
                background: theme.decor.audioPermissionGradient,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  pointerEvents: 'none'
                }
              }}
            >
              {/* Close button. The inset is COMPUTED against the card's corner arc, not eyeballed.
                  This theme sets `shape.borderRadius: 16`, so the Paper's `borderRadius: 4` is **64px** —
                  and the Paper is `overflow: hidden`, so anything straying outside that arc is silently
                  CLIPPED. The old 32px `size="small"` button at top/right 8 put its disc centre 24px in;
                  the arc's centre of curvature is 64px in, so √2·(64−24) = 57 > 64−16 and the disc was
                  cut by the corner. That clipping is what read as "too close to the edge".
                  A 44px disc (also the app's touch minimum, which `size="small"` missed) at inset 16
                  centres 38px in: √2·(64−38) + 22 = 58.8 ≤ 64, so the whole disc clears the curve with
                  ~5px to spare. Recompute this if the radius or the button size ever changes.
                  The translucent backing gives it a body on the gradient — a bare white glyph on
                  mid-purple is easy to miss, and this is one of the two controls that MUST dismiss
                  (see audio-system.md). */}
              <IconButton
                onClick={hidePrompt}
                aria-label="Luk"
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 44,
                  height: 44,
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.26)'
                  }
                }}
              >
                <Close fontSize="small" />
              </IconButton>

              {/* Audio icon with animation */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'reverse'
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto',
                    border: '3px solid rgba(255,255,255,0.3)'
                  }}
                >
                  <VolumeUp sx={{ fontSize: 40, color: 'white' }} />
                </Box>
              </motion.div>

              {/* Main message - more direct and clear */}
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom
                sx={{ 
                  fontWeight: 600,
                  mb: 2,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                Tænd for lyd
              </Typography>

              <Typography 
                variant="body1" 
                sx={{ 
                  mb: 3,
                  opacity: 0.95,
                  lineHeight: 1.6,
                  fontSize: '1.1rem'
                }}
              >
                Tryk på knappen for at høre dansk tale og musik i spillet.
              </Typography>

              {/* Simplified action button */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleEnableAudio}
                  variant="contained"
                  size="large"
                  startIcon={<TouchApp />}
                  sx={{
                    py: 2,
                    px: 4,
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    backgroundColor: 'white',
                    color: theme.decor.audioPermissionAccent,
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    '&:hover': {
                      backgroundColor: '#f8f9ff',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                  fullWidth
                >
                  Start lyd nu
                </Button>
              </motion.div>

              {/* Helper text - more encouraging */}
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 3,
                  opacity: 0.8,
                  fontSize: '0.9rem'
                }}
              >
                Dette kræves kun én gang for at spille med lyd
              </Typography>
            </Paper>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  )
}

export default SimplifiedAudioPermission