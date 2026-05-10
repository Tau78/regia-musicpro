---
name: Titoli e Gobbo — stato piano vs codice
overview: "Traccia cosa è stato implementato nel codice rispetto al piano originale. Il file hashato locale va eliminato a mano se ancora presente."
isProject: false
---

# Titoli e Gobbo — implementazione

## File deprecati

- **`titoli_e_gobbo_da6071ac.plan.md`** e **`titoli_e_gobbo_e32499fc.plan.md`**: non usare; rimossi dal repo in favore di questo documento e del codice.
- Se sul tuo Mac esiste ancora `~/.cursor/plans/titoli_e_gobbo_*.plan.md`, puoi cancellarlo: non è più la fonte di verità.

## Completezza del piano (lacune principali)

| Area | Stato |
|------|--------|
| **`titlesLayer` verso Output + main flush** | Fatto (`playbackTypes`, `main.ts`, `OutputApp`, `TitleOverlayView`) |
| **Pannello Titoli regia + preset + PreviewBlock** | **Parziale**: renderer Output ok; **manca** editor regia, debounce, preset utente, overlay anteprima programma |
| **Gobbo session singleton `ensureGobboSingleton`** | Fatto (`RegiaContext`, fan menu) |
| **Gobbo finestra dedicata + IPC + LAN scroll** | **Manca** (`gobbo.html`, sync snapshot, `RemoteDispatchPayload` esteso) |
| **Preset Gobbo / Titoli a cartelle** | **Manca** |
| **Menu «+» ventaglio** | Fatto (`NewPanelFanMenu`, `SavedPlaylistsPanel`) |
| **Playlist `playlistItems` stop/macro + migrazione** | **Parziale**: tipi, migrazione sessioni, playback stop/macro base, UI righe stop/macro; **manca** UI «aggiungi stop/macro», persistenza JSON salvati (`saved-playlists.json`), cloud snapshot |
| **Presenter Bluetooth Impostazioni** | **Manca** |

## Dettaglio tecnico recente

- Elenco programma: `playlistItems` opzionale su sessione tracks; `effectivePlaylistRows` allinea indici con Output.
- Macro MVP: `loadSavedPlaylistAndPlay` con guardrail profondità (8).
- Badge logo Schermo 2 spostato sopra il layer titoli (`z-index`).

---

Per il piano funzionale completo vedi la disciplina architetturale nel codice e nei commenti dei componenti citati sopra.
