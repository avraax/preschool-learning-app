import React from 'react'
import { Fab, CircularProgress } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { Refresh as RefreshIcon } from '@mui/icons-material'

interface UpdateBannerProps {
  show: boolean
  onUpdate: () => void
  isApplying?: boolean
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ 
  show, 
  onUpdate, 
  isApplying = false 
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000, // Below version display (1001) to avoid conflicts
          }}
        >
          <Fab
            variant="extended"
            onClick={onUpdate}
            disabled={isApplying}
            sx={{
              backgroundColor: '#8B5CF6', // Purple theme matching the app
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              textTransform: 'none',
              minWidth: '140px', // Ensure enough width for "Opdater app"
              height: '48px', // Standard height
              paddingX: 2, // Extra horizontal padding
              whiteSpace: 'nowrap', // Prevent text wrapping to multiple lines
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
              '&:hover': {
                backgroundColor: '#7C3AED',
                boxShadow: '0 12px 40px rgba(139, 92, 246, 0.4)',
              },
              '&:disabled': {
                backgroundColor: '#A78BFA',
                color: 'white',
              }
            }}
          >
            {isApplying ? (
              <>
                <CircularProgress 
                  size={20} 
                  sx={{ 
                    color: 'white',
                    marginRight: 1
                  }} 
                />
                Opdaterer...
              </>
            ) : (
              <>
                <RefreshIcon sx={{ marginRight: 1 }} />
                Opdater app
              </>
            )}
          </Fab>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdateBanner