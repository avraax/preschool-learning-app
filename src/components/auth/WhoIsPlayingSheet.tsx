import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, Portal, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { ChevronRight } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuthContext } from '../../contexts/AuthContext'
import { avatarArt } from '../../assets/avatars'
import { normalizeAvatarId } from '../../config/avatars'
import { adultSurfaceBus } from '../../services/adultSurfaceBus'
import { musicClient } from '../../services/musicClient'
import { warmScreenshot } from '../../services/screenshotService'
import { captureExcludeProps } from '../../services/captureExclude'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AUTH_Z } from './authOverlayZ'
import ProfilePicker from './ProfilePicker'

// "Hvem spiller?", reopened mid-session from the profile chip (Corner identity PRD-01 §2.6).
//
// This is Khan Academy Kids' model adapted to our gating: the avatar opens a USER surface, and the
// grown-ups' door is a labelled row inside it, behind the parental gate. It replaces the arrangement
// where the child's own face WAS that door — one control doing two contradictory jobs, so a
// five-year-old who tapped their own portrait met a keypad. The gate is what makes the adult area safe,
// not the disguise, and it works just as well behind a row that says what it does.
//
// FOUR THINGS, IN THIS ORDER:
//   1. The active child, large. Read-only. This is the child-safe payoff of the tap — *"that's me!"*
//   2. "Skift barn"      → `requirePin('switchProfile')` → the full-screen `ProfilePicker`.
//   3. "Indstillinger"   → the parental gate → the adult surface.
//   4. "Luk".
//
// **ROW 2 IS AN OWNER OVERRIDE OF THE PRD (2026-09-05), and the reasoning is worth keeping.** The PRD
// specified a deep link into the adult surface's roster rows instead, on the argument that *"tiles that
// look tappable but raise a keypad would be worse than no tiles"*. The owner asked for the picker
// itself — *"the fullscreen modal as shown on page load but gated by adult/account pin"* — and the
// argument does not apply to what shipped, because **the keypad comes FIRST**: nothing tappable is on
// screen until an adult has already passed the gate, so a child never meets a locked door. It is also
// not a second switching path — it is the SAME `ProfilePicker` the boot gate raises, behind the SAME
// `requirePin('switchProfile')` the adult surface's roster rows use. Nothing new implements a switch;
// **this file must never call `profileStore.selectProfile` itself** (`profileChip.test.ts` fails the
// build if it does) — the picker owns that, as it always has.
//
// `ProfilePicker` itself is untouched: its cold-start rule, its single-child straight-in and its "no
// create affordance" rule are out of scope. It is rendered here with `onCancel`, which is exactly the
// prop it already documents as "an adult opened this deliberately, so they can back out".
//
// **IT IS A BLOCKING OVERLAY, so it takes the flags the picker takes** (§4.4): `setAuthUiOpen` while
// open, or the audio-permission cue paints over it; `musicClient.setGateBlocking('sheet', …)`, or the
// bed keeps playing under a modal. One blocking overlay at a time — which is also why the sheet stands
// ITSELF down while the picker is up rather than stacking behind it.
//
// **ONLY A `click` HANDLER MAY CLOSE IT.** The "Start lyd nu" tap-through incident (0ec1df3): a
// `pointerdown` close fires before the overlay is gone, so the same gesture presses whatever is behind
// it — a child tapping "Luk" pressed the game board underneath. Every control here is `onClick`;
// `onPointerDown` may only WARM.

export interface WhoIsPlayingSheetProps {
  open: boolean
  onClose: () => void
}

const WhoIsPlayingSheet: React.FC<WhoIsPlayingSheetProps> = ({ open, onClose }) => {
  const theme = useTheme()
  const auth = useAuthContext()
  const { profiles, activeProfileId } = useProfiles()
  const profile = profiles.find((p) => p.id === activeProfileId) ?? null

  /**
   * Is there anything to switch TO? Same `> 1` threshold as `profileGateSurface`'s boot picker, so a
   * household that never meets "Hvem spiller?" on launch is never offered it mid-session either.
   */
  const canSwitchChild = profiles.length > 1

  /** The gate has been passed and the full-screen picker is up. */
  const [picking, setPicking] = useState(false)
  /** Re-entrancy guard: `requirePin` is async, so a second tap would raise a second pad. */
  const asking = useRef(false)

  /**
   * True while this component owns the screen — either surface counts. The flags below follow THIS,
   * not `open`, or handing over to the picker would drop them for the frames in between and let the
   * music bed restart under a modal.
   */
  const blocking = open || picking

  /**
   * Set when a row wants the ADULT SURFACE, held until this sheet is actually down.
   *
   * `AdultSurface` refuses to open while `authUiOpen` is true (deliberately, on the surface side of the
   * bus, so no trigger can forget it — see `.claude/rules/adult-surface.md`). This sheet sets that same
   * flag while it is up, so calling the bus straight from a row handler would be swallowed: the flag is
   * React state and is still true in the tick the handler runs. Waiting for the flag to actually go
   * DOWN — rather than for a timer — is what makes the hand-off deterministic.
   */
  const [handingOff, setHandingOff] = useState(false)

  useEffect(() => {
    if (!blocking) return
    auth?.setAuthUiOpen(true)
    return () => auth?.setAuthUiOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking])

  useEffect(() => {
    musicClient.setGateBlocking('sheet', blocking)
  }, [blocking])

  useEffect(() => {
    if (!handingOff || blocking || auth?.authUiOpen) return
    adultSurfaceBus.open()
    setHandingOff(false)
  }, [handingOff, blocking, auth?.authUiOpen])

  /** Close first, hand off after — see `handingOff`. */
  const openSettings = useCallback(() => {
    setHandingOff(true)
    onClose()
  }, [onClose])

  /**
   * THE GATE COMES FIRST, AND IT IS `force`d. `requirePin('switchProfile')` is the same reason id the
   * adult surface's roster rows use, verified LOCALLY (`config/pinReasons.ts`: progress is
   * localStorage, so local authority is the right blast radius) — and a guest meets the arithmetic
   * gate instead. The picker only mounts on `true`; a cancelled pad leaves the sheet as it was.
   *
   * **`force: true` is what makes this actually gated** (owner, 2026-09-05: *"when clicking Skift barn
   * it need the pin gate"* — it was opening the picker with no challenge). `requirePin` normally
   * short-circuits inside the ~5-minute adult unlock window, which is right in the settings surface
   * (the adult just proved themselves to get there, and HIG says not to re-ask per adjustment) and
   * wrong here: this row is ONE TAP from the child's own name pill on home, so for five minutes after
   * any adult action the child could switch to a sibling's book unchallenged. The consequence lands on
   * the CHILD — playing into the wrong book, silently — which is precisely what the gate exists for.
   * The verifier is unchanged, so it still works offline.
   */
  const switchChild = useCallback(async () => {
    if (asking.current) return
    asking.current = true
    try {
      // `!auth` is the dev/probe path (no provider); the gate cannot be skipped in the app.
      const ok = auth ? await auth.requirePin('switchProfile', { force: true }) : true
      if (!ok) return
      setPicking(true)
    } finally {
      asking.current = false
    }
  }, [auth])

  const name = profile?.name?.trim() ?? ''
  const accent = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main

  return (
    <>
      <Dialog
        // Stood down while the picker is up: one blocking overlay at a time, the app's own rule. The
        // picker sits at AUTH_Z.profilePicker (10 000) and would render over this anyway — closing it
        // is what keeps the DOM honest about which surface is being asked to answer.
        open={open && !picking}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        aria-label="Hvem spiller?"
        // A bug report captures the screen BEHIND whatever opened over it. This sheet closes before the
        // adult surface opens, so it should never be up during a capture — but its close transition and
        // the capture's 320ms delay are close enough together that "should never" is not a guarantee.
        // The marker goes on the Dialog ROOT: MUI's backdrop is a sibling of the paper, so marking the
        // paper alone leaves a grey slab over the whole shot.
        {...captureExcludeProps}
        // MUI's own default, named rather than written — see `AUTH_Z.whoIsPlayingSheet` for why this
        // one is deliberately NOT in the blocking stack.
        sx={{ zIndex: AUTH_Z.whoIsPlayingSheet }}
        slotProps={{ paper: { sx: { borderRadius: 4, p: 1, [PHONE_ANY]: { p: 0.5 } } } }}
      >
        <Box sx={{ p: 3, [PHONE_ANY]: { p: 2 } }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: theme.titleFontFamily,
              fontWeight: 700,
              fontSize: '1.35rem',
              textAlign: 'center',
              mb: 2.5,
              [PHONE_ANY]: { fontSize: '1.15rem', mb: 1.5 },
            }}
          >
            Hvem spiller?
          </Typography>

          {/* 1. THE CHILD, LARGE AND READ-ONLY. Not a button, not `aria-pressed`, nothing to press —
              the payoff of the tap is recognition, and a child-tappable control here would be a
              switch in front of the gate. The portrait resolves unconditionally (avatars.test.ts
              guarantees it); never add a `??` beside `avatarArt`. */}
          {profile && (
            <Stack spacing={1.25} sx={{ alignItems: 'center', mb: 3, [PHONE_ANY]: { mb: 2 } }}>
              <Box
                sx={{
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: alpha(accent, 0.08),
                  border: `3px solid ${accent}`,
                  [PHONE_ANY]: { width: 84, height: 84 },
                }}
              >
                <Box
                  component="img"
                  src={avatarArt(normalizeAvatarId(profile.avatarId))}
                  alt=""
                  draggable={false}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                />
              </Box>
              {name && (
                <Typography
                  sx={{
                    fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    [PHONE_ANY]: { fontSize: '1.15rem' },
                  }}
                >
                  {name}
                </Typography>
              )}
            </Stack>
          )}

          {/* 2 + 3. THE TWO ADULT ROWS. Both are gated: row 2 by `requirePin('switchProfile')` here,
              row 3 by `AdultSurface`'s own `requirePin('adultMenu')` (or the guest arithmetic gate).
              This sheet adds no gate of its own and implements neither.
              `warmScreenshot` on pointer-down resolves the snapdom chunk while the finger is still
              down, exactly as the old avatar door did — it is what keeps the capture off the dialog's
              enter transition. Pointer-down WARMS; only the click acts. */}
          <Stack spacing={1}>
            {/* "Skift barn" IS ABSENT AT ONE CHILD (owner, 2026-09-06). With a single profile the row
                cost a parental gate and then raised a ONE-TILE picker whose only tile re-selected the
                child already playing — a dead end dressed as a choice. Børn picker PRD-01 §4.3 already
                ruled that shape out ("deleting down to ONE child must not leave a one-tile picker");
                this sheet reintroduced it through a different door, which is why the ban is on the
                SHAPE and not on `deleteProfile`. `> 1` is the same threshold `profileGateSurface` uses
                to decide whether the boot picker appears at all, so the two agree by construction:
                if booting would not ask who is playing, nothing mid-session offers to change it. */}
            {canSwitchChild && (
              <AdultRow label="Skift barn" hint="Vælg et andet barn" onActivate={() => void switchChild()} />
            )}
            <AdultRow
              // Renamed from "Til de voksne" (owner, 2026-09-05: the adult area is called
              // **Indstillinger** everywhere now). THE SELECTOR MOVED WITH IT: every `ui-screenshot`
              // recipe and `sweep.mjs` clicks `[aria-label="Indstillinger"]`, so this string and those
              // must never drift. `profileChip.test.ts` asserts it appears exactly once as a trigger.
              label="Indstillinger"
              hint="Lyd, sværhedsgrad, konto"
              onActivate={openSettings}
            />
          </Stack>

          {/* 4. Luk. One word for closing, app-wide. */}
          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center', [PHONE_ANY]: { mt: 1.5 } }}>
            <Button onClick={onClose} sx={{ textTransform: 'none', minHeight: 44, px: 3 }}>
              Luk
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* THE PICKER, behind the gate. The same component the boot `ProfileGate` raises, with the same
          full-screen treatment the owner recognised — "the fullscreen modal as shown on page load".
          Cancelling closes the whole sheet rather than dropping back to it: the adult came here to
          switch, and returning them to the screen they just left reads as a failure. */}
      {/* PORTALLED TO `document.body`, and that is load-bearing, not tidiness.
          `ProfilePicker` is a `position: fixed` box at `AUTH_Z.profilePicker` (10 000), which is
          correct where `ProfileGate` mounts it — high in the tree, outside every page. Rendered from
          HERE it is a descendant of the chip, i.e. of the page's own chrome, and its ancestors create
          STACKING CONTEXTS: measured `z=10000` inside `z=2` inside `z=3` inside `z=1`, so the 10 000 is
          resolved relative to that `z=2` subtree and the whole app paints over it. The picker rendered
          BEHIND the home screen — `elementFromPoint` at its centre returned an `<img>` from the world,
          not a tile — which is a live, interactive, invisible surface: the exact failure
          `authOverlayZ.ts` was written for, in a new shape (a z-index that is high enough and still
          loses, rather than one that is missing). A portal puts it back in the root stacking context,
          where its z-index means what it says.
          Do not "simplify" this away, and do not chase it with a bigger number. */}
      {picking && (
        <Portal>
        <ProfilePicker
          profiles={profiles}
          activeProfileId={activeProfileId}
          onCancel={() => {
            setPicking(false)
            onClose()
          }}
          // Not `activeProfileId` watching: re-picking the child who is ALREADY active is a no-op in
          // the store, so a state watcher would leave the picker up forever on a perfectly reasonable
          // tap. See the prop's own doc in ProfilePicker.
          onPicked={() => {
            setPicking(false)
            onClose()
          }}
        />
        </Portal>
      )}
    </>
  )
}

/** A labelled adult route: title + outcome hint + a chevron. 44px minimum, like every touch target. */
const AdultRow: React.FC<{
  label: string
  hint: string
  onActivate: () => void
}> = ({ label, hint, onActivate }) => {
  const theme = useTheme()
  return (
    <Box
      role="button"
      tabIndex={0}
      // The accessible name of a control is its action, and here the visible label IS the action, so
      // the two are the same string by construction rather than by discipline.
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      onPointerDown={warmScreenshot}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 56,
        px: 2,
        py: 1.25,
        borderRadius: 3,
        cursor: 'pointer',
        border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
        bgcolor: alpha(theme.palette.text.primary, 0.03),
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.06) },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.8rem', opacity: 0.7 }}>{hint}</Typography>
      </Box>
      <ChevronRight size={20} aria-hidden />
    </Box>
  )
}

export default WhoIsPlayingSheet
