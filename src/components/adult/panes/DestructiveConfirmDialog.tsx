// A destructive confirmation that will not fire on a single tap: the action button stays disabled
// until the adult TYPES a fixed word.
//
// WHY, precisely: the PIN and the typed word answer different questions. The PIN asks "is this an
// adult?" — and inside the ~5-minute `ADULT_UNLOCK_MS` window it is already satisfied, so for a
// second destructive action in one sitting the confirm dialog is the ONLY thing between a tap and a
// wiped book. The typed word asks "did you mean to?", which no amount of authorisation covers.
//
// Two buttons only, Annullér leading (Settings PRD-01 §6.4). The word gates the BUTTON; the PIN still
// runs on press, so this is an extra barrier, never a replacement for one.

import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'

/** Trim + case-fold. The point is deliberation, not a spelling test. */
const matches = (input: string, word: string): boolean =>
  input.trim().toLocaleLowerCase('da-DK') === word.trim().toLocaleLowerCase('da-DK')

export interface DestructiveConfirmDialogProps {
  open: boolean
  title: string
  /** Danish du-form, two sentences — the existing convention on every adult confirm. */
  children: React.ReactNode
  /** The word that must be typed before the action enables. */
  word: string
  actionLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const DestructiveConfirmDialog: React.FC<DestructiveConfirmDialogProps> = ({
  open,
  title,
  children,
  word,
  actionLabel,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const [typed, setTyped] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  // Clear the field on each open (render-time state adjust, the pattern the other adult dialogs use).
  // Without it, a cancelled confirm leaves the word sitting there and the next open is a single tap
  // again — which would defeat the whole point.
  if (open && !wasOpen) {
    setWasOpen(true)
    setTyped('')
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const armed = matches(typed, word) && !busy

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>{children}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Skriv <strong>{word}</strong> for at bekræfte.
        </Typography>
        <TextField
          size="small"
          fullWidth
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && armed) onConfirm()
          }}
          placeholder={word}
          disabled={busy}
          // NOT autoFocus: on a phone in landscape the soft keyboard covers most of the dialog, and
          // the adult should read the consequence before the field takes over the screen.
          //
          // The three off-switches are load-bearing on iOS, not tidiness — autocapitalisation and
          // autocorrect will happily rewrite a short all-caps Danish word as you type it, and then
          // the button never arms and it looks broken.
          sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
          slotProps={{
            htmlInput: {
              'aria-label': `Skriv ${word} for at bekræfte`,
              'data-confirm-input': word,
              autoCapitalize: 'off',
              autoCorrect: 'off',
              autoComplete: 'off',
              spellCheck: false,
              maxLength: 24,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} aria-label="Annullér" disabled={busy}>
          Annullér
        </Button>
        <Button
          variant="contained"
          color="error"
          aria-label={actionLabel}
          disabled={!armed}
          onClick={onConfirm}
        >
          {actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DestructiveConfirmDialog
