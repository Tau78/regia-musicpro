/**
 * Popola public/launchpad-sfx/ e public/launchpad-base/ con campioni reali (CC0).
 * Rimuove i vecchi toni sintetici pad-*.wav da launchpad-base.
 *
 * Richiede rete. Esegui: npm run gen:launchpad-sfx
 */
import { fetchRealLaunchpadKits } from './launchpad-real-kit-fetch.mjs'

await fetchRealLaunchpadKits()
