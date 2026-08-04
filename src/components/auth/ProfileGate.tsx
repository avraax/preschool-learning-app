// Sits just inside the auth gate and decides whether a CHILD still has to be chosen.
//
// The rule that keeps "the child never sees a login screen" true (accounts PRD §7.4): the picker appears
// only when the account has MORE THAN ONE profile and no valid pointer. One child boots straight into
// their book.
//
// An account with NO children yet gets the mandatory CreateProfileDialog — there is nobody to play as,
// and nothing is pre-added. Progress from before accounts is deliberately NOT migrated (owner's call:
// clean sheet), so there is no adoption flow here at all.
//
// While no profile is attached the store is INERT, so nothing can be written to the wrong book in the
// meantime — that is the whole point of inert-by-default.

import React, { useEffect, useState } from 'react'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuthContext } from '../../contexts/AuthContext'
import { profileGateBlocks, profileGateSurface } from '../../contexts/profileGatePolicy'
import { musicClient } from '../../services/musicClient'
import { profileStore } from '../../services/profileStore'
import CreateProfileDialog from './CreateProfileDialog'
import ProfilePicker from './ProfilePicker'

const ProfileGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useProfiles()
  const auth = useAuthContext()
  const [creating, setCreating] = useState(false)

  // The decision itself is a PURE function in contexts/profileGatePolicy.ts — extracted because the
  // "no children yet" case was wrong here in a way no test could reach. See that module for why
  // `rosterSettled` (rather than `profiles.length === 0`) is what may raise a mandatory dialog.
  const surface = profileGateSurface(account, creating)
  const needsFirstProfile = surface === 'create' && !creating
  const needsPicker = surface === 'picker'

  // These are onboarding surfaces, so they claim the same "an auth surface is open" flag as the lock
  // screen and the PIN pad: it keeps AdultCorner's hold gesture inert AND stops the audio-permission
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
        <ProfilePicker
          profiles={account.profiles}
          activeProfileId={account.activeProfileId}
          onCreate={() => setCreating(true)}
        />
      )}
      <CreateProfileDialog
        open={creating || needsFirstProfile}
        // Mandatory on first run (there is nobody to play as), optional afterwards.
        dismissible={!needsFirstProfile}
        onDone={(profile) => {
          setCreating(false)
          if (profile) profileStore.selectProfile(profile.id)
        }}
        onCancel={() => setCreating(false)}
      />
    </>
  )
}

export default ProfileGate
