import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const PWAUpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let updateTimer: NodeJS.Timeout;
    let periodicCheck: NodeJS.Timeout;

    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            console.log('🔄 Checking for updates...');
            // Force check for updates
            await registration.update();
            
            // Check if there's a waiting service worker
            if (registration.waiting) {
              console.log('🔄 Update available - service worker waiting');
              handleServiceWorkerUpdate();
            }
          }
        } catch (error) {
          console.log('Service worker update check failed:', error);
        }
      }
    };

    const handleServiceWorkerUpdate = () => {
      console.log('🔄 Service worker update detected');
      setUpdateAvailable(true);

      // Auto-update after 10 minutes
      updateTimer = setTimeout(() => {
        handleUpdate();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const handleUpdate = () => {
      console.log('🔄 Updating app...');
      // Clear timers
      if (updateTimer) clearTimeout(updateTimer);
      
      // Force reload to get latest code
      window.location.reload();
    };

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service worker controller changed');
        handleServiceWorkerUpdate();
      });

      // Check for updates when the page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          checkForUpdates();
        }
      });

      // Initial update check
      checkForUpdates();
      
      // Periodic update check every 30 seconds
      periodicCheck = setInterval(() => {
        checkForUpdates();
      }, 30000); // Check every 30 seconds

      // Listen to existing service worker registration (don't register again)
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.addEventListener('updatefound', () => {
            console.log('🔄 Update found in service worker registration');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New service worker installed, update available');
                  handleServiceWorkerUpdate();
                }
              });
            }
          });
          
          // Also check immediately if there's already a waiting worker
          if (registration.waiting) {
            console.log('🔄 Service worker already waiting, showing update prompt');
            handleServiceWorkerUpdate();
          }
        }
      }).catch((error) => {
        console.log('Service worker registration check failed:', error);
      });
    }

    // Cleanup function
    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      if (periodicCheck) clearInterval(periodicCheck);
    };
  }, []);

  const handleManualUpdate = () => {
    console.log('🔄 Manual update triggered');
    window.location.reload();
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleManualUpdate}
      className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl transition-all duration-300"
      title="Opdater app - opdateres automatisk om 10 minutter"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="text-2xl"
      >
        🔄
      </motion.div>
    </motion.button>
  );
};

export default PWAUpdateNotification;