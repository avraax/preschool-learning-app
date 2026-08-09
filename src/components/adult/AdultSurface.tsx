// "Til de voksne": the gate, the capture and the mount point — with NO trigger of its own.
//
// **The gear is gone (owner, 2026-08-09). The child's avatar IS the door.** `ProfileBadge` already
// renders in the header of every screen, so tapping it opens this surface with exactly the behaviour
// the floating gear had: a plain tap → PIN (or the guest arithmetic gate) → the lazy `AdultSettings`.
// That is Khan Academy Kids' pattern, and it removes a permanent adult artifact from a child's screen.
// The trigger reaches this component through `adultSurfaceBus` — see that file for why a bus.
//
// The objection that had to be answered first, recorded so it is not re-litigated: a bug report
// captures `document.body` at the moment this opens, so the door MUST be reachable from the broken
// screen, mid-game included — otherwise no report can ever show the game that broke. It survives only
// because the badge is on every screen and behaves identically everywhere. A stray tap in the game
// header meets a gate the child cannot pass, which is no worse than the reward ring 12px away already
// leaving the game on a stray tap (owner's own precedent, 2026-08-03).
//
// The one behaviour that genuinely changed: `ProfileBadge` renders nothing while no child is attached,
// so during the cold-boot window before the roster settles there is no adult door. That window also
// has no child playing, and the gear was inert over the gate anyway — but it is a real difference, so
// don't be surprised by it.
//
// It used to need a ~2s hold as the child-resistant gesture; the real gate is now the 4-digit PIN (or
// Face ID), so the hold was pure friction for the adult.
//
// THAT IS A BUNDLE WIN, NOT A COST (PRD §10). This component is mounted globally, so its module-scope
// imports are eager. It used to pull MUI List/Dialog/Switch, 17 lucide icons, `useProfiles`,
// `progressSync` and `profileStore` into first paint, plus seven separate lazy chunks behind them.
// Collapsing all of that into ONE lazy chunk keeps first paint light; dropping the gear removed the
// last eager widget here, so this file now renders nothing until the adult asks for it.
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

import React, { useEffect, useRef, useState } from 'react'
import { captureScreenshot } from '../../services/screenshotService'
import { adultSurfaceBus } from '../../services/adultSurfaceBus'
import { useAuthContext } from '../../contexts/AuthContext'

const AdultSettings = React.lazy(() => import('./AdultSettings'))

/** MUI's dialog enter transition is 225ms; give it that plus a frame before stealing the thread. */
const CAPTURE_AFTER_GATE_MS = 320

interface AdultSurfaceProps {
  /** A newer build is live → show the update strip inside the settings surface (PRD-09 P4). */
  updateAvailable?: boolean
  /** Apply the update (hard reload). Only reachable from inside the PIN-gated settings surface. */
  onApplyUpdate?: () => void
}

const AdultSurface: React.FC<AdultSurfaceProps> = ({ updateAvailable = false, onApplyUpdate }) => {
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

  const closeAll = () => {
    setOpen(false)
    setScreenshot(null)
  }

  // The badge taps through to here. The `authUiOpen` check stays on THIS side of the bus on purpose:
  // an auth surface is open (lock screen, PIN pad, PIN setup), so the trigger is INERT and a PIN
  // screen can never be captured into a bug report at all (accounts PRD §8.1 layer a). Keeping it here
  // rather than in the trigger means a future second trigger cannot forget it.
  //
  // `auth` is a dependency: the effect re-registers whenever the context object changes, so the
  // closure can never hold a stale `authUiOpen` and let a tap through over a live PIN pad.
  useEffect(
    () =>
      adultSurfaceBus.register(() => {
        if (auth?.authUiOpen) return
        void openSettings()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openSettings is stable enough; `auth` is the live input
    [auth],
  )

  return (
    <>
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

export default AdultSurface
