// "Hvem spiller?" — the child picker.
//
// Shown at app start ONLY when the account has more than one profile; a single child boots straight in,
// which is what keeps "the child never sees a login screen" true (accounts PRD §7.4). Picking at boot is
// NOT PIN-gated — a child choosing their own avatar is the point. Switching MID-SESSION is gated, and
// that gate lives at the call site (AdultCorner's "Skift barn"), not here.
//
// Visual model: ThemePanel's selectable-tile grid — `role="group"`, `motion.button` with `aria-pressed`,
// a circular thumb and an accent ring when active. That is the app's established "grid of identity
// tiles", so this needs no new vocabulary.

import React, { useCallback, useState } from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { profileStore, type ChildProfile } from '../../services/profileStore'
import { PHONE_ANY } from '../../theme/phoneMedia'
import { AUTH_Z } from './authOverlayZ'
import { avatarArt } from '../../assets/avatars'

export interface ProfilePickerProps {
  profiles: ChildProfile[]
  activeProfileId: string | null
  /** Shown when an adult opened the picker deliberately, so they can back out. */
  onCancel?: () => void
  onCreate?: () => void
}

const ProfilePicker: React.FC<ProfilePickerProps> = ({
  profiles,
  activeProfileId,
  onCancel,
  onCreate,
}) => {
  const theme = useTheme()
  const [busy, setBusy] = useState(false)

  const pick = useCallback((id: string) => {
    if (busy) return
    setBusy(true)
    // Synchronous attach inside selectProfile → the next render already has the child's real book.
    profileStore.selectProfile(id)
  }, [busy])

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Hvem spiller?"
      sx={{
        position: 'fixed',
        inset: 0,
        // ABOVE SimplifiedAudioPermission (9999). "Who is playing?" has to be answered before "turn
        // on sound" — and since this surface is opaque and full-screen, the audio modal is simply
        // hidden behind it and reappears once a child is chosen. One blocking overlay at a time, which
        // is the same rule the auth gate follows.
        zIndex: AUTH_Z.profilePicker,
        background: theme.decor.notFoundBackground,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: '100%', maxWidth: 480 }}
      >
        <Paper
          elevation={12}
          sx={{
            p: 4,
            borderRadius: 4,
            textAlign: 'center',
            maxHeight: 'calc(var(--vh, 1vh) * 92)',
            overflowY: 'auto',
            [PHONE_ANY]: { p: 2.5 },
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontWeight: 700, mb: 2.5, [PHONE_ANY]: { fontSize: '1.25rem', mb: 1.5 } }}
          >
            Hvem spiller?
          </Typography>

          <Box
            role="group"
            aria-label="Vælg barn"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
              gap: 1.5,
              [PHONE_ANY]: { gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 1 },
            }}
          >
            {profiles.map((p) => {
              const isActive = p.id === activeProfileId
              const ring = isActive
                ? theme.palette.primary.main
                : alpha(theme.palette.primary.main, 0.18)
              return (
                <Box
                  key={p.id}
                  component={motion.button}
                  type="button"
                  data-profile-tile={p.id}
                  onClick={() => pick(p.id)}
                  aria-pressed={isActive}
                  aria-label={`Spil som ${p.name || 'barn'}`}
                  whileTap={{ scale: 0.94 }}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.75,
                    p: 1,
                    border: 'none',
                    borderRadius: 3,
                    background: 'transparent',
                    cursor: 'pointer',
                    minHeight: 44,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: alpha(theme.palette.primary.main, 0.08),
                      border: `3px solid ${ring}`,
                      [PHONE_ANY]: { width: 52, height: 52 },
                    }}
                  >
                    {/* Baked portrait, never a glyph (de-emoji PRD-01 D5). `contain` inside the round
                        badge so the head isn't cropped by the circle. */}
                    <Box
                      component="img"
                      src={avatarArt(p.avatarId)}
                      alt=""
                      draggable={false}
                      sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {p.name || '—'}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          {(onCreate || onCancel) && (
            <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'center' }}>
              {onCreate && (
                <Button onClick={onCreate} aria-label="Tilføj et barn" sx={{ textTransform: 'none' }}>
                  Tilføj et barn
                </Button>
              )}
              {onCancel && (
                <Button onClick={onCancel} aria-label="Annullér" sx={{ textTransform: 'none' }}>
                  Annullér
                </Button>
              )}
            </Box>
          )}
        </Paper>
      </motion.div>
    </Box>
  )
}

export default ProfilePicker
