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
import { Lock } from 'lucide-react'
import PinPad from './PinPad'
import PinSetupDialog from './PinSetupDialog'
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
import { captureExcludeProps } from '../../services/captureExclude'
import { useGateDialogShell } from './gateDialog'
import { AUTH_Z } from './authOverlayZ'

// Plain strings — they double as the dialog's aria-label, and the padlock is drawn as a lucide icon
// beside the title instead of living in the text (de-emoji PRD-01 W1).
const TITLES: Record<PinReason, string> = {
  adultMenu: 'Kun for voksne',
  resetProgress: 'Kun for voksne',
  switchProfile: 'Skift barn',
  unlockSession: 'Lås op',
  changePin: 'Skift kode',
  manageCredentials: 'Login og sikkerhed',
  revokeSessions: 'Kun for voksne',
}

interface Pending {
  reason: PinReason
  verifier: PinVerifier
  resolve: (ok: boolean) => void
}

const PinDialog: React.FC = () => {
  const auth = useAuthContext()
  const shell = useGateDialogShell()
  const [pending, setPending] = useState<Pending | null>(null)
  const [wrong, setWrong] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<Pending | null>(null)

  // While the pad is up, the adult-surface trigger must be inert (§8.1 layer a).
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

  /**
   * THE FORGOTTEN-PIN DOOR. Offered only when the SERVER says this session is fresh enough
   * (`/family/status` → `pinResettable`, the same pure predicate `pin/set` will apply), so the button
   * can never appear and then fail.
   *
   * When the session is NOT fresh the hint tells the adult what to do instead, and that sentence is
   * now true — before 2026-09-19 the lockout copy promised a Google recovery that did not exist.
   */
  const [resetting, setResetting] = useState(false)
  const canReset = auth?.info?.pinResettable === true

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
      // A PIN can be demanded from the LOCK SCREEN (`unlockSession`), which is a fixed box at ~10 000
      // — far above a MUI Dialog's default 1300. Without this, "Brug kode i stedet" mounted a pad that
      // was live and completely invisible.
      sx={{ zIndex: AUTH_Z.pin }}
      // A capture can now run while this is open (the gear no longer blocks the gate on it), so the
      // marker goes on the dialog ROOT — the paper's `data-bl-redact` would leave the backdrop.
      {...captureExcludeProps}
      fullScreen={shell.fullScreen}
      slotProps={{
        paper: {
          'data-bl-redact': true,
          // Full-screen on phones + `--vh` + safe-area insets; see `gateDialog.ts`.
          sx: shell.paperSx,
        } as never,
      }}
    >
      <DialogTitle
        sx={{
          flex: '0 0 auto',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          [PHONE_LANDSCAPE]: { py: 1, fontSize: '1.05rem' },
        }}
      >
        <Lock size={20} aria-hidden />
        {TITLES[pending.reason]}
      </DialogTitle>
      <DialogContent sx={[shell.contentSx, { [PHONE_LANDSCAPE]: { py: 0.5 } }]}>
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
        {canReset ? (
          <Button
            onClick={() => setResetting(true)}
            disabled={busy}
            aria-label="Jeg har glemt koden"
            sx={{ mt: 1, alignSelf: 'center' }}
          >
            Jeg har glemt koden
          </Button>
        ) : (
          <Typography
            variant="caption"
            sx={{ mt: 1, textAlign: 'center', color: 'text.secondary', [PHONE_LANDSCAPE]: { display: 'none' } }}
          >
            Glemt koden? Log ud og log ind igen — så kan du lave en ny.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ flex: '0 0 auto', [PHONE_LANDSCAPE]: { py: 0.5 } }}>
        <Button onClick={() => finish(false)} aria-label="Annullér">
          Annullér
        </Button>
      </DialogActions>

      {/* The recovery flow. `requireCurrent={false}` is the whole point — the fresh session IS the
          credential, and `pin/set` applies the same predicate server-side, so this cannot be forced
          open by a client that lies about it. Setting a code also satisfies whatever the adult was
          being challenged for, so the pending request resolves TRUE. */}
      <PinSetupDialog
        open={resetting}
        dismissible
        requireCurrent={false}
        onDone={() => {
          setResetting(false)
          void authStore.refreshStatus(true)
          finish(true)
        }}
        onCancel={() => setResetting(false)}
      />
    </Dialog>
  )
}

export default PinDialog
