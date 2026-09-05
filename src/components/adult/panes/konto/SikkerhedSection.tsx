// "Sikkerhed" — the code and Face ID (Familie IA PRD §3.3). Signed in only.
//
// Lifted out of the old `KontoPane`; verification is unchanged (`removePasskey` keeps
// `requirePin('manageCredentials')`, which is SERVER-verified and never accepts the local ~5-minute
// unlock that opened settings — `adultSettingsIa.test.ts` holds that line).
//
// AND DO NOT TIDY THE PASSKEY PRE-FETCH. iOS spends the transient user activation on any `await`
// before `navigator.credentials.*`, so the options are fetched ahead of time (refreshed ~4 min) and
// the tap handler is deliberately NOT async. It looks odd; it is load-bearing.

import React, { useCallback, useEffect, useState } from 'react'
import { Box, Button, Divider, Stack, TextField, Typography } from '@mui/material'
import { LockKeyhole } from 'lucide-react'
import { apiUrl } from '../../../../config/apiBase'
import { useAuthContext } from '../../../../contexts/AuthContext'
import { authStore } from '../../../../services/authStore'
import {
  fetchPasskeyRegisterOptions,
  passkeysSupportedInThisBuild,
  passkeysUsableHere,
  registerPasskey,
  type PasskeyRegisterOptions,
} from '../../../../services/passkeyClient'
import { AppSkin } from '../../../../theme/adultTheme'
import PinSetupDialog from '../../../auth/PinSetupDialog'
import { PaneSection } from '../paneParts'

/** A stale challenge is a clean retryable error, so refreshing on a timer is safe. */
const OPTIONS_REFRESH_MS = 4 * 60 * 1000

interface PasskeyRow {
  id: string
  name?: string
  createdAt?: string
}

/** The sub-label inside `Sikkerhed`, one step below the section eyebrow. */
const SubLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography component="h5" sx={{ fontSize: '0.9rem', fontWeight: 700, mb: 0.5 }}>
    {children}
  </Typography>
)

const SikkerhedSection: React.FC = () => {
  const auth = useAuthContext()

  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [deviceName, setDeviceName] = useState('')
  const [registerOptions, setRegisterOptions] = useState<PasskeyRegisterOptions | null>(null)
  const [usable, setUsable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [changingPin, setChangingPin] = useState(false)

  const webauthnEnabled = auth?.info?.webauthnEnabled === true

  const loadPasskeys = useCallback(async () => {
    const token = authStore.sessionToken()
    if (!token) return
    try {
      const res = await fetch(apiUrl('/api/auth/passkey/list-user-passkeys'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const rows = (await res.json()) as PasskeyRow[]
      setPasskeys(Array.isArray(rows) ? rows : [])
    } catch {
      /* the list is informational; a failure just leaves it empty */
    }
  }, [])

  useEffect(() => {
    void loadPasskeys()
    void passkeysUsableHere().then(setUsable)
  }, [loadPasskeys])

  // DEBOUNCED name: the pre-fetch below depends on it, so binding it straight to `deviceName` fired a
  // fresh /generate-register-options — and restarted the refresh interval — on every keystroke.
  const [optionsName, setOptionsName] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setOptionsName(deviceName.trim()), 400)
    return () => clearTimeout(id)
  }, [deviceName])

  // PRE-FETCH the creation options so the "Tilføj Face ID" handler can stay synchronous — see header.
  useEffect(() => {
    if (!webauthnEnabled || !usable) return
    let cancelled = false
    const name = optionsName || 'Denne enhed'
    const load = async () => {
      const opts = await fetchPasskeyRegisterOptions(name)
      if (!cancelled) setRegisterOptions(opts)
    }
    void load()
    const id = setInterval(() => void load(), OPTIONS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [webauthnEnabled, usable, optionsName])

  // NOT async, and nothing is awaited before registerPasskey — see the header.
  const onAddPasskey = useCallback(() => {
    setMessage(null)
    setBusy(true)
    registerPasskey(registerOptions, deviceName.trim() || 'Denne enhed')
      .then(async (result) => {
        setMessage(result.ok ? 'Face ID er tilføjet på denne enhed.' : (result.message ?? null))
        if (result.ok) await loadPasskeys()
      })
      .finally(() => setBusy(false))
  }, [registerOptions, deviceName, loadPasskeys])

  const onRemovePasskey = useCallback(
    async (id: string) => {
      if (!auth) return
      const ok = await auth.requirePin('manageCredentials')
      if (!ok) return
      const token = authStore.sessionToken()
      if (!token) return
      setBusy(true)
      try {
        const res = await fetch(apiUrl('/api/auth/passkey/delete-passkey'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setMessage(res.ok ? 'Face ID er fjernet.' : 'Kunne ikke fjerne Face ID.')
        await loadPasskeys()
        // FORCED: removing the last passkey has to take the Face ID button off the lock screen.
        await authStore.refreshStatus(true)
      } finally {
        setBusy(false)
      }
    },
    [auth, loadPasskeys],
  )

  return (
    <>
      <PaneSection title="Sikkerhed">
        {message && (
          <Typography role="status" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>
            {message}
          </Typography>
        )}

        <SubLabel>Kode</SubLabel>
        <Button
          onClick={() => setChangingPin(true)}
          disabled={busy}
          startIcon={<LockKeyhole size={17} />}
          aria-label={auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
        >
          {auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
        </Button>

        <Box sx={{ mt: 2 }}>
          <SubLabel>Face ID / Touch ID</SubLabel>
          {/* THE SHELL BRANCH COMES FIRST, and it says "app-udgaven", not "denne enhed" — the iPad is
              perfectly capable of Face ID, it is this BUILD that cannot use it (PRD §3.3 / B6). Telling
              an adult their device is unsupported, when the same device does it in Safari, is the kind
              of wrong that generates a bug report nobody can reproduce. The existing passkey LIST is
              deliberately still rendered below: one registered from the web should stay removable. */}
          {!passkeysSupportedInThisBuild() ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Face ID kan ikke bruges i app-udgaven. Brug Google eller koden. I browserversionen af
              Børnelæring virker Face ID som før.
            </Typography>
          ) : !webauthnEnabled ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Face ID kan ikke bruges på denne udgave af appen. Brug Google eller koden.
            </Typography>
          ) : !usable ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Denne enhed understøtter ikke Face ID. Brug Google eller koden.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              <TextField
                label="Navn på enheden"
                placeholder="iPad i stuen"
                size="small"
                fullWidth
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                // Page roots set userSelect:none; inheriting breaks iOS selection and paste.
                sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
                slotProps={{ htmlInput: { 'aria-label': 'Navn på enheden', maxLength: 40 } }}
              />
              <Button
                variant="contained"
                onClick={onAddPasskey}
                disabled={busy || !registerOptions}
                aria-label="Tilføj Face ID på denne enhed"
                sx={{ alignSelf: 'flex-start' }}
              >
                Tilføj Face ID på denne enhed
              </Button>
            </Stack>
          )}

          {passkeys.length > 0 && (
            <Stack sx={{ mt: 1 }} divider={<Divider flexItem />}>
              {passkeys.map((p) => (
                <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}>
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.9rem' }}>
                    {p.name || 'Enhed uden navn'}
                  </Typography>
                  <Button
                    color="error"
                    size="small"
                    onClick={() => void onRemovePasskey(p.id)}
                    disabled={busy}
                    aria-label={`Fjern ${p.name || 'enhed'}`}
                  >
                    Fjern
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
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
