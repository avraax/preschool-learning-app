// The 4-digit keypad. Replaces AdultGate's single TextField entirely (D4).
//
// Deliberately NOT a text field: it is built from `TactileTile variant="chip"`, which already provides
// 44px+ touch targets, press travel, a :focus-visible ring, the `state='wrong'` shake
// (x: [0,-7,7,-5,5,0]) and internal useReducedMotion handling — so the keypad inherits the app's whole
// interaction language for free instead of re-implementing it (accounts PRD §7.2).
//
// Accent: getCategoryTheme('math').accentColor — NEVER categoryThemes['math'], which is bound to the
// default kid tokens and is not skin-aware, so it would show kid colours on the other three skins.
// Digit glyphs sit on the white tileSurface, so they use onTileColor(accent), never the raw accent.
//
// IT RENDERS DOTS, NEVER DIGITS. That is the third of three independent layers keeping a PIN out of a
// public bug-report blob (§8.1): the hold gesture is disabled while this is open, the surface carries
// data-bl-redact, and even a bypassed capture shows only filled circles.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import TactileTile from '../common/TactileTile'
import { getCategoryTheme } from '../../config/categoryThemes'
import { onTileColor } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PHONE_ANY, PHONE_LANDSCAPE } from '../../theme/phoneMedia'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export interface PinPadProps {
  /** Fires automatically on the 4th digit — there is no OK button. */
  onComplete: (pin: string) => void
  /** Set by the host after a failed attempt; shakes the pad and clears it. */
  wrong?: boolean
  /** Cleared by the host once the shake has been consumed. */
  onWrongConsumed?: () => void
  disabled?: boolean
  /** Danish helper line under the dots (attempts left, lockout countdown, …). */
  hint?: string
  label?: string
}

const PinPad: React.FC<PinPadProps> = ({
  onComplete,
  wrong = false,
  onWrongConsumed,
  disabled = false,
  hint,
  label = 'Tast koden',
}) => {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const accent = getCategoryTheme('math').accentColor
  const glyph = onTileColor(accent)
  const [digits, setDigits] = useState('')
  const digitsRef = useRef('')

  useEffect(() => {
    if (!wrong) return
    digitsRef.current = ''
    setDigits('')
    const id = setTimeout(() => onWrongConsumed?.(), 450)
    return () => clearTimeout(id)
  }, [wrong, onWrongConsumed])

  const press = useCallback(
    (key: string) => {
      if (disabled) return
      if (key === 'del') {
        digitsRef.current = digitsRef.current.slice(0, -1)
        setDigits(digitsRef.current)
        return
      }
      // NB `onComplete` must NOT be called from inside a setState updater: React runs updaters during
      // reconciliation, so notifying the parent there is a setState-during-render ("Cannot update a
      // component while rendering a different component"). Read the current value from a ref instead.
      const current = digitsRef.current
      if (current.length >= PIN_LENGTH) return
      const next = current + key
      digitsRef.current = next
      setDigits(next)
      // Verify on the 4th digit; no OK button to hunt for.
      if (next.length === PIN_LENGTH) onComplete(next)
    },
    [disabled, onComplete],
  )

  // A physical keyboard is the fastest path for an adult on a laptop (and for headless tests).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, disabled])

  return (
    // A phone in LANDSCAPE is only ~375–390px tall, and four 44px rows plus a title and actions do
    // not fit — the pad ended up needing an internal scroll, which breaks the app's no-scroll rule.
    // So on a short landscape phone the info block moves BESIDE the keypad (there is plenty of width
    // there), while portrait phones and tablets keep the natural stacked layout.
    <Box
      data-bl-redact
      data-pin-pad
      sx={{
        userSelect: 'none',
        [PHONE_LANDSCAPE]: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
      }}
    >
      <Box sx={{ [PHONE_LANDSCAPE]: { flex: '0 1 auto', maxWidth: 170 } }}>
        <Typography
          sx={{ textAlign: 'center', fontWeight: 600, mb: 1, [PHONE_ANY]: { fontSize: '0.95rem' } }}
        >
          {label}
        </Typography>

        {/* Dots, never digits. */}
        <motion.div
          animate={wrong && !reduced ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 12 }}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <Box
              key={i}
              data-pin-dot={i < digits.length ? 'filled' : 'empty'}
              aria-hidden
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `2px solid ${wrong ? theme.palette.error.main : accent}`,
                backgroundColor:
                  i < digits.length ? (wrong ? theme.palette.error.main : accent) : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            />
          ))}
        </motion.div>

        {hint && (
          <Typography
            role="status"
            sx={{
              textAlign: 'center',
              mb: 1.5,
              fontSize: '0.9rem',
              color: wrong ? 'error.main' : 'text.secondary',
              minHeight: '1.4em',
              [PHONE_LANDSCAPE]: { mb: 0 },
            }}
          >
            {hint}
          </Typography>
        )}
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
                // Drop the aspect ratio in short landscape so four rows fit exactly; the tap target
                // stays at the 44px floor, just wider than tall.
                [PHONE_LANDSCAPE]: { aspectRatio: 'auto', height: 44, minHeight: 44 },
              }}
            >
              <TactileTile
                accent={accent}
                variant="chip"
                state={wrong ? 'wrong' : 'idle'}
                disabled={disabled}
                onActivate={() => press(key)}
                domProps={{
                  'aria-label': key === 'del' ? 'Slet sidste ciffer' : `Ciffer ${key}`,
                  'data-pin-key': key,
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
  )
}

export default PinPad
