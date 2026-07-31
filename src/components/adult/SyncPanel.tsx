// "Synkronisering" — the one place an adult can see whether the book is safe on the server.
//
// Plain language, no jargon: no rev numbers, no "CRDT", no conflict counts. An adult needs to know
// three things — is it saved, when was it last saved, and can I make it happen now.
//
// It reads useSyncStatus(), NOT useProgress(): folding sync state into the progress hook would re-render
// every game board and the whole scene on each sync tick (accounts PRD §5.9).

import React, { useCallback, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { progressSync } from '../../services/progressSync'

export interface SyncPanelProps {
  open: boolean
  onClose: () => void
}

const danishWhen = (ms: number): string => {
  if (!ms) return 'aldrig'
  const age = Date.now() - ms
  if (age < 60_000) return 'lige nu'
  if (age < 3_600_000) {
    const m = Math.floor(age / 60_000)
    return m === 1 ? 'for 1 minut siden' : `for ${m} minutter siden`
  }
  try {
    return new Date(ms).toLocaleString('da-DK', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'ukendt'
  }
}

const SyncPanel: React.FC<SyncPanelProps> = ({ open, onClose }) => {
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)

  const syncNow = useCallback(async () => {
    setBusy(true)
    await progressSync.syncNow('manual')
    setBusy(false)
  }, [])

  const headline =
    status.phase === 'offline'
      ? 'Ingen forbindelse lige nu.'
      : status.phase === 'error'
        ? 'Der er et problem med at gemme.'
        : status.dirty
          ? 'Der er noget der ikke er gemt endnu.'
          : 'Alt er gemt.'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Synkronisering</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 600 }}>{headline}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sidst gemt: {danishWhen(status.lastPushAt)}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sidst hentet: {danishWhen(status.lastPullAt)}
          </Typography>
          {status.error && (
            <Typography variant="body2" role="alert" color="error">
              {status.error}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: 1 }}>
            Spillet virker også uden internet. Fremgangen gemmes på enheden med det samme og sendes
            videre, når der er forbindelse.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} aria-label="Luk">
          Luk
        </Button>
        <Button
          variant="contained"
          onClick={() => void syncNow()}
          disabled={busy || status.phase === 'pulling' || status.phase === 'pushing'}
          aria-label="Synkronisér nu"
        >
          Synkronisér nu
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SyncPanel
