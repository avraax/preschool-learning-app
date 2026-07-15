import React from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import Mascot from '../common/Mascot'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { MascotEvent } from '../../services/mascotBus'
import { allStickers } from '../../config/stickers'
import type { RoundOutcome, StickerAward, XpGrantResult } from '../../services/progressStore'

// DEV-only harness routes (UI/UX Overhaul PRD §8.0.3). Routed ONLY under import.meta.env.DEV in
// App.tsx, so they never ship. They render reward/mascot states deterministically for the
// headless screenshot loop.

// /dev/mascot?event=correct|wrong|round|streak|sticker|hint|welcome|idle
export const DevMascot: React.FC = () => {
  const { search } = useLocation()
  const theme = useTheme()
  const ev = (new URLSearchParams(search).get('event') || 'idle') as MascotEvent
  return (
    <Box
      sx={{
        height: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        background: theme.scene.dark
          ? 'radial-gradient(circle at 50% 40%, #16204a 0%, #070b1a 100%)'
          : 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
      }}
    >
      <Typography sx={{ position: 'absolute', top: 12, left: 16, fontFamily: 'monospace', opacity: 0.7 }}>
        /dev/mascot · event={ev}
      </Typography>
      {/* forceEvent sets the pose (and bubble) so a single screenshot captures it. */}
      <Mascot forceEvent={ev} sx={{ left: '50%', bottom: '20%', transform: 'translateX(-50%)', width: 160, height: 160 }} />
    </Box>
  )
}

// /dev/round-result?stars=3&record=1&sticker=1
export const DevRoundResult: React.FC = () => {
  const { search } = useLocation()
  const p = new URLSearchParams(search)
  const stars = Math.min(3, Math.max(1, Number(p.get('stars') ?? 3)))
  const record = p.get('record') === '1'
  const showSticker = p.get('sticker') !== '0'

  const sampleSticker = allStickers()[0]
  const award: StickerAward = {
    sticker: sampleSticker,
    setId: '',
    setTitle: '',
    isNew: true,
    isShiny: false,
    count: 1,
  }
  const correct = stars === 3 ? 8 : stars === 2 ? 6 : 4
  // Liveliness PRD-01: ?levelup=1&level=N forces the XP meter to fill fully + hands off to the
  // level-up overlay, so the ceremony is capturable in the screenshot harness.
  const levelup = p.get('levelup') === '1'
  const lvl = Math.max(1, Number(p.get('level') ?? 3))
  const xp: XpGrantResult = {
    granted: 33,
    section: 'alphabet',
    global: {
      xpBefore: 0,
      xpAfter: 33,
      levelBefore: levelup ? Math.max(1, lvl - 1) : lvl,
      levelAfter: lvl,
      leveledUp: levelup,
      xpIntoLevel: levelup ? 13 : 10,
      xpToNextLevel: 22,
      xpForThisLevel: 35,
    },
    bloom: {
      xpBefore: 0,
      xpAfter: 33,
      stageBefore: 0,
      stageAfter: 0,
      stageAdvanced: false,
      fillBefore: 0,
      fillAfter: 33 / 480,
    },
  }
  const outcome: RoundOutcome = {
    gameId: 'dev.sample',
    correct,
    total: 8,
    mistakes: 8 - correct,
    stars,
    longestStreak: stars === 3 ? 8 : 4,
    previousBests: { streak: record ? 3 : 8, stars: record ? 2 : 3, count: record ? 5 : 8 },
    newBests: { streak: record, stars: record, count: record },
    anyNewBest: record,
    stickers: showSticker ? [award] : [],
    pageCompleted: null,
    totals: { totalStars: 12, totalStickers: 5 },
    xp,
  }

  return (
    <GameShell categoryId="alphabet" title="Resultat (dev)" backRoute="/">
      <RoundResultScreen outcome={outcome} categoryId="alphabet" backRoute="/" onReplay={() => {}} />
    </GameShell>
  )
}
