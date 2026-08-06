// "Privatliv" — the sixth adult group (App Store PRD §3.5 + §3.6, Phase A2/A3).
//
// Three rows that are one story: whether the microphone may send the child's voice to a third party,
// and the two documents that say what happens to data. A Kids Category reviewer goes looking for
// exactly this, which is why it is its own pane rather than scattered (see `adultSettingsIa.ts`).
//
// THE GUEST CASE IS NOT A DEGRADED VERSION OF THE SIGNED-IN ONE, it is a different truth. `/api/stt`
// requires a server-minted access JWT that no account-less client can obtain (that gate is what stops a
// stranger burning Google credit — `.claude/rules/auth.md`), so in guest mode the microphone game
// CANNOT work. Offering the switch there would let an adult consent to a game that then dead-ends on
// "det hørte jeg ikke helt" forever, which is precisely what Guideline 5.1.1(iv) asks us not to do
// ("provide alternative solutions for users who don't grant consent"). So the row explains itself
// instead, and points at the thing that would actually fix it.

import React, { useCallback, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { ChevronRight, FileText, LifeBuoy, Mic, MicOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../contexts/AuthContext'
import { grantMicConsent, micConsentGiven, revokeMicConsent } from '../../../utils/micConsent'
import MicConsentDialog from './MicConsentDialog'
import { PaneSection, ToggleRow } from './paneParts'

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
  const { pathname } = useLocation()
  const auth = useAuthContext()
  const guest = auth?.phase === 'guest'

  // Read once per open, then track locally: the flag is device-scoped localStorage with no subscriber
  // model, and this pane is a modal snapshot — the same shape as `audioEverWorked` in LydPane.
  const [micOn, setMicOn] = useState(() => micConsentGiven())
  const [asking, setAsking] = useState(false)

  const onToggle = useCallback(
    (next: boolean) => {
      // ON goes through the consent screen; OFF is immediate. Asymmetric on purpose — see
      // MicConsentDialog's header.
      if (next) {
        setAsking(true)
        return
      }
      revokeMicConsent()
      setMicOn(false)
      // `MicGameRoute` only re-decides on NAVIGATION, and this dialog re-renders itself, not the router
      // — so revoking while the child is standing in the game would leave a live microphone behind an
      // adult who just switched it off. Leave the route explicitly.
      if (pathname === '/ordleg/mic') {
        closeAll()
        navigate('/ordleg', { replace: true })
      }
    },
    [closeAll, navigate, pathname],
  )

  const onAccept = useCallback(() => {
    grantMicConsent()
    setMicOn(true)
    setAsking(false)
  }, [])

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
      <PaneSection
        title="Mikrofon"
        hint='Kun spillet "Sig et Ord" bruger mikrofonen. Den er slået fra, indtil du slår den til.'
      >
        {guest ? (
          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
              Mikrofonspillet kræver en konto
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
              Talegenkendelsen er en betalt tjeneste, så den virker kun, når du er logget ind. Alt andet
              i appen virker uden konto. Log ind under Konto, hvis I vil bruge "Sig et Ord".
            </Typography>
          </Box>
        ) : (
          <>
            <ToggleRow
              icon={micOn ? <Mic size={19} /> : <MicOff size={19} />}
              label='Tillad mikrofonen i "Sig et Ord"'
              hint={
                micOn
                  ? 'Til. Barnets stemme sendes til Google for at blive genkendt.'
                  : 'Fra. Spillet er ikke tilgængeligt for barnet.'
              }
              checked={micOn}
              onChange={onToggle}
            />
            {micOn && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                Du kan slå den fra igen her. Så sendes der ikke mere lyd nogen steder.
              </Typography>
            )}
          </>
        )}
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

      <MicConsentDialog open={asking} onAccept={onAccept} onCancel={() => setAsking(false)} />
    </Stack>
  )
}

export default PrivatlivPane
