import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(10);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let updateTimer: NodeJS.Timeout;
    let countdownTimer: NodeJS.Timeout;

    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            // Force check for updates
            await registration.update();
          }
        } catch (error) {
          console.log('Service worker update check failed:', error);
        }
      }
    };

    const handleServiceWorkerUpdate = () => {
      console.log('🔄 Service worker update detected');
      setUpdateAvailable(true);
      setShowUpdatePrompt(true);
      setMinutesLeft(10);

      // Start 10-minute countdown
      countdownTimer = setInterval(() => {
        setMinutesLeft((prev) => {
          if (prev <= 1) {
            // Auto-update after 10 minutes
            handleUpdate();
            return 0;
          }
          return prev - 1;
        });
      }, 60000); // Update every minute

      // Auto-update after 10 minutes
      updateTimer = setTimeout(() => {
        handleUpdate();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const handleUpdate = () => {
      console.log('🔄 Updating app...');
      // Clear timers
      if (updateTimer) clearTimeout(updateTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      
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

      // Register for service worker updates
      navigator.serviceWorker.register('/sw.js').then((registration) => {
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
      }).catch((error) => {
        console.log('Service worker registration failed:', error);
      });
    }

    // Cleanup function
    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, []);

  const handleManualUpdate = () => {
    console.log('🔄 Manual update triggered');
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt || !updateAvailable) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md"
      >
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🔄</span>
              <h3 className="font-bold text-lg">Ny Version</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white text-xl leading-none"
              aria-label="Luk"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <p className="text-sm mb-4 text-white/90">
            Ny version tilgængelig! Opdater app eller den opdateres automatisk om{' '}
            <span className="font-bold">{minutesLeft} minut{minutesLeft !== 1 ? 'ter' : ''}</span>.
          </p>

          {/* Buttons */}
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleManualUpdate}
              className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              🔄 Opdater App
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDismiss}
              className="px-4 py-2 text-white/80 text-sm hover:text-white transition-colors"
            >
              Senere
            </motion.button>
          </div>

          {/* Progress bar showing time left */}
          <div className="mt-3">
            <div className="w-full bg-white/20 rounded-full h-2">
              <motion.div
                className="bg-white h-2 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(minutesLeft / 10) * 100}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAUpdateNotification;