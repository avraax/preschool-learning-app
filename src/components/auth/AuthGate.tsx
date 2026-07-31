// The hard gate (D5): nothing works before sign-in.
//
// Mounted between AppErrorBoundary and App in main.tsx, and deliberately NOT React.lazy — a blocking
// gate must never wait on a chunk to arrive.
//
// TWO THINGS THIS DOES NOT DO, both on purpose (accounts PRD §4.7):
//  * It never blocks first paint and never awaits a fetch. authStore hydrates localStorage
//    SYNCHRONOUSLY and renders optimistically (`unknown` + a stored token ⇒ authed), validating in the
//    background — the same discipline as progressStore. There is no boot spinner anywhere.
//  * It does not render <App /> while the gate blocks, which is what keeps the audio-permission modal
//    INSIDE the gate: only one blocking overlay is ever on screen.
//
// `offlineGrace` deliberately does NOT block: all paid capability is gated by a server-minted access
// JWT that cannot be minted offline, so letting the app keep PLAYING costs nothing. Strictness belongs
// on the token, not on playtime.

import React, { useEffect } from 'react'
// Side-effect import: registers the real passkey / Google implementations into authSignIn.
import '../../services/authSignInRegistry'
import { gateBlocks } from '../../contexts/authGatePolicy'
import { AuthProvider, useAuthContext } from '../../contexts/AuthContext'
import { profileStore } from '../../services/profileStore'
import AuthDialogs from './AuthDialogs'
import LockScreen from './LockScreen'
import OAuthReturnHandler from './OAuthReturnHandler'

const GateBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthContext()
  const blocked = !!auth && gateBlocks(auth.phase)

  // progressStore is INERT until a child is attached (§5.4), and profileStore is the ONLY thing
  // allowed to attach. Do it the moment the gate opens, and detach when it closes again — playing on
  // behind a lock screen would write to the previous child's key.
  useEffect(() => {
    if (blocked) return
    profileStore.hydrate(auth?.user?.id ?? null)
  }, [blocked, auth?.user?.id])

  // No context (shouldn't happen) → fail OPEN rather than bricking the app behind a gate that can't
  // decide. The paid endpoints are still protected server-side, which is the control that matters.
  if (!auth) return <>{children}</>
  return (
    <>
      {/* Handles the `#bl_auth=1` return fragment and the polling/cold-boot recovery. Mounted even
          while blocked — it is what UNBLOCKS the gate after a Google round trip. */}
      <OAuthReturnHandler />
      {blocked ? <LockScreen /> : children}
      {/* Above the gate on purpose: `requirePin('unlockSession')` is demanded FROM the lock screen. */}
      <AuthDialogs />
    </>
  )
}

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <GateBody>{children}</GateBody>
  </AuthProvider>
)

export default AuthGate
