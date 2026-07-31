// A SEPARATE hook from useProgress, deliberately (accounts PRD §5.9): sync status changes on every
// tick, and folding it into useProgress would re-render the whole world — every game board, the scene,
// the mascot — for a timestamp only the adult menu reads.

import { useSyncExternalStore } from 'react'
import { progressSync, type SyncStatus } from '../services/progressSync'

const subscribe = (cb: () => void) => progressSync.subscribe(cb)
const getSnapshot = () => progressSync.getStatus()

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
