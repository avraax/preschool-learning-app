// Sits just inside the auth gate and decides whether a CHILD still has to be chosen.
//
// The rule that keeps "the child never sees a login screen" true (accounts PRD §7.4): the picker appears
// only when the account has MORE THAN ONE profile. One child boots straight into their book.
//
// With more than one it now appears on EVERY cold start (Børn picker PRD-01 §2.1) — `hydrate` no longer
// honours the stored "last child" pointer, which used to mean a family met this screen once and then
// silently resumed as whoever played last. COLD START ONLY (§2.2): nothing on a resume path may raise
// it, and the thing that guarantees that is `hydrate`'s `already` guard. Do not add a `hydrate` call to
// a visibilitychange/pagehide handler.
//
// The picker PICKS. Its old un-gated "Tilføj et barn" button is deleted (§2.3) — creating a child now
// happens only behind the parental gate in the adult surface, or through the MANDATORY dialog below,
// which is a different thing: it is the only way into an account that has no children at all, so it
// must stay un-gated (a brand-new account may have no PIN yet).
//
// An account with NO children yet gets the mandatory CreateProfileDialog — there is nobody to play as,
// and nothing is pre-added. Progress from before accounts is deliberately NOT migrated (owner's call:
// clean sheet), so there is no adoption flow here at all.
//
// While no profile is attached the store is INERT, so nothing can be written to the wrong book in the
// meantime — that is the whole point of inert-by-default.

import React, { useEffect } from 'react'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuthContext } from '../../contexts/AuthContext'
import { profileGateBlocks, profileGateSurface } from '../../contexts/profileGatePolicy'
import { musicClient } from '../../services/musicClient'
import { GUEST_PROFILE_ID, profileStore } from '../../services/profileStore'
import { progressStore } from '../../services/progressStore'
import { markGuestBookClaimed } from '../../utils/guestMode'
import CreateProfileDialog from './CreateProfileDialog'
import ProfilePicker from './ProfilePicker'

const ProfileGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useProfiles()
  const auth = useAuthContext()

  // The decision itself is a PURE function in contexts/profileGatePolicy.ts — extracted because the
  // "no children yet" case was wrong here in a way no test could reach. See that module for why
  // `rosterSettled` (rather than `profiles.length === 0`) is what may raise a mandatory dialog.
  //
  // No `creating` flag any more: the picker's un-gated "Tilføj et barn" was the only thing that set it
  // (Børn picker PRD-01 §2.3), so the ONLY dialog this gate raises is the mandatory first-run one.
  // The policy keeps its `creating` parameter for the next deliberate caller; nothing here passes it.
  const surface = profileGateSurface(account)
  const needsFirstProfile = surface === 'create'
  const needsPicker = surface === 'picker'

  // These are onboarding surfaces, so they claim the same "an auth surface is open" flag as the lock
  // screen and the PIN pad: it keeps the adult-surface trigger inert AND stops the audio-permission
  // modal painting over them.
  const blocking = profileGateBlocks(surface)
  useEffect(() => {
    if (!blocking) return
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking])

  // …and the same surfaces keep the music bed silent: nobody is playing yet. See AuthGate.
  useEffect(() => {
    musicClient.setGateBlocking('profile', blocking)
  }, [blocking])

  return (
    <>
      {children}
      {needsPicker && (
        <ProfilePicker profiles={account.profiles} activeProfileId={account.activeProfileId} />
      )}
      {/* MANDATORY, always: this is the only dialog the gate raises, and it exists because an
          answered-but-empty roster means there is nobody to play as. Never gate it — it is the way
          into the app, and a brand-new account may not have a PIN set yet (§4.4). */}
      <CreateProfileDialog
        open={needsFirstProfile}
        dismissible={false}
        onDone={(profile, adoptGuestBook) => {
          if (!profile) return
          // ORDER IS LOAD-BEARING: the copy lands BEFORE `selectProfile()` attaches, so `attach()`
          // reads the adopted book off disk instead of writing `defaultPersisted(...)` over it. A
          // `false` from `adoptDocument` leaves the guest book untouched and the child simply starts
          // fresh — profile creation must never be blocked by a failed adoption.
          if (adoptGuestBook) {
            if (progressStore.adoptDocument(GUEST_PROFILE_ID, profile.id)) markGuestBookClaimed()
            else if (import.meta.env?.DEV) console.warn('[profiles] guest book not adopted')
          }
          profileStore.selectProfile(profile.id)
        }}
      />
    </>
  )
}

export default ProfileGate
