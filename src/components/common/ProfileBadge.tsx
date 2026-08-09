import React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useProfiles } from '../../hooks/useProfiles'
import { avatarArt } from '../../assets/avatars'
import { normalizeAvatarId } from '../../config/avatars'
import { profileInitial } from '../../config/profileInitial'
import { onTileColor } from '../../theme/tokens/helpers'

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
// **It is deliberately NOT tappable** (owner). Profile switching stays in the adult surface behind
// `requirePin('switchProfile')` — a 5-year-old must not be able to tap their own face and land in a
// sibling's book. `pointerEvents: 'none'` is therefore load-bearing rather than tidy: the disc sits
// ~8px from the ring, which IS a live tap target (the only door to Min Bog), so a near-miss has to fall
// through and do nothing rather than be swallowed by a control that does nothing anyway.
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

  const dark = theme.scene?.dark
  // The ring's own colour source, so the pair belongs to one family on every skin.
  const accent = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  // The letter sits on WHITE, so it takes the same accent-on-light treatment as every other surface
  // here — a no-op on an accent that already reads, a darkening on the pale ones (Havet, Rummet).
  const ink = onTileColor(accent)

  // Badge geometry, DERIVED — the same discipline as the ring's (`rewardRingGeometry.ts`), for the same
  // reason: a tuned corner offset is correct at exactly one diameter and this renders at five (52/48/46
  // /44 plus the 36/34 phone-landscape pair). Seat the badge's CENTRE on the portrait's own circle at
  // 45° down-right: on a circle of radius R that point is R/√2 out along each axis, so the disc reads as
  // attached to the rim rather than floating in the bounding box's corner. The 16px floor is the ring
  // badge's floor too — below it a Comic Sans capital stops being legible.
  const badge = Math.max(16, Math.round(size * 0.34))
  const seat = Math.round((size / 2) * (1 + Math.SQRT1_2) - badge / 2)

  return (
    <Box
      // Stable hook for the geometry probe: this rect must never intersect [data-reward-ring].
      data-profile-badge
      role="img"
      // `.trim()`, not a bare truthiness check: a whitespace-only name is truthy and announced as
      // "    spiller". Same input the letter already rejects, so the two must agree.
      aria-label={profile.name?.trim() ? `${profile.name.trim()} spiller` : 'Spiller nu'}
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
          // See the header: the ring is 8px away and it navigates. A near-miss must reach what is
          // BEHIND this disc, not be eaten by an indicator that does nothing.
          pointerEvents: 'none',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Same backing as the picker's tile, plus a hairline so a light portrait still reads as a
          // disc on a light world and a dark one still has an edge on a dark world.
          background: dark ? 'rgba(255,255,255,0.10)' : alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${dark ? 'rgba(255,255,255,0.35)' : alpha(ink, 0.2)}`,
        }}
      >
        {/* `contain`, never `cover` — the avatars are head-and-shoulders portraits and `cover` crops
            the ears off inside a circle. Identical to ProfilePicker / BarnPane. */}
        <Box
          component="img"
          src={art}
          alt=""
          draggable={false}
          sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
        />
      </Box>

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
