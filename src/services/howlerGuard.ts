// Guards Howler 2.2.4's known iOS/Safari WebAudio crash. Extracted from sfxClient so it's unit-testable
// without importing the whole Howler runtime (which needs a browser AudioContext).
//
// Howl.prototype._cleanBuffer(node) is called from an internal _ended timer with node = the sound's
// _node, which can already be undefined after the node pool was torn down (fast tapping / stopAll).
// It then does `if (!node.bufferSource)` and throws `undefined is not an object (evaluating
// 'a.bufferSource')` as an UNCAUGHT window error — seen in production crash reports on iOS. Upstream
// is unfixed (2.2.4 is the latest release), so we patch the prototype once to no-op on a missing node.

interface CleanBufferProto {
  _cleanBuffer?: (this: unknown, node: unknown) => unknown
  __cleanBufferGuarded?: boolean
}

export function guardHowlCleanBuffer(proto: CleanBufferProto | null | undefined): void {
  if (!proto || typeof proto._cleanBuffer !== 'function' || proto.__cleanBufferGuarded) return
  const orig = proto._cleanBuffer
  proto._cleanBuffer = function (this: unknown, node: unknown) {
    if (!node) return this
    try {
      return orig.call(this, node)
    } catch {
      // Mirror Howler's own final step so the node's state stays consistent after a partial cleanup.
      try {
        ;(node as { bufferSource?: unknown }).bufferSource = null
      } catch {
        /* ignore */
      }
      return this
    }
  }
  proto.__cleanBufferGuarded = true
}
