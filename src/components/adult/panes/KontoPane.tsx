// "Konto" — the adult's own account: who is signed in, whether the book is safe on the server, the
// code, Face ID, and the destructive strip.
//
// MERGES the old "Synkronisering" and "Login og sikkerhed" panels plus the top-level "Log ud" row.
// Those three were split across two levels of menu while "Log ud alle steder" and "Slet kontoen helt"
// sat two levels DOWN — related things apart, unrelated things adjacent. Log ud comes back down into
// the destructive strip here; the original complaint it was promoted to fix ("nothing revealed which
// account") is answered by the email at the top of this pane.
//
// THE PIN RULE IS UNCHANGED (§7 / accounts PRD §7.2). Every mutation here is a CREDENTIAL or an
// account-scoped change, so it is SERVER-verified: `manageCredentials` / `revokeSessions` never accept
// the local unlock that opened settings. Do not "simplify" them onto the adult's 5-minute window.
//
// AND DO NOT TIDY THE PASSKEY PRE-FETCH. iOS spends the transient user activation on any `await`
// before `navigator.credentials.*`, so the options are fetched ahead of time (refreshed ~4 min) and
// the tap handler is deliberately NOT async. It looks odd; it is load-bearing.

import React, { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../../../config/apiBase'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Cloud,
  LockKeyhole,
  LogOut,
  Mic,
  RefreshCw,
  ShieldCheck,
  TabletSmartphone,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuthContext } from '../../../contexts/AuthContext'
import { useSyncStatus } from '../../../hooks/useSyncStatus'
import { authStore } from '../../../services/authStore'
import { progressSync } from '../../../services/progressSync'
import { startSocialSignIn, type SignInProvider } from '../../../services/authSignIn'
import { useSignUpProviders } from '../../../services/signUpProviders'
import { profileStore } from '../../../services/profileStore'
import {
  fetchPasskeyRegisterOptions,
  passkeysSupportedInThisBuild,
  passkeysUsableHere,
  registerPasskey,
  type PasskeyRegisterOptions,
} from '../../../services/passkeyClient'
import { AppSkin } from '../../../theme/adultTheme'
import PinSetupDialog from '../../auth/PinSetupDialog'
import PinPad from '../../auth/PinPad'
import { AUTH_Z } from '../../auth/authOverlayZ'
import { useGateDialogShell } from '../../auth/gateDialog'
import { captureExcludeProps } from '../../../services/captureExclude'
import { adultItem } from '../../../config/adultSettingsIa'
import DestructiveConfirmDialog from './DestructiveConfirmDialog'
import { DangerHeading, PaneSection } from './paneParts'

// Read the word from the IA declaration, not a literal here — that module is what
// `adultSettingsIa.test.ts` asserts on, and a duplicate would let the guard pass while the shipped
// dialog demanded something else.
const DELETE_ACCOUNT_WORD = adultItem('konto.deleteAccount').typeToConfirm!

/** A stale challenge is a clean retryable error, so refreshing on a timer is safe. */
const OPTIONS_REFRESH_MS = 4 * 60 * 1000

interface PasskeyRow {
  id: string
  name?: string
  createdAt?: string
}

const danishWhen = (ms: number): string => {
  if (!ms) return 'aldrig'
  const age = Date.now() - ms
  if (age < 60_000) return 'lige nu'
  if (age < 3_600_000) {
    const m = Math.floor(age / 60_000)
    return m === 1 ? 'for 1 minut siden' : `for ${m} minutter siden`
  }
  try {
    return new Date(ms).toLocaleString('da-DK', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'ukendt'
  }
}

/**
 * One "what an account buys you" line: the `LinkRow` shape from `PrivatlivPane` with the chevron and
 * the `onClick` removed, because these are STATEMENTS. Not a `Button`, so it never lands in the tab
 * order between the adult and the sign-in button below it. The icon is decorative — the text carries
 * the meaning.
 *
 * TITLE + HINT, not one line. The first version stated four FEATURES ("Fremgangen følger med til jeres
 * andre enheder"), and a feature is only persuasive to someone who already has the thing it needs — one
 * child on one iPad, which is the median install, matched none of them. The hint carries the OUTCOME,
 * which is the half that answers "why would I?".
 */
const BenefitRow: React.FC<{ icon: React.ReactNode; title: string; hint: string }> = ({
  icon,
  title,
  hint,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', py: 0.75 }}>
    <Box sx={{ display: 'flex', color: 'text.secondary', mr: 1.5, pt: 0.25 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{title}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}>
        {hint}
      </Typography>
    </Box>
  </Box>
)

export interface KontoPaneProps {
  closeAll: () => void
}

const KontoPane: React.FC<KontoPaneProps> = ({ closeAll }) => {
  const auth = useAuthContext()
  const status = useSyncStatus()
  const signUpProviders = useSignUpProviders()
  /** No account at all (A1) — this pane has a different job entirely. See the branch below. */
  const guest = auth?.phase === 'guest'

  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [deviceName, setDeviceName] = useState('')
  const [registerOptions, setRegisterOptions] = useState<PasskeyRegisterOptions | null>(null)
  const [usable, setUsable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deleteAccountPin, setDeleteAccountPin] = useState(false)

  const webauthnEnabled = auth?.info?.webauthnEnabled === true
  /**
   * From the UNAUTHENTICATED providers endpoint, not `auth.info.methods` — a guest has no session,
   * so `info` is null here and the Apple button would never render on the one pane that offers it.
   */
  const appleAvailable = signUpProviders.includes('apple')

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

  const syncNow = useCallback(async () => {
    setBusy(true)
    await progressSync.syncNow('manual')
    setBusy(false)
  }, [])

  // GUEST sign-in. `startGoogleSignIn()` returns a `SignInResult` and this call site used to discard
  // it, so a failure showed the adult nothing at all — the button simply did nothing. The lock screen
  // has always surfaced `result.message` (`LockScreen.tsx:128-134`); this mirrors it.
  // `finally`, not a trailing `setBusy(false)`: a throw would otherwise leave the button disabled
  // with no message — a dead grey control, which is strictly worse than the silent one this replaced.
  // It does NOT cover a HANG (report BV9DJ: the shell's `startGoogleSignIn` never settled), and no
  // timeout can — on the web the call deliberately never resolves, because `location.assign` has
  // navigated away by then. A promise that never settles has to be fixed where it hangs.
  const onGuestSignIn = useCallback(async (provider: SignInProvider) => {
    setMessage(null)
    setBusy(true)
    try {
      const result = await startSocialSignIn(provider)
      if (!result.ok) setMessage(result.message ?? 'Login mislykkedes. Prøv igen.')
    } catch {
      setMessage('Login mislykkedes. Prøv igen.')
    } finally {
      setBusy(false)
    }
  }, [])

  const onSignOut = useCallback(async () => {
    // NO PIN (owner, 2026-08-09). The adult passed the parental gate to open this surface, and the
    // confirm below names the account — the PIN asked the same question a second time. Signing out is
    // reversible and destroys nothing: you sign back in, and the book is on the server.
    //
    // What the PIN also bought, without saying so, was a guarantee that the adult was ONLINE at this
    // moment. The confirm now carries that explicitly (`unpushedWarning`) instead, which is the honest
    // version — it warns about the actual risk rather than blocking on a credential.
    setConfirmLogout(false)
    closeAll()
    // Last chance to get the book onto the server: the push needs the bearer token signOut() clears.
    await progressSync.push('manual')
    await authStore.signOut()
  }, [closeAll])

  const onRevokeAll = useCallback(async () => {
    // No PIN here either, same reasoning as onSignOut.
    const token = authStore.sessionToken()
    if (!token) return
    setBusy(true)
    try {
      await fetch(apiUrl('/api/auth/revoke-sessions'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
    } catch {
      /* best effort */
    } finally {
      setBusy(false)
    }
    setConfirmRevoke(false)
    closeAll()
    // Same reason as onSignOut: last chance to push while a token still exists.
    await progressSync.push('manual')
    // Every session including this one is gone → drop the local one too.
    await authStore.signOut()
  }, [auth, closeAll])

  /**
   * "al fremgang er gemt" is a CLAIM, and until now nothing checked it — it was true by luck, because
   * `requirePin` forced a server round trip first and so proved the device was online.
   *
   * With the PIN gone (owner, 2026-08-09) the claim has to stand on its own. `onSignOut` still pushes
   * before clearing the token, but an offline push cannot succeed, and signing out drops the session
   * the next push would need. So when there is unsent progress, say that instead of promising the
   * opposite. This is the honest replacement for what the PIN was silently buying.
   */
  const unpushedWarning =
    status.dirty || status.phase === 'offline'
      ? 'Der er fremgang, som ikke er sendt til serveren endnu. Gå på nettet først, hvis den skal med.'
      : null

  const syncHeadline =
    status.phase === 'offline'
      ? 'Ingen forbindelse lige nu.'
      : status.phase === 'error'
        ? 'Der er et problem med at gemme.'
        : status.dirty
          ? 'Der er noget der ikke er gemt endnu.'
          : 'Alt er gemt.'

  // GUEST (App Store PRD §3.2 / A1): everything below assumes an account — an email to show, a sync
  // status, credentials to manage, a session to end, an account to delete. None of it exists here, and
  // rendering it would show "Ukendt konto", an empty sync panel and four destructive buttons that all
  // fail. So this pane becomes the ONE thing a guest actually wants from it: the way in.
  //
  // This is also the answer to "what does an account buy me?", and it deliberately names both halves —
  // 5.1.1(v) wants an account offered for account-shaped features, not demanded for play.
  if (guest) {
    return (
      <Stack spacing={2.5}>
        {/* `caps={false}`: the pane header already reads "Konto", so a small-caps "KONTO" eyebrow
            directly beneath it said the same word twice. */}
        <PaneSection title="I spiller uden konto" caps={false}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            Barnets bog ligger kun her på iPad&apos;en. Der er ingen kopi andre steder.
          </Typography>
        </PaneSection>

        {/* Statements, not links — no chevron, no onClick, no Button wrapper, which also keeps them out
            of the tab order. Face ID and passkeys are deliberately ABSENT: the shell's
            `capacitor://localhost` origin can never satisfy the `boernelaering.dk` rpID, and the
            signed-in branch below already says so. Google or the code, nothing else.

            THE ORDER IS THE ARGUMENT. Sync, multiple children and the microphone game are all
            conditional on something a new user may not have — one child on one iPad matches none of
            them, and that is the median install (and the owner's own household). "Bogen er sikret" is
            the only line true for EVERY family, so it leads. It is also the honest one: today a guest
            book dies with the iPad, silently.

            Do NOT reword this into "din fremgang gemmes ikke". It IS saved — it is UNCOPIED, and the
            distinction is the whole point. */}
        <PaneSection title="Med en konto">
          <Stack spacing={0}>
            <BenefitRow
              icon={<ShieldCheck size={19} aria-hidden />}
              title="Bogen er sikret"
              hint="Klistermærkerne er der stadig, hvis iPad'en bliver nulstillet eller skiftet ud."
            />
            <BenefitRow
              // Two devices, not one: a lone `Tablet` rendered as a featureless rectangle beside a
              // line that is specifically about a SECOND device.
              icon={<TabletSmartphone size={19} aria-hidden />}
              title="Den samme bog på flere enheder"
              hint="Barnet kan spille videre på fx en telefon."
            />
            <BenefitRow
              icon={<Users size={19} aria-hidden />}
              title="Plads til flere børn"
              hint="Hvert barn får sin egen bog og sin egen sværhedsgrad."
            />
            <BenefitRow
              icon={<Mic size={19} aria-hidden />}
              title="Mikrofonspillet kan slås til"
              hint={'"Sig et Ord" kræver en konto.'}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => void onGuestSignIn('google')}
              disabled={busy}
              aria-label="Log ind med Google"
              sx={{ minHeight: 44 }}
            >
              Log ind med Google
            </Button>
            {/* Apple appears only when the server says it is configured (`/family/status` methods).
                Required by App Store Guideline 4.8, which wants a second option collecting no more
                than name + email and allowing the address to be kept private, whenever a third-party
                service sets up the primary account. Passkeys do NOT satisfy it — they can only unlock
                an account that already exists. */}
            {appleAvailable && (
              <Button
                variant="outlined"
                onClick={() => void onGuestSignIn('apple')}
                disabled={busy}
                aria-label="Log ind med Apple"
                sx={{ minHeight: 44 }}
              >
                Log ind med Apple
              </Button>
            )}
          </Stack>
          {message && (
            <Typography
              role="status"
              variant="body2"
              sx={{ display: 'block', fontWeight: 600, mt: 1 }}
            >
              {message}
            </Typography>
          )}
          {/* THE OBJECTION-REMOVER, and it belongs at the moment of the ask rather than one pane away
              in Privatliv. Cost and data handling are the dominant parental worry for a children's app,
              and this one is genuinely clean — so saying so is not a boast, it is the answer to the
              question the adult is already asking.

              EVERY CLAUSE MUST STAY TRUE. No ads, no analytics/tracking, no in-app purchases, and no
              marketing email — all four are load-bearing claims, mirrored in PrivatlivPane and in the
              App Store description. If any of them ever stops being true, this line goes first. */}
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
            Gratis. Ingen reklamer, ingen sporing — og vi skriver aldrig til dig.
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
            Fremgangen fra denne iPad kan følge med til det første barn, du opretter.
          </Typography>
        </PaneSection>
      </Stack>
    )
  }

  return (
    <>
      <Stack spacing={2.5}>
        {/* Which account this device is signed in as — the thing the old menu never showed. */}
        <PaneSection title="Logget ind som">
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-all' }}>
            {auth?.user?.email ?? 'Ukendt konto'}
          </Typography>
        </PaneSection>

        {message && (
          <Typography role="status" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {message}
          </Typography>
        )}

        <PaneSection title="Synkronisering">
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box sx={{ display: 'flex', color: 'text.secondary', pt: 0.25 }}>
              <Cloud size={19} aria-hidden />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{syncHeadline}</Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Sidst gemt: {danishWhen(status.lastPushAt)}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Sidst hentet: {danishWhen(status.lastPullAt)}
              </Typography>
              {status.error && (
                <Typography variant="caption" role="alert" color="error" sx={{ display: 'block' }}>
                  {status.error}
                </Typography>
              )}
            </Box>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
            Spillet virker også uden internet. Fremgangen gemmes på enheden med det samme og sendes
            videre, når der er forbindelse.
          </Typography>
          <Button
            onClick={() => void syncNow()}
            disabled={busy || status.phase === 'pulling' || status.phase === 'pushing'}
            aria-label="Synkronisér nu"
            startIcon={<RefreshCw size={16} />}
            sx={{ mt: 1 }}
          >
            Synkronisér nu
          </Button>
        </PaneSection>

        <PaneSection title="Kode">
          <Button
            onClick={() => setChangingPin(true)}
            disabled={busy}
            startIcon={<LockKeyhole size={17} />}
            aria-label={auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
          >
            {auth?.info?.hasPin ? 'Skift kode' : 'Lav en kode'}
          </Button>
        </PaneSection>

        <PaneSection title="Face ID / Touch ID">
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
        </PaneSection>

        {/* ---- Destructive strip (§7) ---- */}
        <Box>
          <Divider sx={{ mb: 1.25 }} />
          <DangerHeading />
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <Button
              color="error"
              onClick={() => setConfirmLogout(true)}
              disabled={busy}
              startIcon={<LogOut size={17} />}
              aria-label="Log ud på denne enhed"
            >
              Log ud på denne enhed
            </Button>
            <Button
              color="error"
              onClick={() => setConfirmRevoke(true)}
              disabled={busy}
              startIcon={<LogOut size={17} />}
              aria-label="Log ud alle steder"
            >
              Log ud alle steder
            </Button>
            <Button
              color="error"
              onClick={() => setConfirmDeleteAccount(true)}
              disabled={busy}
              startIcon={<Trash2 size={17} />}
              aria-label="Slet kontoen helt"
            >
              Slet kontoen helt
            </Button>
          </Stack>
        </Box>
      </Stack>

      {/* Worth a confirmation even though a PIN follows: the pad on its own gives no reason, and on a
          family device the consequence lands on the CHILD, not on the adult tapping. It NAMES the
          account — a shared iPad can have had more than one adult on it. */}
      <Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log ud?</DialogTitle>
        <DialogContent>
          <Typography>
            {auth?.user?.email
              ? `Du logger ud af ${auth.user.email} på denne enhed. `
              : 'Du logger ud på denne enhed. '}
            Der kan ikke spilles, før en voksen logger ind igen
            {unpushedWarning ? '.' : ' — al fremgang er gemt.'}
          </Typography>
          {unpushedWarning && (
            <Typography role="alert" sx={{ mt: 1.5, fontWeight: 600 }} color="error">
              {unpushedWarning}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLogout(false)} aria-label="Annullér">
            Annullér
          </Button>
          <Button variant="contained" color="error" aria-label="Log ud" onClick={() => void onSignOut()}>
            Log ud
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRevoke} onClose={() => setConfirmRevoke(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log ud alle steder?</DialogTitle>
        <DialogContent>
          <Typography>
            Alle enheder logges ud — også denne. Der kan ikke spilles nogen steder, før en voksen
            logger ind igen{unpushedWarning ? '.' : '; al fremgang er gemt.'}
          </Typography>
          {unpushedWarning && (
            <Typography role="alert" sx={{ mt: 1.5, fontWeight: 600 }} color="error">
              {unpushedWarning}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRevoke(false)} aria-label="Annullér">
            Annullér
          </Button>
          <Button
            variant="contained"
            color="error"
            aria-label="Log ud alle steder"
            onClick={() => void onRevokeAll()}
          >
            Log ud alle steder
          </Button>
        </DialogActions>
      </Dialog>

      {/* THREE barriers, each doing a different job: the typed word is deliberation at the moment of
          the tap, the PIN pad below is authorisation, and the server verifies that PIN under the same
          pin_attempt lockout before ON DELETE CASCADE does the rest.
          The word alone used to be missing, which left this confirm a single tap — identical in
          weight to the reversible "Log ud" two rows above it in the same strip. */}
      <DestructiveConfirmDialog
        open={confirmDeleteAccount}
        title="Slet kontoen helt?"
        word={DELETE_ACCOUNT_WORD}
        actionLabel="Slet"
        onCancel={() => setConfirmDeleteAccount(false)}
        onConfirm={() => {
          setConfirmDeleteAccount(false)
          setDeleteAccountPin(true)
        }}
      >
        {auth?.user?.email ? `${auth.user.email}: alt slettes` : 'Alt slettes'} — alle børn, alle
        bøger, alle rekorder, koden og Face ID. Det kan ikke fortrydes.
      </DestructiveConfirmDialog>

      {/* Auth surfaces are NOT re-skinned (§5) — PinPad is shared with LockScreen and deliberately
          uses TactileTile + getCategoryTheme('math'). */}
      <AppSkin>
        <DeleteAccountPinDialog
          open={deleteAccountPin}
          onCancel={() => setDeleteAccountPin(false)}
          onDone={async () => {
            setDeleteAccountPin(false)
            closeAll()
            profileStore.signOut()
            await authStore.signOut()
          }}
          onError={(m) => {
            setDeleteAccountPin(false)
            setMessage(m)
          }}
        />

        {/* No requirePin() here on purpose: PinSetupDialog's own first step asks for the CURRENT code
            and `pin/set` verifies it server-side under the same lockout — so the secret never travels
            through a generic context callback, and the change keeps full server authority. */}
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

/** The PIN pad shown as the second barrier before an account is deleted. */
const DeleteAccountPinDialog: React.FC<{
  open: boolean
  onCancel: () => void
  onDone: () => void | Promise<void>
  onError: (message: string) => void
}> = ({ open, onCancel, onDone, onError }) => {
  const shell = useGateDialogShell()
  const [wrong, setWrong] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (pin: string) => {
      setBusy(true)
      const result = await authStore.deleteAccount(pin)
      setBusy(false)
      if (result.ok) {
        setHint('')
        await onDone()
        return
      }
      setWrong(true)
      setHint(result.message ?? 'Koden er ikke rigtig.')
      if (result.fatal) onError(result.message ?? 'Kontoen kunne ikke slettes.')
    },
    [onDone, onError],
  )

  if (!open) return null
  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      // A PIN surface sits above everything, from the shared ordering constant — the same value
      // PinDialog and PinSetupDialog carry. Without it this pad and the settings dialog are BOTH at
      // MUI's default 1300 and the pad is on top only by DOM order, which is the accident the auth
      // stack has already shipped twice. Measured with elementFromPoint at the pad's centre.
      sx={{ zIndex: AUTH_Z.pin }}
      // Same shell as every other gate: full-screen on a phone, safe-area padded, never scrolls. This
      // pad had no responsive work at all, so it was the worst of the four on a phone.
      {...captureExcludeProps}
      fullScreen={shell.fullScreen}
      slotProps={{ paper: { 'data-bl-redact': true, sx: shell.paperSx } as never }}
    >
      <DialogTitle sx={{ flex: '0 0 auto', fontWeight: 700 }}>Bekræft med koden</DialogTitle>
      <DialogContent sx={shell.contentSx}>
        <PinPad
          onComplete={(pin) => void submit(pin)}
          wrong={wrong}
          onWrongConsumed={() => setWrong(false)}
          disabled={busy}
          hint={hint}
          label="Tast koden for at slette"
        />
      </DialogContent>
      <DialogActions sx={{ flex: '0 0 auto' }}>
        <Button onClick={onCancel} aria-label="Annullér">
          Annullér
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default KontoPane
