// The one PIN prompt for the whole app.
//
// `AuthContext.requirePin(reason)` resolves a promise through here, so every caller — the adult menu,
// a per-child reset, a profile switch, a credential change — shares one implementation and one set of
// failure messages. The LOCAL-vs-SERVER decision was already made by `pinVerifierFor(reason, online)`;
// this component just executes it.
//
// Unlike the old AdultGate, a wrong code gives REAL feedback (shake + attempts left + a lockout
// countdown) instead of closing silently. That silent close was the worst part of the old gate: an
// adult who mistyped had no idea whether the feature was broken.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import PinPad from './PinPad'
import {
  registerPinPrompt,
  useAuthContext,
  type PinReason,
  type PinVerifier,
} from '../../contexts/AuthContext'
import { authStore } from '../../services/authStore'
import {
  clearLocalAttempts,
  hasLocalVerifier,
  localLockout,
  storeLocalVerifier,
  verifyLocally,
} from '../../services/pinVerifier'
import { attemptsLeft, isLockedOut, lockoutMessage } from '../../config/pinPolicy'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

const TITLES: Record<PinReason, string> = {
  adultMenu: 'Kun for voksne 🔒',
  resetProgress: 'Kun for voksne 🔒',
  switchProfile: 'Skift barn 🔒',
  unlockSession: 'Lås op 🔒',
  changePin: 'Skift kode 🔒',
  manageCredentials: 'Login og sikkerhed 🔒',
  revokeSessions: 'Kun for voksne 🔒',
}

interface Pending {
  reason: PinReason
  verifier: PinVerifier
  resolve: (ok: boolean) => void
}

const PinDialog: React.FC = () => {
  const auth = useAuthContext()
  const [pending, setPending] = useState<Pending | null>(null)
  const [wrong, setWrong] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<Pending | null>(null)

  // While the pad is up, AdultCorner's hold gesture must be inert (§8.1 layer a).
  useEffect(() => {
    if (!pending) return
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pending])

  useEffect(() => {
    registerPinPrompt((reason, verifier) => {
      return new Promise<boolean>((resolve) => {
        // A second request while one is open resolves the first as refused rather than stacking.
        pendingRef.current?.resolve(false)
        const next = { reason, verifier, resolve }
        pendingRef.current = next
        setWrong(false)
        setBusy(false)
        const lock = localLockout()
        setHint(isLockedOut(lock, Date.now()) ? lockoutMessage(lock, Date.now()) : '')
        setPending(next)
      })
    })
    return () => registerPinPrompt(null)
  }, [])

  const finish = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok)
    pendingRef.current = null
    setPending(null)
    setWrong(false)
    setHint('')
    setBusy(false)
  }, [])

  const onComplete = useCallback(
    async (pin: string) => {
      const current = pendingRef.current
      if (!current || busy) return
      setBusy(true)

      // LOCAL path: only possible once a verifier was cached after an online verify on this device.
      // Falling back to the server when there is no cache is what stops a brand-new device from being
      // ungated — it just needs the network the first time.
      const useLocal = current.verifier === 'local' && hasLocalVerifier()
      if (useLocal) {
        const result = await verifyLocally(pin)
        setBusy(false)
        if (result.ok) return finish(true)
        setWrong(true)
        const now = Date.now()
        setHint(
          result.lockedOut || isLockedOut(result.lockout, now)
            ? lockoutMessage(result.lockout, now)
            : `Prøv igen. ${attemptsLeft(result.lockout)} forsøg tilbage.`,
        )
        return
      }

      const server = await authStore.verifyPinOnServer(pin)
      setBusy(false)
      if (server.ok) {
        // Cache the local verifier so this device works offline from now on, and clear the local
        // counter (the server just cleared its own).
        if (server.pinUpdatedAt) void storeLocalVerifier(pin, server.pinUpdatedAt)
        clearLocalAttempts()
        return finish(true)
      }
      setWrong(true)
      setHint(server.message ?? 'Koden er ikke rigtig.')
    },
    [busy, finish],
  )

  if (!pending) return null

  return (
    <Dialog
      open
      onClose={() => finish(false)}
      maxWidth="xs"
      fullWidth
      aria-label={TITLES[pending.reason]}
      slotProps={{
        paper: {
          'data-bl-redact': true,
          // Short landscape phones: reclaim the default 64px of vertical margin so the pad never
          // needs an internal scroll (the app's no-scroll rule).
          sx: { [PHONE_LANDSCAPE]: { maxHeight: 'calc(100% - 16px)', m: 1 } },
        } as never,
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, [PHONE_LANDSCAPE]: { py: 1, fontSize: '1.05rem' } }}>
        {TITLES[pending.reason]}
      </DialogTitle>
      <DialogContent sx={{ [PHONE_LANDSCAPE]: { py: 0.5 } }}>
        {pending.verifier === 'server' && (
          <Typography variant="body2" sx={{ textAlign: 'center', mb: 1.5, color: 'text.secondary' }}>
            Dette kræver internet.
          </Typography>
        )}
        <PinPad
          onComplete={onComplete}
          wrong={wrong}
          onWrongConsumed={() => setWrong(false)}
          disabled={busy}
          hint={hint}
        />
      </DialogContent>
      <DialogActions sx={{ [PHONE_LANDSCAPE]: { py: 0.5 } }}>
        <Button onClick={() => finish(false)} aria-label="Annullér">
          Annullér
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PinDialog
