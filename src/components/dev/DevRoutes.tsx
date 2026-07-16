import React from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import Mascot from '../common/Mascot'
import GameShell from '../common/GameShell'
import GameIntro from '../common/GameIntro'
import RoundResultScreen from '../common/RoundResultScreen'
import ThemeScene from '../common/scene/ThemeScene'
import SceneObject from '../common/scene/SceneObject'
import type { MascotEvent } from '../../services/mascotBus'
import { allStickers } from '../../config/stickers'
import type { RoundOutcome, StickerAward, XpGrantResult } from '../../services/progressStore'
import { getCategoryTheme } from '../../config/categoryThemes'
import { sectionIconImages, type SectionIconId } from '../../assets/themes/icons'
import { defaultHomeAnchors, SCENE_SECTION_ORDER } from '../../theme/tokens/helpers'
import type { SceneSectionId } from '../../theme/tokens/types'

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
    <GameShell categoryId="alphabet" title="Resultat (dev)" backRoute="/" intro={false}>
      <RoundResultScreen outcome={outcome} categoryId="alphabet" backRoute="/" onReplay={() => {}} />
    </GameShell>
  )
}

// /dev/game-intro?category=alphabet&phase=ready|go — the game-entry beat, FROZEN (no auto-dismiss)
// so the headless screenshot loop can capture it (Chrome runs animations unthrottled, so a live
// beat would lift before a screenshot lands). `phase=go` shows the "Kør!" state.
export const DevGameIntro: React.FC = () => {
  const { search } = useLocation()
  const p = new URLSearchParams(search)
  const category = p.get('category') || 'alphabet'
  const phase = p.get('phase') === 'go' ? 'go' : 'ready'
  return (
    <GameShell categoryId={category} title="Intro (dev)" backRoute="/" intro={false}>
      <Box sx={{ flex: 1 }} />
      <GameIntro categoryId={category} onDismiss={() => {}} hold initialPhase={phase} />
    </GameShell>
  )
}

// /dev/scene?theme=<id>&section=<alphabet|math|colors|english|ordleg>&bloom=0..4
// Structured World harness (Liveliness PRD-05 §11). Previews the tactile SceneObject seating,
// depth (contact shadow), per-theme home anchors, section framing (focus zoom + accent tint),
// and bloom stage IN ISOLATION per skin — using PLACEHOLDER art (today's section icons) until
// the Gemini asset batches land. Force the skin with ?theme=<id> (AppThemeProvider reads it).
//
//   • no `section` → HOME preview: 5 section objects seated at theme.scene.homeAnchors.
//   • `section=<id>` → SECTION preview: the world framed on that section's focus + accent tint,
//     the section's object enlarged as a landmark, its games laid out as SceneObjects.
export const DevScene: React.FC = () => {
  const { search } = useLocation()
  const p = new URLSearchParams(search)
  const theme = useTheme()
  const sectionParam = p.get('section') as SceneSectionId | null
  const section = sectionParam && SCENE_SECTION_ORDER.includes(sectionParam) ? sectionParam : null
  const bloom = Math.min(4, Math.max(0, Number(p.get('bloom') ?? 0)))
  const bloomExtra = bloom * 2 // stage→extra ambient (fill 0); mirrors PersistentWorld's formula

  const anchors = theme.scene.homeAnchors ?? defaultHomeAnchors()
  const focus = section ? theme.scene.sectionFocus?.[section] ?? { xPct: 50, yPct: 50, zoom: 1.15 } : null
  const burstMotion = theme.scene.ambient.motion
  const dark = theme.scene.dark
  const accent = section ? getCategoryTheme(section).accentColor : undefined

  const sectionArt = (s: SceneSectionId): string => sectionIconImages[s as SectionIconId]

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100dvh',
        overflow: 'hidden',
        background: dark
          ? '#070B1A'
          : 'linear-gradient(180deg, #EAF3FF 0%, #F8FAFC 100%)',
      }}
    >
      {/* Backdrop world — framed (scaled toward the focal point) when previewing a section. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          transformOrigin: focus ? `${focus.xPct}% ${focus.yPct}%` : 'center',
          transform: focus ? `scale(${focus.zoom})` : 'none',
          transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <ThemeScene bloomExtra={bloomExtra} bloomStage={bloom} bloomSection={section} />
      </Box>

      {/* Section accent tint — makes /alphabet feel like a different place than /math. */}
      {section && accent && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, ${alpha(accent, 0.10)} 0%, ${alpha(accent, 0.22)} 100%)`,
          }}
        />
      )}

      {/* HOME preview: 5 section objects seated at the theme's home anchors. */}
      {!section &&
        anchors.map((a, i) => (
          <SceneObject
            key={a.section}
            art={sectionArt(a.section)}
            label={getCategoryTheme(a.section).name}
            accent={getCategoryTheme(a.section).accentColor}
            index={i}
            rotate={a.rotate ?? 0}
            burstMotion={burstMotion}
            onActivate={() => {}}
            size={`clamp(84px, ${13 * a.scale}vh, ${132 * a.scale}px)`}
            sx={{
              position: 'absolute',
              left: `${a.xPct}%`,
              top: `${a.yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

      {/* SECTION preview: enlarged landmark + the section's games as SceneObjects. */}
      {section && (
        <>
          <SceneObject
            art={sectionArt(section)}
            label={getCategoryTheme(section).name}
            accent={getCategoryTheme(section).accentColor}
            burstMotion={burstMotion}
            shadow="float"
            onActivate={() => {}}
            size="clamp(120px, 22vh, 220px)"
            sx={{ position: 'absolute', left: '18%', top: '30%', transform: 'translate(-50%, -50%)' }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '6%',
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '20px 32px',
              px: 3,
            }}
          >
            {getCategoryTheme(section).games.map((g, i) => (
              <SceneObject
                key={g.id}
                // Placeholder: game icons (B2) not generated yet → SceneObject shows the emoji-less
                // section icon as art; real per-game art lands with the icon registry.
                art={sectionArt(section)}
                label={g.title}
                accent={getCategoryTheme(section).accentColor}
                index={i}
                burstMotion={burstMotion}
                onActivate={() => {}}
                size="clamp(64px, 11vh, 108px)"
              />
            ))}
          </Box>
        </>
      )}

      {/* Dev HUD */}
      <Typography
        sx={{
          position: 'absolute',
          top: 10,
          left: 14,
          fontFamily: 'monospace',
          fontSize: 12,
          color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
          background: dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.6)',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          zIndex: 100,
          whiteSpace: 'pre',
        }}
      >
        {`/dev/scene · theme=${theme.scene.dark ? 'dark' : 'light'} · section=${section ?? 'home'} · bloom=${bloom}`}
      </Typography>
    </Box>
  )
}
