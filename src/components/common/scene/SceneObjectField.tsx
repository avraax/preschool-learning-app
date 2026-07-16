import React from 'react'
import { Box, useMediaQuery } from '@mui/material'
import type { AmbientMotion, HomeAnchor } from '../../../theme/tokens/types'
import { PHONE_ANY } from '../../../theme/phoneMedia'
import SceneObject from './SceneObject'

// Shared "objects living in the world" layout (Liveliness PRD-05 W3/W4). Renders a set of
// tactile <SceneObject>s in one of two arrangements, and owns the single RESPONSIVE FALLBACK
// the PRD asks both home and the section menus to share:
//
//   • SEATED  — absolute per-theme anchors over the scene (home on iPad): objects rest on the
//               world's own features along a gentle arc, each phased/tilted individually.
//   • FLOW    — a centred, wrap-friendly band near the lower third (phones/portrait AND the
//               section-menu game tiles at every size): tactile objects on an implied ground
//               line, never a frosted-card grid.
//
// The switch: SEATED needs `anchors` AND a non-phone viewport. Phones, or callers with no
// anchors (section tiles), get FLOW. This keeps the "never a spreadsheet grid" rule in ONE place.

export interface SceneFieldItem {
  key: string
  art: string
  label: string
  accent: string
  onActivate: () => void
  rotate?: number
}

interface SceneObjectFieldProps {
  items: SceneFieldItem[]
  anchors?: HomeAnchor[]        // seated positions (index-aligned to items); absent → always flow
  frozen: boolean
  burstMotion: AmbientMotion
  attractKey?: string | null    // item.key currently doing the idle-attract wiggle
  float?: boolean               // dark world → floating shadow (objects hang in space, not grounded)
  flowSize?: string             // per-item width in flow mode
}

const SceneObjectField: React.FC<SceneObjectFieldProps> = ({
  items,
  anchors,
  frozen,
  burstMotion,
  attractKey = null,
  float = false,
  flowSize = 'clamp(72px, 12vh, 116px)',
}) => {
  const isPhone = useMediaQuery(PHONE_ANY)
  const seated = !!anchors && anchors.length === items.length && !isPhone
  const shadow = float ? 'float' : 'contact'

  if (seated) {
    return (
      <>
        {items.map((item, i) => {
          const a = anchors![i]
          return (
            <SceneObject
              key={item.key}
              art={item.art}
              label={item.label}
              accent={item.accent}
              index={i}
              frozen={frozen}
              attract={attractKey === item.key}
              burstMotion={burstMotion}
              shadow={shadow}
              rotate={item.rotate ?? a.rotate ?? 0}
              onActivate={item.onActivate}
              size={`clamp(${Math.round(98 * a.scale)}px, ${(15 * a.scale).toFixed(1)}vh, ${Math.round(158 * a.scale)}px)`}
              sx={{
                position: 'absolute',
                left: `${a.xPct}%`,
                top: `${a.yPct}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}
            />
          )
        })}
      </>
    )
  }

  // FLOW — a centred wrap band. Used for phones/portrait home AND all section-menu tiles.
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 'clamp(10px, 2.4vh, 26px) clamp(14px, 3vw, 40px)',
        px: 2,
      }}
    >
      {items.map((item, i) => (
        <SceneObject
          key={item.key}
          art={item.art}
          label={item.label}
          accent={item.accent}
          index={i}
          frozen={frozen}
          attract={attractKey === item.key}
          burstMotion={burstMotion}
          shadow={shadow}
          rotate={item.rotate ?? 0}
          onActivate={item.onActivate}
          size={flowSize}
        />
      ))}
    </Box>
  )
}

export default SceneObjectField
