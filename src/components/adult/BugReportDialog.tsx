// Bug reporter dialog (Bug Report feature) — parent-facing, reached via the adult menu.
//
// compose → sending → success (big short code to mention to Claude) | error (retry or
// save the identical report as a local .json file — the offline fallback).
// The screenshot was captured by AdultCorner at menu-open, BEFORE any dialog rendered,
// so it shows the broken moment rather than the menu.

import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import {
  buildReportPayload,
  downloadReportAsFile,
  submitBugReport,
  type BugReportPayload,
  type SubmitResult,
} from '../../services/bugReporter'
import AdultBackHeader from './AdultBackHeader'

type Phase = 'compose' | 'sending' | 'success' | 'error'

interface BugReportDialogProps {
  open: boolean
  /** JPEG data URL stashed at menu-open, or null if capture failed/timed out. */
  screenshot: string | null
  onClose: () => void
}

const BugReportDialog: React.FC<BugReportDialogProps> = ({ open, screenshot, onClose }) => {
  const [phase, setPhase] = useState<Phase>('compose')
  const [note, setNote] = useState('')
  const [includeShot, setIncludeShot] = useState(true)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  // The exact payload that was (attempted) sent — retry/download must reuse it unchanged.
  // Always assigned in send() before any read, so it needs no per-open reset.
  const payloadRef = useRef<BugReportPayload | null>(null)

  // Reset to a fresh compose form each time the dialog opens (render-time state adjust).
  if (open && !wasOpen) {
    setWasOpen(true)
    setPhase('compose')
    setNote('')
    setIncludeShot(true)
    setResult(null)
    setCopied(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const send = async (reusePayload = false) => {
    setPhase('sending')
    const payload = reusePayload && payloadRef.current
      ? payloadRef.current
      : buildReportPayload({ type: 'manual', category: 'andet', note: note.trim() })
    payloadRef.current = payload
    try {
      setResult(await submitBugReport(payload, includeShot ? screenshot : null))
      setPhase('success')
    } catch {
      setPhase('error')
    }
  }

  const copyCode = () => {
    if (!result) return
    navigator.clipboard
      ?.writeText(result.id)
      .then(() => setCopied(true))
      .catch(() => {})
  }

  return (
    <Dialog open={open} onClose={phase === 'sending' ? undefined : onClose} maxWidth="xs" fullWidth>
      {phase === 'compose' && (
        <>
          <AdultBackHeader title="🐞 Rapportér et problem" onBack={onClose} />
          <DialogContent>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1.5 }}>
              Rapporten indeholder automatisk skærmbillede, seneste hændelser og teknisk info.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Hvad skete der?"
              placeholder="Beskriv problemet – fx: 'Der kom ingen lyd, da jeg trykkede på bogstavet.'"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            />
            {screenshot && (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  component="img"
                  src={screenshot}
                  alt="Skærmbillede"
                  sx={{ height: 96, borderRadius: 1, border: '1px solid rgba(0,0,0,0.2)' }}
                />
                <FormControlLabel
                  control={
                    <Checkbox checked={includeShot} onChange={(_, v) => setIncludeShot(v)} />
                  }
                  label="Send skærmbillede med"
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Annullér</Button>
            <Button aria-label="Send rapport" onClick={() => send()} variant="contained">
              Send rapport
            </Button>
          </DialogActions>
        </>
      )}

      {phase === 'sending' && (
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Sender rapport…</Typography>
        </DialogContent>
      )}

      {phase === 'success' && result && (
        <>
          <DialogContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Tak! Rapporten er sendt ✅</Typography>
            <Typography
              sx={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '0.4rem', my: 1.5 }}
            >
              {result.id}
            </Typography>
            <Button onClick={copyCode} variant="outlined" size="small" sx={{ mb: 1.5 }}>
              {copied ? 'Kopieret!' : 'Kopiér kode'}
            </Button>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              Nævn koden, når du beskriver problemet — eller bed bare om den nyeste rapport.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center' }}>
            <Button onClick={onClose} variant="contained">Luk</Button>
          </DialogActions>
        </>
      )}

      {phase === 'error' && (
        <>
          <DialogContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Rapporten kunne ikke sendes 😕</Typography>
            <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Tjek internetforbindelsen og prøv igen — eller gem rapporten som en fil, og send den senere.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
            <Button onClick={() => send(true)} variant="contained">Prøv igen</Button>
            <Button
              onClick={() => {
                if (payloadRef.current) {
                  downloadReportAsFile(payloadRef.current, includeShot ? screenshot : null)
                }
              }}
              variant="outlined"
            >
              Gem som fil
            </Button>
            <Button onClick={onClose}>Luk</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

export default BugReportDialog
