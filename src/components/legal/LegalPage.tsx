// The shell for the two public text pages (`/privatliv`, `/support`) — App Store PRD §3.5 / A2.
//
// THREE THINGS THAT ARE NOT ORDINARY PAGE LAYOUT HERE:
//
//  * IT SCROLLS, and nothing else in this app does. Body overflow is `hidden` app-wide because every
//    game layout is full-viewport and no-scroll (`.claude/rules/layout-contract.md`) — so a long text
//    page needs its OWN scroll container or the bottom of the privacy policy is simply unreachable,
//    which for a mandatory disclosure is the whole point of the page.
//  * IT RENDERS WITHOUT THE APP. `AuthGate` mounts these directly when there is no session, so the
//    persistent world, the audio engine and `progressStore` are all absent. Nothing here may touch
//    them, and there is deliberately no mascot, no music and no reward ring.
//  * ADULT SURFACE, so `lucide-react` is allowed and no baked art is needed (CLAUDE.md's no-emoji rule
//    splits exactly there). Comic Neue is the app font, but body text here is the system stack for
//    readability at length.

import React from 'react'
import { Box, Button, Divider, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ArrowLeft, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { LegalSection } from '../../config/legalContent'
import { CONTROLLER } from '../../config/legalContent'

export interface LegalDoc {
  title: string
  intro: string[]
  sections: LegalSection[]
}

const BODY_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontFamily: BODY_FONT, fontSize: '1rem', lineHeight: 1.65, mb: 1.25 }}>
    {children}
  </Typography>
)

const Section: React.FC<{ section: LegalSection }> = ({ section }) => (
  <Box component="section" sx={{ mb: 3 }}>
    <Typography
      component="h2"
      sx={{ fontFamily: BODY_FONT, fontSize: '1.15rem', fontWeight: 700, mb: 1 }}
    >
      {section.heading}
    </Typography>
    {section.body?.map((p) => <Para key={p}>{p}</Para>)}
    {section.bullets && (
      <Box component="ul" sx={{ pl: 3, m: 0, mt: section.body ? 1 : 0 }}>
        {section.bullets.map((b) => (
          <Box
            component="li"
            key={b}
            sx={{ fontFamily: BODY_FONT, fontSize: '1rem', lineHeight: 1.6, mb: 0.85 }}
          >
            {b}
          </Box>
        ))}
      </Box>
    )}
  </Box>
)

/**
 * `docs` is a list so the privacy route can carry the Danish policy AND the English one on one page:
 * the app is Danish-only, but App Review reads English, and 5.1.1(i) wants the reviewer able to read
 * what is disclosed. One URL, both languages, no locale routing.
 */
const LegalPage: React.FC<{ docs: LegalDoc[]; showEmail?: boolean }> = ({ docs, showEmail }) => {
  const navigate = useNavigate()
  const theme = useTheme()

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        // Its own scroll container — see the header note. `-webkit-overflow-scrolling` keeps the
        // momentum scroll on the iPad, where a plain `auto` container feels dead.
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: theme.palette.background.default,
        color: theme.palette.text.primary,
        zIndex: 1,
      }}
    >
      <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 4 } }}>
        {/* A plain navigate() is correct here and is NOT the raw-navigate() violation in
            `.claude/rules/scene-and-world.md`: that rule governs leaving a GAME, where the wipe
            overlay has to cover the swap. This page is outside the world and can be mounted with no
            TransitionProvider above it at all (the signed-out case), so a transition hook would throw. */}
        <Button
          onClick={() => navigate('/')}
          startIcon={<ArrowLeft size={20} />}
          sx={{ mb: 2, minHeight: 44 }}
        >
          Tilbage
        </Button>

        {docs.map((doc, i) => (
          <Box key={doc.title} component="article">
            {i > 0 && <Divider sx={{ my: 4 }} />}
            <Typography
              component="h1"
              sx={{ fontFamily: BODY_FONT, fontSize: '1.6rem', fontWeight: 800, mb: 2 }}
            >
              {doc.title}
            </Typography>
            {doc.intro.map((p) => (
              <Para key={p}>{p}</Para>
            ))}
            <Box sx={{ mt: 3 }}>
              {doc.sections.map((s) => (
                <Section key={s.heading} section={s} />
              ))}
            </Box>
          </Box>
        ))}

        {showEmail && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, mb: 4 }}>
            <Mail size={18} aria-hidden />
            <Typography sx={{ fontFamily: BODY_FONT, fontSize: '1rem', fontWeight: 600 }}>
              {CONTROLLER.email}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default LegalPage
