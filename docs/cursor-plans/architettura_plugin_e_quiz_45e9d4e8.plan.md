---
name: Architettura plugin e Quiz
overview: "Telecomando = primo plugin (`remote`); Quiz = secondo plugin sullo stesso host LAN. Monorepo/pacchetti; stesso server HTTP+WS, path e channel namespaced."
todos:
  - id: align-telecomando-plan
    content: "Piano telecomando implementa host minimale + plugin `remote` (primo plugin); Quiz si aggiunge come secondo modulo sullo stesso server"
    status: pending
  - id: define-plugin-api
    content: "Contratto host↔plugin (lifecycle, mountHttpRoutes, registerWebSocket channel, dispose); prima implementazione = carica solo plugin remote"
    status: pending
  - id: local-transport
    content: "Un solo server HTTP+WS in main: mount da plugin (`/remote/*`, `/quiz/*`, API v1 per id); evitare due porte"
    status: pending
  - id: quiz-package
    content: "Modulo Quiz: stato round, join mobile, scoring server-side, vista output classifica"
    status: pending
isProject: false
---

# Plugin: dove vivono e come pensare al Quiz

## Telecomando = primo plugin

Sì: il modello plugin può (e conviene) **iniziare dal telecomando**. Il piano [telecomando_qr_launchpad_8f3ad2a1.plan.md](./telecomando_qr_launchpad_8f3ad2a1.plan.md) è aggiornato in questo senso: **host** con server LAN unico + **plugin `remote`** che monta `/remote/`, `/api/remote/v1`, messaggi WS `channel: "remote"`. Il Quiz diventa naturalmente il **secondo** plugin (`quiz`, `/quiz/`, `channel: "quiz"`) senza duplicare il trasporto.

Esempio naming pacchetti: `packages/regia-plugin-api` (tipi contratto), `packages/regia-plugin-remote` (telecomando), `packages/regia-plugin-quiz` — oppure cartelle `plugins/remote` e `plugins/quiz` finché non estrai i package.

---

## Allineamento con il piano Telecomando (LAN + QR)

Il lavoro in [telecomando_qr_launchpad_8f3ad2a1.plan.md](./telecomando_qr_launchpad_8f3ad2a1.plan.md) non è solo “infrastruttura”: è **prima implementazione del contratto plugin** + feature telecomando.

- **Opzione A**: server HTTP (+ WebSocket) nel **main**, bind LAN, **token nel QR** (URL sotto `/remote/?token=…` come in quel piano).
- Il plugin `remote` usa la pipeline regia: playlist via IPC, `playback:send` / `PlaybackCommand` (dettagli nel piano telecomando).

**Plugin Quiz**: stesso server, route e channel dedicati, secondo QR o link dalla regia; token e policy LAN restano nell’host.

---

## Risposta diretta: repo unico vs progetto per plugin

**Non serve un repository Git separato per ogni plugin** a meno che non ci siano team, licenze o segreti davvero isolati. L’approccio più solido per la tua app (Electron + React in [`package.json`](/Users/mauroandreoni/Regia%20Video/package.json)) è un **monorepo** con **pacchetti separati** (es. `packages/regia-plugin-api`, `packages/regia-plugin-remote`, `packages/regia-plugin-quiz`):

- **Ciclo di aggiornamento indipendente**: ogni pacchetto ha versione propria (npm workspaces + [changesets](https://github.com/changesets/changesets) o equivalente); puoi pubblicare solo il plugin su registry privato o includerlo nel build dell’app quando serve.
- **Confini chiari**: il core espone solo un **contratto** (tipi, hook, capacità dichiarate); il plugin implementa UI + logica senza toccare ovunque `RegiaContext`.
- **Build Electron**: i plugin “seri” in Electron finiscono quasi sempre **bundlati** o copiati in `app.asar` / cartella `resources`: il “progetto separato” è il **pacchetto**, non per forza un altro repo.

**Repo separati** hanno senso se: plugin sviluppati da terzi con NDA, open source separato, o CI/release completamente disaccoppiate; il costo è duplicazione di toolchain, allineamento versioni API e integrazione manuale nel build.

**Sintesi consigliata**: **monorepo + un package per plugin**; estrai in repo separato solo quando il confine organizzativo lo impone.

---

## Cosa mettere nel core vs nel plugin

| Nel progetto principale (host) | Nel modulo plugin |
|-------------------------------|-------------------|
| Definizione API plugin (lifecycle, registry, mount route/WS) | Plugin **remote**: UI telecomando, API playlist/pad, comandi playback; plugin **quiz**: domande, classifica, join giocatori |
| Caricamento / wiring (abilitazione server LAN, menu Impostazioni) | Regole di punteggio Quiz (300→200, 0, -50→-200); logica pad/slot nel solo `remote` |
| Infrastruttura condivisa: **un solo server HTTP/WS** in [`electron/main.ts`](/Users/mauroandreoni/Regia%20Video/electron/main.ts) avviato dall’host; i plugin solo registrano mount | Handler WS per `channel` quiz; niente seconda porta |

Oggi il pattern più vicino a “più superfici sincronizzate” è il **floater playlist** via payload serializzabile ([`src/floater/playlistFloaterSync.ts`](/Users/mauroandreoni/Regia%20Video/src/floater/playlistFloaterSync.ts)): per il Quiz replicheresti l’idea (stato + comandi) ma verso **client browser su smartphone** invece che verso un’altra finestra Electron.

---

## Esempio PLUGIN QUIZ (stesso canale LAN del telecomando)

**Flusso concettuale** (LAN, router comune):

```mermaid
sequenceDiagram
  participant Host as Host_Electron
  participant Srv as Local_HTTP_WS
  participant Phone as Smartphone_browser
  participant Out as Output_second_screen

  Host->>Srv: avvia_sessione_quiz
  Phone->>Srv: WebSocket_join_token
  Host->>Out: domande_e_classifica
  Phone->>Srv: risposta_timestamp
  Srv->>Host: eventi_aggregati
  Host->>Out: aggiorna_classifica
```

- **Smartphone**: pagina web leggera (stesso WiFi, URL tipo `http://IP-PC:PORTA/quiz?token=…`) con pulsanti A/B/C/D; niente installazione se non vuoi.
- **Schermo regia / output**: finestra o canale già usato per il video ([`src/OutputApp.tsx`](/Users/mauroandreoni/Regia%20Video/src/OutputApp.tsx)) esteso o dedicato al plugin per domande + classifica in tempo reale.
- **Punteggi**: conviene centralizzare nel **server (main process)** per avere un solo orologio di riferimento, ordinare i “correct” per tempo di arrivo del messaggio e applicare le tue fasce (es. mappatura lineare 300→200 sul tempo relativo all’apertura della domanda, soglie per astensione e penalità per errore).

**Attenzioni pratiche**: firewall macOS, binding su `0.0.0.0` vs solo localhost, HTTPS opzionale in LAN, token di sessione per evitare join casuali, e latenza rete (per una classifica “velocità” il confronto è coerente se tutti usano lo stesso server come riferimento temporale).

---

## Prossimi passi se vorrai implementarlo

1. **Contratto plugin + host LAN** nello stesso incremento: registry, avvio/stop server, smistamento envelope WS; vedi todo `plugin-host-minimum` nel piano [telecomando](./telecomando_qr_launchpad_8f3ad2a1.plan.md).
2. **Plugin `remote`**: tutto ciò che oggi è descritto come telecomando (token QR `/remote/`, schede playlist/launchpad, `playback:send`).
3. **Plugin `quiz`**: UI mobile, round, classifica su [`OutputApp`](/Users/mauroandreoni/Regia%20Video/src/OutputApp.tsx) o finestra dedicata, mount `/quiz/` e `channel: "quiz"`.

Non è necessario decidere subito monorepo tooling (workspaces): si può iniziare con `plugins/remote` e `plugins/quiz` nel repo ed estrarre in package quando l’API si stabilizza.
