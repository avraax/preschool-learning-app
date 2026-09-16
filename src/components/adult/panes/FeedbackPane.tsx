// "Send feedback" — the feedback form, rendered in the DETAIL COLUMN like every other rail row.
//
// compose → sending → sent (a big short code) | error (retry, or save the identical message as a local
// .json file — the offline fallback).
//
// **IT WAS A NESTED TASK DIALOG UNTIL 2026-09-16, AND THAT WAS THE DEFECT** (owner: *"the send
// feedback menu item opens a modal. why is that? the other menu items just shows its content in the
// right column"*). Settings PRD-01 made it a dialog on the reasoning that a BUG REPORT is a task you
// start at the moment something looks wrong, not a settings category — sound while the row read
// "Rapportér et problem", and wrong once it read "Send feedback", which is a destination like the
// five above it. A row that behaves differently from every neighbouring row has to earn it, and this
// one no longer could.
//
// The row stays in the rail FOOTER (below the divider) rather than becoming a sixth group: it is
// reachable from every pane, it is not a settings category, and `ADULT_IA` is contractually five
// mutually-exclusive groups (`adultSettingsIa.test.ts`). Only the rendering moved.
//
// The screenshot was captured by AdultSurface at menu-open, BEFORE this pane rendered, so it shows the
// screen the adult came from rather than the settings surface.
//
// The payload is unchanged and still a `BugReportPayload` with `type: 'manual'`: crashes and failed
// sign-ins ride the same service, and `type` is what separates them — which is also what names the
// Blob folder (`feedback-<ID>` vs `crash-<ID>` / `auth-<ID>`), so the bucket is readable without
// opening anything. `/feedback` lists the manual ones.

import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  buildReportPayload,
  downloadReportAsFile,
  submitBugReport,
  type BugReportPayload,
  type SubmitResult,
} from '../../../services/bugReporter'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import {
  canSubmitFeedback,
  FEEDBACK_ATTACHMENT_NOTE,
  FEEDBACK_INTRO,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_SCREENSHOT_LABEL,
} from '../../../config/feedbackForm'
import { CONTROLLER } from '../../../config/legalContent'

type Phase = 'compose' | 'sending' | 'sent' | 'error'

interface FeedbackPaneProps {
  /** JPEG data URL stashed at menu-open, or null if capture failed/timed out. */
  screenshot: string | null
  /**
   * Leave the form. On compact this pops back to the rail list; at regular width it returns to the
   * last settings pane, because the detail column always shows something.
   */
  onDone: () => void
}

const FeedbackPane: React.FC<FeedbackPaneProps> = ({ screenshot, onDone }) => {
  const [phase, setPhase] = useState<Phase>('compose')
  const [note, setNote] = useState('')
  const [includeShot, setIncludeShot] = useState(true)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [copied, setCopied] = useState(false)
  // The exact payload that was (attempted) sent — retry/download must reuse it unchanged.
  // Always assigned in send() before any read, so it needs no reset.
  const payloadRef = useRef<BugReportPayload | null>(null)

  const send = async (reusePayload = false) => {
    setPhase('sending')
    const payload =
      reusePayload && payloadRef.current
        ? payloadRef.current
        : buildReportPayload({ type: 'manual', category: 'andet', note: note.trim() })
    payloadRef.current = payload
    try {
      setResult(await submitBugReport(payload, includeShot ? screenshot : null))
      setPhase('sent')
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

  if (phase === 'sending') {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography>Sender…</Typography>
      </Box>
    )
  }

  if (phase === 'sent' && result) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography
          sx={{
            fontWeight: 700,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
          }}
        >
          <Box component="span" sx={{ display: 'flex', color: 'success.main' }}>
            <CircleCheck size={20} aria-hidden />
          </Box>
          Tak! Din besked er sendt
        </Typography>
        <Typography sx={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '0.4rem', my: 1.5 }}>
          {result.id}
        </Typography>
        <Button onClick={copyCode} variant="outlined" size="small" sx={{ mb: 1.5 }}>
          {copied ? 'Kopieret!' : 'Kopiér kode'}
        </Button>
        {/* The channel is ONE-WAY by design (owner, 2026-09-15): no e-mail field, so nothing new is
            collected and the policy can still say a message carries no name and no e-mail. The code is
            therefore the ONLY handle a parent has on their own message — hence the address here. */}
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
          Vil du have svar, så skriv til {CONTROLLER.email} og nævn koden.
        </Typography>
        {/* NOT "Luk" — that word belongs to the surface header alone (Settings PRD-01 §6.1). This
            only leaves the form; the surface stays open, which is the whole point of it being a pane. */}
        <Button onClick={onDone} variant="contained" aria-label="Færdig">
          Færdig
        </Button>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography
          sx={{
            fontWeight: 700,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
          }}
        >
          <Box component="span" sx={{ display: 'flex', color: 'warning.main' }}>
            <TriangleAlert size={20} aria-hidden />
          </Box>
          Beskeden kunne ikke sendes
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', mb: 2 }}>
          Tjek internetforbindelsen og prøv igen — eller gem beskeden som en fil, og send den senere.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => send(true)} variant="contained">
            Prøv igen
          </Button>
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
          {/* Back to the form with the text intact — `note` is untouched by a failed send. */}
          <Button onClick={() => setPhase('compose')}>Tilbage</Button>
        </Stack>
      </Box>
    )
  }

  return (
    <Box>
      <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', mb: 1.5 }}>
        {FEEDBACK_INTRO}
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={4}
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
            control={<Checkbox checked={includeShot} onChange={(_, v) => setIncludeShot(v)} />}
            label={FEEDBACK_SCREENSHOT_LABEL}
          />
        </Box>
      )}
      {/* The action sits at the END of the pane's own flow, not in a dialog's action bar. An empty
          message is unreadable as praise and undebuggable as a bug — the rule is pure and lives in
          feedbackForm.ts so a plain-Node test can hold it. */}
      <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          aria-label="Send"
          onClick={() => send()}
          variant="contained"
          disabled={!canSubmitFeedback(note)}
        >
          Send
        </Button>
      </Box>
    </Box>
  )
}

export default FeedbackPane
