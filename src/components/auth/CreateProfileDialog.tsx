// "Tilføj et barn" — the only place a child profile is created.
//
// Data minimisation is the design (D9/§8.4): an avatar and an OPTIONAL first name. No surname, no
// birthdate, no photo, nothing else — and the name is genuinely optional, because the avatar is what a
// pre-reader recognises anyway.
//
// The avatars are baked soft-3D portraits keyed by id (de-emoji PRD-01), not OS-font emoji: this is a
// child-facing surface, and a glyph here changes shape between the iPadOS 17.7 floor device and a
// newer one. The closed id set lives in `src/config/avatars.ts`; the art in `src/assets/avatars/`.

import React, { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { GUEST_PROFILE_ID, profileStore, type ChildProfile } from '../../services/profileStore'
import { authStore } from '../../services/authStore'
import { useProfiles } from '../../hooks/useProfiles'
import { guestAdoptionOffer } from '../../config/guestAdoption'
import { normalizePersisted, progressKeyFor } from '../../config/progressSchema'
import { guestBookClaimed } from '../../utils/guestMode'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AVATAR_IDS, AVATAR_LABELS, DEFAULT_AVATAR_ID, type AvatarId } from '../../config/avatars'
import { avatarArt } from '../../assets/avatars'
import { AUTH_Z } from './authOverlayZ'

/** Read the guest book off disk. Returns `null` for absent, malformed, or non-v4 (by design). */
const readGuestDoc = () => {
  try {
    const raw = localStorage.getItem(progressKeyFor(GUEST_PROFILE_ID))
    return raw ? normalizePersisted(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export interface CreateProfileDialogProps {
  open: boolean
  dismissible?: boolean
  /**
   * `adoptGuestBook` is the adult's answer to the checkbox below — true only when the offer was
   * actually made AND left ticked. The CALLER performs the copy, because it has to happen between
   * `createProfile()` and `selectProfile()` (see `ProfileGate`).
   */
  onDone: (profile: ChildProfile | null, adoptGuestBook?: boolean) => void
  onCancel?: () => void
}

const CreateProfileDialog: React.FC<CreateProfileDialogProps> = ({
  open,
  dismissible = true,
  onDone,
  onCancel,
}) => {
  const theme = useTheme()
  const account = useProfiles()
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR_ID)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [adopt, setAdopt] = useState(true)

  // THE ASK IS AN ATTRIBUTION QUESTION, NOT A PERMISSION DIALOG (PRD §6.3). The guest book belongs to
  // one specific child; if this first profile is a sibling rather than the child who has been playing,
  // a silent transfer puts months of stickers on the wrong kid with no undo. Hence one checkbox,
  // defaulted on, and no second screen.
  //
  // Recomputed while `open` so the roster state is the one at the moment of asking. The predicate is
  // pure and cheap; the only I/O is the single `localStorage` read above. "Tilføj et barn" from the
  // picker is excluded for free by `rosterCount === 0`.
  const offer = useMemo(
    () =>
      open
        ? guestAdoptionOffer({
            claimed: guestBookClaimed(),
            guestDoc: readGuestDoc(),
            rosterCount: account.profiles.length,
            rosterSettled: account.rosterSettled,
            hasSessionToken: !!authStore.sessionToken(),
          })
        : { offer: false, stickers: 0 },
    [open, account.profiles.length, account.rosterSettled],
  )

  const submit = useCallback(async () => {
    // Belt and braces with the disabled button: an Enter key or a stray programmatic call must not be
    // able to create the nameless profile the button now prevents.
    if (!name.trim()) return
    setBusy(true)
    const created = await profileStore.createProfile({
      name: name.trim(),
      avatarId: avatar,
    })
    setBusy(false)
    if (created) {
      setName('')
      onDone(created, offer.offer && adopt)
    }
  }, [avatar, name, onDone, offer.offer, adopt])

  return (
    // zIndex: this is opened FROM the profile picker, which is a hand-rolled fixed box at 10 000. A
    // MUI Dialog defaults to 1300, so without this the "Lav en ny profil" button appeared to do
    // nothing — the dialog was mounted and interactive, behind an opaque full-screen surface.
    <Dialog
      open={open}
      onClose={dismissible ? onCancel : undefined}
      maxWidth="xs"
      fullWidth
      sx={{ zIndex: AUTH_Z.createProfile }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Tilføj et barn</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Vælg et billede, og skriv barnets fornavn.
        </Typography>

        {account.error && (
          <Typography role="alert" color="error" sx={{ mb: 1.5, fontWeight: 600 }}>
            {account.error}
          </Typography>
        )}

        <Box
          role="group"
          aria-label="Vælg billede"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 1,
            mb: 2,
            [PHONE_ANY]: { gap: 0.5 },
          }}
        >
          {AVATAR_IDS.map((id) => {
            const isActive = id === avatar
            return (
              <Box
                key={id}
                component={motion.button}
                type="button"
                onClick={() => setAvatar(id)}
                aria-pressed={isActive}
                aria-label={`Billede ${AVATAR_LABELS[id]}`}
                data-avatar-choice={id}
                whileTap={{ scale: 0.92 }}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0.25,
                  cursor: 'pointer',
                  borderRadius: 2,
                  background: isActive
                    ? alpha(theme.palette.primary.main, 0.14)
                    : 'transparent',
                  border: `3px solid ${
                    isActive ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.14)
                  }`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Sized by the tile, not by a font: the glyph these replaced scaled off `fontSize`,
                    so an <img> needs explicit bounds or the row's intrinsic height changes. */}
                <Box
                  component="img"
                  src={avatarArt(id)}
                  alt=""
                  draggable={false}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                />
              </Box>
            )
          })}
        </Box>

        <TextField
          label="Fornavn"
          required
          size="small"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Page roots set userSelect:none / WebkitTouchCallout:none; inheriting breaks iOS selection
          // and paste inside an input (§9).
          sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
          slotProps={{ htmlInput: { 'aria-label': 'Fornavn', maxLength: 24 } }}
        />

        {offer.offer && (
          <Box sx={{ mt: 1.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={adopt}
                  onChange={(_, v) => setAdopt(v)}
                  slotProps={{ input: { 'aria-label': 'Flyt fremgangen fra denne iPad' } }}
                />
              }
              label={`Flyt fremgangen fra denne iPad til ${name.trim() || 'barnet'}`}
              slotProps={{ typography: { sx: { fontSize: '0.95rem' } } }}
              sx={{ alignItems: 'flex-start', mr: 0 }}
            />
            {/* Klistermærker only: `PerGameStats` and `totals.totalStars` were deleted by Endless Play
                PRD-01, so "og alle rekorder" named a thing the app no longer has. */}
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', pl: 4 }}>
              {offer.stickers === 1
                ? '1 klistermærke følger med.'
                : `${offer.stickers} klistermærker følger med.`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {dismissible && (
          <Button onClick={onCancel} aria-label="Annullér">
            Annullér
          </Button>
        )}
        {/* THE NAME IS MANDATORY (owner, 2026-08-09), and this is the control that enforces it.
            It was optional by design — data minimisation — but a nameless profile turned out to be a
            trap rather than a courtesy: the picker shows it with no way to name it (renaming lives in
            the adult menu), so the only affordance is "Tilføj et barn", which makes a SECOND child.
            The owner hit exactly that. The server stays permissive on purpose: `name` is nullable, and
            a profile created before this change must keep working rather than become unreadable. */}
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          aria-label="Gem barnet"
        >
          Gem
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateProfileDialog
