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
// Screenshot subtlety: a report must show the broken game state, not the settings surface. That USED
// to be arranged by capturing before anything else could render — `await captureScreenshot()` sat in
// front of the PIN gate. It cost the adult 1-2 seconds of nothing happening on every single open: a
// cold dynamic import of snapdom, a full-document getComputedStyle walk, and an SVG-foreignObject
// rasterise with `embedFonts` (~0.9s by its own measurement), all racing a 5000ms timeout.
//
// The gate now opens on the tap and the capture runs BEHIND it. Three things make that safe, and all
// three are load-bearing:
//
//   1. The gate, the settings surface and the PIN pads carry `data-capture-exclude`, so they are
//      dropped from the clone (`services/captureExclude.ts`) and the picture still shows the game.
//   2. `stabilizeForCapture` skips those same subtrees, so its live-DOM mutations cannot flicker the
//      dialog the adult is looking at.
//   3. The capture STARTS one frame-budget after the gate is up, not immediately. snapdom's clone is
//      main-thread work; firing it into the dialog's enter transition would trade a slow open for a
//      janky one.
//
// The chunk is warmed on `pointerdown` so the import is resolved before the finger lifts.

import React, { useRef, useState } from 'react'
import { IconButton } from '@mui/material'
import { Settings } from 'lucide-react'
import { captureScreenshot, warmScreenshot } from '../../services/screenshotService'
import { useAuthContext } from '../../contexts/AuthContext'

const AdultSettings = React.lazy(() => import('./AdultSettings'))

/** MUI's dialog enter transition is 225ms; give it that plus a frame before stealing the thread. */
const CAPTURE_AFTER_GATE_MS = 320

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
  // Re-entrancy guard: the PIN prompt is async, so a second tap while it is in flight would fire a
  // second screenshot and a second PIN request.
  const opening = useRef(false)

  const openSettings = async () => {
    if (opening.current) return
    opening.current = true
    // `finally`, not a plain reset: a throw would otherwise leave the guard latched and the corner
    // button permanently dead — the failure mode a tap-to-open makes reachable.
    try {
      // Started, never awaited — see the header. `captureScreenshot` is documented never to throw
      // and to resolve null on failure or timeout, so nothing downstream needs a catch.
      const shot = new Promise<string | null>((resolve) => {
        setTimeout(() => void captureScreenshot().then(resolve), CAPTURE_AFTER_GATE_MS)
      })
      // Opening costs a PIN (or Face ID), which replaced the per-action Danish-number-word gate
      // entirely. Verified LOCALLY, so it still works on a plane. Unlocked ~5 min afterwards.
      // A guest has no PIN and meets the arithmetic gate instead (`config/guestAdultGate.ts`).
      if (auth) {
        const ok = await auth.requirePin('adultMenu')
        // Cancelled: the capture is still in flight and is simply thrown away.
        if (!ok) return
      }
      setMounted(true)
      setOpen(true)
      void shot.then(setScreenshot)
    } finally {
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
        // Resolve the snapdom chunk while the finger is still down. Costs nothing at cold launch —
        // see `warmScreenshot`.
        onPointerDown={warmScreenshot}
        sx={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          // Always bottom-right (PRD-09 P4): the update pill is bottom-CENTRE, so the gear no longer
          // has to dodge left onto the mascot when an update is available.
          right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
          zIndex: 1001, // above the UpdateBanner pill (1000), below modals
          width: 40,
          height: 40,
          // The old `capturing` pulse (opacity 1 + scale 1.15) is gone with the blocking capture:
          // there is nothing left to wait for, so a busy signal would only be a lie.
          opacity: 0.55,
          bgcolor: 'rgba(255,255,255,0.4)',
          color: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.25)',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
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
