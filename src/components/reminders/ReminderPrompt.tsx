// "Må vi minde jer om Børnelæring?" — the one-time, adult-addressed card that comes BEFORE iOS's
// one-shot permission dialog (Re-engagement PRD-01 §2.1–2.2). Mounted once in `App.tsx`.
//
// WHY OUR CARD FIRST. iOS asks once, ever. A "Tillad ikke" tapped by a five-year-old is permanent short
// of iPad Settings, and "Ikke nu" here does NOT spend that dialog. Only "Ja tak" opens it.
//
// NO PARENTAL GATE, by decision (owner, 2026-10-09): the card is addressed to the adult in its copy, and
// a child tapping "Ja tak" costs at most one weekly reminder to the parent. A gate would sink the
// opt-in rate. It is SILENT (no narration — so no new spoken line and no prebake).
//
// THREE RULES THIS FILE HOLDS:
//   * Only a `click` may close it. A pointerdown/touchend close lets the tap fall through to the board
//     behind (the "Start lyd nu" incident). MUI's Button onClick IS click; the backdrop and Escape do
//     nothing, so a child's stray tap on the dimmed home cannot answer for the adult.
//   * Home only, after ~4 s of uninterrupted home, never over another overlay — `promptMayShow`.
//   * Shown at most once per session, and once answered never again.

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'
import { BellRing } from 'lucide-react'
import { AdultThemeProvider, ADULT_FONT } from '../../theme/adultTheme'
import { useAuthContext } from '../../contexts/AuthContext'
import { profileStore } from '../../services/profileStore'
import { reminders, promptMayShow } from '../../services/reminders'
import { REMINDER_PROMPT } from '../../config/reminderSchedule'

/** Any other modal on screen? Read from the DOM so a surface added later is covered without wiring. */
function otherOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector('[data-reward-overlay], .MuiDialog-root, .MuiDrawer-root.MuiModal-root') !== null
}

const POLL_MS = 500

const ReminderPrompt: React.FC = () => {
  const snap = useSyncExternalStore(reminders.subscribe, reminders.getSnapshot, reminders.getSnapshot)
  const { pathname } = useLocation()
  const auth = useAuthContext()
  const authUiOpen = auth?.authUiOpen ?? false
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const shownThisSession = useRef(false)

  const canOffer = snap.available && reminders.canOffer()

  // The clock: how long home has been visible, uninterrupted. Any route change resets it.
  useEffect(() => {
    if (!canOffer || pathname !== '/' || open || shownThisSession.current) return
    const since = Date.now()
    const t = setInterval(() => {
      if (
        promptMayShow({
          canOffer: reminders.canOffer(),
          pathname,
          profileAttached: profileStore.activeProfile() !== null,
          authUiOpen,
          otherOverlay: otherOverlayOpen(),
          homeVisibleMs: Date.now() - since,
        })
      ) {
        clearInterval(t)
        shownThisSession.current = true
        reminders.noteOffered()
        setOpen(true)
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [canOffer, pathname, authUiOpen, open])

  if (!snap.available) return null

  const answerYes = () => {
    if (busy) return
    setBusy(true)
    // Close OUR card first so iOS's dialog appears over home, not over a card that seems to be waiting.
    setOpen(false)
    void reminders.acceptFromPrompt().finally(() => setBusy(false))
  }
  const answerNo = () => {
    reminders.declineFromPrompt()
    setOpen(false)
  }

  return (
    <AdultThemeProvider>
      <Dialog
        open={open}
        // Deliberately inert: neither the backdrop nor Escape may answer for the adult.
        onClose={() => {}}
        maxWidth="xs"
        fullWidth
        aria-labelledby="reminder-prompt-title"
        slotProps={{
          paper: {
            ...({ 'data-reminder-prompt': true } as Record<string, unknown>),
            sx: { fontFamily: ADULT_FONT, borderRadius: 3 },
          },
        }}
      >
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 1 }}>
            <BellRing size={18} aria-hidden />
            <Typography
              component="span"
              sx={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              {REMINDER_PROMPT.overline}
            </Typography>
          </Box>
          <Typography id="reminder-prompt-title" component="h2" sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1.5 }}>
            {REMINDER_PROMPT.title}
          </Typography>
          <Typography sx={{ fontSize: '0.95rem', color: 'text.secondary', lineHeight: 1.5 }}>
            {REMINDER_PROMPT.body}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={answerNo} aria-label={REMINDER_PROMPT.no} sx={{ minHeight: 44, px: 2 }}>
            {REMINDER_PROMPT.no}
          </Button>
          <Button
            variant="contained"
            onClick={answerYes}
            disabled={busy}
            aria-label={REMINDER_PROMPT.yes}
            sx={{ minHeight: 44, px: 2.5 }}
          >
            {REMINDER_PROMPT.yes}
          </Button>
        </DialogActions>
      </Dialog>
    </AdultThemeProvider>
  )
}

export default ReminderPrompt
