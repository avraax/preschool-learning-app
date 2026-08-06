// The microphone consent screen — App Store PRD §3.6 (Phase A3).
//
// WHY A SCREEN AND NOT A SWITCH. Guideline 1.3 is flat: "Kids Category apps may not send personally
// identifiable information or device information to third parties." The single qualifier in Apple's
// material is "unless the parent explicitly consents", and a switch is not an explicit consent — it is
// a preference. So the ON direction goes through this dialog, which must NAME the recipient (Google),
// say what is sent, say it is not stored, and say it can be turned off again. 5.1.2(i) requires the
// same thing in its own words: "You must clearly disclose where personal data will be shared with third
// parties, including with third-party AI, and obtain explicit permission before doing so."
//
// THE OFF DIRECTION HAS NO DIALOG AT ALL, deliberately. Withdrawal must never be harder than consent —
// the privacy policy promises it is one tap in this exact place — so `PrivatlivPane` revokes straight
// from the switch. `adultSettingsIa.test.ts` pins that the row is not marked destructive, which is what
// would otherwise attach a confirm to the safe direction.
//
// NOT type-to-confirm. That mechanism is for IRREVERSIBLE destruction (`.claude/rules/adult-surface.md`)
// and this is reversible in one tap; making the adult type here would spend the app's one
// deliberation-friction device on the wrong action and teach them to type past prompts.
//
// The whole pane already sits behind `requirePin('adultMenu')`, so a child cannot reach this screen.

import React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { Mic } from 'lucide-react'

const Point: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="li" sx={{ mb: 1, fontSize: '0.95rem', lineHeight: 1.55 }}>
    {children}
  </Box>
)

const MicConsentDialog: React.FC<{
  open: boolean
  onAccept: () => void
  onCancel: () => void
}> = ({ open, onAccept, onCancel }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth aria-label="Slå mikrofonen til">
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Mic size={22} aria-hidden />
      Slå mikrofonen til?
    </DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 1.5, fontSize: '0.95rem', lineHeight: 1.6 }}>
        Spillet "Sig et Ord" lader barnet sige et ord højt, og appen staver det tilbage. Det kræver
        mikrofonen, og det kræver hjælp udefra til at genkende ordet. Læs det her igennem, før du slår
        det til.
      </Typography>
      <Box component="ul" sx={{ pl: 3, m: 0 }}>
        <Point>
          <strong>Barnets stemme sendes til Google.</strong> Optagelsen sendes til Google Cloud
          Speech-to-Text, som genkender det talte ord og sender teksten tilbage.
        </Point>
        <Point>
          <strong>Optagelsen gemmes ikke.</strong> Den bruges til at genkende ordet og forsvinder
          derefter. Hverken appen eller Google beholder lyden, og den bruges ikke til at træne modeller.
        </Point>
        <Point>
          <strong>Der optages kun, mens barnet holder knappen nede.</strong> Mikrofonen er ellers
          lukket, og iPad'en viser sit eget mikrofon-mærke, når den er åben.
        </Point>
        <Point>
          <strong>Det kræver internet</strong>, og det er det eneste spil i appen, der gør. Alt andet
          virker uden.
        </Point>
        <Point>
          <strong>Du kan slå det fra igen med ét tryk</strong>, her på samme side. Så sendes der ikke
          mere lyd nogen steder, og spillet forsvinder fra Ordleg.
        </Point>
      </Box>
      <Typography sx={{ mt: 2, fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.55 }}>
        Du kan læse mere under Privatlivspolitik nederst på denne side. iPad'en spørger selv om lov til
        mikrofonen første gang barnet trykker.
      </Typography>
    </DialogContent>
    {/* Annullér leading, the action trailing — the two-button grammar every nested dialog here uses
        (`.claude/rules/adult-surface.md` §6). */}
    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
      <Button onClick={onCancel} sx={{ minHeight: 44 }}>
        Annullér
      </Button>
      <Button onClick={onAccept} variant="contained" sx={{ minHeight: 44 }}>
        Ja, slå mikrofonen til
      </Button>
    </DialogActions>
  </Dialog>
)

export default MicConsentDialog
