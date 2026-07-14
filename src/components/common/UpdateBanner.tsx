import React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { Close as CloseIcon } from '@mui/icons-material'

// Update announcement pill (PRD-09 P4). Deliberately does NOT reload on tap — a child could
// otherwise mid-game tap a big "Opdater app" Fab and lose their round. It only ANNOUNCES that a
// new version is ready and points the adult to the ⚙️ corner menu (the actual, hold-gated
// "⬆️ Opdater app" action lives there). A small ✕ dismisses it (wires dismissUpdate). Anchored
// bottom-centre so it never overlaps the bottom-right gear or the bottom-left mascot.

interface UpdateBannerProps {
  show: boolean
  onDismiss: () => void
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ show, onDismiss }) => {
  const theme = useTheme()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000, // below the adult corner button (1001) and modals
            maxWidth: 'min(92vw, 360px)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.75,
              pr: 0.5,
              py: 0.75,
              borderRadius: '999px',
              bgcolor: alpha(theme.palette.primary.main, 0.95),
              color: '#fff',
              boxShadow: `0 8px 26px ${alpha(theme.palette.primary.main, 0.4)}`,
              backdropFilter: 'blur(6px)',
            }}
          >
            <Typography
              sx={{
                fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                fontWeight: 700,
                fontSize: '0.9rem',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              🎉 Ny version — åbn ⚙️ for at opdatere
            </Typography>
            <IconButton
              aria-label="Skjul opdatering"
              onClick={onDismiss}
              size="small"
              sx={{ color: '#fff', flex: '0 0 auto', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdateBanner
