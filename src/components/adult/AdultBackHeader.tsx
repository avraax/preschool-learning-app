import React from 'react'
import { Box, DialogTitle, IconButton } from '@mui/material'
import { ArrowLeft } from 'lucide-react'

// Shared header for adult-menu SUB-panels (bug report / voice / difficulty). A touch-friendly
// back arrow (→ back to the main adult menu) + the panel title, so there's always a visible way
// back — Escape isn't available on iPad/iPhone. Keeps the adult area's look consistent.
interface AdultBackHeaderProps {
  title: string
  onBack: () => void
}

const AdultBackHeader: React.FC<AdultBackHeaderProps> = ({ title, onBack }) => (
  <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, py: 1.25, pr: 2 }}>
    <IconButton onClick={onBack} aria-label="Tilbage" edge="start" size="small" sx={{ flex: '0 0 auto' }}>
      <ArrowLeft size={22} />
    </IconButton>
    <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: '1.15rem' }}>{title}</Box>
  </DialogTitle>
)

export default AdultBackHeader
