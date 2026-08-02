// "Til de voksne" corner button (Bug Report feature / adult-tools consolidation).
//
// ONE small semi-transparent button, bottom-right on every page (mounted globally in App.tsx).
// A plain TAP opens it. It used to need a ~2s hold as the child-resistant gesture, but the real gate
// is now the 4-digit PIN (or Face ID) — a child who taps just meets the PIN pad, so the hold was pure
// friction for the adult.
//
// This file is now ONLY the button, the screenshot capture, the PIN gate, and the mount point for the
// lazy `AdultSettings` surface. Everything the adult can DO lives there (Settings PRD-01 W7).
//
// THAT IS A BUNDLE WIN, NOT A COST (PRD §10). This component is mounted globally, so its module-scope
// imports are eager. It used to pull MUI List/Dialog/Switch, 17 lucide icons, `useProfiles`,
// `progressSync` and `profileStore` into first paint, plus seven separate lazy chunks behind them.
// Collapsing all of that into ONE lazy chunk and leaving only the gear eager makes first paint
// lighter, not heavier.
//
// Screenshot subtlety: the screen is captured on tap, BEFORE any settings UI renders, and stashed —
// so a report shows the broken game state, not the settings surface.

import React, { useRef, useState } from 'react'
import { IconButton } from '@mui/material'
import { Settings } from 'lucide-react'
import { captureScreenshot } from '../../services/screenshotService'
import { useAuthContext } from '../../contexts/AuthContext'

const AdultSettings = React.lazy(() => import('./AdultSettings'))

interface AdultCornerProps {
  /** A newer build is live → show the update strip inside the settings surface (PRD-09 P4). */
  updateAvailable?: boolean
  /** Apply the update (hard reload). Only reachable from inside the PIN-gated settings surface. */
  onApplyUpdate?: () => void
}

const AdultCorner: React.FC<AdultCornerProps> = ({ updateAvailable = false, onApplyUpdate }) => {
  const auth = useAuthContext()
  const [open, setOpen] = useState(false)
  // Mount the lazy surface on first open and keep it mounted, so its close transition still animates.
  const [mounted, setMounted] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  // Re-entrancy guard: the capture + PIN prompt are async, so a second tap while they're in flight
  // would fire a second screenshot and a second PIN request.
  const opening = useRef(false)

  const openSettings = async () => {
    if (opening.current) return
    opening.current = true
    // `finally`, not a plain reset: a throwing capture would otherwise leave the guard latched and
    // the corner button permanently dead — the failure mode a tap-to-open makes reachable.
    try {
      setCapturing(true)
      // Capture BEFORE the settings surface exists — this is the screenshot a report will carry.
      const shot = await captureScreenshot()
      setScreenshot(shot)
      setCapturing(false)
      // Opening costs a PIN (or Face ID), which replaced the per-action Danish-number-word gate
      // entirely. Verified LOCALLY, so it still works on a plane. Unlocked ~5 min afterwards.
      if (auth) {
        const ok = await auth.requirePin('adultMenu')
        if (!ok) {
          setScreenshot(null)
          return
        }
      }
      setMounted(true)
      setOpen(true)
    } finally {
      setCapturing(false)
      opening.current = false
    }
  }

  const handleClick = () => {
    // An auth surface is open (lock screen, PIN pad, PIN setup): the tap is INERT, so a PIN screen
    // can never be captured into a bug report at all (accounts PRD §8.1 layer a).
    if (auth?.authUiOpen) return
    void openSettings()
  }

  const closeAll = () => {
    setOpen(false)
    setScreenshot(null)
  }

  return (
    <>
      <IconButton
        aria-label="Til de voksne"
        onClick={handleClick}
        sx={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          // Always bottom-right (PRD-09 P4): the update pill is bottom-CENTRE, so the gear no longer
          // has to dodge left onto the mascot when an update is available.
          right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
          zIndex: 1001, // above the UpdateBanner pill (1000), below modals
          width: 40,
          height: 40,
          opacity: capturing ? 1 : 0.55,
          bgcolor: 'rgba(255,255,255,0.4)',
          color: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.25)',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          transform: capturing ? 'scale(1.15)' : 'none',
          '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.55)' },
        }}
      >
        <Settings size={20} />
      </IconButton>

      <React.Suspense fallback={null}>
        {mounted && (
          <AdultSettings
            open={open}
            onClose={closeAll}
            screenshot={screenshot}
            updateAvailable={updateAvailable}
            onApplyUpdate={onApplyUpdate}
          />
        )}
      </React.Suspense>
    </>
  )
}

export default AdultCorner
