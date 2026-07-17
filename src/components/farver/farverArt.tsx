import React from 'react'
import { Box, Typography } from '@mui/material'
import { colorObjectArt } from '../../assets/games/farver'
import { softShadow } from '../../theme/depth'

// Shared Farver object renderer (Liveliness PRD-09 §3.0 "object surface"): a baked soft-3D colour
// object RESTING in the world — a cut-out `<img>` grounded by a layered `softShadow` drop-shadow
// (no hex backing square, no border, no keyboard lip). Falls back to the emoji while the art is
// un-baked (art-gated). Used by Farvejagt (scattered + collected), Hvilken Farve? (dragged object)
// and Lær Farver (examples), so a given object looks identical everywhere.
//
// `elevation` raises the shadow while an object is lifted/grabbed (3 ≈ "in the air"). The visual
// is inert to pointer events; the caller owns drag/press/hint motion on its own wrapper.
interface ObjectArtProps {
  art?: string
  emoji: string
  size: number | string
  elevation?: number
  alt?: string
}

const ObjectArt: React.FC<ObjectArtProps> = ({ art, emoji, size, elevation = 1, alt }) => {
  const url = colorObjectArt(art)
  if (url) {
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
  // Art-gated fallback: the emoji, resting on the same soft shadow (no hex tile).
  const px = typeof size === 'number' ? size : undefined
  return (
    <Typography
      aria-label={alt}
      sx={{
        fontSize: px ? px * 0.82 : '2.4rem',
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'none',
        filter: softShadow(elevation),
      }}
    >
      {emoji}
    </Typography>
  )
}

export default ObjectArt
