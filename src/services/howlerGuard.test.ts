import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardHowlCleanBuffer } from './howlerGuard.ts'

// A faithful stand-in for Howler 2.2.4's _cleanBuffer: it dereferences node.bufferSource with no
// null-check on the node itself, so calling it with undefined throws (the production crash).
function makeHowlerLikeProto() {
  return {
    _cleanBuffer(this: unknown, node: unknown) {
      const n = node as { bufferSource?: unknown }
      if (!n.bufferSource) return this // throws when node is undefined
      n.bufferSource = null
      return this
    },
    __cleanBufferGuarded: undefined as boolean | undefined,
  }
}

test('unguarded _cleanBuffer(undefined) throws (reproduces the crash)', () => {
  const proto = makeHowlerLikeProto()
  assert.throws(() => proto._cleanBuffer(undefined))
})

test('THE FIX: guarded _cleanBuffer(undefined) no longer throws', () => {
  const proto = makeHowlerLikeProto()
  guardHowlCleanBuffer(proto)
  assert.doesNotThrow(() => proto._cleanBuffer(undefined))
})

test('guarded _cleanBuffer still cleans a real node', () => {
  const proto = makeHowlerLikeProto()
  guardHowlCleanBuffer(proto)
  const node = { bufferSource: {} as unknown }
  proto._cleanBuffer(node)
  assert.equal(node.bufferSource, null)
})

test('is idempotent — double-guarding does not double-wrap', () => {
  const proto = makeHowlerLikeProto()
  guardHowlCleanBuffer(proto)
  const afterFirst = proto._cleanBuffer
  guardHowlCleanBuffer(proto)
  assert.equal(proto._cleanBuffer, afterFirst)
  assert.equal(proto.__cleanBufferGuarded, true)
})

test('no-op on a prototype without _cleanBuffer', () => {
  const proto: { _cleanBuffer?: unknown } = {}
  assert.doesNotThrow(() => guardHowlCleanBuffer(proto as Parameters<typeof guardHowlCleanBuffer>[0]))
  assert.equal(proto._cleanBuffer, undefined)
})
