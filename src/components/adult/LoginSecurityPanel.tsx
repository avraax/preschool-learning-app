// "🔑 Login og sikkerhed" — the adult's credential surface.
//
// Set/change the PIN, add or remove Face ID ON THIS DEVICE, sign out here, sign out everywhere.
//
// Every mutation here is a CREDENTIAL or an account-scoped change, so per §7.2's table it is
// SERVER-verified: `requirePin('manageCredentials' | 'changePin' | 'revokeSessions')` never accepts an
// earlier local unlock. The adult menu's own 5-minute window deliberately does not cover these.
//
// Passkeys are labelled by a DEVICE NAME the adult types ("iPad i stuen"), never by the authenticator
// model: Apple reports an all-zero AAGUID by design, so branching on it or trying to name the hardware
// produces nonsense (§9).

import React, { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuthContext } from '../../contexts/AuthContext'
import { authStore } from '../../services/authStore'
import {
  fetchPasskeyRegisterOptions,
  passkeysUsableHere,
  registerPasskey,
  type PasskeyRegisterOptions,
} from '../../services/passkeyClient'
import PinSetupDialog from '../auth/PinSetupDialog'

/** A stale challenge is a clean retryable error, so refreshing on a timer is safe (§9). */
const OPTIONS_REFRESH_MS = 4 * 60 * 1000

interface PasskeyRow {
  id: string
  name?: string
  createdAt?: string
}

export interface LoginSecurityPanelProps {
  open: boolean
  onClose: () => void
}

const LoginSecurityPanel: React.FC<LoginSecurityPanelProps> = ({ open, onClose }) => {
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
      const res = await fetch('/api/auth/passkey/list-user-passkeys', {
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
    if (!open) return
    void loadPasskeys()
    void passkeysUsableHere().then(setUsable)
  }, [open, loadPasskeys])

  // PRE-FETCH the creation options while the panel is open, so the "Tilføj Face ID" tap handler can
  // stay synchronous — iOS spends the user activation on any `await` before navigator.credentials.*.
  useEffect(() => {
    if (!open || !webauthnEnabled || !usable) return
    let cancelled = false
    const name = deviceName.trim() || 'Denne enhed'
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
  }, [open, webauthnEnabled, usable, deviceName])

  // NOT async, and nothing is awaited before registerPasskey — see the note above.
  const onAddPasskey = useCallback(() => {
    setMessage(null)
    setBusy(true)
    registerPasskey(registerOptions, deviceName.trim() || 'Denne enhed')
      .then(async (result) => {
        setMessage(result.ok ? 'Face ID er tilføjet på denne enhed. 👍' : (result.message ?? null))
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
        const res = await fetch('/api/auth/passkey/delete-passkey', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setMessage(res.ok ? 'Face ID er fjernet.' : 'Kunne ikke fjerne Face ID.')
        await loadPasskeys()
        await authStore.refreshStatus()
      } finally {
        setBusy(false)
      }
    },
    [auth, loadPasskeys],
  )

  // No requirePin() here on purpose: PinSetupDialog's own first step asks for the CURRENT code and
  // `pin/set` verifies it server-side under the same lockout — so the secret never travels through a
  // generic context callback, and the change still has full server authority. See PinSetupDialog.
  const onChangePin = useCallback(() => setChangingPin(true), [])

  const onSignOut = useCallback(async () => {
    if (!auth) return
    const ok = await auth.requirePin('manageCredentials')
    if (!ok) return
    onClose()
    await authStore.signOut()
  }, [auth, onClose])

  const onRevokeAll = useCallback(async () => {
    if (!auth) return
    const ok = await auth.requirePin('revokeSessions')
    if (!ok) return
    const token = authStore.sessionToken()
    if (!token) return
    setBusy(true)
    try {
      await fetch('/api/auth/revoke-sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
    } catch {
      /* best effort */
    } finally {
      setBusy(false)
    }
    onClose()
    // Every session including this one is gone → drop the local one too.
    await authStore.signOut()
  }, [auth, onClose])

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Login og sikkerhed 🔑</DialogTitle>
        <DialogContent>
          {auth?.user?.email && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Logget ind som {auth.user.email}
            </Typography>
          )}
          {message && (
            <Typography role="status" sx={{ mb: 1.5, fontWeight: 600 }}>
              {message}
            </Typography>
          )}

          <List sx={{ py: 0 }}>
            <ListItemButton
              aria-label={auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
              onClick={onChangePin}
              disabled={busy}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemText primary={auth?.info?.hasPin ? '🔢 Skift kode' : '🔢 Lav en kode'} />
            </ListItemButton>
          </List>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 700, mb: 1 }}>Face ID / Touch ID</Typography>
          {!webauthnEnabled ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Face ID kan ikke bruges på denne udgave af appen. Brug Google eller koden.
            </Typography>
          ) : !usable ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Denne enhed understøtter ikke Face ID. Brug Google eller koden.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              <TextField
                label="Navn på enheden"
                placeholder="iPad i stuen"
                size="small"
                fullWidth
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                // Page roots set userSelect:none / WebkitTouchCallout:none; inheriting that breaks iOS
                // selection and paste inside an input (§9).
                sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
                slotProps={{ htmlInput: { 'aria-label': 'Navn på enheden', maxLength: 40 } }}
              />
              <Button
                variant="contained"
                onClick={onAddPasskey}
                disabled={busy || !registerOptions}
                aria-label="Tilføj Face ID på denne enhed"
                sx={{ minHeight: 48, textTransform: 'none' }}
              >
                Tilføj Face ID på denne enhed
              </Button>
            </Stack>
          )}

          {passkeys.length > 0 && (
            <List sx={{ mt: 1 }}>
              {passkeys.map((p) => (
                <ListItem
                  key={p.id}
                  secondaryAction={
                    <Button
                      color="error"
                      size="small"
                      onClick={() => void onRemovePasskey(p.id)}
                      disabled={busy}
                      aria-label={`Fjern ${p.name || 'enhed'}`}
                    >
                      Fjern
                    </Button>
                  }
                >
                  <ListItemText primary={p.name || 'Enhed uden navn'} />
                </ListItem>
              ))}
            </List>
          )}

          <Divider sx={{ my: 1.5 }} />

          <Stack spacing={1}>
            <Button
              onClick={onSignOut}
              disabled={busy}
              aria-label="Log ud på denne enhed"
              sx={{ minHeight: 48, textTransform: 'none' }}
            >
              Log ud på denne enhed
            </Button>
            <Button
              color="error"
              onClick={onRevokeAll}
              disabled={busy}
              aria-label="Log ud alle steder"
              sx={{ minHeight: 48, textTransform: 'none' }}
            >
              Log ud alle steder
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} aria-label="Luk">
            Luk
          </Button>
        </DialogActions>
      </Dialog>

      <PinSetupDialog
        open={changingPin}
        dismissible
        requireCurrent={auth?.info?.hasPin === true}
        onDone={() => {
          setChangingPin(false)
          setMessage('Koden er skiftet. 👍')
        }}
        onCancel={() => setChangingPin(false)}
      />
    </>
  )
}

export default LoginSecurityPanel
