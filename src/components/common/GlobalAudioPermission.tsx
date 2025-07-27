import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Button, Typography, Paper, IconButton } from '@mui/material'
import { VolumeUp, TouchApp, Close } from '@mui/icons-material'
import { useAudioPermissionHook } from '../../hooks/useAudioPermission'

const GlobalAudioPermission: React.FC = () => {
  const { state, requestAudioPermission, hidePrompt } = useAudioPermissionHook()

  const handleEnableAudio = async () => {
    await requestAudioPermission()
  }

  const handleDismiss = () => {
    hidePrompt()
  }

  return (
    <AnimatePresence>
      {state.showPrompt && (
        <Box
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              {/* Close button */}
              <IconButton
                onClick={handleDismiss}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  color: 'white',
                  opacity: 0.8,
                  '&:hover': {
                    opacity: 1,
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }
                }}
                size="small"
              >
                <Close />
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

              {/* Main message */}
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
                Aktivér lyd 🎵
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
                For at høre dansk tale og musik, skal du aktivere lyd ved at trykke på knappen nedenfor.
              </Typography>

              {/* Action button */}
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
                    color: '#667eea',
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
                  Tryk for at aktivere lyd
                </Button>
              </motion.div>

              {/* Helper text */}
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 3,
                  opacity: 0.8,
                  fontSize: '0.9rem'
                }}
              >
                Dette spørges kun én gang per session
              </Typography>
            </Paper>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  )
}

export default GlobalAudioPermission