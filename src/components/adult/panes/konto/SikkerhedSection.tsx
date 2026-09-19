// "Sikkerhed" — the code (Familie IA PRD §3.3). Signed in only.
//
// Biometric unlock used to live here too. It was removed on 2026-09-19 (owner: too early for the app
// to carry it) — see `.claude/rules/auth.md`. What is left is the four-digit code, which is the adult
// gate the rest of the app actually depends on.

import React, { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { LockKeyhole } from 'lucide-react'
import { useAuthContext } from '../../../../contexts/AuthContext'
import { AppSkin } from '../../../../theme/adultTheme'
import PinSetupDialog from '../../../auth/PinSetupDialog'
import { PaneSection } from '../paneParts'

const SikkerhedSection: React.FC = () => {
  const auth = useAuthContext()

  const [message, setMessage] = useState<string | null>(null)
  const [changingPin, setChangingPin] = useState(false)

  return (
    <>
      <PaneSection title="Sikkerhed">
        {message && (
          <Typography role="status" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>
            {message}
          </Typography>
        )}

        <Button
          onClick={() => setChangingPin(true)}
          startIcon={<LockKeyhole size={17} />}
          aria-label={auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
        >
          {auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
        </Button>
      </PaneSection>

      {/* Auth surfaces are NOT re-skinned (§5) — PinSetupDialog renders inside the APP theme.
          No requirePin() here on purpose: PinSetupDialog's own first step asks for the CURRENT code
          and `pin/set` verifies it server-side under the same lockout — so the secret never travels
          through a generic context callback, and the change keeps full server authority. */}
      <AppSkin>
        <PinSetupDialog
          open={changingPin}
          dismissible
          requireCurrent={auth?.info?.hasPin === true}
          onDone={() => {
            setChangingPin(false)
            setMessage('Koden er skiftet.')
          }}
          onCancel={() => setChangingPin(false)}
        />
      </AppSkin>
    </>
  )
}

export default SikkerhedSection
