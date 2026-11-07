import React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PICTURES, StudioButton } from './StudioControls'
import { NEW_PAPER_TITLE } from '../../../config/kreaPhrases'

// "Nyt papir?" (Krea PRD-01 §2.1.4) — discarding UNFINISHED work asks first, as spoken words plus a
// picture button, because a five-year-old can't read "Er du sikker?". The line itself is spoken by the
// game when this opens.
//
// ONE choice and a way out (owner, 2026-11-07, HRJ4H): the picture button means "yes, a fresh one"; a
// red close X on the card's corner closes the question and keeps everything. There is no second "no, keep it"
// picture any more — two big pictures side by side read as two equal choices.
//
// Both close on `onClick` only, never on pointerdown: a blocking overlay closed on pointerdown passes the
// same tap through to the paper underneath (memory: audio-modal tap-through).

export interface NewPaperConfirmProps {
  open: boolean
  onFresh: () => void
  /** The close X: close the question, keep the piece. */
  onClose: () => void
  /** Perleplade asks "Ny plade?" (PRD-02 §2.6); the drawing games keep the default. */
  title?: string
  /** The "fresh" button's picture (Perleplade: an empty board); default the new sheet. */
  freshPicture?: React.ReactNode
  /** The fresh button's name for assistive tech (picture only on screen); default the drawing games'. */
  freshLabel?: string
}

/** The close mark's red, and its ring. */
const CLOSE_RED = '#E0463B'

const NewPaperConfirm: React.FC<NewPaperConfirmProps> = ({ open, onFresh, onClose, title = NEW_PAPER_TITLE, freshPicture, freshLabel = 'Ja, nyt papir' }) => {
  const theme = useTheme()
  if (!open) return null
  const big = 'clamp(88px, 18vmin, 150px)'
  const close = 'clamp(48px, 8vmin, 64px)'
  return (
    <Box
      data-krea-confirm
      role="dialog"
      aria-label={title}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Dark enough that the question owns the screen: at 0.45 a bright crayon line on the paper read
        // straight through it and crossed the title.
        background: 'rgba(50,32,15,0.68)',
        touchAction: 'none',
      }}
    >
      <Box
        data-krea-confirm-card
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(12px, 3vmin, 24px)',
          p: 'clamp(20px, 4vmin, 36px)',
          pt: 'clamp(16px, 3vmin, 28px)',
          borderRadius: '28px',
          background: '#FFFCF7',
          boxShadow: '0 12px 32px rgba(30,18,6,0.35)',
        }}
      >
        <Typography sx={{ fontFamily: theme.titleFontFamily, fontWeight: 700, fontSize: 'clamp(1.6rem, 5vmin, 2.6rem)', color: '#4A3420' }}>{title}</Typography>
        <StudioButton dataId="confirm-fresh" label={freshLabel} size={big} activateOn="click" onPress={onFresh}>
          {freshPicture ?? <PICTURES.NewPaper />}
        </StudioButton>
        {/* The close X sits ON the card's top-right corner, half outside it — where a close mark is expected. */}
        <ButtonBase
          aria-label="Luk"
          data-krea-control="confirm-close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: `calc(${close} / -2.6)`,
            right: `calc(${close} / -2.6)`,
            width: close,
            height: close,
            borderRadius: '50%',
            background: CLOSE_RED,
            boxShadow: '0 0 0 4px #FFFFFF, 0 4px 10px rgba(30,18,6,0.35)',
            touchAction: 'manipulation',
            '&:active': { transform: 'scale(0.94)' },
          }}
        >
          <svg viewBox="0 0 24 24" width="50%" height="50%" aria-hidden>
            <path d="M6 6 L18 18 M18 6 L6 18" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
          </svg>
        </ButtonBase>
      </Box>
    </Box>
  )
}

export default NewPaperConfirm
