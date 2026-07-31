// React binding for profileStore, mirroring useProgress.ts / useAuth.ts (useSyncExternalStore over a
// singleton). `getSnapshot` returns the store's cached state object — a STABLE reference between
// publishes — because a freshly built object per call is an infinite re-render loop.

import { useSyncExternalStore } from 'react'
import { profileStore, type AccountState } from '../services/profileStore'

const subscribe = (cb: () => void) => profileStore.subscribe(cb)
const getSnapshot = () => profileStore.get()

export function useProfiles(): AccountState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
