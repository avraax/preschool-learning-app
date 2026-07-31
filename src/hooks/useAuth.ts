// React binding for authStore, mirroring useProgress.ts exactly (useSyncExternalStore over a
// singleton). `getSnapshot` returns the store's cached snapshot object — a STABLE reference between
// publishes — because returning a freshly built object per call is an infinite re-render loop.

import { useSyncExternalStore } from 'react'
import { authStore, type AuthSnapshot } from '../services/authStore'

const subscribe = (cb: () => void) => authStore.subscribe(cb)
const getSnapshot = () => authStore.get()

export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
