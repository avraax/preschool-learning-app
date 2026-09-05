// "Konto" — the merged pane (Familie IA PRD, owner chose shape A on 2026-09-05).
//
// It shipped as `Familie` and was renamed to `Konto` the same day — the owner read the word as odd.
// ONLY the name changed; the PRD is still the record for the merge, the order and the danger blocks.
//
// WHAT REPLACED WHAT: `BarnPane` + `KontoPane` + the standalone `Log ind` promo row above the rail.
// A guest saw BOTH the promo row and a `Konto — Ikke logget ind` rail entry, and `KontoPane` opened
// with `if (guest) return <the sign-in offer>` — two doors to the same screen. Underneath that sat the
// modelling problem the owner named: `Barn` and `Konto` are not two things to a parent. They are the
// family, seen from two angles, and "Bogen er sikret" — the argument for signing in — is a statement
// about the CHILD that was filed under account. The merge also returns the rail to the five
// mutually-exclusive groups Settings PRD-01 specified.
//
// THIS FILE IS THE ORDER, and the order is load-bearing (§3):
//
//   1. the identity row       — guest: the sign-in offer, the ONLY place it now appears
//                               signed in: which account this device is
//   2. Børn                   — active child, "Sådan går det", roster, switch, rename, add
//   3. Sikkerhed              — signed in only: the code, Face ID
//   4. Synkronisering         — signed in only
//   5. Farligt for {navn}     — child-scoped, this device's copy
//   6. Farligt for kontoen    — account-scoped, LAST
//
// The two danger blocks are separate CONTAINERS (see `konto/DangerBlocks.tsx`), not one strip with
// a divider, and `KONTO_BLOCK_ORDER` in `adultSettingsIa.ts` declares this order as data so a
// plain-Node test can assert it. A guest sees 1 → 2 → 5 and that is correct: no dead rows, no
// "requires an account" stubs beyond the one on "Tilføj et barn".

import React, { useCallback, useRef } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useAuthContext } from '../../../contexts/AuthContext'
import BoernSection from './konto/BoernSection'
import SignInOffer from './konto/SignInOffer'
import SikkerhedSection from './konto/SikkerhedSection'
import SynkSection from './konto/SynkSection'
import { BarnDanger, KontoDanger } from './konto/DangerBlocks'
import { PaneSection } from './paneParts'

export interface KontoPaneProps {
  /** Close the whole settings surface — switching child re-attaches the store under the new profile. */
  closeAll: () => void
}

const KontoPane: React.FC<KontoPaneProps> = ({ closeAll }) => {
  const auth = useAuthContext()
  /** Playing with no account at all — the state in which signing in is something to offer. */
  const guest = auth?.phase === 'guest'

  // "Tilføj et barn" used to route a guest ACROSS THE RAIL to Konto. After the merge the thing it was
  // routing to is at the top of this same pane, so it scrolls instead — the small win §3.2 says the
  // merge buys for free.
  const offerRef = useRef<HTMLDivElement | null>(null)
  const showOffer = useCallback(() => {
    offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <Stack spacing={2.5}>
      {/* ---- 1. The identity row (§3.1): the account, at the top, as iOS places Apple Account ---- */}
      <Box ref={offerRef}>
        {guest ? (
          <SignInOffer />
        ) : (
          // Which account this device is signed in as — the thing the old flat menu never showed.
          <PaneSection title="Logget ind som">
            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-all' }}>
              {auth?.user?.email ?? 'Ukendt konto'}
            </Typography>
          </PaneSection>
        )}
      </Box>

      {/* ---- 2. Børn (§3.2) ---- */}
      <BoernSection closeAll={closeAll} onWantAccount={showOffer} />

      {/* ---- 3 + 4. Signed in only (§3.3, §3.4). A guest has no credentials to manage and no
              sync state to report, so these do not render at all rather than render empty. ---- */}
      {!guest && <SikkerhedSection />}
      {!guest && <SynkSection />}

      {/* ---- 5. Child danger, then 6. account danger. Never merged, account always last (§3.5). ---- */}
      <BarnDanger closeAll={closeAll} />
      {!guest && <KontoDanger closeAll={closeAll} />}
    </Stack>
  )
}

export default KontoPane
