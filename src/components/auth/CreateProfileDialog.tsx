// "Tilføj et barn" — the only place a child profile is created.
//
// Data minimisation is the design (D9/§8.4): an avatar and an OPTIONAL first name. No surname, no
// birthdate, no photo, nothing else — and the name is genuinely optional, because the avatar is what a
// pre-reader recognises anyway.
//
// The avatars are baked soft-3D portraits keyed by id (de-emoji PRD-01), not OS-font emoji: this is a
// child-facing surface, and a glyph here changes shape between the iPadOS 17.7 floor device and a
// newer one. The closed id set lives in `src/config/avatars.ts`; the art in `src/assets/avatars/`.

import React, { useCallback, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { profileStore, type ChildProfile } from '../../services/profileStore'
import { useProfiles } from '../../hooks/useProfiles'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AVATAR_IDS, AVATAR_LABELS, DEFAULT_AVATAR_ID, type AvatarId } from '../../config/avatars'
import { avatarArt } from '../../assets/avatars'
import { AUTH_Z } from './authOverlayZ'


export interface CreateProfileDialogProps {
  open: boolean
  dismissible?: boolean
  onDone: (profile: ChildProfile | null) => void
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

  const submit = useCallback(async () => {
    setBusy(true)
    const created = await profileStore.createProfile({
      name: name.trim() || undefined,
      avatarId: avatar,
    })
    setBusy(false)
    if (created) {
      setName('')
      onDone(created)
    }
  }, [avatar, name, onDone])

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
          Vælg et billede. Navnet er valgfrit.
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
          label="Fornavn (valgfrit)"
          size="small"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Page roots set userSelect:none / WebkitTouchCallout:none; inheriting breaks iOS selection
          // and paste inside an input (§9).
          sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
          slotProps={{ htmlInput: { 'aria-label': 'Fornavn', maxLength: 24 } }}
        />
      </DialogContent>
      <DialogActions>
        {dismissible && (
          <Button onClick={onCancel} aria-label="Annullér">
            Annullér
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={busy}
          aria-label="Gem barnet"
        >
          Gem
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateProfileDialog
