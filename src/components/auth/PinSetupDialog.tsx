// Mandatory PIN setup, immediately after the first successful sign-in.
//
// WHY IT CANNOT BE SKIPPED (accounts PRD §7.2): the PIN is the only adult gate that works OFFLINE. If
// an adult could defer it, a fresh device would have NO adult gate at all once AdultGate is deleted —
// the child-resistant Danish-number-word reading test is gone. So we nag until a PIN exists, while the
// device is still online (which is also what lets the local verifier be cached).
//
// Two steps with confirmation, because a mistyped 4-digit code an adult can't recover from is worse
// than one extra screen. `validateNewPin` is the SAME pure module the server enforces, so the two can't
// disagree about what's acceptable.

import React, { useCallback, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import PinPad from './PinPad'
import { authStore } from '../../services/authStore'
import { storeLocalVerifier } from '../../services/pinVerifier'
import { validateNewPin } from '../../config/pinPolicy'

type Step = 'choose' | 'confirm' | 'saving'

export interface PinSetupDialogProps {
  open: boolean
  /** Onboarding (mandatory) hides Annullér; a later change from the adult menu allows it. */
  dismissible?: boolean
  /** Required when a PIN already exists — the server verifies it (§7.2 changePin). */
  currentPin?: string
  onDone: () => void
  onCancel?: () => void
}

const PinSetupDialog: React.FC<PinSetupDialogProps> = ({
  open,
  dismissible = false,
  currentPin,
  onDone,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('choose')
  const [first, setFirst] = useState('')
  const [wrong, setWrong] = useState(false)
  const [hint, setHint] = useState('')

  const reset = useCallback(() => {
    setStep('choose')
    setFirst('')
    setWrong(false)
    setHint('')
  }, [])

  const onComplete = useCallback(
    async (pin: string) => {
      if (step === 'choose') {
        const check = validateNewPin(pin)
        if (!check.ok) {
          setWrong(true)
          setHint(check.message ?? 'Vælg en anden kode.')
          return
        }
        setFirst(pin)
        setHint('')
        setStep('confirm')
        return
      }
      if (step === 'confirm') {
        if (pin !== first) {
          setWrong(true)
          setHint('De to koder er ikke ens. Prøv forfra.')
          setStep('choose')
          setFirst('')
          return
        }
        setStep('saving')
        const result = await authStore.setPin(pin, currentPin)
        if (!result.ok) {
          setWrong(true)
          setHint(result.message ?? 'Koden kunne ikke gemmes.')
          setStep('choose')
          setFirst('')
          return
        }
        // The adult just proved this PIN online on this device → cache the offline verifier.
        if (result.pinUpdatedAt) await storeLocalVerifier(pin, result.pinUpdatedAt)
        reset()
        onDone()
      }
    },
    [step, first, currentPin, onDone, reset],
  )

  return (
    <Dialog
      open={open}
      onClose={dismissible ? onCancel : undefined}
      maxWidth="xs"
      fullWidth
      aria-label="Lav en voksenkode"
      slotProps={{ paper: { 'data-bl-redact': true } as never }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {currentPin ? 'Skift kode 🔒' : 'Lav en voksenkode 🔒'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Koden bruges til at åbne &quot;Til de voksne&quot; og til at skifte barn. Den virker også
          uden internet.
        </Typography>
        <PinPad
          onComplete={onComplete}
          wrong={wrong}
          onWrongConsumed={() => setWrong(false)}
          disabled={step === 'saving'}
          hint={hint}
          label={step === 'confirm' ? 'Tast koden igen' : 'Vælg en kode på 4 cifre'}
        />
      </DialogContent>
      {dismissible && (
        <DialogActions>
          <Button
            onClick={() => {
              reset()
              onCancel?.()
            }}
            aria-label="Annullér"
          >
            Annullér
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

export default PinSetupDialog
