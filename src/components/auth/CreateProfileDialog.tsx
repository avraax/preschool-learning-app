// "Tilføj et barn" — the only place a child profile is created.
//
// Data minimisation is the design (D9/§8.4): an emoji avatar and an OPTIONAL first name. No surname, no
// birthdate, no photo, nothing else — and the name is genuinely optional, because the avatar is what a
// pre-reader recognises anyway.

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

/** A small, deliberately child-friendly set — a full emoji keyboard would be a worse choice here. */
const AVATARS = [
  '🦊', '🐻', '🐰', '🦉', '🐱', '🐶',
  '🦄', '🐸', '🐧', '🦋', '🐢', '🦁',
] as const

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
  const [avatar, setAvatar] = useState<string>(AVATARS[0])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    setBusy(true)
    const created = await profileStore.createProfile({
      name: name.trim() || undefined,
      avatarEmoji: avatar,
    })
    setBusy(false)
    if (created) {
      setName('')
      onDone(created)
    }
  }, [avatar, name, onDone])

  return (
    <Dialog open={open} onClose={dismissible ? onCancel : undefined} maxWidth="xs" fullWidth>
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
          {AVATARS.map((emoji) => {
            const isActive = emoji === avatar
            return (
              <Box
                key={emoji}
                component={motion.button}
                type="button"
                onClick={() => setAvatar(emoji)}
                aria-pressed={isActive}
                aria-label={`Billede ${emoji}`}
                data-avatar-choice={emoji}
                whileTap={{ scale: 0.92 }}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 44,
                  fontSize: '1.6rem',
                  lineHeight: 1,
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
                {emoji}
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
