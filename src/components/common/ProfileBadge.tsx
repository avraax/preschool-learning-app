import React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useProfiles } from '../../hooks/useProfiles'
import { avatarArt } from '../../assets/avatars'
import { normalizeAvatarId } from '../../config/avatars'
import { profileInitial } from '../../config/profileInitial'
import { onTileColor } from '../../theme/tokens/helpers'
import { adultSurfaceBus } from '../../services/adultSurfaceBus'
import { warmScreenshot } from '../../services/screenshotService'

// WHO IS PLAYING — the child-facing half of the profile system (owner, 2026-08-09).
//
// Until now the active child was visible ONLY behind "Til de voksne" (BarnPane) and on the boot
// ProfilePicker, so a two-child household could play a whole session as the wrong child and find out
// from the adult pane. This is the always-present cue: the child's own baked animal portrait, in the
// top-right beside the reward ring, on home, every section menu, Min Bog and every game.
//
// **It is a PICTURE first.** Khan Academy Kids and Netflix Kids both put the active profile as an
// avatar in the child home's top-right corner, and both make identity pictorial rather than textual for
// the same reason we do: 3-5-year-olds are pre-readers and 6-8 reading is "tentative" (NN/g). The
// portrait was already chosen at profile creation and already carried on every `ChildProfile`, so this
// costs no art. The first LETTER rides along as a second cue because the owner's 5-year-old knows all
// 29 of them — but it is secondary, and its absence is a supported state (see `profileInitial`).
//
// **IT IS NOT A METER, AND IT MUST NEVER BECOME ONE.** The in-game header used to hold a second
// progress readout (`ScoreChip`) inches from the ring, with nothing on screen to say one counted the
// round and the other the whole book; the owner deleted it, and the rule became "the header holds the
// reward ring and nothing else". That rule is now narrowed — deliberately, in the open — to "nothing
// that measures PERFORMANCE", because a static identity disc measures nothing. What keeps that honest
// is mechanical: `profileBadge.test.ts` fails the build if this file ever imports `useProgress`,
// `progressStore`, `rewardNumber`, `xpBus` or `xpProgress`. Don't reach for them; add nothing that
// fills, counts or animates.
//
// **IT IS THE DOOR TO "TIL DE VOKSNE", AND THE FLOATING GEAR IS DELETED** (owner, 2026-08-09 —
// reversing this file's own first decision, which was "pure indicator, never tappable"). Tapping it is
// identical to tapping the old gear: PIN (or the guest arithmetic gate) → the lazy `AdultSettings`.
// Khan Academy Kids does the same thing. It is safe for the same reason the gear was: the gate is the
// child-resistant part, not the trigger, so a 5-year-old who taps their own face meets a keypad.
//
// Two things this must keep:
//   - **`aria-label` is EXACTLY "Til de voksne".** Every `ui-screenshot` recipe and `sweep.mjs` clicks
//     `[aria-label="Til de voksne"]`; that selector moved here with the door. The child's name rides
//     on `title`, not on the label — the accessible name of a CONTROL is its action.
//   - **It still must not route to `/album`.** The ring is the only door to Min Bog and
//     `rewardSurfaces.test.ts` asserts exactly one per surface. Two adjacent same-size discs now go to
//     two different places; that is the accepted cost, and it is why the two are hit-tested separately.
//
// `pointerEvents: 'none'` is GONE with that decision. It used to be load-bearing (a near-miss had to
// fall through to whatever was behind an inert disc); now the disc is the target.
//
// **Sized at PARITY with the ring at every call site** (owner, 2026-08-09, over a recommendation of
// ~72%). Pass the same `size` the neighbouring `RewardRing` gets, including its phone-landscape value.
//
// The two badges are visually INVERSE so the pair can never read as two meters: the ring's count is a
// filled accent disc with a white numeral, seated bottom-CENTRE in the gauge's gap; this one is an
// opaque white disc with an accent letter, seated bottom-RIGHT on the portrait's rim, where the ring
// has nothing.

interface ProfileBadgeProps {
  /** Match the neighbouring RewardRing's `size` exactly — including its phone-landscape value. */
  size: number
  sx?: SxProps<Theme>
}

const ProfileBadge: React.FC<ProfileBadgeProps> = ({ size, sx = {} }) => {
  const theme = useTheme()
  const { profiles, activeProfileId } = useProfiles()
  const profile = profiles.find((p) => p.id === activeProfileId) ?? null

  // Nothing attached (detached, or `status: 'choosing'` mid-boot) → render NOTHING. No placeholder and
  // no skeleton: the gate is blocking play in that state anyway, and a grey disc that resolves into a
  // face one frame later is a flicker in the corner of every cold launch.
  if (!profile) return null

  // The portrait ALWAYS resolves and there is no glyph path — `normalizeAvatarId` coerces an unknown id
  // (a roster cached by an older client) to the default, and `avatars.test.ts` fails the build if any
  // id lacks its baked WebP. Same unconditional render as ProfilePicker and BarnPane; don't add a `??`.
  const art = avatarArt(normalizeAvatarId(profile.avatarId))
  const initial = profileInitial(profile.name)

  // The ring's own colour source, so the pair belongs to one family on every skin.
  const accent = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  // The letter sits on WHITE, so it takes the same accent-on-light treatment as every other surface
  // here — a no-op on an accent that already reads, a darkening on the pale ones (Havet, Rummet).
  const ink = onTileColor(accent)

  // Badge geometry, DERIVED — the same discipline as the ring's (`rewardRingGeometry.ts`), for the same
  // reason: a tuned corner offset is correct at exactly one diameter and this renders at five (52/48/46
  // /44 plus the 36/34 phone-landscape pair). Seat the badge's CENTRE on the box's INSCRIBED circle at
  // 45° down-right: at radius R that point is R/√2 out along each axis, which keeps the letter tucked
  // against the portrait at every size instead of drifting into the bounding box's empty corner. The
  // 16px floor is the ring badge's floor too — below it a Comic Sans capital stops being legible.
  const badge = Math.max(16, Math.round(size * 0.34))
  const seat = Math.round((size / 2) * (1 + Math.SQRT1_2) - badge / 2)

  return (
    <Box
      // Stable hook for the geometry probe: this rect must never intersect [data-reward-ring].
      data-profile-badge
      role="button"
      tabIndex={0}
      // EXACTLY the old gear's label — see the header. This is the selector the whole screenshot
      // harness clicks, and the accessible name of a control is its action, not its picture.
      aria-label="Til de voksne"
      // Who is playing goes here instead, so it is still recoverable without competing with the label.
      // `.trim()`, not a bare truthiness check: a whitespace-only name is truthy and would announce as
      // "    spiller". Same input the letter already rejects, so the two must agree.
      title={profile.name?.trim() ? `${profile.name.trim()} spiller` : undefined}
      onClick={() => adultSurfaceBus.open()}
      // Enter/Space, since this is a div playing a button.
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          adultSurfaceBus.open()
        }
      }}
      // Resolve the snapdom chunk while the finger is still down, exactly as the gear did — the
      // capture now runs behind the gate, so this is what keeps it off the dialog's enter transition.
      onPointerDown={warmScreenshot}
      sx={[
        {
          position: 'relative',
          width: size,
          height: size,
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          cursor: 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* NO DISC BEHIND THE PORTRAIT (owner, 2026-08-09: "a very dim grey circle background").
          It shipped with the picker's tile backing — `alpha(primary.main, 0.08)` plus a 20% hairline —
          which is right in a LIST on a paper surface and wrong on the painted world: over the pale sky
          the purple desaturates into a grey ring around the fox, and the reward ring 12px away has no
          backing at all (measured `rgba(0,0,0,0)`), so the pair looked like one object had a plate and
          the other didn't. The avatars are green-screened cutouts (measured alpha 0..255), so they sit
          on the world exactly like the mascot and the section objects do. The circular clip went with
          it: its only job was shaping that backing, and `objectFit: contain` puts the art's widest
          point on the box edge, so a 50% clip was a latent crop of the ears for no visible gain.
          `contain`, never `cover`. */}
      <Box
        component="img"
        src={art}
        alt=""
        draggable={false}
        sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      />

      {/* The letter. Absent when the profile has no name — that is the fallback, and it is a normal
          state, not a defect (the name field is optional). Never an em-dash, never a "?". */}
      {initial && (
        <Box
          data-profile-initial
          sx={{
            position: 'absolute',
            left: seat,
            top: seat,
            minWidth: badge,
            height: badge,
            borderRadius: '999px',
            bgcolor: '#FFFFFF',
            color: ink,
            border: `1px solid ${alpha(ink, 0.25)}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
            fontWeight: 800,
            // The ring badge's ratio, so two glyphs sitting 8px apart are the same optical size.
            fontSize: Math.round(badge * 0.62),
            lineHeight: 1,
          }}
        >
          {initial}
        </Box>
      )}
    </Box>
  )
}

export default ProfileBadge
