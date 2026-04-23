import type { SavedPlaylistKind } from '../playlistTypes.ts'

type PanelKind = SavedPlaylistKind | 'sottofondo' | undefined

/** Voce nella lista «Preset» (salvati su disco). */
export function previewHintSavedListRow(mode: PanelKind): string {
  const m = mode ?? 'tracks'
  if (m === 'launchpad') {
    return 'Launchpad salvato: clic per portare in primo piano se già aperto; doppio clic per aprire senza interrompere play/uscita. Tasto destro: duplica o elimina; trascina per riordinare.'
  }
  if (m === 'chalkboard') {
    return 'Lavagna salvata: clic per portare in primo piano se già aperta; doppio clic per aprire senza interrompere play/uscita. Tasto destro: duplica o elimina; trascina per riordinare.'
  }
  return 'Playlist salvata: clic per portare in primo piano se già aperta; doppio clic per aprire senza interrompere play/uscita. Tasto destro: duplica o elimina; trascina per riordinare.'
}

/** Voce in «Pannelli aperti» (sidebar). */
export function previewHintSidebarOpenPanelRow(mode: PanelKind): string {
  const m = mode ?? 'tracks'
  if (m === 'launchpad') {
    return 'Launchpad aperto: clic per portarlo in primo piano sulla plancia. Trascina per riordinare l’elenco nella sidebar.'
  }
  if (m === 'chalkboard') {
    return 'Lavagna aperta: clic per portarla in primo piano sulla plancia. Trascina per riordinare l’elenco nella sidebar.'
  }
  if (m === 'sottofondo') {
    return 'Sottofondo aperto: audio in uscita indipendente dal trasporto globale; un solo pannello (non compare tra i preset su disco). Clic per primo piano; trascina per riordinare.'
  }
  return 'Playlist aperta: clic per portarla in primo piano sulla plancia. Trascina per riordinare l’elenco nella sidebar.'
}

export const previewHintNewEmptyPlaylist =
  'Nuova playlist vuota: apre un pannello floating con elenco brani sulla plancia.'

export const previewHintNewEmptyLaunchpad =
  'Nuovo launchpad vuoto: apre un pannello con griglia 4×4 campioni sulla plancia.'

export const previewHintNewLaunchpadSfx =
  'Launchpad preset SFX: apre un launchpad con kit campioni precaricato sulla plancia.'

export const previewHintNewChalkboard =
  'Nuova lavagna: apre un pannello chalkboard (disegno e testo) sulla plancia.'

export const previewHintNewSottofondo =
  'Nuovo sottofondo: pannello unico con play/stop sul pannello e audio in uscita indipendente; elenco e impostazioni restano nel workspace (niente salvataggio in PLAYLIST; in futuro: setlist interne).'

export const previewHintFilterTracks =
  'Filtro playlist a brani: nell’elenco salvati mostra solo le playlist con elenco file (combinabile con altri filtri).'

export const previewHintFilterLaunchpad =
  'Filtro launchpad: nell’elenco salvati mostra solo i launchpad (combinabile con altri filtri).'

export const previewHintFilterChalkboard =
  'Filtro lavagna: nell’elenco salvati mostra solo le chalkboard (combinabile con altri filtri).'
