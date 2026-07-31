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
  ListItemIcon,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material'
import {
  ArrowUp,
  Bug,
  CircleCheck,
  Cloud,
  KeyRound,
  Lock,
  Mic,
  Music,
  Palette,
  Repeat,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { BUILD_INFO } from '../../config/version'
import { useProgress } from '../../hooks/useProgress'
import { useProfiles } from '../../hooks/useProfiles'
import { captureScreenshot } from '../../services/screenshotService'
import { useAuthContext } from '../../contexts/AuthContext'
import { profileStore } from '../../services/profileStore'

// Adult-only dialogs are lazy-loaded (PRD-07): they pull in VoiceLab data (~282 lines), the bug
// reporter, and the difficulty panel, none of which are needed until the adult menu opens. Keeping
// them out of the main chunk shaves that weight off first paint. Each mounts on first open and
// stays mounted afterwards so its open/close transition still animates.
const VoiceOverridePanel = React.lazy(() => import('../voicelab/VoiceOverridePanel'))
const BugReportDialog = React.lazy(() => import('./BugReportDialog'))
const DifficultyPanel = React.lazy(() => import('./DifficultyPanel'))
const ThemePanel = React.lazy(() => import('./ThemePanel'))
const LoginSecurityPanel = React.lazy(() => import('./LoginSecurityPanel'))
const ProfilesPanel = React.lazy(() => import('./ProfilesPanel'))
const SyncPanel = React.lazy(() => import('./SyncPanel'))

const HOLD_MS = 2000
const ICON = 20
// Tighter than MUI's 56px default so a leading icon doesn't indent the labels into a second column
// (de-emoji PRD-01 W1: these rows used to lead with an emoji sitting inline in the text).
const iconSlot = { minWidth: 32, color: 'inherit' } as const

type AdultView = null | 'menu' | 'report' | 'voice' | 'difficulty' | 'theme' | 'login' | 'profiles' | 'sync' | 'resetConfirm' | 'resetDone'

interface AdultCornerProps {
  /** A newer build is live → show the hold-gated "Opdater app" item in the menu (PRD-09 P4). */
  updateAvailable?: boolean
  /** Apply the update (hard reload). Only reachable from inside the adult menu, so it's gated by
   *  the same ~2s hold that opens the menu — a child can't trigger it. */
  onApplyUpdate?: () => void
}

const AdultCorner: React.FC<AdultCornerProps> = ({ updateAvailable = false, onApplyUpdate }) => {
  const progress = useProgress()
  const auth = useAuthContext()
  const account = useProfiles()
  // Named in the reset confirmation. `undefined` for an unnamed child (the name is optional), in which
  // case the copy falls back to the generic wording rather than saying "for undefined".
  const activeChild = account.profiles.find((p) => p.id === account.activeProfileId)?.name
  const [view, setView] = useState<AdultView>(null)
  // Which lazy dialogs have been opened at least once — once true they stay mounted so their
  // open/close transitions animate (and their chunk only loads on first open).
  const [mounted, setMounted] = useState<{ report?: boolean; voice?: boolean; difficulty?: boolean; theme?: boolean; login?: boolean; profiles?: boolean; sync?: boolean }>({})
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
    // Opening the menu now costs a PIN (or Face ID), which replaces the per-action Danish-number-word
    // gate entirely (D4). Verified LOCALLY, so it still works on a plane. Unlocked ~5 min afterwards.
    if (auth) {
      const ok = await auth.requirePin('adultMenu')
      if (!ok) {
        setScreenshot(null)
        return
      }
    }
    setView('menu')
  }

  const startHold = () => {
    if (auth?.authUiOpen) return // see handleClick: the gesture is inert over any auth surface
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
    // An auth surface is open (lock screen, PIN pad, PIN setup): the gesture is INERT, so a PIN
    // screen can never be captured into a bug report at all (§8.1 layer a).
    if (auth?.authUiOpen) return
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
          // Always bottom-right now (PRD-09 P4): the update pill is bottom-CENTRE, so the gear no
          // longer has to dodge left onto the mascot when an update is available.
          right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
          zIndex: 1001, // above the UpdateBanner pill (1000), below modals
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
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lock size={ICON} aria-hidden />
          Til de voksne
        </DialogTitle>
        <DialogContent sx={{ pb: 0.5 }}>
          <List sx={{ py: 0 }}>
            {updateAvailable && onApplyUpdate && (
              <ListItemButton
                aria-label="Opdater app"
                onClick={() => { closeAll(); onApplyUpdate() }}
                sx={{
                  borderRadius: 1,
                  minHeight: 48,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  mb: 0.5,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <ListItemIcon sx={iconSlot}><ArrowUp size={ICON} aria-hidden /></ListItemIcon>
                <ListItemText primary="Opdater app (ny version klar)" />
              </ListItemButton>
            )}
            <ListItemButton
              aria-label="Rapportér et problem"
              onClick={() => { setMounted((m) => ({ ...m, report: true })); setView('report') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Bug size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Rapportér et problem" />
            </ListItemButton>
            <ListItemButton
              aria-label="Stemme-test"
              onClick={() => { setMounted((m) => ({ ...m, voice: true })); setView('voice') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Mic size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Stemme-test" />
            </ListItemButton>
            <ListItemButton
              aria-label="Sværhedsgrad"
              onClick={() => { setMounted((m) => ({ ...m, difficulty: true })); setView('difficulty') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><SlidersHorizontal size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Sværhedsgrad" />
            </ListItemButton>
            <ListItemButton
              aria-label="Tema"
              onClick={() => { setMounted((m) => ({ ...m, theme: true })); setView('theme') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Palette size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Tema" />
            </ListItemButton>
            <ListItem sx={{ minHeight: 48 }}>
              <ListItemIcon sx={iconSlot}>
                {progress.state.settings.sfxEnabled ? <Volume2 size={ICON} aria-hidden /> : <VolumeX size={ICON} aria-hidden />}
              </ListItemIcon>
              <ListItemText primary="Lydeffekter" />
              <Switch
                checked={progress.state.settings.sfxEnabled}
                onChange={(_, v) => progress.setSetting('sfxEnabled', v)}
                slotProps={{ input: { 'aria-label': 'Lydeffekter til/fra' } }}
              />
            </ListItem>
            <ListItem sx={{ minHeight: 48 }}>
              <ListItemIcon sx={iconSlot}><Music size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Musik" />
              <Switch
                checked={progress.state.settings.musicEnabled}
                onChange={(_, v) => progress.setSetting('musicEnabled', v)}
                slotProps={{ input: { 'aria-label': 'Musik til/fra' } }}
              />
            </ListItem>
            <ListItemButton
              aria-label="Profiler"
              onClick={() => { setMounted((m) => ({ ...m, profiles: true })); setView('profiles') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Users size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Profiler" />
            </ListItemButton>
            {/* Deliberately NOT PIN-gated here: clearing the selection only brings up the picker, and
                picking a child at that point is exactly what a child is allowed to do. Switching from
                INSIDE Profiler (i.e. while already playing as someone) IS gated. */}
            <ListItemButton
              aria-label="Skift barn"
              onClick={() => { closeAll(); profileStore.clearSelection() }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Repeat size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Skift barn" />
            </ListItemButton>
            <ListItemButton
              aria-label="Synkronisering"
              onClick={() => { setMounted((m) => ({ ...m, sync: true })); setView('sync') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><Cloud size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Synkronisering" />
            </ListItemButton>
            <ListItemButton
              aria-label="Login og sikkerhed"
              onClick={() => { setMounted((m) => ({ ...m, login: true })); setView('login') }}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><KeyRound size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Login og sikkerhed" />
            </ListItemButton>
            <ListItemButton
              aria-label="Nulstil al fremgang"
              onClick={() => setView('resetConfirm')}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={iconSlot}><RotateCcw size={ICON} aria-hidden /></ListItemIcon>
              <ListItemText primary="Nulstil al fremgang" />
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

      <React.Suspense fallback={null}>
        {mounted.report && (
          <BugReportDialog open={view === 'report'} screenshot={screenshot} onClose={() => setView('menu')} />
        )}
        {mounted.voice && (
          <VoiceOverridePanel open={view === 'voice'} onClose={() => setView('menu')} />
        )}
        {mounted.difficulty && (
          <DifficultyPanel open={view === 'difficulty'} onClose={() => setView('menu')} />
        )}
        {mounted.theme && (
          <ThemePanel open={view === 'theme'} onClose={() => setView('menu')} />
        )}
        {mounted.login && (
          <LoginSecurityPanel open={view === 'login'} onClose={() => setView('menu')} />
        )}
        {mounted.profiles && (
          <ProfilesPanel open={view === 'profiles'} onClose={() => setView('menu')} />
        )}
        {mounted.sync && (
          <SyncPanel open={view === 'sync'} onClose={() => setView('menu')} />
        )}
      </React.Suspense>

      {/* Second confirmation. The PIN was already proven to OPEN the menu, so this is the "are you
          sure" — but it is still routed through requirePin('resetProgress'), which re-asks if the
          ~5-minute unlocked window has lapsed. */}
      <Dialog open={view === 'resetConfirm'} onClose={() => setView('menu')} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <RotateCcw size={ICON} aria-hidden />
          {/* PRODUCT CHANGE (accounts PRD §5.6): reset is now PER CHILD, so the copy must NAME the
              child or a parent will nuke the wrong kid's book. */}
          {activeChild ? `Nulstil fremgang for ${activeChild}?` : 'Nulstil fremgang?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Dette nulstiller <strong>alle</strong> {activeChild ? `${activeChild}s ` : ''}klistermærker,
            rekorder og stjerner. Andre børn røres ikke. Lyd, musik og sværhedsgrad beholdes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView('menu')} aria-label="Annullér">Annullér</Button>
          <Button
            variant="contained"
            color="error"
            aria-label="Nulstil"
            onClick={async () => {
              if (auth) {
                const ok = await auth.requirePin('resetProgress')
                if (!ok) return
              }
              progress.resetAll()
              setView('resetDone')
            }}
          >
            Nulstil
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={view === 'resetDone'} onClose={closeAll} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography component="div" sx={{ color: 'success.main', mb: 1, lineHeight: 0 }}>
            <CircleCheck size={40} aria-hidden />
          </Typography>
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
