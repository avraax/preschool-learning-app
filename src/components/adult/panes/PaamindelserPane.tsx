// "Påmindelser" — the one switch for the weekly reminder (Re-engagement PRD-01 §2.8–2.9).
//
// It is the in-app opt-out Guideline 4.5.4 requires, and the only way in after "Ikke nu" on the card.
// NO day or time picker, by decision (owner, 2026-10-09: no manual setup) — the hint says when they come.
//
// THE SWITCH SHOWS THE ADULT'S CHOICE, not iOS's verdict. On + iOS denied is a real state (the adult
// wants them, iPad Settings forbids them), and showing the switch off there would make the adult flip
// it again and again to no effect. Instead the pane says so plainly and offers the way to iPad Settings.
// Coming back from Settings re-checks the permission (the service listens for the foreground).

import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { BellRing, BellOff, Send } from 'lucide-react'
import { PaneSection, ToggleRow } from './paneParts'
import { reminders } from '../../../services/reminders'
import { showDevTools } from '../../../utils/adultDevTools'

export const PAAMINDELSER_HINT =
  'Kommer kl. 16.30 på hverdage og kl. 10 i weekenden — kun hvis appen ikke har været åbnet i en uge, og højst tre i træk. Påmindelserne laves på iPad’en; der sendes ingen data.'

export const PAAMINDELSER_DENIED =
  'Notifikationer er slået fra for Børnelæring i iPad’ens indstillinger, så påmindelserne kan ikke komme frem.'

export const PAAMINDELSER_SETTINGS_PATH = 'Indstillinger → Børnelæring → Notifikationer'

const PaamindelserPane: React.FC = () => {
  const snap = useSyncExternalStore(reminders.subscribe, reminders.getSnapshot, reminders.getSnapshot)
  const [busy, setBusy] = useState(false)
  const [openFailed, setOpenFailed] = useState(false)
  const [testResult, setTestResult] = useState<'sent' | 'blocked' | null>(null)

  // The adult may have changed iPad Settings since boot; ask iOS again whenever the pane opens.
  useEffect(() => {
    void reminders.refreshPermission()
  }, [])

  const enabled = snap.prefs.enabled
  const denied = enabled && snap.perm === 'denied'

  const toggle = (on: boolean) => {
    if (busy) return
    setBusy(true)
    setOpenFailed(false)
    void reminders.setEnabled(on).finally(() => setBusy(false))
  }

  const openSettings = () => {
    void reminders.openSystemSettings().then((ok) => setOpenFailed(!ok))
  }

  const sendTest = () => {
    setTestResult(null)
    void reminders.scheduleTest().then((ok) => setTestResult(ok ? 'sent' : 'blocked'))
  }

  return (
    <Stack spacing={2.5} data-paamindelser-pane>
      <Stack>
        <ToggleRow
          icon={enabled && !denied ? <BellRing size={19} /> : <BellOff size={19} />}
          label="Ugentlig påmindelse"
          hint={PAAMINDELSER_HINT}
          checked={enabled}
          onChange={toggle}
        />
      </Stack>

      {denied && (
        <Alert severity="warning" data-paamindelser-denied sx={{ alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {PAAMINDELSER_DENIED}
          </Typography>
          <Button variant="outlined" size="small" onClick={openSettings} sx={{ minHeight: 44 }}>
            Åbn iPad-indstillinger
          </Button>
          {openFailed && (
            <Typography variant="body2" sx={{ mt: 1 }} data-paamindelser-path>
              Find det under {PAAMINDELSER_SETTINGS_PATH}.
            </Typography>
          )}
        </Alert>
      )}

      {showDevTools() && (
        <PaneSection title="Til test" hint="Kun i test-bygget: én påmindelse om et minut. Lås iPad’en for at se banneret.">
          <Box>
            <Button
              variant="outlined"
              startIcon={<Send size={16} aria-hidden />}
              onClick={sendTest}
              sx={{ minHeight: 44 }}
              data-paamindelser-test
            >
              Send en testpåmindelse
            </Button>
            {testResult && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }} data-paamindelser-test-result={testResult}>
                {testResult === 'sent'
                  ? 'Den kommer om et minut.'
                  : 'Det kræver, at notifikationer er tilladt for Børnelæring.'}
              </Typography>
            )}
          </Box>
        </PaneSection>
      )}
    </Stack>
  )
}

export default PaamindelserPane
