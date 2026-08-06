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
import { useLocation } from 'react-router-dom'
// Side-effect import: registers the real passkey / Google implementations into authSignIn.
import '../../services/authSignInRegistry'
import { gateBlocks, isPublicPath } from '../../contexts/authGatePolicy'
import { AuthProvider, useAuthContext } from '../../contexts/AuthContext'
import { musicClient } from '../../services/musicClient'
import { profileStore } from '../../services/profileStore'
import PublicPages from '../legal/PublicPages'
import AuthDialogs from './AuthDialogs'
import LockScreen from './LockScreen'
import OAuthReturnHandler from './OAuthReturnHandler'
import ProfileGate from './ProfileGate'

const GateBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthContext()
  const { pathname } = useLocation()
  const blocked = !!auth && gateBlocks(auth.phase)
  // The privacy policy and the support page are the two URLs App Store Connect demands and Apple
  // fetches WITHOUT an account (PRD §3.5, listing §3.1). Static text, no child data, nothing to spend.
  const publicPage = blocked && isPublicPath(pathname)

  // progressStore is INERT until a child is attached (§5.4), and profileStore is the ONLY thing allowed
  // to attach. Do it the moment the gate opens.
  //
  // There is deliberately NO detach here, and the comment that used to claim one was simply wrong.
  // While the gate blocks, <App /> is not rendered at all, so no game exists to write to the previous
  // child's key — a detach would buy nothing. The case that DOES need one is a change of identity, and
  // that is handled where it belongs: `authStore.onSignOut` → `profileStore.signOut()`, which fires on
  // the adult's own sign-out and on a revoked session alike.
  useEffect(() => {
    if (blocked) return
    profileStore.hydrate(auth?.user?.id ?? null)
  }, [blocked, auth?.user?.id])

  // The music bed must not play over the login screen or through the Google round trip. It cannot be
  // route-based: `AppThemeProvider` starts the bed and sits ABOVE this gate, and the lock screen is at
  // '/', which IS a menu path. So the gate reports itself. Runs on the `!auth` fail-open path too.
  useEffect(() => {
    musicClient.setGateBlocking('auth', blocked)
  }, [blocked])

  // No context (shouldn't happen) → fail OPEN rather than bricking the app behind a gate that can't
  // decide. The paid endpoints are still protected server-side, which is the control that matters.
  if (!auth) return <>{children}</>
  return (
    <>
      {/* Handles the `#bl_auth=1` return fragment and the polling/cold-boot recovery. Mounted even
          while blocked — it is what UNBLOCKS the gate after a Google round trip. */}
      <OAuthReturnHandler />
      {/* Inside the auth gate, ProfileGate decides whether a CHILD still has to be chosen. */}
      {publicPage ? <PublicPages /> : blocked ? <LockScreen /> : <ProfileGate>{children}</ProfileGate>}
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
