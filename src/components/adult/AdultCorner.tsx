// "Til de voksne" corner button + menu (Bug Report feature / adult-tools consolidation).
//
// ONE small semi-transparent button, bottom-right on every page (mounted globally in
// App.tsx). Hold ~2s to open — the same child-resistant gesture the old version-chip
// reset used; a plain tap only wiggles as a hint. The menu consolidates the adult tools
// that used to float separately: bug reporter (new), voice override panel (old floating
// mic), SFX toggle (setting existed with no UI), progress reset (old version-chip hold),
// and the version/build info footer (old version chip).
//
// Screenshot subtlety: the screen is captured at hold-fire, BEFORE the menu renders, and
// stashed — so a report shows the broken game state, not the menu itself.

import React, { useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material'
import { Settings } from 'lucide-react'
import { BUILD_INFO } from '../../config/version'
import { useProgress } from '../../hooks/useProgress'
import { captureScreenshot } from '../../services/screenshotService'
import AdultGate, { makeGateCode } from '../common/AdultGate'
import VoiceOverridePanel from '../voicelab/VoiceOverridePanel'
import BugReportDialog from './BugReportDialog'

const HOLD_MS = 2000

type AdultView = null | 'menu' | 'report' | 'voice' | 'resetGate' | 'resetDone'

interface AdultCornerProps {
  /** Mirror the old VersionDisplay dodge: UpdateBanner owns bottom-right when visible. */
  updateAvailable?: boolean
}

const AdultCorner: React.FC<AdultCornerProps> = ({ updateAvailable = false }) => {
  const progress = useProgress()
  const [view, setView] = useState<AdultView>(null)
  const [gateCode, setGateCode] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  const fireHold = async () => {
    holdFired.current = true
    setCapturing(true)
    // Capture BEFORE the menu dialog exists — this is the screenshot a report will carry.
    const shot = await captureScreenshot()
    setScreenshot(shot)
    setCapturing(false)
    setView('menu')
  }

  const startHold = () => {
    holdFired.current = false
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => { void fireHold() }, HOLD_MS)
  }
  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  const handleClick = () => {
    // click fires after pointerup — swallow the ghost click that follows a completed hold.
    if (holdFired.current) {
      holdFired.current = false
      return
    }
    // Headless-test hook: CDP automation can't hold a pointer down for 2s.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('adult-tap')) {
      void fireHold()
      return
    }
    setWiggle(true)
  }

  const closeAll = () => {
    setView(null)
    setScreenshot(null)
  }

  const buildDateTime = new Date(BUILD_INFO.buildTime)
  const releaseDate = buildDateTime.toLocaleDateString('da-DK', { year: 'numeric', month: 'short', day: 'numeric' })
  const releaseTime = buildDateTime.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <>
      <IconButton
        aria-label="Til de voksne"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onClick={handleClick}
        onAnimationEnd={() => setWiggle(false)}
        sx={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          right: updateAvailable ? 'auto' : 'calc(env(safe-area-inset-right, 0px) + 8px)',
          left: updateAvailable ? 'calc(env(safe-area-inset-left, 0px) + 8px)' : 'auto',
          zIndex: 1001, // old version-chip slot: above UpdateBanner (1000), below modals
          width: 40,
          height: 40,
          opacity: capturing ? 1 : 0.55,
          bgcolor: 'rgba(255,255,255,0.4)',
          color: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.25)',
          // Hold must not be hijacked by scroll/pan; no text selection on long-press.
          touchAction: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          transform: capturing ? 'scale(1.15)' : 'none',
          '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.55)' },
          '@keyframes bl-adult-wiggle': {
            '0%, 100%': { transform: 'rotate(0deg)' },
            '25%': { transform: 'rotate(-12deg)' },
            '75%': { transform: 'rotate(12deg)' },
          },
          ...(wiggle && { animation: 'bl-adult-wiggle 0.3s ease-in-out 2' }),
        }}
      >
        <Settings size={20} />
      </IconButton>

      {/* The adult menu */}
      <Dialog open={view === 'menu'} onClose={closeAll} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Til de voksne 🔒</DialogTitle>
        <DialogContent sx={{ pb: 0.5 }}>
          <List sx={{ py: 0 }}>
            <ListItemButton
              aria-label="Rapportér et problem"
              onClick={() => setView('report')}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemText primary="🐞 Rapportér et problem" />
            </ListItemButton>
            <ListItemButton
              aria-label="Stemme-test"
              onClick={() => setView('voice')}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemText primary="🎙️ Stemme-test" />
            </ListItemButton>
            <ListItem sx={{ minHeight: 48 }}>
              <ListItemText primary="🔊 Lydeffekter" />
              <Switch
                checked={progress.state.settings.sfxEnabled}
                onChange={(_, v) => progress.setSetting('sfxEnabled', v)}
                slotProps={{ input: { 'aria-label': 'Lydeffekter til/fra' } }}
              />
            </ListItem>
            <ListItemButton
              aria-label="Nulstil al fremgang"
              onClick={() => {
                setGateCode(makeGateCode())
                setView('resetGate')
              }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemText primary="♻️ Nulstil al fremgang" />
            </ListItemButton>
          </List>
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 1, mb: 1 }}
          >
            v{BUILD_INFO.version} · {BUILD_INFO.commitHash} · {releaseDate} {releaseTime}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAll}>Luk</Button>
        </DialogActions>
      </Dialog>

      <BugReportDialog open={view === 'report'} screenshot={screenshot} onClose={closeAll} />

      <VoiceOverridePanel open={view === 'voice'} onClose={() => setView('menu')} />

      <AdultGate
        open={view === 'resetGate'}
        code={gateCode}
        description={
          <>Dette nulstiller <strong>alle</strong> klistermærker, rekorder og stjerner.</>
        }
        confirmLabel="Nulstil"
        confirmColor="error"
        onClose={() => setView('menu')}
        onSuccess={() => {
          progress.resetAll()
          setView('resetDone')
        }}
      />

      <Dialog open={view === 'resetDone'} onClose={closeAll} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>✅</Typography>
          <Typography sx={{ fontWeight: 700 }}>Al fremgang er nulstillet.</Typography>
          <DialogActions sx={{ justifyContent: 'center', mt: 2 }}>
            <Button onClick={closeAll} variant="contained">Luk</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AdultCorner
