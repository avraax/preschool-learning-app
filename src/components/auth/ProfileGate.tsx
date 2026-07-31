// Sits just inside the auth gate and decides whether a CHILD still has to be chosen.
//
// The rule that keeps "the child never sees a login screen" true (accounts PRD §7.4): the picker appears
// only when the account has MORE THAN ONE profile and no valid pointer. One child boots straight into
// their book.
//
// It also hosts the two first-run flows:
//   * CreateProfileDialog — an account with no children yet
//   * AdoptLegacyDialog   — a device that still carries the old anonymous v3 book
//
// While no profile is attached the store is INERT, so nothing can be written to the wrong book in the
// meantime — that is the whole point of inert-by-default.

import React, { useState } from 'react'
import { useProfiles } from '../../hooks/useProfiles'
import { profileStore } from '../../services/profileStore'
import { adoptionMarker, legacyPreview } from '../../services/legacyAdoption'
import AdoptLegacyDialog from './AdoptLegacyDialog'
import CreateProfileDialog from './CreateProfileDialog'
import ProfilePicker from './ProfilePicker'

const ProfileGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useProfiles()
  const [creating, setCreating] = useState(false)
  // Read ONCE per mount: both are pure localStorage reads, and re-reading on every render would make
  // the dialog flicker as the merge lands.
  const [legacy] = useState(() => ({ preview: legacyPreview(), marker: adoptionMarker() }))

  const needsFirstProfile = account.status !== 'signed-out' && account.profiles.length === 0
  const needsPicker = account.status === 'choosing' && account.profiles.length > 0

  // An un-adopted legacy book on a device that now has a real child to adopt it INTO.
  const offerAdoption =
    legacy.preview.present && !legacy.marker && account.profiles.length > 0 && !!account.activeProfileId

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
      {offerAdoption && !creating && !needsFirstProfile && (
        <AdoptLegacyDialog
          preview={legacy.preview}
          profiles={account.profiles}
          defaultProfileId={account.activeProfileId}
        />
      )}
    </>
  )
}

export default ProfileGate
