// DOM screenshot for bug reports (Bug Report feature).
//
// snapdom renders the live DOM to a canvas — no getDisplayMedia (not viable on iPad, would
// prompt). Loaded via dynamic import so the capture code ships as a lazy chunk and never
// weighs on the home bundle.

/**
 * Capture document.body → downscaled JPEG data URL. Resolves null on failure OR timeout —
 * a report without a screenshot beats a reporter that hangs. Never throws.
 */
export async function captureScreenshot(opts?: {
  maxDim?: number
  quality?: number
  timeoutMs?: number
}): Promise<string | null> {
  const { maxDim = 1600, quality = 0.75, timeoutMs = 2500 } = opts ?? {}
  try {
    const work = (async () => {
      const { snapdom } = await import('@zumer/snapdom')
      const largestSide = Math.max(window.innerWidth, window.innerHeight, 1)
      const canvas = await snapdom.toCanvas(document.body, {
        // dpr defaults to devicePixelRatio (2-3x on iPad) — pin to 1, layout is what matters.
        dpr: 1,
        scale: Math.min(1, maxDim / largestSide),
        fast: true,
        // Safari's font embedding is the slow path; fallback glyphs are fine for diagnosis.
        embedFonts: false,
        backgroundColor: '#ffffff',
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
  }
}
