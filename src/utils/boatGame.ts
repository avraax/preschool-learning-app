import { BL_TIER } from '../config/backendTarget'
import { DEV } from './devHarness'
import { showsBoatGame } from '../config/boatGate'

/** The runtime binding of `showsBoatGame` — staging builds, dev and the harness see Fyld Båden. */
export const boatGameShown = (): boolean => showsBoatGame(BL_TIER, DEV, false)
