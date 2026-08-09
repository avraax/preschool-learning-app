// The parental gate a GUEST device sees instead of the PIN pad (App Store PRD §3.2 / A1, §3.6).
//
// The reasoning for why this exists, why it is arithmetic and why the operands are what they are lives
// in `src/config/guestAdultGate.ts`. This file is only the surface.
//
// DELIBERATELY NOT `PinPad`, although it looks similar. PinPad renders DOTS, never digits, carries
// `data-bl-redact` and is stripped from bug-report screenshots — all correct for a secret, all wrong
// here. This challenge is not a secret: the adult must SEE what they are typing, and there is nothing
// to redact. Reusing PinPad would have meant either showing digits through a component whose contract
// is "never show digits", or asking an adult to type an arithmetic answer blind.
//
// A NEW CHALLENGE ON EVERY OPEN. Reusing one question across a session would let a child who watched
// once repeat the taps from memory — which is the only realistic attack on a gate like this.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import {
  ANSWER_DIGITS,
  isGuestAnswerCorrect,
  makeGuestChallenge,
  type GuestChallenge,
} from '../../config/guestAdultGate'
import { getCategoryTheme } from '../../config/categoryThemes'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { captureExcludeProps } from '../../services/captureExclude'
import Keypad from './Keypad'
import { useGateDialogShell } from './gateDialog'
import { AUTH_Z } from './authOverlayZ'

const GuestAdultGate: React.FC<{
  open: boolean
  onResolve: (ok: boolean) => void
}> = ({ open, onResolve }) => {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const accent = getCategoryTheme('math').accentColor
  const shell = useGateDialogShell()

  // `nonce` forces a fresh question on every open AND after every wrong answer — see the header.
  //
  // ESLint calls `nonce` an unnecessary dependency because it does not appear in the factory. That is
  // exactly backwards here: `makeGuestChallenge` is deliberately IMPURE (it draws from `Math.random`),
  // so `nonce` is the only thing that can re-run it. Removing it, as the rule suggests, would freeze one
  // question for the lifetime of the component — the single failure this gate has to avoid.
  const [nonce, setNonce] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const challenge: GuestChallenge = useMemo(() => makeGuestChallenge(), [nonce])
  const [typed, setTyped] = useState('')
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    if (!open) return
    setNonce((n) => n + 1)
    setTyped('')
    setWrong(false)
  }, [open])

  const submit = useCallback(
    (value: string) => {
      if (isGuestAnswerCorrect(value, challenge)) {
        onResolve(true)
        return
      }
      // Wrong ⇒ shake, clear, and ask a DIFFERENT question. No lockout and no attempt counter: this
      // gate protects a settings screen on a device with no account and no spend, and a parent who
      // fumbles 6 × 7 must not be locked out of their own child's difficulty setting.
      setWrong(true)
      setTyped('')
      setNonce((n) => n + 1)
    },
    [challenge, onResolve],
  )

  const press = useCallback(
    (key: string) => {
      setWrong(false)
      if (key === 'del') {
        setTyped((t) => t.slice(0, -1))
        return
      }
      setTyped((t) => {
        if (t.length >= ANSWER_DIGITS) return t
        const next = t + key
        // Auto-submit on the last digit, exactly like the PIN pad's 4th — no OK button to hunt for.
        // Deferred out of the updater: calling `submit` here would be a setState during render.
        if (next.length === ANSWER_DIGITS) queueMicrotask(() => submit(next))
        return next
      })
    },
    [submit],
  )

  // A physical keyboard is the fastest path on a laptop, and the only one a headless test has.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, press])

  if (!open) return null

  return (
    <Dialog
      open
      onClose={() => onResolve(false)}
      maxWidth="xs"
      fullWidth
      aria-label="Til de voksne"
      // Same reason as PinDialog: this can be demanded over surfaces that are fixed boxes at ~10 000,
      // far above a MUI Dialog's default 1300.
      sx={{ zIndex: AUTH_Z.pin }}
      // The bug-report screenshot is now taken BEHIND this gate rather than before it, so the gate has
      // to remove itself from the picture. NOT `data-bl-redact` — see `captureExclude.ts` and this
      // file's header for why those two are deliberately different things.
      {...captureExcludeProps}
      fullScreen={shell.fullScreen}
      slotProps={{ paper: { sx: shell.paperSx } }}
    >
      <DialogContent sx={shell.contentSx}>
        <Box
          sx={{
            userSelect: 'none',
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            [PHONE_LANDSCAPE]: {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            },
          }}
        >
          {/* Title, prompt, answer and status are ONE block. Keeping the title outside put it above
              the whole row on a landscape phone, i.e. centred over the keypad rather than over the
              question it names — it read as a stray caption on the pad. */}
          <Box sx={{ flex: '0 0 auto', [PHONE_LANDSCAPE]: { flex: '0 1 auto', maxWidth: 200 } }}>
            <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
              Til de voksne
            </Typography>
            <Typography
              sx={{
                textAlign: 'center',
                color: 'text.secondary',
                fontSize: '0.9rem',
                mb: 2,
                // The one line that can go when height is the binding constraint. The prompt below
                // already says what to do, and a landscape phone is ~390px tall in total.
                [PHONE_LANDSCAPE]: { display: 'none' },
              }}
            >
              Svar for at fortsætte.
            </Typography>

            <Typography
              data-guest-gate-prompt
              sx={{
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 'clamp(1.35rem, 5vw, 1.7rem)',
                mb: 1.25,
                // A landscape phone is WIDE, so the `vw` term picks the largest size — into a 200px
                // column, which wrapped "Hvor meget er 4 × 8?" after the 4. The column is narrow
                // here regardless of how wide the viewport is, so pin the size instead.
                [PHONE_LANDSCAPE]: { fontSize: '1.15rem', mb: 1 },
              }}
            >
              {challenge.prompt}
            </Typography>

            {/* The typed answer is SHOWN, unlike the PIN's dots — see the header. */}
            <motion.div
              animate={wrong && !reduced ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}
            >
              {Array.from({ length: ANSWER_DIGITS }, (_, i) => (
                <Box
                  key={i}
                  data-guest-gate-slot={i < typed.length ? 'filled' : 'empty'}
                  sx={{
                    // Scales with the keys rather than staying at the old fixed 44 × 52. At the old
                    // size it was visibly smaller than a ~106px key, so the thing being ANSWERED
                    // looked less important than the buttons used to answer it.
                    width: 'clamp(52px, 16vw, 72px)',
                    height: 'clamp(60px, 19vw, 86px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // An explicit LENGTH, not `borderRadius: 2` — that multiplies against this theme's
                    // shape token and rendered the two answer slots as ovals (measured).
                    borderRadius: '16px',
                    fontSize: 'clamp(1.8rem, 6vw, 2.4rem)',
                    fontWeight: 700,
                    color: wrong ? theme.palette.error.main : accent,
                    border: `2px solid ${wrong ? theme.palette.error.main : accent}`,
                  }}
                >
                  {typed[i] ?? ''}
                </Box>
              ))}
            </motion.div>

            <Typography
              role="status"
              sx={{
                textAlign: 'center',
                fontSize: '0.85rem',
                minHeight: '1.4em',
                mb: 1.5,
                color: wrong ? 'error.main' : 'text.secondary',
                [PHONE_LANDSCAPE]: { mb: 0 },
              }}
            >
              {wrong ? 'Ikke helt. Her er et nyt spørgsmål.' : ''}
            </Typography>
          </Box>

          <Keypad accent={accent} wrong={wrong} onPress={press} keyAttr="data-guest-gate-key" />
        </Box>
      </DialogContent>
      <DialogActions sx={{ flex: '0 0 auto', px: 3, pb: 2, [PHONE_LANDSCAPE]: { py: 0.5 } }}>
        <Button onClick={() => onResolve(false)} sx={{ minHeight: 44 }}>
          Annullér
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default GuestAdultGate
