import React from 'react'
import { Box, useTheme } from '@mui/material'
import { Check } from 'lucide-react'
import { hintPulse } from '../../../theme/idleMotion'

// Fyld Båden's "I'm done" — a big green ✓ (owner, 2026-10-15). The horn used to send the boat and a
// child had no way to know that; a round green checkmark means "done, check it" in every preschool app.
// It sits in one fixed place and only wakes up once there is cargo on the deck: dim and still while the
// deck is empty, full colour and gently breathing once it can be pressed. Tap only — it confirms, it
// never answers (Harbour PRD-01 §4.4).

const SendButton: React.FC<{ enabled: boolean; reduce: boolean; onSend: () => void }> = ({ enabled, reduce, onSend }) => {
  const theme = useTheme()
  const main = theme.palette.success.main
  const dark = theme.palette.success.dark
  const pulse = hintPulse(reduce || !enabled)
  return (
    <Box {...pulse.props} sx={[{ display: 'inline-block' }, pulse.sx]}>
      <Box
        component="button"
        type="button"
        aria-label="Send båden"
        data-boat-send
        disabled={!enabled}
        onClick={onSend}
        sx={{
          width: 'max(76px, calc(var(--s) * 1.9))',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.9)',
          p: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          background: `radial-gradient(circle at 35% 30%, ${theme.palette.success.light}, ${main} 60%, ${dark})`,
          boxShadow: `0 6px 0 ${dark}, 0 10px 18px rgba(0,0,0,0.28)`,
          cursor: enabled ? 'pointer' : 'default',
          opacity: enabled ? 1 : 0.45,
          filter: enabled ? 'none' : 'grayscale(0.7)',
          transition: 'transform 0.1s ease, box-shadow 0.1s ease, opacity 0.25s ease, filter 0.25s ease',
          '&:active': enabled ? { transform: 'translateY(4px)', boxShadow: `0 2px 0 ${dark}, 0 4px 8px rgba(0,0,0,0.25)` } : {},
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Check strokeWidth={4} style={{ width: '58%', height: '58%' }} />
      </Box>
    </Box>
  )
}

export default SendButton
