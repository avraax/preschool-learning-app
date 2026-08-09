// DOM screenshot for bug reports (Bug Report feature).
//
// snapdom renders the live DOM to a canvas — no getDisplayMedia (not viable on iPad, would
// prompt). Loaded via dynamic import so the capture code ships as a lazy chunk and never
// weighs on the home bundle.
//
// HOW SNAPDOM WORKS, because every fidelity bug below follows from it: it CLONES the subtree,
// copies each node's **computed** style onto the clone, and rasterises that through an SVG
// <foreignObject>. So the clone re-runs layout with no stylesheets — only the resolved values
// Chrome/WebKit chose to expose. Anything `getComputedStyle` does not round-trip is LOST, and the
// capture then shows an app the child never saw. `stabilizeForCapture` below re-states those
// values on the live DOM (briefly, then restores) so the clone can reproduce them.

import { needsMarginPin, isFalseEllipsis } from './screenshotFidelity'
import { CAPTURE_EXCLUDE_SELECTOR, CAPTURE_EXCLUDE_SELECTORS } from './captureExclude'

/**
 * Pull the chunk down without capturing anything. Called on the gear's `pointerdown`, so the ~200KB
 * module is already resolved by the time the finger lifts.
 *
 * This is NOT the preloading `vite.config.ts` refuses to do: that rule is about COLD LAUNCH, where a
 * `<link modulepreload>` costs parse work before first paint. This fires on a deliberate adult
 * gesture, minutes into a session.
 */
export function warmScreenshot(): void {
  void import('@zumer/snapdom').catch(() => {})
}

/** One saved inline-style property, so every mutation can be put back exactly as it was. */
type Saved = { el: HTMLElement; prop: string; value: string; priority: string }

const save = (out: Saved[], el: HTMLElement, prop: string) => {
  out.push({
    el,
    prop,
    value: el.style.getPropertyValue(prop),
    priority: el.style.getPropertyPriority(prop),
  })
}

/**
 * Re-state the live layout in terms the computed-style clone can reproduce. Returns a restore()
 * that MUST run (finally) — these mutations are on the real DOM the child is looking at.
 *
 * Reads are batched before writes: one forced reflow, not one per node.
 *
 * EXCLUDED SUBTREES ARE SKIPPED ENTIRELY, and that is not just an optimisation. The capture now runs
 * BEHIND the open adult gate rather than before it, and these writes land on the live DOM: killing
 * `backdrop-filter` and pinning margins under the dialog the adult is reading would flicker it for
 * the length of the capture. Anything dropped from the clone has nothing to stabilise anyway.
 */
function stabilizeForCapture(root: HTMLElement): () => void {
  const saved: Saved[] = []
  const excluded = Array.from(root.querySelectorAll<HTMLElement>(CAPTURE_EXCLUDE_SELECTOR))
  const isExcluded = (el: HTMLElement) =>
    excluded.length > 0 && excluded.some((x) => x === el || x.contains(el))
  const els = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].filter(
    (el) => !isExcluded(el),
  )

  // ---- measure ----------------------------------------------------------------------------
  const marginPins: { el: HTMLElement; left: number; right: number; before: DOMRect }[] = []
  const killBackdrop: HTMLElement[] = []
  const unclip: HTMLElement[] = []

  for (const el of els) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue

    // (a) `backdrop-filter` has no backdrop inside the foreignObject. snapdom paints its region as
    //     a hard, OVERSIZED washed rectangle that covers real content — measured 602px wide for a
    //     520px frosted card, hiding the reef behind Min Bog. Losing the frost is a smaller lie
    //     than a grey slab over the thing being reported.
    if (cs.backdropFilter && cs.backdropFilter !== 'none') killBackdrop.push(el)

    // (b) A label that fits live must not come back ellipsised. snapdom pins each box's computed
    //     WIDTH, and the clone's text can rasterise a fraction wider — so a pill sitting at
    //     128.5px of a 200px max-width truncates to "Tal og Regn…" purely from rounding. Only
    //     elements that are NOT truncated live are un-clipped, so a genuine truncation the child
    //     saw still shows up as one.
    if (cs.textOverflow === 'ellipsis' && isFalseEllipsis(el.scrollWidth, el.clientWidth)) {
      unclip.push(el)
    }

    // (c) `margin: auto` — the big one. `getComputedStyle(el).marginLeft` reports **0px** for an
    //     auto margin (Chrome and WebKit both resolve `auto` to zero, not to the used value), so
    //     every centred block lands hard against its container's left edge in the clone. On the
    //     home page that threw the whole Min Bog shelf ~350px left, under the mascot, and the
    //     report looked like a layout bug that does not exist. Pin the USED gaps instead.
    const parent = el.parentElement
    if (!parent || cs.position === 'absolute' || cs.position === 'fixed') continue
    if (cs.display.startsWith('inline')) continue
    const pcs = getComputedStyle(parent)
    const r = el.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    if (!r.width || !pr.width) continue
    const gapL = r.left - (pr.left + parseFloat(pcs.borderLeftWidth) + parseFloat(pcs.paddingLeft))
    const gapR = pr.right - parseFloat(pcs.borderRightWidth) - parseFloat(pcs.paddingRight) - r.right
    if (needsMarginPin(gapL, gapR, parseFloat(cs.marginLeft) || 0, parseFloat(cs.marginRight) || 0)) {
      marginPins.push({ el, left: gapL, right: gapR, before: r })
    }
  }

  // ---- write ------------------------------------------------------------------------------
  for (const el of killBackdrop) {
    save(saved, el, 'backdrop-filter')
    save(saved, el, '-webkit-backdrop-filter')
    el.style.setProperty('backdrop-filter', 'none', 'important')
    el.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
  }
  for (const el of unclip) {
    save(saved, el, 'overflow')
    el.style.setProperty('overflow', 'visible', 'important')
  }
  for (const { el, left, right } of marginPins) {
    save(saved, el, 'margin-left')
    save(saved, el, 'margin-right')
    el.style.setProperty('margin-left', `${left}px`, 'important')
    el.style.setProperty('margin-right', `${right}px`, 'important')
  }

  const restore = () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      const { el, prop, value, priority } = saved[i]
      if (value) el.style.setProperty(prop, value, priority)
      else el.style.removeProperty(prop)
    }
  }

  // ---- self-check -------------------------------------------------------------------------
  // Pinning the used gaps should be a no-op on the live layout (the element's outer box now fills
  // exactly the space it already occupied). If any pinned element actually MOVED, the heuristic
  // read that container wrong — revert everything rather than photograph a layout we just broke.
  for (const { el, before } of marginPins) {
    const after = el.getBoundingClientRect()
    if (Math.abs(after.left - before.left) > 0.5 || Math.abs(after.right - before.right) > 0.5) {
      restore()
      return () => {}
    }
  }

  return restore
}

/**
 * Capture document.body → downscaled JPEG data URL. Resolves null on failure OR timeout —
 * a report without a screenshot beats a reporter that hangs. Never throws.
 */
export async function captureScreenshot(opts?: {
  maxDim?: number
  quality?: number
  timeoutMs?: number
}): Promise<string | null> {
  const { maxDim = 1600, quality = 0.75, timeoutMs = 5000 } = opts ?? {}
  let restore: (() => void) | null = null
  try {
    const work = (async () => {
      const { snapdom } = await import('@zumer/snapdom')
      const largestSide = Math.max(window.innerWidth, window.innerHeight, 1)
      restore = stabilizeForCapture(document.body)
      const canvas = await snapdom.toCanvas(document.body, {
        // dpr defaults to devicePixelRatio (2-3x on iPad) — pin to 1, layout is what matters.
        dpr: 1,
        scale: Math.min(1, maxDim / largestSide),
        fast: true,
        // Comic Neue / the per-skin title faces are self-hosted @fontsource woff2, so embedding is
        // a same-origin fetch that snapdom caches across captures. It is NOT optional: without it
        // the clone falls back to a wider face and text reflows — four of the five home labels came
        // back ellipsised ("Alfab…", "Ordleg" → "Ord…") and "Hør igen" wrapped to two lines. A
        // report has to show the words the child actually saw. Costs ~0.9s of the budget below.
        embedFonts: true,
        backgroundColor: '#ffffff',
        // NEVER capture an auth surface (accounts PRD §8.1 layer b). Reports land in a PUBLIC-access
        // Vercel Blob, so a PIN pad or a sign-in screen must not be renderable into one. `remove`
        // (not `hide`) so the nodes are dropped from the clone entirely. Every node carrying the
        // attribute is a fixed-position overlay, so removing it doesn't reflow the page beneath.
        //
        // This is one of THREE independent layers — the adult-surface tap is inert while an auth
        // dialog is open, and PinPad renders dots rather than digits — because one layer is not
        // enough for a public blob.
        //
        // `data-capture-exclude` is the SECOND, differently-motivated selector: the adult gate now
        // opens immediately and the capture runs behind it, so the gate (and the settings surface it
        // leads to) must remove itself from a picture that is meant to show the game underneath.
        // See `captureExclude.ts` for why that is not the same concern as redaction.
        exclude: [...CAPTURE_EXCLUDE_SELECTORS],
        excludeMode: 'remove',
      })
      return canvas.toDataURL('image/jpeg', quality)
    })()
    const result = await Promise.race([
      work,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
    return typeof result === 'string' && result.startsWith('data:image/jpeg') ? result : null
  } catch {
    return null
  } finally {
    // Also runs when the timeout wins the race — the capture may still be in flight, but leaving
    // the child's screen with pinned margins and no frost is not an option.
    ;(restore as (() => void) | null)?.()
  }
}
