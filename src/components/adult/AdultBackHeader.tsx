import React from 'react'
import { Box, IconButton } from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// The settings surface's header (Settings PRD-01 §6 + §11).
//
// It used to be the header of six sibling sub-panels, three of which ignored it and offered only a
// "Luk" that actually behaved as back — the exact inconsistency the rework removed. It is now the ONE
// header of the ONE surface, and it encodes the navigation grammar:
//
//   * `onBack` is passed ONLY on compact width, for a pushed pane — regular width has no back arrow
//     anywhere, because the rail is the way back (§6.2).
//   * `title` on a pushed pane must match, exactly, the rail label that opened it (Material).
//   * `action` carries the single "Luk". It is the only control in the adult area that uses that word.
interface AdultBackHeaderProps {
  title: string
  /** Omit on regular width — that is what makes "no back arrow outside compact" structural. */
  onBack?: () => void
  /** Trailing control: the one "Luk". */
  action?: React.ReactNode
}

const AdultBackHeader: React.FC<AdultBackHeaderProps> = ({ title, onBack, action }) => (
  <Box
    component="header"
    sx={{
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      px: 1.5,
      py: 1,
      borderBottom: '1px solid',
      borderColor: 'divider',
      [PHONE_LANDSCAPE]: { py: 0.5 },
    }}
  >
    {onBack && (
      <IconButton onClick={onBack} aria-label="Tilbage" edge="start" size="small" sx={{ flex: '0 0 auto' }}>
        <ArrowLeft size={22} />
      </IconButton>
    )}
    <Box
      component="h2"
      sx={{ flex: 1, minWidth: 0, m: 0, fontSize: '1.05rem', fontWeight: 700, px: onBack ? 0 : 0.5 }}
    >
      {title}
    </Box>
    {action}
  </Box>
)

export default AdultBackHeader
