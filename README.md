# VANTAGGIO 4.2 — The Football Intelligence Experience

Portale calcistico responsive in italiano che unisce calendario globale, live score, probabilità e **Match Intelligence** in un’identità ibrida esclusiva: regia broadcast, data room e magazine editoriale. Funziona senza API a pagamento, senza account utente e senza dipendenze npm.

## Esperienza V4 per ogni sezione

- **Dashboard / Daily Briefing**: pulse live, agenda delle 48 ore, segnale Intelligence, copertura e ticker broadcast scorrevole.
- **Partite / Matchday Command**: ora ufficiale Europe/Rome, live control, prossimo kickoff, densità del programma e calendario a giornate.
- **Radar / Signal Studio**: podio delle priorità, registro segnali/rischio e tavolo completo di selezione.
- **News / VANTAGGIO Newsroom**: apertura editoriale, titoli secondari, classificazione tematica, data ed editore visibili.
- **Classifiche / Table Lab**: capolista, distacco, miglior attacco/difesa, ritmo gol, PPG e lettura della corsa.
- **Preferiti / My Matchroom**: countdown, prossimo evento, dossier consultati, alert e privacy locale.
- **Scout Search**: ricerca trasversale di partite, squadre, competizioni e notizie con navigazione da tastiera.
- **Match dossier**: Power Model 2.1 e Intelligence Room rimangono il livello più profondo.

## Specialità V4.1

- **What Changed Desk**: crea una baseline locale e segnala nuovi eventi, variazioni di orario o sede, inizio/fine, punteggi, lineup e nuovi segnali pre-partita. Il registro resta sul dispositivo.
- **Kickoff Watch**: per le partite salvate esegue un ricontrollo mirato a 60, 30 e 10 minuti dal calcio d’inizio, senza polling costoso continuo; può notificare quando il browser è aperto.
- **Team DNA**: dossier squadra richiamabile dal match, dalla ricerca o dalla classifica, con risultati, split casa/trasferta, fingerprint tecnico, fatti, letture e limiti del campione.
- **Data Reliability Ledger**: valuta separatamente contesto, calendario, boxscore tecnici, formazioni, news e disponibilità. Misura la qualità informativa, non la certezza di un pronostico.
- Lo **Scenario Lab** non è incluso, come richiesto.

## Deep Research V4.2

- **Deep Research Brief** pre-partita: trasforma contesto, forma, riposo, precedenti, stili e segnali del modello in una lettura editoriale strutturata.
- **Deep Match Review** post-partita: usa risultato, possesso, tiri, tiri in porta, passaggi, disciplina e momenti decisivi realmente presenti nel feed.
- Le partite globali di **ieri** sono ora scoperte insieme a oggi e domani; la striscia date include “Ieri”.
- Dopo il fischio finale il Power Model viene archiviato e non ricalcolato sul risultato già noto.
- **Season Vault** riassume l’intera stagione precedente e il torneo principale con partite, bilancio e gol, chiarendo sempre l’ambito del dato.
- Quando il feed offre prezzi reali, un **Market Snapshot** mostra provider e quote decimali con avviso di volatilità; xG, assenze o quote non disponibili vengono dichiarati mancanti anziché inventati.
- Caso di controllo: PSG–Aston Villa, Supercoppa UEFA del 12 agosto 2026, risultato 2-1 e review verificata sui dati reali della gara.

## Match Intelligence

Ogni partita analizzabile apre due livelli distinti.

### Power Model 2.1

- probabilità 1-X-2 e confronto con il solo modello statistico;
- gol attesi, risultato modale, Over/Under e Goal/No Goal;
- ultime cinque partite, rendimento casa/trasferta e precedenti;
- classifica e consenso di mercato senza margine, quando disponibili;
- segnali ordinati, qualità del campione e profilo di rischio.

### Intelligence Room

- fase della competizione, andata/ritorno, aggregato e posta reale;
- stadio e contesto casa/trasferta;
- giorni di riposo, partite nei 14 giorni precedenti e prossimo impegno;
- campioni tecnici recenti con possesso, tiri, tiri in porta, corner, passaggi, contrasti, respinte e cartellini;
- profili tattici e possibile copione della gara, derivati da evidenze visibili;
- statistiche nel torneo e leader per gol, assist, tiri, passaggi o parate;
- stato esplicito delle formazioni ufficiali;
- News Pulse datato e filtrato sulla partita;
- Red Flags su campione ridotto, rotazioni, nuova stagione, calendario e dati mancanti;
- separazione visiva fra **Fatto**, **Lettura** e **Da verificare**.

La Intelligence Room viene caricata solo quando si apre una partita. Le chiamate più costose sono limitate e memorizzate in cache.

## Altre funzioni

- dashboard premium responsive con tema scuro/chiaro;
- scoperta globale delle partite, non limitata ai cinque principali campionati;
- filtri dinamici per data e competizione;
- aggiornamento automatico ogni 90 secondi;
- live score e stato degli incontri;
- Match Radar con indice trasparente 0–100;
- Power Picks ordinati per segnale, rischio e qualità;
- notizie aggregate con link alla fonte originale;
- classifiche di Serie A, Premier League, LaLiga, Bundesliga e Ligue 1;
- ricerca globale (`Ctrl/Cmd + K`);
- preferiti e alert locali persistenti nel browser;
- cache server con fallback sull'ultima risposta valida;
- PWA installabile e interfaccia dedicata ad Android Chrome.

## Fonti gratuite

- **ESPN public feeds**: calendario, risultati, classifiche, summary dell'evento, aggregato, venue, statistiche tecniche, calendari squadra, leader e lineup.
- **Google News RSS**: soli titoli datati e link agli editori per il News Pulse della singola partita.
- **ANSA Calcio, Football Italia, ESPN**: flusso generale delle notizie.

Le fonti possono essere parziali o cambiare formato. Il backend normalizza i dati, limita i campioni a tre gare tecniche recenti per squadra e rende visibile quando un'informazione manca. Un feed infortuni vuoto **non** viene interpretato come rosa al completo; un titolo di giornale **non** viene presentato come conferma medica; una shell rosa pre-partita **non** viene chiamata formazione ufficiale.

## Architettura e cache

- Node.js 18+, zero dipendenze runtime;
- `/api/analysis`: Power Model e contesto essenziale, cache 10 minuti;
- `/api/intelligence`: calendario, tattica, copione, giocatori, news e Reliability Ledger, cache separata 10 minuti;
- `/api/team-dna`: profilo squadra, split, fingerprint tecnico e ledger, cache 30 minuti;
- snapshot tecnici recenti: massimo tre eventi per squadra, cache 30 minuti;
- endpoint leggeri per partite, classifiche, notizie e stato servizio;
- asset statici con versionamento cache `4.2.0`; cambio data automatico a mezzanotte nel fuso Europe/Rome.

## Pubblicazione con URL stabile

Il progetto include `render.yaml` per il deploy gratuito su Render, con URL invariato e aggiornamenti automatici da GitHub. Le istruzioni sono in `DEPLOY-RENDER.md`.

## Avvio locale

```bash
npm start
```

Il server usa `PORT=4173` per impostazione predefinita e ascolta su `0.0.0.0`.

## Verifica

Con il server avviato:

```bash
npm run check
npm test
```

Lo smoke test verifica homepage e asset V4.2, archivio globale di ieri, Deep Match Review, partite, notizie, classifica, Power Model 2.1, Match Intelligence 1.1, Reliability Ledger e Team DNA.

## Struttura

- `server.js` — server statico, proxy dati, cache, Power Model e motore Intelligence;
- `public/index.html` — shell accessibile dell'app;
- `public/styles.css` — design system responsive e Intelligence Room;
- `public/app.js` — routing, filtri, ricerca, preferiti, modal e rendering Intelligence;
- `scripts/smoke-test.js` — test end-to-end degli endpoint principali.

## Nota responsabile

VANTAGGIO ordina informazioni e scenari descrittivi: non costituisce una promessa o garanzia di vincita. Le probabilità dipendono dalla disponibilità e qualità dei dati. Nessun modello conosce in anticipo episodi, rotazioni tardive o decisioni tecniche. Uso responsabile, 18+.
