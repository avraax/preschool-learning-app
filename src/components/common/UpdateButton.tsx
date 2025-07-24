import React, { useState } from 'react';
import { motion } from 'framer-motion';

const UpdateButton: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);

  const handleUpdateCheck = async () => {
    setIsChecking(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Force check for updates
          await registration.update();
          console.log('🔄 Manual update check completed');
        }
      }
      
      // Always refresh after checking - ensures latest code
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.log('Update check failed, refreshing anyway:', error);
      // Even if service worker fails, refresh to get latest code
      window.location.reload();
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleUpdateCheck}
      disabled={isChecking}
      className={`
        fixed top-4 right-4 z-40 
        w-12 h-12 
        bg-gradient-to-br from-blue-500 to-purple-600 
        text-white rounded-full shadow-lg
        flex items-center justify-center
        hover:shadow-xl transition-all duration-200
        ${isChecking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title="Tjek for opdateringer"
    >
      <motion.div
        animate={isChecking ? { rotate: 360 } : { rotate: 0 }}
        transition={isChecking ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
        className="text-xl"
      >
        🔄
      </motion.div>
    </motion.button>
  );
};

export default UpdateButton;