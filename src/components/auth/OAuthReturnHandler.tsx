// Recovery for the Google leg (accounts PRD §4.5 steps 5–6).
//
// The URL that comes back carries NO secret — only `#bl_auth=1`, in the FRAGMENT so it never reaches
// Vercel access logs or a `Referer` header. The claim credential is the `flowId` this app wrote into
// ITS OWN localStorage before navigating, which is what makes a wrong-context return harmless.
//
// Three paths, and the second one is NOT belt-and-braces — it is what makes the flow survive iOS
// simply not handing control back to the app:
//   * FAST:     the fragment triggers a claim on the next paint.
//   * RECOVERY: poll every 3s, PLUS on every visibilitychange:visible, PLUS on the next cold boot while
//               a pending flow exists. The give-up ceiling is the SERVER's flow TTL (10 min) counted in
//               FOREGROUND time only — see `oauthPollWindow.ts`, and RC4 in the sign-in reliability PRD.
//   * WRONG CONTEXT: `#bl_auth=1` present but no local flowId ⇒ we are the in-app browser view, which
//               CANNOT steal the session because it has no flowId. Show WrongContextNotice.
//
// The claim implementation itself lives in W7 (services/authSignIn.ts); this component owns only the
// when.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import {
  AUTH_FRAGMENT,
  claimPendingFlow,
  clearPendingFlow,
  readPendingFlow,
} from '../../services/authSignIn'
import { noteAuthStep, reportAuthFailure } from '../../services/authDiagnostics'
import { AUTH_Z } from './authOverlayZ'
import {
  createPollWindow,
  POLL_INTERVAL_MS,
  sampleWindow,
  windowExhausted,
} from './oauthPollWindow'

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
  // Never go back to Date.now() - current.startedAt > POLL_WINDOW_MS wall-clock accounting,
  // and never useRef<number>(Date.now()) for the window either.
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
      //
      // It is ALSO what an installed-PWA storage-jar mismatch looks like (the flow started in Safari and
      // came back into the home-screen app, or vice versa), which is indistinguishable from here and is a
      // genuine dead end for the adult. Report it: this is the single most likely shape of "I tried to log
      // in twice and nothing happened".
      setWrongContext(true)
      stripFragment()
      void reportAuthFailure('google-return', 'returned-without-pending-flow', {
        note: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
      })
      return
    }
    if (fragment) {
      stripFragment()
      noteAuthStep('google-return', 'ok', {
        note: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
      })
    }

    // Cold boot with a pending flow counts as a recovery attempt too.
    if (pending) void attempt()

    // ARMED UNCONDITIONALLY, AND THAT IS THE FIX. This used to `return` here when no flow was pending
    // AT MOUNT — so a sign-in STARTED LATER in the same page lifetime got no poll and no visibility
    // listener at all, and nothing ever claimed the session the callback had parked. On the plain web
    // that was invisible, because `location.assign` unloads the page and the return is a fresh mount.
    // It is NOT invisible where the app page survives the round trip: an installed PWA (or the shell)
    // opens the authorize URL in a separate view with its OWN storage jar, so the return context has no
    // flowId — it correctly shows WrongContextNotice and reports `returned-without-pending-flow` — and
    // the app that DOES hold the flowId was the one that had stopped listening. Measured shape: report
    // F9BJX, 2026-08-08, plus four identical ones on 4–5 Aug; the adult's second attempt then works,
    // because by then a pending flow existed at mount and the poll was armed.

    // THE WINDOW IS FOREGROUND TIME, NOT WALL-CLOCK. See `oauthPollWindow.ts` for the measured reason —
    // iOS froze this webview for 210 s behind the sign-in sheet, and wall-clock accounting then threw
    // away a flow the server would still have honoured. It is per-effect state rather than a ref because
    // it belongs to this poll loop and nothing else reads it.
    let pollWindow = createPollWindow(Date.now())
    const sample = () => {
      pollWindow = sampleWindow(pollWindow, Date.now(), document.visibilityState === 'visible')
    }

    const onVisible = () => {
      // Sample on BOTH transitions: a hidden stretch that ends here would otherwise be measured only by
      // whichever tick happened to follow it.
      sample()
      if (document.visibilityState === 'visible') void attempt()
    }
    document.addEventListener('visibilitychange', onVisible)

    const poll = setInterval(() => {
      const current = readPendingFlow()
      // Nothing in flight: idle, and NOT a give-up — the flow may not have started yet.
      if (!current) {
        // Keep the clock honest for the NEXT flow: an idle stretch must not be charged to it.
        pollWindow = createPollWindow(Date.now())
        return
      }
      sample()

      // CLAIM FIRST, ALWAYS. This used to evaluate the give-up window and `return` before ever asking the
      // server, so the very first tick after the sheet closed — the one tick that would have succeeded —
      // was spent throwing the flow away instead. A flow is only dead when the SERVER says so or when we
      // have genuinely watched for longer than the server keeps it.
      void attempt().then(() => {
        // A decisive answer (404/410, since W3 with the reason and the Fejlkode) has already cleared the
        // flow and told the adult. That is the one SILENT stop — adding a second report here would file
        // a duplicate for a fault the server already recorded.
        if (!readPendingFlow()) return
        if (!windowExhausted(pollWindow)) return
        // THE SILENT DEAD END, still reported. This used to just `clearInterval`: three minutes of
        // polling, then nothing — no message, no log, no report, and a lock screen that simply sat
        // there. A timer expiry is a decisive failure and stays one.
        //
        // It CLEARS the flow rather than the interval, because the interval has to survive for the
        // adult's next attempt. Same effect for this flow — the loop goes idle on the next tick — and
        // the report is deduped by `stage|reason` anyway.
        clearPendingFlow()
        void reportAuthFailure('google-claim', 'poll-window-exhausted', {
          note: `${Math.round(pollWindow.foregroundMs / 1000)}s foreground`,
        })
      })
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
      zIndex: AUTH_Z.wrongContext, // above the picker — a wrong-context return needs the last word
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
