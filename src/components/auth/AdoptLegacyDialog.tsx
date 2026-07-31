// "Hvem har spillet på denne iPad?" — moving the old anonymous book into a real child.
//
// The adult sees exactly what will be adopted ("45 klistermærker, niveau 46") before confirming, because
// this is the one irreversible-feeling moment in the whole build — even though it isn't actually
// irreversible: the legacy key is never written to and never deleted (accounts PRD §5.5).
//
// Adopting the same blob into TWO profiles is ALLOWED (two kids really did share the iPad). The marker
// prevents ACCIDENTAL repeats; this dialog lets an adult do it deliberately.

import React, { useCallback, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { adoptLegacyInto, type LegacyPreview } from '../../services/legacyAdoption'
import type { ChildProfile } from '../../services/profileStore'

export interface AdoptLegacyDialogProps {
  preview: LegacyPreview
  profiles: ChildProfile[]
  defaultProfileId: string | null
}

const AdoptLegacyDialog: React.FC<AdoptLegacyDialogProps> = ({
  preview,
  profiles,
  defaultProfileId,
}) => {
  const theme = useTheme()
  const [open, setOpen] = useState(true)
  const [target, setTarget] = useState<string | null>(defaultProfileId ?? profiles[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const adopt = useCallback(() => {
    if (!target) return
    setBusy(true)
    const result = adoptLegacyInto(target)
    setBusy(false)
    if (result.status === 'adopted') {
      setMessage(
        result.report.changed
          ? 'Fremgangen er flyttet over.'
          : 'Der var ikke noget nyt at flytte over.',
      )
      setTimeout(() => setOpen(false), 1400)
      return
    }
    setMessage(
      result.status === 'already-adopted'
        ? 'Den er allerede flyttet over.'
        : result.status === 'unreadable'
          ? 'Den gamle fremgang kunne ikke læses.'
          : 'Der er ingen gammel fremgang at flytte.',
    )
    setTimeout(() => setOpen(false), 1800)
  }, [target])

  if (!preview.present) return null

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Hvem har spillet på denne iPad?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Der ligger fremgang fra før, du fik en konto: {preview.collectedCount} klistermærker, niveau{' '}
          {preview.level} og {preview.totalStars} stjerner. Vælg hvem den tilhører.
        </Typography>

        {message && (
          <Typography role="status" sx={{ mb: 1.5, fontWeight: 600 }}>
            {message}
          </Typography>
        )}

        <Box
          role="group"
          aria-label="Vælg barn"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 1 }}
        >
          {profiles.map((p) => {
            const isActive = p.id === target
            return (
              <Box
                key={p.id}
                component={motion.button}
                type="button"
                onClick={() => setTarget(p.id)}
                aria-pressed={isActive}
                aria-label={`Tilhører ${p.name || 'barn'}`}
                data-adopt-target={p.id}
                whileTap={{ scale: 0.94 }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  p: 1,
                  minHeight: 44,
                  cursor: 'pointer',
                  borderRadius: 3,
                  background: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  border: `3px solid ${
                    isActive ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.14)
                  }`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Box sx={{ fontSize: '1.7rem', lineHeight: 1 }}>{p.avatarEmoji}</Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {p.name || '—'}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)} aria-label="Ikke nu">
          Ikke nu
        </Button>
        <Button
          variant="contained"
          onClick={adopt}
          disabled={busy || !target}
          aria-label="Flyt fremgangen over"
        >
          Flyt over
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AdoptLegacyDialog
