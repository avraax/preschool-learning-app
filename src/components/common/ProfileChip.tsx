import React, { useState } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useProfiles } from '../../hooks/useProfiles'
import { avatarArt } from '../../assets/avatars'
import { normalizeAvatarId } from '../../config/avatars'
import { onTileColor } from '../../theme/tokens/helpers'
import WhoIsPlayingSheet from '../auth/WhoIsPlayingSheet'

// WHO IS PLAYING — a pill in the title row, top-LEFT (Corner identity PRD-01 §2.4).
//
// It replaces `ProfileBadge`, a 44-52px disc that sat in the top-right corner 8-12px from the reward
// ring. That corner was doing THREE unrelated jobs with TWO identical discs: how close am I to the next
// sticker, who is playing, and where is the adult area. `ProfileBadge`'s own header recorded the defect
// and called it accepted — *"Two adjacent same-size discs now go to two different places; that is the
// accepted cost."* It is no longer accepted, and the fix is not a smaller avatar:
//
//   • **LEFT, NOT RIGHT.** Physical separation is what stops the pair reading as a pair. Adjacency was
//     the defect; shrinking one of two adjacent discs leaves two adjacent discs.
//   • **A PILL, NEVER A CIRCLE.** This is the anti-confusion invariant and it is mechanically guarded
//     (`profileChip.test.ts`): the reward ring is the ONLY circle in the chrome, so shape alone carries
//     "these are different kinds of thing" for a child who can read neither label. A round chip would
//     re-create the confusion at a distance instead of at 12px.
//   • **THE NAME AS TEXT**, reversing `profileBadge.test.ts`'s *"a PICTURE and a letter, never the name
//     as text"*. That guard existed because the badge was a 46px disc with no room for a word, and a
//     name would have made its width depend on the name. A pill has room and is allowed to. Names here
//     are short, the owner's five-year-old knows all 29 letters, and even a pre-reader recognises the
//     shape of their own name. The old `profileInitial` letter-in-a-disc is deleted with the badge.
//     A whitespace-only name still renders portrait-only — a supported state, not a defect.
//
// **IT IS NOT A METER, AND IT MUST NEVER BECOME ONE.** The forbidden-import guard moved across from
// `profileBadge.test.ts` intact: this file may not touch `useProgress`, `progressStore`,
// `rewardNumber`, `xpBus` or `xpProgress`, and it may not route to `/album`. Add nothing that fills,
// counts or animates. The in-game header once held a second progress readout (`ScoreChip`) inches from
// the ring with nothing on screen to say what each counted; that is the regression this forbids.
//
// **TAPPING IT OPENS "Hvem spiller?", NOT THE ADULT AREA** (§2.6). The avatar used to be the adult
// door, which made it do two contradictory jobs at once: *who is playing* is a passive cue aimed at the
// child, *the adult door* is a control aimed at the owner, and a five-year-old who taps their own face
// met a keypad. That is a mis-teaching, not a safety feature — the gate is what makes it safe, and the
// gate works just as well behind a labelled row. Apple 1.3 requires the parental gate for the adult
// area; it does not require the door to be the child's face. So the tap now opens a sheet whose FIRST
// element is the child themselves ("that's me!"), with the two adult routes as labelled rows below it.
// `aria-label="Indstillinger"` — the selector the whole screenshot harness clicks — moved onto that row.
// (It read "Til de voksne" until the owner renamed the adult area on 2026-09-05; the harness now needs
// TWO clicks, `[data-profile-chip]` then that row.)
//
// NOT rendered in game (§2.5): `GameShell` shows the book and stops. Nobody needs telling who they are
// mid-round, that is the surface where real estate matters most, and it gives the tappable corner back
// to Min Bog.

interface ProfileChipProps {
  /**
   * Portrait diameter in px. The pill's WIDTH is never set — it is content-sized, which is what makes
   * it a pill rather than a disc at every name length.
   */
  size?: number
  sx?: SxProps<Theme>
}

const ProfileChip: React.FC<ProfileChipProps> = ({ size = 32, sx = {} }) => {
  const theme = useTheme()
  const { profiles, activeProfileId } = useProfiles()
  const [open, setOpen] = useState(false)
  const profile = profiles.find((p) => p.id === activeProfileId) ?? null

  // Nothing attached (detached, or `status: 'choosing'` mid-boot) → render NOTHING (§4.5). No
  // placeholder and no skeleton: the gate is blocking play in that state anyway, and a grey pill that
  // resolves into a name one frame later is a flicker in the corner of every cold launch.
  if (!profile) return null

  // The portrait ALWAYS resolves and there is no glyph path — `normalizeAvatarId` coerces an unknown id
  // (a roster cached by an older client) to the default, and `avatars.test.ts` fails the build if any
  // id lacks its baked WebP. Same unconditional render as ProfilePicker and BoernSection; don't add a
  // `??` here — a fallback would MASK a missing asset instead of failing the build (§4.6).
  const art = avatarArt(normalizeAvatarId(profile.avatarId))
  // `.trim()`, not a bare truthiness check: a whitespace-only name is truthy and would render a blank
  // word and announce as "    spiller".
  const name = profile.name?.trim() ?? ''

  // The ring's own colour source, so the two chrome elements belong to one family on every skin; the
  // name sits on a near-white pill, so it takes the same accent-on-light treatment as every other
  // surface here (a no-op on an accent that already reads, a darkening on the pale ones).
  const accent = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  const ink = onTileColor(accent)
  const dark = theme.scene?.dark

  return (
    <>
      <Box
        // Stable hook for the geometry probe: this rect must never intersect [data-reward-ring].
        data-profile-chip
        role="button"
        tabIndex={0}
        // The accessible name of a CONTROL is its action, so the question comes first; who is playing
        // rides along after it rather than replacing it. NB this is deliberately NOT
        // `aria-label="Indstillinger"` — that selector belongs to the adult ROW inside the sheet now.
        aria-label={name ? `Hvem spiller? ${name} spiller` : 'Hvem spiller?'}
        onClick={() => setOpen(true)}
        // Enter/Space, since this is a div playing a button.
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        sx={[
          {
            // A PILL: content-sized width, 999px radius, real horizontal padding. Never a fixed square
            // and never `borderRadius: '50%'` — see the header, and profileChip.test.ts.
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            pl: 0.5,
            pr: 1.25,
            py: 0.5,
            borderRadius: '999px',
            // 44px minimum touch target (CLAUDE.md), which the 32px portrait plus padding already
            // clears vertically — stated rather than implied, because a smaller `size` must not eat it.
            minHeight: 44,
            maxWidth: { xs: 150, md: 210 },
            // A HAZE, NOT A CARD, and the difference is the whole balance of the corner.
            //
            // The first version was `paper` at 0.55 with a hairline border, and beside it the reward
            // ring paints no backing at all — so the pair read as one object with a card and one
            // without. `ProfileBadge` recorded that exact failure when the ProfilePicker's tile
            // backing shipped into the chrome by mistake: over the pale sky it "desaturates into a
            // grey ring", and the ring 12px away measured `rgba(0,0,0,0)`.
            //
            // But this one cannot go bare the way the badge did: it carries TEXT, and Comic Sans over
            // a painted parallax world is unreadable without a ground. So legibility moves OFF the
            // fill and onto the glyphs (the `textShadow` below, the same device every themed title on
            // the scene uses), and the fill drops to a haze that only softens the sky behind the word.
            // The portrait is a green-screened cutout and sits on the world like the mascot either way.
            bgcolor: alpha(theme.palette.background.paper, theme.scene?.dark ? 0.16 : 0.34),
            boxSizing: 'border-box',
            userSelect: 'none',
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            flex: '0 0 auto',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Box
          component="img"
          src={art}
          alt=""
          draggable={false}
          sx={{ width: size, height: size, objectFit: 'contain', flex: '0 0 auto', userSelect: 'none' }}
        />
        {/* The name. Absent when the profile has no name — a normal state (the field is optional), and
            the pill then reads as a portrait on a plate. Never an em-dash, never a "?". */}
        {name && (
          <Typography
            component="span"
            sx={{
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: '0.95rem',
              lineHeight: 1.1,
              // White on a dark world, the readable-on-white accent on a light one — the same pair
              // GameShell's title and Min Bog's use, so the chip belongs to the scene rather than to
              // a card sitting on it.
              color: dark ? '#FFFFFF' : ink,
              // THIS is what carries legibility now, not the fill behind it. A glow on a dark world, a
              // soft light halo on a light one, so a name stays readable over the rainbow's saturated
              // bands and over a plain sky alike.
              textShadow: dark
                ? '0 0 10px rgba(120,170,255,0.55), 0 1px 4px rgba(0,0,0,0.6)'
                : '0 1px 0 rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {name}
          </Typography>
        )}
      </Box>

      <WhoIsPlayingSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default ProfileChip
