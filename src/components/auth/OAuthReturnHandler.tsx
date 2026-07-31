// Recovery for the Google leg (accounts PRD §4.5 steps 5–6).
//
// The URL that comes back carries NO secret — only `#bl_auth=1`, in the FRAGMENT so it never reaches
// Vercel access logs or a `Referer` header. The claim credential is the `flowId` this app wrote into
// ITS OWN localStorage before navigating, which is what makes a wrong-context return harmless.
//
// Three paths, and the second one is NOT belt-and-braces — it is what makes the flow survive iOS
// simply not handing control back to the app:
//   * FAST:     the fragment triggers a claim on the next paint.
//   * RECOVERY: poll every 3s for ≤3 min, PLUS on every visibilitychange:visible, PLUS on the next
//               cold boot while a pending flow exists.
//   * WRONG CONTEXT: `#bl_auth=1` present but no local flowId ⇒ we are the in-app browser view, which
//               CANNOT steal the session because it has no flowId. Show WrongContextNotice.
//
// The claim implementation itself lives in W7 (services/authSignIn.ts); this component owns only the
// when.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { AUTH_FRAGMENT, claimPendingFlow, readPendingFlow } from '../../services/authSignIn'

const POLL_INTERVAL_MS = 3000
const POLL_WINDOW_MS = 3 * 60 * 1000

const hasAuthFragment = (): boolean => {
  try {
    return window.location.hash.includes(AUTH_FRAGMENT)
  } catch {
    return false
  }
}

/** Strip the fragment the instant it is read — URL hygiene (§8.1 item 5). */
const stripFragment = (): void => {
  try {
    if (!window.location.hash) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* ignore */
  }
}

const OAuthReturnHandler: React.FC = () => {
  const [wrongContext, setWrongContext] = useState(false)
  const startedAt = useRef<number>(Date.now())
  const claiming = useRef(false)

  const attempt = useCallback(async () => {
    if (claiming.current) return
    const pending = readPendingFlow()
    if (!pending) return
    claiming.current = true
    try {
      await claimPendingFlow(pending.flowId)
    } finally {
      claiming.current = false
    }
  }, [])

  useEffect(() => {
    const fragment = hasAuthFragment()
    const pending = readPendingFlow()

    if (fragment && !pending) {
      // We are running somewhere that never started the flow — an in-app browser view, or a link
      // opened on the wrong device. There is nothing to claim here, by design.
      setWrongContext(true)
      stripFragment()
      return
    }
    if (fragment) stripFragment()

    // Cold boot with a pending flow counts as a recovery attempt too.
    if (!pending) return
    void attempt()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void attempt()
    }
    document.addEventListener('visibilitychange', onVisible)

    const poll = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_WINDOW_MS || !readPendingFlow()) {
        clearInterval(poll)
        return
      }
      void attempt()
    }, POLL_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(poll)
    }
  }, [attempt])

  if (!wrongContext) return null
  return <WrongContextNotice onClose={() => setWrongContext(false)} />
}

const WrongContextNotice: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Box
    data-bl-redact
    role="alert"
    onClick={onClose}
    sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      p: 2,
    }}
  >
    <Paper elevation={12} sx={{ p: 4, borderRadius: 4, maxWidth: 400, textAlign: 'center' }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
        Næsten færdig
      </Typography>
      <Typography variant="body1">
        Vend tilbage til Børnelæring-appen for at fortsætte. Du er allerede logget ind.
      </Typography>
    </Paper>
  </Box>
)

export default OAuthReturnHandler
