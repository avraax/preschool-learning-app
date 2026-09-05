// The two danger blocks at the bottom of the Konto pane (Familie IA PRD §3.5).
//
// THEY ARE TWO CONTAINERS, NEVER ONE STRIP WITH A DIVIDER, and the account one is LAST. Merging Barn
// and Konto put "Slet barnet" and "Slet kontoen helt" in the same pane for the first time, and NN/g is
// verbatim on the hazard: *"Avoid placing highly consequential actions (that will require a lot of user
// work to fix if accidentally triggered) directly next to options that are benign."* Its remedies are
// spatial separation (Fitts' Law), a redundant visual signal, and Gestalt proximity — a divider inside
// one group still reads as one group, which is why `DangerBlock` is a bordered box with its own
// heading rather than the old `DangerHeading` over a strip.
//
// The child block NAMES THE CHILD, so the blast radius is legible from the heading alone. The account
// block comes last, which puts "Slet kontoen helt" as far from "Omdøb barnet" as the pane allows —
// replacing the accidental protection the two-group split used to give for free.
//
// The three confirmation words stay three DIFFERENT words (NULSTIL / SLET / SLET ALT). That was always
// the rule; in one pane it is the point, because muscle memory is now a real path.

import React, { useCallback, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { CircleCheck, LogOut, RotateCcw, Trash2 } from 'lucide-react'
import { apiUrl } from '../../../../config/apiBase'
import { useAuthContext } from '../../../../contexts/AuthContext'
import { useProfiles } from '../../../../hooks/useProfiles'
import { useProgress } from '../../../../hooks/useProgress'
import { useSyncStatus } from '../../../../hooks/useSyncStatus'
import { authStore } from '../../../../services/authStore'
import { profileStore } from '../../../../services/profileStore'
import { progressSync } from '../../../../services/progressSync'
import { adultItem } from '../../../../config/adultSettingsIa'
import { AppSkin } from '../../../../theme/adultTheme'
import PinPad from '../../../auth/PinPad'
import { AUTH_Z } from '../../../auth/authOverlayZ'
import { useGateDialogShell } from '../../../auth/gateDialog'
import { captureExcludeProps } from '../../../../services/captureExclude'
import DestructiveConfirmDialog from '../DestructiveConfirmDialog'
import { DangerBlock } from '../paneParts'

// Read the required words from the IA declaration rather than typing them here — that module is what
// `adultSettingsIa.test.ts` asserts on, and a hardcoded duplicate would let the guard pass while the
// shipped dialog demanded something else.
const RESET_WORD = adultItem('barn.reset').typeToConfirm!
const DELETE_WORD = adultItem('barn.delete').typeToConfirm!
const DELETE_ACCOUNT_WORD = adultItem('konto.deleteAccount').typeToConfirm!

// ---------------------------------------------------------------------------------------------
// `Farligt for {navn}` — this device's copy of ONE child's book. Local authority, works offline.
// ---------------------------------------------------------------------------------------------

export const BarnDanger: React.FC<{ closeAll: () => void }> = ({ closeAll }) => {
  const auth = useAuthContext()
  const account = useProfiles()
  const progress = useProgress()

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const active = account.profiles.find((p) => p.id === account.activeProfileId)
  const activeName = active?.name
  /** Deleting the ONLY child would leave the app with nobody to play as; a guest always has one. */
  const canDelete = account.profiles.length > 1

  const doDelete = useCallback(async () => {
    if (!active) return
    // Deleting drops this device's local copy of that child's book (the server delete is soft), so
    // the LOCAL verifier is the right authority — same blast radius as a reset, and it still works
    // offline. Inside the adult's ~5-minute window this costs no extra tap.
    if (auth) {
      const ok = await auth.requirePin('resetProgress')
      if (!ok) return
    }
    setBusy(true)
    const ok = await profileStore.deleteProfile(active.id)
    setBusy(false)
    setConfirmDelete(false)
    // The deleted child WAS the active one, so `profileStore` has detached the store and gone to
    // `choosing`. Close the surface or the boot picker comes up behind a settings dialog nobody
    // needs any more.
    if (ok) closeAll()
  }, [auth, active, closeAll])

  return (
    <>
      <DangerBlock id="fareBarn" title={activeName ? `Farligt for ${activeName}` : 'Farligt for barnet'}>
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          <Button
            color="error"
            aria-label="Nulstil al fremgang"
            startIcon={<RotateCcw size={17} />}
            onClick={() => setConfirmReset(true)}
            disabled={busy}
          >
            {activeName ? `Nulstil fremgang for ${activeName}` : 'Nulstil fremgang'}
          </Button>
          {/* It used to be a bin icon on the roster row, one control from the rename pencil. Here it
              acts on the ACTIVE child, under a heading that names them — deleting another child now
              costs a switch first, which is the deliberate half of the trade. */}
          <Button
            color="error"
            aria-label={activeName ? `Slet ${activeName}` : 'Slet barnet'}
            startIcon={<Trash2 size={17} />}
            onClick={() => setConfirmDelete(true)}
            disabled={busy || !canDelete}
          >
            {activeName ? `Slet ${activeName}` : 'Slet barnet'}
          </Button>
        </Stack>
      </DangerBlock>

      {/* The PIN already opened this surface, so this is the "are you sure" — but it still routes
          through requirePin('resetProgress'), which re-asks if the ~5-minute window has lapsed. */}
      <DestructiveConfirmDialog
        open={confirmReset}
        // Reset is PER CHILD, so the copy must NAME the child or a parent nukes the wrong kid's book.
        title={activeName ? `Nulstil fremgang for ${activeName}?` : 'Nulstil fremgang?'}
        word={RESET_WORD}
        actionLabel="Nulstil"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          if (auth) {
            const ok = await auth.requirePin('resetProgress')
            if (!ok) return
          }
          progress.resetAll()
          setConfirmReset(false)
          setResetDone(true)
        }}
      >
        {/* "rekorder og stjerner" dropped (Endless Play PRD-01 W3): records and stars no longer
            exist, and copy that names a thing the app doesn't have is worse than terse. The book and
            the XP behind it ARE the progress now. The fixed type-to-confirm word and the "andre børn
            røres ikke" clause stay exactly as they are (`.claude/rules/adult-surface.md`). */}
        Dette nulstiller <strong>alle</strong> {activeName ? `${activeName}s ` : ''}klistermærker.
        Andre børn røres ikke. Lyd, musik og sværhedsgrad beholdes.
      </DestructiveConfirmDialog>

      <DestructiveConfirmDialog
        open={confirmDelete}
        title={activeName ? `Slet ${activeName}?` : 'Slet barnet?'}
        word={DELETE_WORD}
        actionLabel="Slet"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
      >
        {/* "Kontakt os", not "Skriv til os" — the dialog now asks the adult to SKRIVE a word, and two
            different senses of that verb in one box reads as an instruction. */}
        {activeName ? `${activeName}s bog` : 'Barnets bog'} og rekorder fjernes fra denne enhed.
        Kontakt os hvis det var et uheld — vi gemmer det stadig på serveren et stykke tid.
      </DestructiveConfirmDialog>

      <Dialog open={resetDone} onClose={() => setResetDone(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography component="div" sx={{ color: 'success.main', mb: 1, lineHeight: 0 }}>
            <CircleCheck size={36} aria-hidden />
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>Al fremgang er nulstillet.</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button onClick={() => setResetDone(false)} variant="contained" aria-label="Færdig">
            Færdig
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// `Farligt for kontoen` — the LAST block in the pane, on purpose. Sessions, and the account itself.
// ---------------------------------------------------------------------------------------------

export const KontoDanger: React.FC<{ closeAll: () => void }> = ({ closeAll }) => {
  const auth = useAuthContext()
  const status = useSyncStatus()

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deleteAccountPin, setDeleteAccountPin] = useState(false)

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
  }, [closeAll])

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

  return (
    <>
      <DangerBlock id="fareKonto" title="Farligt for kontoen">
        {message && (
          <Typography role="status" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>
            {message}
          </Typography>
        )}
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
      </DangerBlock>

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
          weight to the reversible "Log ud" two rows above it in the same block. */}
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
