import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UpdateBannerProps {
  show: boolean
  onUpdate: () => void
  onDismiss: () => void
  isApplying?: boolean
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ 
  show, 
  onUpdate, 
  onDismiss, 
  isApplying = false 
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: isApplying ? 360 : 0 }}
                transition={{ 
                  duration: isApplying ? 2 : 0, 
                  repeat: isApplying ? Infinity : 0,
                  ease: "linear" 
                }}
                className="text-2xl"
              >
                {isApplying ? '🔄' : '🆕'}
              </motion.div>
              <div>
                <p className="font-semibold text-sm md:text-base">
                  Ny version tilgængelig
                </p>
                <p className="text-xs opacity-90 hidden md:block">
                  En opdatering af appen er klar til installation
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onUpdate}
                disabled={isApplying}
                className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Opdaterer...' : 'Opdater nu'}
              </motion.button>
              
              {!isApplying && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDismiss}
                  className="text-white hover:text-purple-200 p-1 rounded-full transition-colors"
                  title="Luk opdateringsbesked"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdateBanner