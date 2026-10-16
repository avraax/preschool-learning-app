import { BL_TIER } from '../config/backendTarget'
import { DEV } from './devHarness'
import { showsKrea } from '../config/kreaGate'

/** The runtime binding of `showsKrea` — staging builds, dev and the harness see the Krea section. */
export const kreaShown = (): boolean => showsKrea(BL_TIER, DEV, false)
