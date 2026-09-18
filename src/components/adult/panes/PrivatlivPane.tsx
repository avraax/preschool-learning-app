// "Privatliv" — the sixth adult group (App Store PRD §3.5, Phase A2).
//
// Two things that are one story: that the voice the child hears is synthetic (PRD §3.11 / B9 —
// Microsoft's obligation, not Apple's), and the two documents that say what happens to data. A Kids
// Category reviewer goes looking for exactly this, which is why it is its own pane rather than
// scattered (see `adultSettingsIa.ts`).

import React, { useCallback } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { ChevronRight, FileText, LifeBuoy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AI_VOICE_DISCLOSURE_DA } from '../../../config/legalContent'
import { PaneSection } from './paneParts'

const LinkRow: React.FC<{
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
}> = ({ icon, label, hint, onClick }) => (
  <Button
    onClick={onClick}
    sx={{
      justifyContent: 'flex-start',
      textAlign: 'left',
      textTransform: 'none',
      color: 'text.primary',
      px: 1,
      py: 1.25,
      minHeight: 48,
      width: '100%',
    }}
  >
    <Box sx={{ display: 'flex', color: 'text.secondary', mr: 1.5 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{label}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {hint}
      </Typography>
    </Box>
    <ChevronRight size={18} aria-hidden />
  </Button>
)

const PrivatlivPane: React.FC<{ closeAll: () => void }> = ({ closeAll }) => {
  const navigate = useNavigate()

  // The documents are in-app ROUTES, not outbound links — Guideline 1.3 forbids links out of a Kids app
  // except behind a parental gate, and rendering the text in-app also satisfies 5.1.1(i)'s "easily
  // accessible" requirement without a browser hop. Close the settings dialog first, or the page mounts
  // underneath it.
  const go = useCallback(
    (path: string) => {
      closeAll()
      navigate(path)
    },
    [closeAll, navigate],
  )

  return (
    <Stack spacing={2.5}>
      {/* Microsoft's Code of Conduct obligation, not Apple's — see AI_VOICE_DISCLOSURE_DA. It is the
          first thing in the pane on purpose: a parent reading what the app sends where is exactly the
          parent this disclosure is written for. Adult surface only, never a child-facing screen. */}
      <PaneSection title={AI_VOICE_DISCLOSURE_DA.title}>
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.55 }}>
            {AI_VOICE_DISCLOSURE_DA.body}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55, mt: 0.75 }}>
            {AI_VOICE_DISCLOSURE_DA.hint}
          </Typography>
        </Box>
      </PaneSection>

      <PaneSection title="Dokumenter">
        <Stack>
          <LinkRow
            icon={<FileText size={19} />}
            label="Privatlivspolitik"
            hint="Hvad appen gemmer, hvem der modtager noget, og hvordan du får det slettet"
            onClick={() => go('/privatliv')}
          />
          <LinkRow
            icon={<LifeBuoy size={19} />}
            label="Support"
            hint="Svar på det, folk oftest spørger om — og hvor du skriver til et menneske"
            onClick={() => go('/support')}
          />
        </Stack>
      </PaneSection>
    </Stack>
  )
}

export default PrivatlivPane
