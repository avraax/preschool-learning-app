// The feedback dialog — parent-facing, reached from the Indstillinger rail footer.
//
// compose → sending → success (big short code) | error (retry or save the identical message as a
// local .json file — the offline fallback).
// The screenshot was captured by AdultSurface at menu-open, BEFORE any dialog rendered,
// so it shows the moment they came from rather than the menu.
//
// It was "Rapportér et problem" until 2026-09-15. ONE door now, deliberately without a kind picker —
// see `src/config/feedbackForm.ts` for why. The payload underneath is unchanged and still a
// `BugReportPayload` with `type: 'manual'`: crashes and failed sign-ins ride the same service and the
// same Blob prefix, and `type` is what separates them (`/feedback` lists the manual ones).

import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { CircleCheck, MessageSquare, TriangleAlert } from 'lucide-react'
import {
  canSubmitFeedback,
  FEEDBACK_ATTACHMENT_NOTE,
  FEEDBACK_ENTRY_LABEL,
  FEEDBACK_INTRO,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_SCREENSHOT_LABEL,
} from '../../config/feedbackForm'
import { CONTROLLER } from '../../config/legalContent'

type Phase = 'compose' | 'sending' | 'success' | 'error'

interface FeedbackDialogProps {
  open: boolean
  /** JPEG data URL stashed at menu-open, or null if capture failed/timed out. */
  screenshot: string | null
  onClose: () => void
}

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, screenshot, onClose }) => {
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
          {/* A nested TASK dialog gets exactly two buttons — Annullér leading, the action trailing
              (Settings PRD-01 §6.4). No back arrow: it would be a third way out of the same dialog. */}
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageSquare size={19} aria-hidden />
            {FEEDBACK_ENTRY_LABEL}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1.5 }}>
              {FEEDBACK_INTRO}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              autoFocus
              label="Hvad vil du sige?"
              placeholder="Fx: 'Min søn elsker krokodillespillet' – eller 'Der kom ingen lyd, da jeg trykkede på bogstavet.'"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, FEEDBACK_MAX_CHARS))}
            />
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 1 }}>
              {FEEDBACK_ATTACHMENT_NOTE}
            </Typography>
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
                  label={FEEDBACK_SCREENSHOT_LABEL}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Annullér</Button>
            {/* An empty message is unreadable as praise and undebuggable as a bug — the rule is pure
                and lives in feedbackForm.ts so a plain-Node test can hold it. */}
            <Button
              aria-label="Send"
              onClick={() => send()}
              variant="contained"
              disabled={!canSubmitFeedback(note)}
            >
              Send
            </Button>
          </DialogActions>
        </>
      )}

      {phase === 'sending' && (
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Sender…</Typography>
        </DialogContent>
      )}

      {phase === 'success' && result && (
        <>
          <DialogContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography
              sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}
            >
              <Box component="span" sx={{ display: 'flex', color: 'success.main' }}>
                <CircleCheck size={20} aria-hidden />
              </Box>
              Tak! Din besked er sendt
            </Typography>
            <Typography
              sx={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '0.4rem', my: 1.5 }}
            >
              {result.id}
            </Typography>
            <Button onClick={copyCode} variant="outlined" size="small" sx={{ mb: 1.5 }}>
              {copied ? 'Kopieret!' : 'Kopiér kode'}
            </Button>
            {/* The channel is ONE-WAY by design (owner, 2026-09-15): no e-mail field, so nothing new
                is collected and the privacy story stays "no name, no e-mail". The code is therefore
                the ONLY handle a parent has on their own message — hence the address here. */}
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              Vil du have svar, så skriv til {CONTROLLER.email} og nævn koden.
            </Typography>
          </DialogContent>
          {/* "Luk" belongs to the settings header alone (§6.1) — this only ends the report. */}
          <DialogActions sx={{ justifyContent: 'center' }}>
            <Button onClick={onClose} variant="contained" aria-label="Færdig">Færdig</Button>
          </DialogActions>
        </>
      )}

      {phase === 'error' && (
        <>
          <DialogContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography
              sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}
            >
              <Box component="span" sx={{ display: 'flex', color: 'warning.main' }}>
                <TriangleAlert size={20} aria-hidden />
              </Box>
              Beskeden kunne ikke sendes
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Tjek internetforbindelsen og prøv igen — eller gem beskeden som en fil, og send den senere.
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
            <Button onClick={onClose} aria-label="Annullér">Annullér</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

export default FeedbackDialog
