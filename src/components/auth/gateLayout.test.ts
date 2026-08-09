// The adult gate's layout contract, and the reason the gate opens instantly.
//
// Both of these regress SILENTLY. A keypad that goes back to fixed pixel widths still renders, still
// takes taps and still passes every other test — it is just unusable with a finger on the one device
// the app is for. And re-`await`ing the bug-report capture in front of the PIN gate costs 1-2 seconds
// on every open with nothing anywhere to notice it.
//
// These are SOURCE guards, like `guestAdultGate.test.ts` next door, because the properties are about
// which mechanism is used rather than about a value that can be computed. The measured properties —
// square keys ≥ 44px, reachable by `elementFromPoint`, zero overflow — are checked by driving the real
// thing (see `.claude/skills/ui-screenshot/`); a unit test has no layout engine and would be pretending.
//
// COMMENTS ARE STRIPPED FIRST. A prose mention of the constant in the "why" comment above a fix once
// satisfied a plain `includes()` and kept a guard green after the fix itself had been deleted
// (`authOverlayZ.test.ts` carries the same scar).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..', '..')

const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const codeOf = (rel: string): string => strip(readFileSync(path.join(SRC, rel), 'utf8'))

/** Every .tsx under src/, so a new gate cannot be added outside the guards below. */
const allTsx = (): string[] => {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx$/.test(entry.name)) out.push(full)
    }
  }
  walk(SRC)
  return out
}

/** The files that mount a keypad inside a dialog — i.e. every adult gate, wherever it lives. */
const gateHosts = (): { rel: string; code: string }[] =>
  allTsx()
    .map((full) => ({ rel: path.relative(SRC, full).replace(/\\/g, '/'), code: strip(readFileSync(full, 'utf8')) }))
    .filter((f) => /<Dialog[\s>]/.test(f.code) && /<(PinPad|Keypad)[\s/>]/.test(f.code))

test('there is ONE keypad, and it is not duplicated back into a host', () => {
  // PinPad and GuestAdultGate carried byte-identical grids for months, and only one of them ever
  // received the landscape height fix. That drift is the thing being prevented, not the duplication.
  const hosts = gateHosts()
  assert.ok(hosts.length >= 3, `expected the PIN, setup and deletion gates at least; found ${hosts.length}`)
  const offenders = hosts.filter((f) => /gridTemplateColumns:\s*['"`]repeat\(3/.test(f.code))
  assert.deepEqual(
    offenders.map((f) => f.rel),
    [],
    `these hand-roll a 3-column keypad instead of using <Keypad>: ${offenders.map((f) => f.rel).join(', ')}`,
  )
})

test('the keypad sizes the GRID by aspect ratio, never the individual keys by pixels', () => {
  const code = codeOf('components/auth/Keypad.tsx')

  // The mechanism: one 3:4 box, so three columns over four rows are square on every viewport.
  assert.match(code, /aspectRatio:\s*['"`]3 \/ 4['"`]/, 'the pad no longer derives its size from a 3:4 box')
  assert.match(code, /gridTemplateRows:\s*['"`]repeat\(4/, 'the four rows are no longer explicit tracks')

  // The shapes it replaced. `3 / 2` cells on a 390px phone measured 68 x 45.
  assert.doesNotMatch(code, /aspectRatio:\s*['"`]3 \/ 2['"`]/, 'the old wide-and-short cell is back')
  assert.doesNotMatch(
    code,
    /maxWidth:\s*(216|198|260)\b/,
    'the old fixed phone pad widths are back — they cannot respond to available HEIGHT',
  )
  assert.doesNotMatch(code, /height:\s*44\b/, 'the old fixed 44px landscape key height is back')

  // WebKit-only regression: shrink-to-fit makes the width min-content, not aspect-derived, and the
  // pad came back 123 x 287 with 36px keys in Safari while Chrome rendered it perfectly.
  assert.doesNotMatch(
    code,
    /flex:\s*['"`]0 1 auto['"`]/,
    'the keypad box shrink-to-fits again — WebKit then sizes it from min-content, not the aspect ratio',
  )
})

test('every gate wears the shared shell, and the shell is full-screen + safe-area padded on a phone', () => {
  const shell = codeOf('components/auth/gateDialog.ts')

  // The reported bug: an installed PWA has no browser chrome, so the home indicator sits INSIDE the
  // viewport and the bottom key row was underneath it.
  for (const side of ['top', 'bottom', 'left', 'right']) {
    assert.match(
      shell,
      new RegExp(`env\\(safe-area-inset-${side}`),
      `the ${side} safe-area inset is gone — a full-bleed PWA will clip against it`,
    )
  }
  // Both halves, separately: a bare /fullScreen/ was satisfied by the word appearing anywhere in the
  // file and survived a mutation that renamed the returned field — caught by re-breaking, not reading.
  assert.match(
    shell,
    /const fullScreen = useMediaQuery\(PHONE_ANY\)/,
    'full-screen is no longer decided by the shared phone guard',
  )
  assert.match(shell, /^\s*fullScreen,$/m, 'the shell no longer hands `fullScreen` to its hosts')

  // `--vh` is maintained against visualViewport; `100%` is measured against a viewport iOS changes.
  assert.match(shell, /var\(--vh, 1vh\)/, 'the shell no longer sizes against --vh')

  // A paper `maxWidth` sits on the same element as the Dialog's own maxWidth="xs" at higher
  // specificity, and silently defeats it: the paper measured 960px wide on an iPad.
  assert.doesNotMatch(shell, /maxWidth:/, 'a paper maxWidth here overrides the Dialog maxWidth="xs"')

  // The owner's hard requirement. `auto` would turn a layout failure into a silent scrollbar that
  // nobody sees on a touch device — which is exactly how the reported bug hid.
  assert.match(shell, /overflow:\s*['"`]hidden['"`]/, 'the shell content can scroll again')
  assert.doesNotMatch(shell, /overflowY?:\s*['"`](auto|scroll)['"`]/, 'a gate surface is scrollable again')

  const offenders = gateHosts().filter((f) => !/useGateDialogShell\(\)/.test(f.code))
  assert.deepEqual(
    offenders.map((f) => f.rel),
    [],
    `these mount a keypad in a Dialog without the shared shell: ${offenders.map((f) => f.rel).join(', ')}`,
  )
})

test('the gate is never gated on the bug-report screenshot', () => {
  // THE regression this whole change exists to prevent: `await captureScreenshot()` in front of
  // `requirePin` cost a cold snapdom import + a full-document computed-style walk + an embedFonts
  // rasterise (~0.9s by its own measurement) before the modal could paint.
  const code = codeOf('components/adult/AdultCorner.tsx')
  assert.doesNotMatch(
    code,
    /await\s+captureScreenshot/,
    'the corner button waits for the capture again — the gate cannot paint until it finishes',
  )
  assert.match(code, /requirePin\('adultMenu'\)/, 'the adult gate is gone from the corner button')
  assert.match(code, /onPointerDown=\{warmScreenshot\}/, 'the snapdom chunk is no longer warmed on press')
})

test('anything that can be OPEN during a capture removes itself from the picture', () => {
  // The capture now runs behind the gate, so a surface that opens over the subject has to drop out of
  // the clone — otherwise the report shows the gate (or the settings screen) instead of the broken
  // game, which is the one property the pre-gate capture existed to guarantee.
  const mustExclude = [...gateHosts().map((f) => f.rel), 'components/adult/AdultSettings.tsx']
  const offenders = mustExclude.filter((rel) => !/\{\.\.\.captureExcludeProps\}/.test(codeOf(rel)))
  assert.deepEqual(offenders, [], `these can be captured into a bug report: ${offenders.join(', ')}`)

  // And the marker must go on the Dialog ROOT, not the paper: MUI renders the dim backdrop as a
  // sibling of the paper, so marking the paper alone leaves a grey slab over the whole capture.
  const gate = codeOf('components/auth/GuestAdultGate.tsx')
  const rootAt = gate.indexOf('{...captureExcludeProps}')
  const paperAt = gate.indexOf('slotProps=')
  assert.ok(rootAt > 0 && rootAt < paperAt, 'the capture marker moved onto the paper — the backdrop stays')
})

test('the capture does not mutate the live surfaces it is excluding', () => {
  // `stabilizeForCapture` writes `backdrop-filter: none !important` and pins margins on the REAL DOM.
  // With the capture running behind an open dialog, that would flicker the gate the adult is reading.
  //
  // Both assertions name the USE SITE, not the identifier. Matching the bare constant passed against a
  // build where the filter had been deleted and only the import remained — re-breaking found it.
  const code = codeOf('services/screenshotService.ts')
  assert.match(
    code,
    /!isExcluded\(el\)/,
    'stabilizeForCapture no longer skips the excluded subtrees — it will flicker the open gate',
  )
  assert.match(
    code,
    /exclude:\s*\[\.\.\.CAPTURE_EXCLUDE_SELECTORS\]/,
    'the clone no longer excludes the marked surfaces',
  )

  // The redaction layer must survive the addition, not be replaced by it — see captureExclude.ts.
  const sel = codeOf('services/captureExclude.ts')
  assert.match(sel, /\[data-bl-redact\]/, 'the redaction selector was dropped from the exclude set')
  assert.match(sel, /data-capture-exclude/, 'the capture-exclude attribute is gone')
})
