// Reusable "grown-ups only" gate (extracted from the old VersionDisplay reset flow).
//
// A random 3-digit code is shown as Danish WORDS; the adult must type the digits. Reading
// the words is the gate — a pre-reader who can count still can't pass it. Wrong input
// closes silently (nothing happens), matching the original reset-gate behavior.

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

const DANISH_DIGIT_WORDS = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni']

/** Call in the event handler that OPENS the gate (render must stay pure) and pass as `code`. */
export const makeGateCode = (): string =>
  Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')

interface AdultGateProps {
  open: boolean
  /** The 3-digit challenge, generated per open via makeGateCode() in the opener's handler. */
  code: string
  title?: string
  /** Warning/explanation shown above the challenge (e.g. what confirming will do). */
  description?: React.ReactNode
  confirmLabel?: string
  confirmColor?: 'primary' | 'error'
  /** Cancel OR wrong code — both close silently without success. */
  onClose: () => void
  onSuccess: () => void
}

const AdultGate: React.FC<AdultGateProps> = ({
  open,
  code,
  title = 'Kun for voksne 🔒',
  description,
  confirmLabel = 'OK',
  confirmColor = 'primary',
  onClose,
  onSuccess,
}) => {
  const [input, setInput] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  // Clear the typed input every time the gate opens (render-time state adjust — the
  // react.dev-recommended alternative to setState-in-effect).
  if (open && !wasOpen) {
    setWasOpen(true)
    setInput('')
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const submit = () => {
    if (input.replace(/\D/g, '') === code) {
      onSuccess()
    } else {
      onClose()
    }
  }

  const words = code.split('').map((d) => DANISH_DIGIT_WORDS[Number(d)]).join(' · ')

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {description && <Typography sx={{ mb: 1 }}>{description}</Typography>}
        <Typography sx={{ mb: 0.5 }}>Tast tallene for at bekræfte:</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', textAlign: 'center', my: 1.5 }}>
          {words}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="000"
          slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 3, style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.5rem' } } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annullér</Button>
        <Button onClick={submit} variant="contained" color={confirmColor}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default AdultGate
