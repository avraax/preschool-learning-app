// The two auth dialogs that must be mounted app-wide, above the gate.
//
// PinDialog is what `AuthContext.requirePin()` resolves through, so it has to exist wherever a PIN can
// be demanded — including on the LOCK screen (`unlockSession`), i.e. while the gate is blocking. That
// is why this sits beside the gate rather than inside <App />.
//
// PinSetupDialog is the mandatory onboarding nag: it appears once the session is real and
// /family/status says no PIN exists yet, and it cannot be dismissed (§7.2).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import PinDialog from './PinDialog'
import PinSetupDialog from './PinSetupDialog'
import GuestAdultGate from './GuestAdultGate'
import { registerGuestAdultPrompt, useAuthContext } from '../../contexts/AuthContext'
import { authStore } from '../../services/authStore'

const AuthDialogs: React.FC = () => {
  const auth = useAuthContext()

  // THE GUEST PARENTAL GATE (App Store PRD §3.2 / A1). Hosted here, beside PinDialog, for the same
  // reason PinDialog is: `requirePin` can be called from anywhere, so the surface it resolves through
  // has to be mounted app-wide and above the auth gate.
  const [gateOpen, setGateOpen] = useState(false)
  const gateResolve = useRef<((ok: boolean) => void) | null>(null)

  useEffect(() => {
    registerGuestAdultPrompt(
      () =>
        new Promise<boolean>((resolve) => {
          gateResolve.current = resolve
          setGateOpen(true)
        }),
    )
    return () => registerGuestAdultPrompt(null)
  }, [])

  const resolveGate = useCallback((ok: boolean) => {
    setGateOpen(false)
    const r = gateResolve.current
    gateResolve.current = null
    // Always settle the promise. A caller awaiting `requirePin` that never resolves is a dead adult
    // menu with no error anywhere — the exact failure shape this repo has shipped before.
    r?.(ok)
  }, [])

  // The gate is an auth surface: it claims `authUiOpen` so AdultCorner's capture stays inert and the
  // audio cue stands down, exactly as the PIN pad does.
  useEffect(() => {
    if (!gateOpen) return
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateOpen])

  // Only nag once the server has actually told us there is no PIN. `info === null` means we haven't
  // asked yet (or we're offline / on the dev bypass) — nagging then would be a guess.
  const needsPin =
    !!auth && auth.phase === 'authed' && !!auth.info && !auth.info.hasPin && !authStore.isDevBypass()

  // Mandatory PIN setup is an auth surface too: mark it so AdultCorner's hold gesture stays inert.
  useEffect(() => {
    if (!needsPin) return
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPin])

  return (
    <>
      <PinDialog />
      <PinSetupDialog open={needsPin} onDone={() => void authStore.refreshStatus()} />
      <GuestAdultGate open={gateOpen} onResolve={resolveGate} />
    </>
  )
}

export default AuthDialogs
