export type PlaybackCommand =
  | { type: 'load'; src: string; crossfade?: boolean }
  | { type: 'seek'; seconds: number }
  | { type: 'play' }
  | { type: 'pause' }
  /**
   * Svuota video/immagine sui due slot (uscita «vuota»): dopo stop, fine playlist,
   * brano rimosso, ecc. Non usare per la sola pausa trasporto (resta `pause`).
   */
  | { type: 'programVacant' }
  | { type: 'setMuted'; muted: boolean }
  /** Volume lineare 0–1 sui video in uscita (il mute globale resta indipendente). */
  | { type: 'setVolume'; volume: number }
  /** `''` = dispositivo predefinito di sistema (setSinkId). */
  | { type: 'setSinkId'; sinkId: string }
  | { type: 'setLoopOne'; loop: boolean }
  | { type: 'setCrossfade'; enabled: boolean }
  /** Durata immagine fissa in playlist (secondi, clamp 1–600 in uscita). */
  | { type: 'setStillImageDurationSec'; seconds: number }
  /**
   * Layer immagine sopra il video in uscita (Chalkboard).
   * `composite`: `transparent` = PNG con alpha, sfondo lavagna non inviato (sotto si vede PGM o tappo).
   * `boardBackgroundColor`: con `solid`, colore dietro l’immagine (evita «buchi» alpha letti come nero).
   */
  | {
      type: 'chalkboardLayer'
      visible: boolean
      src?: string
      composite?: 'solid' | 'transparent'
      boardBackgroundColor?: string
    }
  /**
   * Overlay PNG (tipicamente con alpha) fisso sopra PGM, lavagna e tappo in uscita.
   * `src` = path assoluto o URL già normalizzato dal processo main.
   */
  | { type: 'playlistWatermark'; visible: boolean; src?: string }
  /**
   * Sfondo «tappo» quando non c’è nulla in onda (nessun media sui due slot né lavagna visibile).
   * `black` = nero come prima; `color` / `image` = riempi lo schermo finché non arriva un segnale.
   */
  | {
      type: 'setOutputIdleCap'
      mode: 'black' | 'color' | 'image'
      color?: string
      imagePath?: string | null
    }
  /** Logo marchio in alto a sinistra sulla finestra Schermo 2. */
  | { type: 'setOutputProgramLogoVisible'; visible: boolean }
