// "Til de voksne" — the whole settings surface (Settings PRD-01).
//
// WHAT REPLACED WHAT: 13 flat, undifferentiated rows in a scrolling `maxWidth="xs"` dialog became a
// two-pane split — a persistent left rail of five mutually-exclusive groups (Barn / Læring / Lyd /
// Udseende / Konto) plus a support footer that is reachable from every pane. On a phone the rail IS
// the root list and a group pushes its pane.
//
// THE NAVIGATION GRAMMAR (§6), which is the point of the rework:
//   1. ONE "Luk", top-right, closes everything. No other control in the adult area uses that word.
//   2. Regular width has NO back arrow — the rail is the way back.
//   3. Compact width has exactly one back arrow per pushed pane, titled with the rail label.
//   4. The only stacked modals are nested TASK dialogs (bug report, create profile, PIN setup, the
//      destructive confirms), each with two buttons: Annullér leading + the action trailing.
//   5. Max depth 3: settings → one nested dialog → PIN pad. It used to be 5.
//
// The dialog stays at MUI's default modal z-index (1300), so `AUTH_Z.pin` (10003) still stacks a PIN
// pad above it — verified with `elementFromPoint`, not a screenshot.

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
} from '@mui/material'
import {
  ArrowUp,
  Bug,
  ChevronRight,
  GraduationCap,
  KeyRound,
  LogIn,
  Palette,
  ShieldCheck,
  Users,
  Volume2,
} from 'lucide-react'
import { ADULT_IA, type AdultGroupId } from '../../config/adultSettingsIa'
import { BUILD_INFO } from '../../config/version'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AdultThemeProvider, ADULT_FONT } from '../../theme/adultTheme'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuthContext } from '../../contexts/AuthContext'
import AdultBackHeader from './AdultBackHeader'
import BarnPane from './panes/BarnPane'
import LaeringPane from './panes/LaeringPane'
import LydPane from './panes/LydPane'
import UdseendePane from './panes/UdseendePane'
import KontoPane from './panes/KontoPane'
import PrivatlivPane from './panes/PrivatlivPane'

// The bug reporter is the one nested dialog that is genuinely heavy (it pulls the whole reporter
// service graph), so it stays lazy inside this already-lazy chunk.
const BugReportDialog = React.lazy(() => import('./BugReportDialog'))

const RAIL_W = 200
const ICON = 19

const RAIL_ICON: Record<AdultGroupId, React.ReactNode> = {
  barn: <Users size={ICON} aria-hidden />,
  laering: <GraduationCap size={ICON} aria-hidden />,
  lyd: <Volume2 size={ICON} aria-hidden />,
  udseende: <Palette size={ICON} aria-hidden />,
  konto: <KeyRound size={ICON} aria-hidden />,
  privatliv: <ShieldCheck size={ICON} aria-hidden />,
}

/**
 * The pane the adult was last on. MODULE-level on purpose — HIG: "people often adjust related
 * settings more than once", and re-opening onto Barn every time punishes exactly that. Deliberately
 * NOT persisted to storage: it is a within-session convenience, not a preference.
 */
let lastPane: AdultGroupId = 'barn'

export interface AdultSettingsProps {
  open: boolean
  onClose: () => void
  /** JPEG data URL captured BEFORE this surface rendered — the bug report's picture of the moment. */
  screenshot: string | null
  updateAvailable?: boolean
  onApplyUpdate?: () => void
}

const AdultSettings: React.FC<AdultSettingsProps> = ({
  open,
  onClose,
  screenshot,
  updateAvailable = false,
  onApplyUpdate,
}) => {
  // PHONE_* are height/width based, not MUI breakpoints, so a portrait iPad (768 wide) is NOT a phone
  // and keeps the split. Below `md` there simply isn't room for a 200px rail plus a usable detail
  // pane, so that falls to single-pane too. (MUI's useMediaQuery strips a leading `@media`.)
  const phone = useMediaQuery(PHONE_ANY)
  const narrow = useMediaQuery('(max-width: 767.95px)')
  const compact = phone || narrow

  const [pane, setPane] = useState<AdultGroupId>(lastPane)
  /** Compact only: is a pane pushed over the root list? */
  const [pushed, setPushed] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportMounted, setReportMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const account = useProfiles()
  const activeChild = account.profiles.find((p) => p.id === account.activeProfileId)?.name
  const auth = useAuthContext()
  /** Playing with no account at all — the only state in which signing in is something to offer. */
  const guest = auth?.phase === 'guest'

  // Restore the last pane on each open. On compact that means opening straight onto it, with the
  // back arrow as the way out to the root list.
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setPane(lastPane)
    setPushed(compact)
    setCopied(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const select = useCallback(
    (id: AdultGroupId) => {
      lastPane = id
      setPane(id)
      setPushed(true)
    },
    [],
  )

  const openReport = useCallback(() => {
    setReportMounted(true)
    setReporting(true)
  }, [])

  const versionLine = useMemo(() => {
    const d = new Date(BUILD_INFO.buildTime)
    const date = d.toLocaleDateString('da-DK', { year: 'numeric', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `v${BUILD_INFO.version} · ${BUILD_INFO.commitHash} · ${date} ${time}`
  }, [])

  // Tap-to-copy: the whole line gets read aloud over the phone during support, so the short display
  // form is not what should land on the clipboard.
  const copyVersion = useCallback(() => {
    navigator.clipboard
      ?.writeText(versionLine)
      .then(() => {
        setCopied(true)
        if (copyTimer.current) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }, [versionLine])

  const group = ADULT_IA.find((g) => g.id === pane)!
  const showRail = !compact || !pushed
  const showDetail = !compact || pushed

  const paneBody =
    pane === 'barn' ? (
      <BarnPane closeAll={onClose} />
    ) : pane === 'laering' ? (
      <LaeringPane childName={activeChild} />
    ) : pane === 'lyd' ? (
      <LydPane />
    ) : pane === 'udseende' ? (
      <UdseendePane childName={activeChild} />
    ) : pane === 'privatliv' ? (
      <PrivatlivPane closeAll={onClose} />
    ) : (
      <KontoPane closeAll={onClose} />
    )

  return (
    <AdultThemeProvider>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={compact}
        aria-label="Til de voksne"
        slotProps={{
          paper: {
            // A stable hook for the screenshot/measure probes; MUI's slot typing has no index
            // signature, so the data attribute needs the same escape hatch the auth dialogs use.
            ...({ 'data-adult-settings': true } as Record<string, unknown>),
            sx: {
              // buildTheme applies Comic Sans via MuiCssBaseline.body, and a nested ThemeProvider does
              // NOT re-apply CssBaseline — so raw text in a plain <Box> would still inherit it.
              fontFamily: ADULT_FONT,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: compact ? '100%' : 'min(640px, calc(100vh - 64px))',
              maxHeight: compact ? '100%' : 'calc(100vh - 64px)',
            },
          },
        }}
      >
        {/* ---- The ONE header: the single "Luk", plus a back arrow only when a pane is pushed ---- */}
        <AdultBackHeader
          title={compact && pushed ? group.label : 'Til de voksne'}
          onBack={compact && pushed ? () => setPushed(false) : undefined}
          action={
            <Button onClick={onClose} aria-label="Luk">
              Luk
            </Button>
          }
        />

        {/* ---- Apply-update: app-wide, so it spans the whole surface above the split (§3) ---- */}
        {updateAvailable && onApplyUpdate && (
          <ButtonBase
            aria-label="Opdater app"
            onClick={() => {
              onClose()
              onApplyUpdate()
            }}
            sx={{
              flex: '0 0 auto',
              width: '100%',
              minHeight: 44,
              px: 2,
              gap: 1,
              justifyContent: 'flex-start',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <ArrowUp size={18} aria-hidden />
            En ny version er klar — tryk for at opdatere
          </ButtonBase>
        )}

        {/* ---- rail | detail ---- */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {showRail && (
            <Box
              component="nav"
              aria-label="Indstillinger"
              sx={{
                flex: compact ? 1 : '0 0 auto',
                width: compact ? '100%' : RAIL_W,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: compact ? 'none' : '1px solid',
                borderColor: 'divider',
                bgcolor: compact ? 'transparent' : 'background.default',
              }}
            >
              {/* ---- Sign-in offer, guest only. Deliberately INSIDE the rail column rather than
                      above the split like the apply-update strip: that strip spans every pane, so it
                      would follow an adult who came in for the sound settings all the way into Lyd.
                      Here it costs ~60px of fixed height on the landing, and on compact — where the
                      rail IS the root list — it disappears the moment a pane pushes over it.
                      Bordered and unfilled on purpose: `primary.main` is the alert register and this
                      is an offer, not an alert. ---- */}
              {guest && (
                <Box sx={{ flex: '0 0 auto', px: 0.75, pt: 0.75 }}>
                  <ButtonBase
                    aria-label="Log ind"
                    data-guest-signin-promo
                    onClick={() => select('konto')}
                    sx={{
                      width: '100%',
                      minHeight: 44,
                      px: 1,
                      py: 0.75,
                      gap: 1,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <LogIn size={17} aria-hidden />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }}>Log ind</Typography>
                      {/* Deliberately NOT noWrap: the rail is 200px and the three benefits are the
                          whole reason the row exists — an ellipsis after "flere enheder" throws away
                          the half that answers "why would I?". Wrapping costs ~14px of fixed height. */}
                      <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.3, color: 'text.secondary' }}>
                        Flere børn, flere enheder, mikrofonspil
                      </Typography>
                    </Box>
                  </ButtonBase>
                </Box>
              )}

              <List sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0.75, px: 0.75 }}>
                {ADULT_IA.map((g) => (
                  <ListItemButton
                    key={g.id}
                    aria-label={g.label}
                    data-rail-item={g.id}
                    // Persistent highlight is what keeps people oriented across panes (HIG). On
                    // compact there is no "current" row — the pane is pushed over this list.
                    selected={!compact && g.id === pane}
                    onClick={() => select(g.id)}
                    sx={{ minHeight: 44, mb: 0.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>{RAIL_ICON[g.id]}</ListItemIcon>
                    <ListItemText
                      primary={g.label}
                      // Konto's subtitle makes the destination legible from the landing: the promo row
                      // above says "log ind", this says where that lives.
                      secondary={
                        g.id === 'barn'
                          ? activeChild
                          : g.id === 'konto' && guest
                            ? 'Ikke logget ind'
                            : undefined
                      }
                      slotProps={{
                        primary: { sx: { fontSize: '0.95rem', fontWeight: 600 } },
                        secondary: { noWrap: true, sx: { fontSize: '0.78rem' } },
                      }}
                    />
                    {compact && <ChevronRight size={18} aria-hidden />}
                  </ListItemButton>
                ))}
              </List>

              {/* ---- Support footer: reachable from EVERY pane, because support belongs at the
                      moment something looks wrong, not one tap away (§3). ---- */}
              <Divider />
              <Box sx={{ flex: '0 0 auto', px: 0.75, py: 0.75 }}>
                <ListItemButton
                  aria-label="Rapportér et problem"
                  onClick={openReport}
                  sx={{ minHeight: 44, px: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
                    <Bug size={17} aria-hidden />
                  </ListItemIcon>
                  <ListItemText
                    primary="Rapportér et problem"
                    slotProps={{ primary: { noWrap: true, sx: { fontSize: '0.82rem' } } }}
                  />
                </ListItemButton>
                <ButtonBase
                  onClick={copyVersion}
                  aria-label="Kopiér version og bygge-id"
                  sx={{
                    mt: 0.25,
                    width: '100%',
                    minHeight: 44, // the accessibility floor applies to the version chip too
                    justifyContent: 'flex-start',
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  {copied ? 'Kopieret!' : `v${BUILD_INFO.version} · ${BUILD_INFO.commitHash}`}
                </ButtonBase>
              </Box>
            </Box>
          )}

          {showDetail && (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                // The DETAIL may scroll internally; the dialog itself never exceeds the viewport.
                overflowY: 'auto',
                px: 2.5,
                py: 2,
                [PHONE_ANY]: { px: 1.75, py: 1.25 },
              }}
            >
              {/* On compact the title lives in the surface header, next to the back arrow — Material:
                  the pushed pane's title must match the rail label that opened it, exactly. */}
              {!compact && (
                <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.15rem', mb: 1.5 }}>
                  {group.label}
                </Typography>
              )}
              {paneBody}
            </Box>
          )}
        </Box>
      </Dialog>

      {/* Nested TASK dialog — the only kind of stacked modal the adult area allows. */}
      <React.Suspense fallback={null}>
        {reportMounted && (
          <BugReportDialog open={reporting} screenshot={screenshot} onClose={() => setReporting(false)} />
        )}
      </React.Suspense>
    </AdultThemeProvider>
  )
}

export default AdultSettings
