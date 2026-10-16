import React from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PICTURES, StudioButton } from './StudioControls'
import { gameIconImages } from '../../../assets/themes/icons/games'
import { NEW_PAPER_TITLE } from '../../../config/kreaPhrases'

// "Nyt papir?" (Krea PRD-01 §2.1.4) — discarding UNFINISHED work asks first, as spoken words plus
// picture buttons, because a five-year-old can't read "Er du sikker?". The line itself is spoken by the
// game when this opens. Left = a fresh sheet (Ja), right = my picture, kept (Nej).
//
// Both choices close on `onClick` only, never on pointerdown: a blocking overlay closed on pointerdown
// passes the same tap through to the paper underneath (memory: audio-modal tap-through).

export interface NewPaperConfirmProps {
  open: boolean
  onFresh: () => void
  onKeep: () => void
}

const NewPaperConfirm: React.FC<NewPaperConfirmProps> = ({ open, onFresh, onKeep }) => {
  const theme = useTheme()
  if (!open) return null
  const big = 'clamp(88px, 18vmin, 150px)'
  return (
    <Box
      data-krea-confirm
      role="dialog"
      aria-label={NEW_PAPER_TITLE}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(12px, 3vmin, 28px)',
        // Dark enough that the question owns the screen: at 0.45 a bright crayon line on the paper read
        // straight through it and crossed the title.
        background: 'rgba(50,32,15,0.68)',
        touchAction: 'none',
      }}
    >
      <Typography sx={{ fontFamily: theme.titleFontFamily, fontWeight: 700, fontSize: 'clamp(1.6rem, 5vmin, 2.6rem)', color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}>
        {NEW_PAPER_TITLE}
      </Typography>
      <Box sx={{ display: 'flex', gap: 'clamp(24px, 6vmin, 64px)' }}>
        <StudioButton dataId="confirm-fresh" label="Ja, nyt papir" size={big} activateOn="click" onPress={onFresh}>
          <PICTURES.NewPaper />
        </StudioButton>
        <StudioButton dataId="confirm-keep" label="Nej, behold min tegning" size={big} activateOn="click" onPress={onKeep}>
          <Box component="img" src={gameIconImages['krea.draw']} alt="" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        </StudioButton>
      </Box>
    </Box>
  )
}

export default NewPaperConfirm
