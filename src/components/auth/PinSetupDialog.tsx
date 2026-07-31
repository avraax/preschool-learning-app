// Create or change the 4-digit adult PIN.
//
// WHY THE FIRST-RUN CASE CANNOT BE SKIPPED (accounts PRD §7.2): the PIN is the only adult gate that
// works OFFLINE. If an adult could defer it, a fresh device would have NO adult gate at all now that
// AdultGate is deleted — the child-resistant Danish-number-word reading test is gone. So we nag until
// a PIN exists, while the device is still online (which is also what lets the local verifier be
// cached).
//
// A CHANGE asks for the current PIN as its FIRST step rather than going through
// `requirePin('changePin')`. That is deliberate: the server-side `pin/set` needs the current PIN as a
// parameter, and routing it through AuthContext would mean handing a live secret back through a
// generic context callback. Asking here keeps the secret local to this component AND still gets full
// server authority — `pin/set` verifies it under the same `pin_attempt` lockout as `pin/verify`, so a
// change can't be used as an unthrottled oracle for the old code.
//
// Two confirmation steps for the new PIN, because a mistyped 4-digit code an adult can't recover from
// is worse than one extra screen. `validateNewPin` is the SAME pure module the server enforces.

import React, { useCallback, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { Lock } from 'lucide-react'
import PinPad from './PinPad'
import { authStore } from '../../services/authStore'
import { storeLocalVerifier } from '../../services/pinVerifier'
import { validateNewPin } from '../../config/pinPolicy'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { AUTH_Z } from './authOverlayZ'

type Step = 'current' | 'choose' | 'confirm' | 'saving'

export interface PinSetupDialogProps {
  open: boolean
  /** Onboarding (mandatory) hides Annullér; a later change from the adult menu allows it. */
  dismissible?: boolean
  /** True when a PIN already exists → start by asking for it. */
  requireCurrent?: boolean
  onDone: () => void
  onCancel?: () => void
}

const LABELS: Record<Step, string> = {
  current: 'Tast din nuværende kode',
  choose: 'Vælg en kode på 4 cifre',
  confirm: 'Tast koden igen',
  saving: 'Gemmer …',
}

const PinSetupDialog: React.FC<PinSetupDialogProps> = ({
  open,
  dismissible = false,
  requireCurrent = false,
  onDone,
  onCancel,
}) => {
  const firstStep: Step = requireCurrent ? 'current' : 'choose'
  const [step, setStep] = useState<Step>(firstStep)
  const [currentPin, setCurrentPin] = useState('')
  const [first, setFirst] = useState('')
  const [wrong, setWrong] = useState(false)
  const [hint, setHint] = useState('')

  const reset = useCallback(() => {
    setStep(firstStep)
    setCurrentPin('')
    setFirst('')
    setWrong(false)
    setHint('')
  }, [firstStep])

  const fail = useCallback((message: string, back: Step) => {
    setWrong(true)
    setHint(message)
    setStep(back)
    setFirst('')
  }, [])

  const onComplete = useCallback(
    async (pin: string) => {
      if (step === 'current') {
        // Verified for real, against the server, under the persisted lockout.
        setStep('saving')
        const check = await authStore.verifyPinOnServer(pin)
        if (!check.ok) {
          fail(check.message ?? 'Koden er ikke rigtig.', 'current')
          return
        }
        setCurrentPin(pin)
        setHint('')
        setWrong(false)
        setStep('choose')
        return
      }

      if (step === 'choose') {
        const check = validateNewPin(pin)
        if (!check.ok) {
          fail(check.message ?? 'Vælg en anden kode.', 'choose')
          return
        }
        setFirst(pin)
        setHint('')
        setStep('confirm')
        return
      }

      if (step === 'confirm') {
        if (pin !== first) {
          fail('De to koder er ikke ens. Prøv forfra.', 'choose')
          return
        }
        setStep('saving')
        const result = await authStore.setPin(pin, requireCurrent ? currentPin : undefined)
        if (!result.ok) {
          fail(result.message ?? 'Koden kunne ikke gemmes.', 'choose')
          return
        }
        // The adult just proved this PIN online on this device → cache the offline verifier.
        if (result.pinUpdatedAt) await storeLocalVerifier(pin, result.pinUpdatedAt)
        reset()
        onDone()
      }
    },
    [step, first, currentPin, requireCurrent, onDone, reset, fail],
  )

  return (
    <Dialog
      open={open}
      onClose={dismissible ? onCancel : undefined}
      maxWidth="xs"
      fullWidth
      aria-label={requireCurrent ? 'Skift kode' : 'Lav en voksenkode'}
      // Same stack as PinDialog — see authOverlayZ. Mandatory setup must outrank anything it can
      // appear over.
      sx={{ zIndex: AUTH_Z.pin }}
      slotProps={{
        paper: {
          'data-bl-redact': true,
          sx: { [PHONE_LANDSCAPE]: { maxHeight: 'calc(100% - 16px)', m: 1 } },
        } as never,
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          [PHONE_LANDSCAPE]: { py: 1, fontSize: '1.05rem' },
        }}
      >
        <Lock size={20} aria-hidden />
        {requireCurrent ? 'Skift kode' : 'Lav en voksenkode'}
      </DialogTitle>
      <DialogContent sx={{ [PHONE_LANDSCAPE]: { py: 0.5 } }}>
        {!requireCurrent && (
          <Typography
            variant="body2"
            sx={{ mb: 2, color: 'text.secondary', [PHONE_LANDSCAPE]: { display: 'none' } }}
          >
            Koden bruges til at åbne &quot;Til de voksne&quot; og til at skifte barn. Den virker også
            uden internet.
          </Typography>
        )}
        <PinPad
          onComplete={onComplete}
          wrong={wrong}
          onWrongConsumed={() => setWrong(false)}
          disabled={step === 'saving'}
          hint={hint}
          label={LABELS[step]}
          // Each step asks for a DIFFERENT code, so the entry must start empty — otherwise "type it
          // again" arrives pre-filled and inert.
          resetKey={step}
        />
      </DialogContent>
      {dismissible && (
        <DialogActions sx={{ [PHONE_LANDSCAPE]: { py: 0.5 } }}>
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
