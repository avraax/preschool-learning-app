import React, { useEffect, useRef, useState } from 'react'
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
// HOLD TO CLEAR (owner 2026-11-07: "a lot of kids could accidentally get to this modal and click new"):
// the picture button must be HELD for `HOLD_CONFIRM_MS` while a ring fills round it; a quick tap only
// wiggles it. And every game makes the clear UNDOABLE (Fortryd brings the piece back) — two safety nets.
//
// Never close on pointerdown: a blocking overlay closed on pointerdown passes the same tap through to the
// paper underneath (memory: audio-modal tap-through). So a full ring only ARMS the button, and LETTING GO
// of an armed button clears — on `pointerup`, NOT on the click: iOS synthesizes no `click` after a long
// press (its tap recognizer gives up well under 1.5 s), so a click-only commit never cleared on the iPad
// (owner 2026-11-07). The click stays for a keyboard/mouse; the hold state is a REF so the release and a
// following click can't both clear.

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
/** How long the fresh button must be held (a tap is ~100–200 ms; a deliberate hold is well past it). */
export const HOLD_CONFIRM_MS = 1500
const RING_GREEN = '#4FA83A'
const RING_C = 2 * Math.PI * 46

const NewPaperConfirm: React.FC<NewPaperConfirmProps> = ({ open, onFresh, onClose, title = NEW_PAPER_TITLE, freshPicture, freshLabel = 'Ja, nyt papir' }) => {
  const theme = useTheme()
  const [hold, setHoldState] = useState<'idle' | 'holding' | 'armed'>('idle')
  const holdRef = useRef<'idle' | 'holding' | 'armed'>('idle')
  const setHold = (h: 'idle' | 'holding' | 'armed') => {
    holdRef.current = h
    setHoldState(h)
  }
  const [wiggle, setWiggle] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (!open) {
      stop()
      setHold('idle')
    }
  }, [open])
  if (!open) return null
  const startHold = () => {
    stop()
    setHold('holding')
    timer.current = setTimeout(() => setHold('armed'), HOLD_CONFIRM_MS)
  }
  /** Let go: armed → clear. Lifted too soon → nothing but a wiggle — "hold me". */
  const releaseHold = () => {
    if (holdRef.current === 'armed') return commit()
    if (holdRef.current === 'idle') return
    stop()
    setHold('idle')
    setWiggle((w) => w + 1)
  }
  /** The finger slid off the button (or the system took the pointer): start over, clear nothing. */
  const abandonHold = () => {
    stop()
    setHold('idle')
  }
  const commit = () => {
    if (holdRef.current !== 'armed') return
    stop()
    setHold('idle')
    onFresh()
  }
  const big = 'clamp(80px, 15vmin, 128px)'
  /** The ring's own room round the button (owner 2026-11-07: the ring lay over the button's corners, its
   *  + badge and nearly the title). 1.7× keeps the ring's inner edge clear of a square picture's corners. */
  const ringBox = `calc(${big} * 1.7)`
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
        <Box
          data-krea-hold={hold}
          onPointerDown={startHold}
          onPointerUp={releaseHold}
          onPointerLeave={abandonHold}
          onPointerCancel={abandonHold}
          onContextMenu={(e) => e.preventDefault()}
          sx={{
            position: 'relative',
            width: ringBox,
            height: ringBox,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // The question already says "new": the button's + badge would only sit on the ring.
            '& [data-plus-badge]': { display: 'none' },
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            userSelect: 'none',
            '@keyframes kreaHoldWiggle': {
              '0%, 100%': { transform: 'rotate(0deg)' },
              '25%': { transform: 'rotate(-6deg)' },
              '75%': { transform: 'rotate(6deg)' },
            },
            ...(wiggle ? { animation: 'kreaHoldWiggle 0.35s cubic-bezier(0.4, 0, 0.2, 1) 1' } : {}),
          }}
          key={wiggle}
        >
          <StudioButton dataId="confirm-fresh" label={freshLabel} size={big} activateOn="click" onPress={commit}>
            {freshPicture ?? <PICTURES.NewPaper />}
          </StudioButton>
          {/* The ring that fills while the finger holds; full = let go to clear. */}
          <Box component="svg" viewBox="0 0 100 100" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(79,168,58,0.18)" strokeWidth="5" />
            <Box
              component="circle"
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={RING_GREEN}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              sx={{
                strokeDashoffset: hold === 'idle' ? RING_C : 0,
                transition: hold === 'holding' ? `stroke-dashoffset ${HOLD_CONFIRM_MS}ms linear` : hold === 'armed' ? 'none' : 'stroke-dashoffset 150ms ease-out',
              }}
            />
          </Box>
        </Box>
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
