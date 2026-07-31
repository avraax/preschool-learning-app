// The two auth dialogs that must be mounted app-wide, above the gate.
//
// PinDialog is what `AuthContext.requirePin()` resolves through, so it has to exist wherever a PIN can
// be demanded — including on the LOCK screen (`unlockSession`), i.e. while the gate is blocking. That
// is why this sits beside the gate rather than inside <App />.
//
// PinSetupDialog is the mandatory onboarding nag: it appears once the session is real and
// /family/status says no PIN exists yet, and it cannot be dismissed (§7.2).

import React, { useEffect } from 'react'
import PinDialog from './PinDialog'
import PinSetupDialog from './PinSetupDialog'
import { useAuthContext } from '../../contexts/AuthContext'
import { authStore } from '../../services/authStore'

const AuthDialogs: React.FC = () => {
  const auth = useAuthContext()

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
    </>
  )
}

export default AuthDialogs
