import { BL_TIER } from '../config/backendTarget'
import { DEV } from './devHarness'
import { showsBlocks } from '../config/blocksGate'

/** The runtime binding of `showsBlocks` — staging builds, dev and the harness see Byggeklodser. */
export const blocksShown = (): boolean => showsBlocks(BL_TIER, DEV, false)
