// "Synkronisering" — is the book on the server (Familie IA PRD §3.4). Signed in only.
//
// Lifted out of the old `KontoPane` unchanged. `Synkronisér nu` stays a `devTool`, i.e. absent from
// the production build: sync is automatic, so a manual trigger is only ever used while debugging one.
// `adultSettingsIa.test.ts` reads THIS file for the `showDevTools()` gate — it used to name
// `KontoPane.tsx`, which no longer exists.

import React, { useCallback, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { Cloud, RefreshCw } from 'lucide-react'
import { useSyncStatus } from '../../../../hooks/useSyncStatus'
import { progressSync } from '../../../../services/progressSync'
import { showDevTools } from '../../../../utils/adultDevTools'
import { PaneSection } from '../paneParts'

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

const SynkSection: React.FC = () => {
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)

  const syncNow = useCallback(async () => {
    setBusy(true)
    await progressSync.syncNow('manual')
    setBusy(false)
  }, [])

  const syncHeadline =
    status.phase === 'offline'
      ? 'Ingen forbindelse lige nu.'
      : status.phase === 'error'
        ? 'Der er et problem med at gemme.'
        : status.dirty
          ? 'Der er noget der ikke er gemt endnu.'
          : 'Alt er gemt.'

  return (
    <PaneSection title="Synkronisering">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box sx={{ display: 'flex', color: 'text.secondary', pt: 0.25 }}>
          <Cloud size={19} aria-hidden />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{syncHeadline}</Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Sidst gemt: {danishWhen(status.lastPushAt)}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Sidst hentet: {danishWhen(status.lastPullAt)}
          </Typography>
          {status.error && (
            <Typography variant="caption" role="alert" color="error" sx={{ display: 'block' }}>
              {status.error}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
        Spillet virker også uden internet. Fremgangen gemmes på enheden med det samme og sendes
        videre, når der er forbindelse.
      </Typography>
      {/* Owner tool (adultSettingsIa `devTool`): sync is automatic, so a manual trigger is only
          ever used while debugging one. Absent from the production build. */}
      {showDevTools() && (
        <Button
          onClick={() => void syncNow()}
          disabled={busy || status.phase === 'pulling' || status.phase === 'pushing'}
          aria-label="Synkronisér nu"
          startIcon={<RefreshCw size={16} />}
          sx={{ mt: 1 }}
        >
          Synkronisér nu
        </Button>
      )}
    </PaneSection>
  )
}

export default SynkSection
