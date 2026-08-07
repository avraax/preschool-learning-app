// The blocking sign-in / unlock overlay.
//
// Modelled on the app's former audio-permission modal (`SimplifiedAudioPermission.tsx`, deleted by
// Audio activation PRD-01) — at the time the only app-root blocking overlay, and still the structural
// precedent this follows (session-scoped, must not re-arm spuriously, must dismiss synchronously and
// never on an async result). Same recipe: fixed inset 0 / zIndex 9999, scrim,
// centred motion.div at maxWidth 400, <Paper elevation={12} p:4 borderRadius:4>, AnimatePresence with
// a { stiffness: 300, damping: 30 } spring.
//
// Danish conventions matched from every other adult surface: du-form, ≤2 sentences of body copy,
// `Prøv igen` / `Luk` button verbs, and a Danish aria-label on every interactive element. The word
// "trin" appears nowhere. (The PRD's "trailing emoji on titles" convention is superseded by the
// concurrent de-emoji work — adult surfaces carry a lucide icon instead, as here.)
//
// `data-bl-redact` on the root: screenshotService removes it from a bug-report capture, one of the
// three independent layers protecting a PIN screen from a public blob (accounts PRD §8.1).

import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Fingerprint, Lock, WifiOff } from 'lucide-react'
import type { AuthPhase } from '../../contexts/authGatePolicy'
import { useAuthContext } from '../../contexts/AuthContext'
import { authStore } from '../../services/authStore'
import { getLastAuthReportCode, subscribeAuthReportCode } from '../../services/authDiagnostics'
import {
  startGoogleSignIn,
  startPasskeyUnlock,
  type PasskeyRequestOptions,
} from '../../services/authSignIn'
import { passkeysSupportedInThisBuild } from '../../services/passkeyClient'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AUTH_Z } from './authOverlayZ'

/**
 * A stale WebAuthn challenge is a clean, retryable error — so we PRE-FETCH the options on mount and
 * refresh them every ~4 minutes. That is what lets the tap handler be synchronous (§9).
 */
const PASSKEY_OPTIONS_REFRESH_MS = 4 * 60 * 1000

interface Copy {
  headline: string
  body: string
}

// `guest` is excluded alongside `authed`/`offlineGrace`: all three are full-play phases where this
// screen returns null, so none of them has copy. Keeping it an `Exclude` rather than a partial record is
// what made the compiler point at this line when the phase was added.
const COPY: Record<Exclude<AuthPhase, 'authed' | 'offlineGrace' | 'guest'>, Copy> = {
  booting: { headline: 'Et øjeblik …', body: '' },
  signedOut: {
    // Reworded at A1: "en voksen skal logge ind" was true when the gate was hard and is now a lie —
    // "Spil uden konto" is right there. Signing in is what SYNC costs, not what playing costs.
    headline: 'Velkommen til Børnelæring',
    body: 'Log ind for at gemme fremgangen og bruge flere børneprofiler.',
  },
  locked: {
    headline: 'Velkommen tilbage',
    body: 'Bekræft at det er dig.',
  },
  offlineExpired: {
    headline: 'Ingen forbindelse',
    body: "Børnelæring skal på nettet igen. Slut iPad'en til wi-fi og prøv igen.",
  },
}

const danishDate = (ms: number | null): string => {
  if (!ms) return 'ukendt'
  try {
    return new Date(ms).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'ukendt'
  }
}

const LockScreen: React.FC = () => {
  const theme = useTheme()
  const auth = useAuthContext()
  const [passkeyOptions, setPasskeyOptions] = useState<PasskeyRequestOptions | null>(null)
  const [localBusy, setLocalBusy] = useState(false)
  // The short code of an auto-uploaded login-failure report (see `authDiagnostics`). Seeded from the
  // module so a report sent before this screen mounted — e.g. the OAuth return handler's give-up, which
  // fires while the lock screen is still booting — still shows its code.
  const [authReportCode, setAuthReportCode] = useState<string | null>(getLastAuthReportCode())
  useEffect(() => subscribeAuthReportCode(setAuthReportCode), [])

  const phase = auth?.phase ?? 'booting'
  // `passkeysSupportedInThisBuild()` is the NATIVE SHELL gate (App Store PRD §3.3 / B6): the shell's
  // `capacitor://localhost` origin can never satisfy the production rpID, so offering the button would
  // open a system sheet that fails and blames the adult's iPad. It comes first because the two server
  // flags below say nothing about which build is asking.
  const canOfferPasskey =
    passkeysSupportedInThisBuild() &&
    !!auth?.info?.webauthnEnabled &&
    (auth?.info?.passkeyCount ?? 0) > 0

  // Pre-fetch (and keep fresh) the WebAuthn options so the Face ID tap handler never has to await.
  useEffect(() => {
    if (!canOfferPasskey) {
      setPasskeyOptions(null)
      return
    }
    let cancelled = false
    const load = async () => {
      const opts = await authStore.fetchPasskeyRequestOptions()
      if (!cancelled) setPasskeyOptions(opts)
    }
    void load()
    const id = setInterval(() => void load(), PASSKEY_OPTIONS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [canOfferPasskey])

  // The gate is an auth surface: suppress AdultCorner's hold gesture while it is up.
  useEffect(() => {
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onGoogle = useCallback(async () => {
    setLocalBusy(true)
    authStore.setBusy('Venter på Google…')
    const result = await startGoogleSignIn()
    if (!result.ok) authStore.setError(result.message ?? 'Login mislykkedes. Prøv igen.')
    setLocalBusy(false)
  }, [])

  // NOT async, and it does NOT await before reaching startPasskeyUnlock: iOS consumes the user
  // activation across an await, so the WebAuthn call has to happen in this same task.
  const onPasskey = useCallback(() => {
    setLocalBusy(true)
    startPasskeyUnlock(passkeyOptions)
      .then((result) => {
        if (!result.ok) authStore.setError(result.message ?? 'Face ID mislykkedes. Prøv igen.')
      })
      .finally(() => setLocalBusy(false))
  }, [passkeyOptions])

  const onPinInstead = useCallback(async () => {
    if (!auth) return
    const ok = await auth.requirePin('unlockSession')
    if (ok) authStore.unlock()
  }, [auth])

  const onRetry = useCallback(async () => {
    setLocalBusy(true)
    authStore.setError(null)
    await authStore.validate()
    setLocalBusy(false)
  }, [])

  // Local-only play. `playAsGuest()` refuses if a token is still stored, so this cannot silently
  // discard a session even if the button ever escapes its `signedOut` guard below.
  const onPlayAsGuest = useCallback(() => {
    authStore.setError(null)
    authStore.playAsGuest()
  }, [])

  // `guest` is a full-play phase, so the lock screen must stand down for it exactly as it does for
  // `authed` — otherwise the overlay covers the app it just let through.
  if (!auth || phase === 'authed' || phase === 'offlineGrace' || phase === 'guest') return null

  const copy = COPY[phase as keyof typeof COPY] ?? COPY.booting
  const busy = localBusy || !!auth.busy

  return (
    <AnimatePresence>
      <Box
        data-bl-redact
        role="dialog"
        aria-modal="true"
        aria-label={copy.headline}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: AUTH_Z.lockScreen,
          // The gate is the ONLY thing on screen (App — and therefore PersistentWorld — has not
          // mounted), so this paints the whole first-run surface. Use the skin's own page gradient
          // rather than a scrim over browser white, which read as a flat grey void.
          background: theme.decor.notFoundBackground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.3 }}
          style={{ width: '100%', maxWidth: 400 }}
        >
          <Paper
            elevation={12}
            sx={{
              p: 4,
              borderRadius: 4,
              textAlign: 'center',
              background: theme.decor.audioPermissionGradient,
              color: 'white',
              // Landscape-first: a phone in landscape is only ~390px tall, so the card scrolls
              // internally rather than pushing the page (which must never scroll).
              maxHeight: 'calc(var(--vh, 1vh) * 92)',
              overflowY: 'auto',
              [PHONE_ANY]: { p: 2.5 },
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                [PHONE_ANY]: { width: 56, height: 56, margin: '0 auto 12px auto' },
              }}
            >
              {phase === 'offlineExpired' ? (
                <WifiOff size={34} color="white" />
              ) : (
                <Lock size={34} color="white" />
              )}
            </Box>

            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: 600,
                mb: 1.5,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                [PHONE_ANY]: { fontSize: '1.25rem', mb: 1 },
              }}
            >
              {copy.headline}
            </Typography>

            <Typography
              variant="body1"
              sx={{ mb: 3, opacity: 0.95, lineHeight: 1.5, [PHONE_ANY]: { mb: 2, fontSize: '0.95rem' } }}
            >
              {copy.body}
            </Typography>

            {auth.busy && (
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                {auth.busy}
              </Typography>
            )}
            {auth.error && (
              <Typography
                variant="body2"
                role="alert"
                sx={{ mb: 2, fontWeight: 600, color: '#fff3f3', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}
              >
                {auth.error}
              </Typography>
            )}
            {/* A failed sign-in auto-uploads a report (authDiagnostics). This is the ONLY place its code
                can be shown: the ⚙️ that normally reports lives inside <App />, behind this very gate, so
                without this line the adult has a failure and no way to point anyone at it. Adult-facing
                and deliberately plain — the child never reaches this screen. */}
            {authReportCode && (
              <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.85 }}>
                Fejlrapport sendt. Kode: <strong>{authReportCode}</strong>
              </Typography>
            )}

            <Stack spacing={1.5}>
              {phase === 'offlineExpired' ? (
                <>
                  <PrimaryButton
                    label="Prøv igen"
                    ariaLabel="Prøv at forbinde igen"
                    onClick={onRetry}
                    disabled={busy}
                    accent={theme.decor.audioPermissionAccent}
                  />
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Sidst bekræftet {danishDate(auth.lastVerifiedAt)}
                  </Typography>
                </>
              ) : (
                <>
                  {/* Face ID is the FAST path when it exists, but never the primary story: a domain
                      move would invalidate every passkey, so Google (and later OTP) stay first-class
                      forever (§13). */}
                  {canOfferPasskey && (
                    <PrimaryButton
                      label="Log ind med Face ID"
                      ariaLabel="Log ind med Face ID eller Touch ID"
                      onClick={onPasskey}
                      disabled={busy || !passkeyOptions}
                      accent={theme.decor.audioPermissionAccent}
                      icon={<Fingerprint size={20} />}
                    />
                  )}

                  {phase === 'locked' && auth.info?.hasPin && (
                    <SecondaryButton
                      label="Brug kode i stedet"
                      ariaLabel="Lås op med den 4-cifrede kode"
                      onClick={onPinInstead}
                      disabled={busy}
                    />
                  )}

                  {canOfferPasskey ? (
                    <SecondaryButton
                      label="Log ind med Google"
                      ariaLabel="Log ind med Google"
                      onClick={onGoogle}
                      disabled={busy}
                    />
                  ) : (
                    <PrimaryButton
                      label="Fortsæt med Google"
                      ariaLabel="Fortsæt med Google"
                      onClick={onGoogle}
                      disabled={busy}
                      accent={theme.decor.audioPermissionAccent}
                    />
                  )}

                  {/* PLAY WITHOUT AN ACCOUNT — Guideline 5.1.1(v) (App Store PRD §3.2 / A1).
                      Offered only from `signedOut`, i.e. with NO stored token: `locked` and
                      `offlineExpired` still hold a real session, and trading that for an empty local
                      book would lose the child's synced progress to a mis-tap. A device that has never
                      signed in never reaches this screen at all — it auto-enters guest at boot
                      (`utils/guestMode.ts`), so this button is the RE-entry, not the main door. */}
                  {phase === 'signedOut' && (
                    <>
                      <SecondaryButton
                        label="Spil uden konto"
                        ariaLabel="Spil uden konto, kun på denne enhed"
                        onClick={onPlayAsGuest}
                        disabled={busy}
                      />
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Fremgangen gemmes kun på denne enhed. Log ind senere for at synkronisere.
                      </Typography>
                    </>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        </motion.div>
      </Box>
    </AnimatePresence>
  )
}

const BUTTON_SX = {
  py: 1.6,
  px: 3,
  fontSize: '1.1rem',
  fontWeight: 600,
  borderRadius: 3,
  textTransform: 'none' as const,
  minHeight: 48,
  [PHONE_ANY]: { py: 1.1, fontSize: '1rem' },
}

const PrimaryButton: React.FC<{
  label: string
  ariaLabel: string
  onClick: () => void
  disabled?: boolean
  accent: string
  icon?: React.ReactNode
}> = ({ label, ariaLabel, onClick, disabled, accent, icon }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    variant="contained"
    size="large"
    startIcon={icon}
    fullWidth
    sx={{
      ...BUTTON_SX,
      backgroundColor: 'white',
      color: accent,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      '&:hover': { backgroundColor: '#f8f9ff' },
      '&.Mui-disabled': { backgroundColor: 'rgba(255,255,255,0.6)', color: 'rgba(0,0,0,0.4)' },
    }}
  >
    {label}
  </Button>
)

const SecondaryButton: React.FC<{
  label: string
  ariaLabel: string
  onClick: () => void
  disabled?: boolean
}> = ({ label, ariaLabel, onClick, disabled }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    variant="outlined"
    size="large"
    fullWidth
    sx={{
      ...BUTTON_SX,
      color: 'white',
      borderColor: 'rgba(255,255,255,0.7)',
      '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.12)' },
      '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.3)' },
    }}
  >
    {label}
  </Button>
)

export default LockScreen
