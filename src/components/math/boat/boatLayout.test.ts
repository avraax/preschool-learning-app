import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BOAT_COL_S, BOAT_GAP_S, BOAT_W_S, BOW_AIR_S, JETTY_COL_MAX_S, JETTY_COL_MIN_S, JETTY_OFFSTAGE_MIN_S,
  LANDSCAPE_BUDGET_S, jettyLeftS,
} from './boatLayout.ts'

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

test('the jetty always comes in from off-screen: its left end ≥ 2·s past the stage edge at the widest column', () => {
  // ZZATX/F4E9D (owner 2026-11-04): at the old 10.6·s cap the jetty's beginning sat exactly AT the stage
  // edge, i.e. visibly 32px+ into the screen.
  assert.ok(jettyLeftS(JETTY_COL_MAX_S) <= -JETTY_OFFSTAGE_MIN_S + 1e-9, `jetty left end at ${jettyLeftS(JETTY_COL_MAX_S)}·s`)
  assert.ok(jettyLeftS(JETTY_COL_MIN_S) < jettyLeftS(JETTY_COL_MAX_S))
  assert.ok(JETTY_COL_MIN_S <= JETTY_COL_MAX_S)
})

test('a width-bound screen fits the narrowest jetty column + the whole boat column exactly', () => {
  assert.ok(near(BOAT_COL_S, BOAT_GAP_S + BOAT_W_S + BOW_AIR_S), 'BOAT_COL_S drifted from its parts')
  assert.ok(near(JETTY_COL_MIN_S + BOAT_COL_S, LANDSCAPE_BUDGET_S), 'the bow is cut off (or air pools) on a width-bound screen')
})

test('the game sizes the row from these numbers, never from a container unit inside a flex value', () => {
  const src = readFileSync(new URL('../FyldBaadenGame.tsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  // The old jetty column `flex: '0 0 clamp(…100cqw…)'` resolved to its cap on the device.
  assert.doesNotMatch(src, /\bflex:\s*[`'"][^`'"]*cq[wh]/, 'a flex value reads a container unit again')
  assert.match(src, /maxWidth:\s*`calc\(var\(--s\) \* \$\{JETTY_COL_MAX_S\}\)`/, 'the jetty column lost its off-screen cap')
  assert.match(src, /width:\s*`calc\(var\(--s\) \* \$\{BOAT_COL_S\}\)`/, 'the boat column no longer reads BOAT_COL_S')
})

test('the pier runs on to the SCREEN edge, not the safe-area/content edge', () => {
  // PWWCX (owner 2026-11-05, iPhone 844×390): the body clipped at its own box, 47px in (the notch's
  // safe-area inset), so the pier's cut-off end showed beside an empty strip.
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const game = strip(readFileSync(new URL('../FyldBaadenGame.tsx', import.meta.url), 'utf8'))
  const quay = strip(readFileSync(new URL('./Quay.tsx', import.meta.url), 'utf8'))
  const shell = strip(readFileSync(new URL('../../common/GameShell.tsx', import.meta.url), 'utf8'))
  assert.match(game, /<GameShell\b[^>]*\bbleedLeft\b/, 'Fyld Båden clips its pier at the content box again')
  assert.match(shell, /overflow:\s*bleedLeft\s*\?\s*'visible'\s*:\s*'hidden'/, 'GameShell ignores bleedLeft')
  assert.match(quay, /data-boat-jetty-run[\s\S]{0,300}right:\s*'100%',\s*width:\s*'100%'/, 'the pier no longer continues past its art')
  assert.match(quay, /scaleX\(-1\) rotate\(\$\{JETTY_LEVEL_DEG\}deg\)/, 'the continuation is not the mirrored, levelled render')
})

test('"Hør igen" stands on the pier (in the Quay), once, at full size', () => {
  // UDZM5 (owner 2026-11-05): top-left under the back button on a phone it was "weirdly placed", and its
  // phone-landscape scale(0.8) took it to 38px — under the 44px floor.
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const game = strip(readFileSync(new URL('../FyldBaadenGame.tsx', import.meta.url), 'utf8'))
  const quay = strip(readFileSync(new URL('./Quay.tsx', import.meta.url), 'utf8'))
  assert.equal((game.match(/<MathRepeatButton\b/g) ?? []).length, 1, 'one Hør igen')
  assert.match(game, /aboveSlot=\{<MathRepeatButton\b/, 'Hør igen left the pier')
  assert.doesNotMatch(game, /scale\(0\.\d+\)/, 'a shrink transform is back on the game board')
  assert.match(quay, /\{aboveSlot\}/, 'the Quay no longer renders its slot')
})
