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
import { Delete } from 'lucide-react'
import {
  ANSWER_DIGITS,
  isGuestAnswerCorrect,
  makeGuestChallenge,
  type GuestChallenge,
} from '../../config/guestAdultGate'
import { getCategoryTheme } from '../../config/categoryThemes'
// Digit glyphs sit on the white tileSurface, so they use onTileColor(accent), never the raw accent.
import { onTileColor } from '../../theme/tokens/helpers'
import { PHONE_ANY, PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import TactileTile from '../common/TactileTile'
import { AUTH_Z } from './authOverlayZ'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

const GuestAdultGate: React.FC<{
  open: boolean
  onResolve: (ok: boolean) => void
}> = ({ open, onResolve }) => {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const accent = getCategoryTheme('math').accentColor
  const glyph = onTileColor(accent)

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
      slotProps={{ paper: { sx: { borderRadius: 4, p: 1 } } }}
    >
      <DialogContent>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
          Til de voksne
        </Typography>
        <Typography
          sx={{ textAlign: 'center', color: 'text.secondary', fontSize: '0.9rem', mb: 2 }}
        >
          Svar for at fortsætte.
        </Typography>

        <Box
          sx={{
            userSelect: 'none',
            [PHONE_LANDSCAPE]: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 },
          }}
        >
          <Box sx={{ [PHONE_LANDSCAPE]: { flex: '0 1 auto', maxWidth: 190 } }}>
            <Typography
              data-guest-gate-prompt
              sx={{ textAlign: 'center', fontWeight: 700, fontSize: '1.35rem', mb: 1.25 }}
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
                    width: 44,
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // An explicit LENGTH, not `borderRadius: 2` — that multiplies against this theme's
                    // shape token and rendered the two answer slots as ovals (measured).
                    borderRadius: '12px',
                    fontSize: '1.6rem',
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

          <Box
            role="group"
            aria-label="Talpanel"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              maxWidth: 260,
              mx: 'auto',
              [PHONE_ANY]: { maxWidth: 216, gap: 0.75 },
              [PHONE_LANDSCAPE]: { maxWidth: 198, gap: 0.75, mx: 0, flex: '0 0 auto' },
            }}
          >
            {KEYS.map((key, i) =>
              key === '' ? (
                <Box key={`spacer-${i}`} />
              ) : (
                <Box
                  key={key}
                  sx={{
                    aspectRatio: '3 / 2',
                    minHeight: 44,
                    [PHONE_LANDSCAPE]: { aspectRatio: 'auto', height: 44, minHeight: 44 },
                  }}
                >
                  <TactileTile
                    accent={accent}
                    variant="chip"
                    state={wrong ? 'wrong' : 'idle'}
                    onActivate={() => press(key)}
                    domProps={{
                      'aria-label': key === 'del' ? 'Slet sidste ciffer' : `Ciffer ${key}`,
                      'data-guest-gate-key': key,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: glyph,
                        fontWeight: 700,
                        fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
                      }}
                    >
                      {key === 'del' ? <Delete size={20} /> : key}
                    </Box>
                  </TactileTile>
                </Box>
              ),
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onResolve(false)} sx={{ minHeight: 44 }}>
          Annullér
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default GuestAdultGate
