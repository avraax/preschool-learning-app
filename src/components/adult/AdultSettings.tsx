// "Indstillinger" — the whole settings surface (Settings PRD-01).
//
// **The surface was called "Til de voksne" until 2026-09-05**, when the owner renamed the adult area
// to `Indstillinger` app-wide. The name is the only thing that changed; every decision below is the
// same one, and `aria-label="Indstillinger"` is now THE selector the whole screenshot harness clicks.
//
// WHAT REPLACED WHAT: 13 flat, undifferentiated rows in a scrolling `maxWidth="xs"` dialog became a
// two-pane split — a persistent left rail of five mutually-exclusive groups (Konto / Læring / Lyd /
// Udseende / Privatliv) plus a support footer that is reachable from every pane. On a phone the rail
// IS the root list and a group pushes its pane.
//
// `Konto` is `Barn` + `Konto` merged (Familie IA PRD, owner 2026-09-05 — it shipped that day as
// `Familie` and was renamed back to `Konto` the same day), and the standalone `Log ind` promo row that
// used to sit above the rail went with it: a guest saw the promo row AND a `Konto — Ikke logget ind`
// rail entry, and both opened the same sign-in offer. The offer now lives once, at the top of the
// Konto pane. Do not re-add a second door.
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
  Palette,
  ShieldCheck,
  Users,
  Volume2,
} from 'lucide-react'
import { ADULT_IA, ADULT_GROUP_IDS, type AdultGroupId } from '../../config/adultSettingsIa'
import { BUILD_INFO } from '../../config/version'
import { backendHost } from '../../config/backendTarget'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AdultThemeProvider, ADULT_FONT } from '../../theme/adultTheme'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuthContext } from '../../contexts/AuthContext'
import { captureExcludeProps } from '../../services/captureExclude'
import AdultBackHeader from './AdultBackHeader'
import KontoPane from './panes/KontoPane'
import LaeringPane from './panes/LaeringPane'
import LydPane from './panes/LydPane'
import UdseendePane from './panes/UdseendePane'
import PrivatlivPane from './panes/PrivatlivPane'

// The bug reporter is the one nested dialog that is genuinely heavy (it pulls the whole reporter
// service graph), so it stays lazy inside this already-lazy chunk.
const BugReportDialog = React.lazy(() => import('./BugReportDialog'))

const RAIL_W = 200
const ICON = 19

const RAIL_ICON: Record<AdultGroupId, React.ReactNode> = {
  konto: <Users size={ICON} aria-hidden />,
  laering: <GraduationCap size={ICON} aria-hidden />,
  lyd: <Volume2 size={ICON} aria-hidden />,
  udseende: <Palette size={ICON} aria-hidden />,
  privatliv: <ShieldCheck size={ICON} aria-hidden />,
}

/** The rail's first entry, and the fallback whenever `lastPane` no longer names a real group. */
const FIRST_PANE: AdultGroupId = ADULT_GROUP_IDS[0]

/**
 * The pane the adult was last on. MODULE-level on purpose — HIG: "people often adjust related
 * settings more than once", and re-opening onto Konto every time punishes exactly that. Deliberately
 * NOT persisted to storage: it is a within-session convenience, not a preference.
 */
let lastPane: AdultGroupId = FIRST_PANE

/**
 * …and it is read back through this, because the rail's groups can change under it — `barn` and
 * `konto` were merged into one `konto` group, and a value that names no group would leave `group` undefined
 * and the detail pane blank with no error.
 */
const validPane = (id: AdultGroupId): AdultGroupId =>
  ADULT_GROUP_IDS.includes(id) ? id : FIRST_PANE

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

  const [pane, setPane] = useState<AdultGroupId>(validPane(lastPane))
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
    setPane(validPane(lastPane))
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

  // The backend this build talks to (Staging PRD W3). It rides on BOTH forms, because this chip is how
  // a PRODUCTION binary answers "which backend?" — that one has no corner badge by construction, so
  // without the host here there would be no way to ask it at all. Same value the badge prints.
  const host = backendHost()

  const versionLine = useMemo(() => {
    const d = new Date(BUILD_INFO.buildTime)
    const date = d.toLocaleDateString('da-DK', { year: 'numeric', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `v${BUILD_INFO.version} · ${BUILD_INFO.commitHash} · ${host} · ${date} ${time}`
  }, [host])

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

  const group = ADULT_IA.find((g) => g.id === pane) ?? ADULT_IA[0]
  const showRail = !compact || !pushed
  const showDetail = !compact || pushed

  const paneBody =
    pane === 'laering' ? (
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
        aria-label="Indstillinger"
        // A bug-report capture now runs behind the gate and can still be in flight when this mounts
        // (an adult who answers the challenge fast). Without the marker the report would show the
        // settings surface instead of the game being reported — the exact property the capture was
        // moved before the gate to protect in the first place.
        {...captureExcludeProps}
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
          title={compact && pushed ? group.label : 'Indstillinger'}
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
              {/* THE `Log ind` PROMO ROW USED TO SIT HERE and is deliberately gone (Familie IA PRD
                  §3.1). It duplicated the `Konto` rail entry below it — both opened the same offer —
                  and a duplicate affordance is worse than a missing one, because it makes the surface
                  look like it has two different things in it. The offer, including its
                  progress-aware sticker count, moved into the top of the Konto pane. */}

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
                      // ONE subtitle on the one merged row, and which of the two it shows is the
                      // question the adult is more likely to be answering: a guest needs to know
                      // where signing in lives now that the promo row is gone; everyone else wants
                      // to see whose settings they are about to change. This is a LABEL, not a
                      // second door — the offer itself is inside the pane.
                      secondary={
                        g.id !== 'konto' ? undefined : guest ? 'Ikke logget ind' : activeChild
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
                  {copied ? 'Kopieret!' : `v${BUILD_INFO.version} · ${BUILD_INFO.commitHash} · ${host}`}
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
