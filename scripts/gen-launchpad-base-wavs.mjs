/**
 * Popola public/launchpad-base/ con i campioni reali (CC0, BigSoundBank).
 * Aggiorna anche public/launchpad-sfx/ con lo stesso kit.
 * Rimuove i vecchi toni sintetici pad-01.wav … pad-16.wav.
 *
 * Richiede rete. Esegui: npm run gen:launchpad-base
 */
import { fetchRealLaunchpadKits } from './launchpad-real-kit-fetch.mjs'

await fetchRealLaunchpadKits()
