import React from 'react'
import { Box } from '@mui/material'
import { colorObjectArt } from '../../assets/games/farver'
import { softShadow } from '../../theme/depth'

// Shared Farver object renderer (Liveliness PRD-09 §3.0 "object surface"): a baked soft-3D colour
// object RESTING in the world — a cut-out `<img>` grounded by a layered `softShadow` drop-shadow
// (no hex backing square, no border, no keyboard lip). The whole colour-object set is baked and
// shipping (PRD-12 dropped the emoji fallback). Used by Farvejagt (scattered + collected), Hvilken
// Farve? (dragged object) and Lær Farver (examples), so a given object looks identical everywhere.
//
// `elevation` raises the shadow while an object is lifted/grabbed (3 ≈ "in the air"). The visual
// is inert to pointer events; the caller owns drag/press/hint motion on its own wrapper.
interface ObjectArtProps {
  art?: string
  size: number | string
  elevation?: number
  alt?: string
}

const ObjectArt: React.FC<ObjectArtProps> = ({ art, size, elevation = 1, alt }) => {
  const url = colorObjectArt(art)
  if (!url) return null
  return (
    <Box
      component="img"
      src={url}
      alt={alt ?? ''}
      draggable={false}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        filter: softShadow(elevation),
      }}
    />
  )
}

export default ObjectArt
