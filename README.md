# VANTAGGIO 4.4.0 — Transparency & Availability Intelligence

Portale calcistico responsive in italiano che unisce calendario globale, live score, probabilità e **Match Intelligence** in un’identità ibrida esclusiva: regia broadcast, data room e magazine editoriale. Funziona senza API a pagamento, senza account utente e senza dipendenze npm.

## Esperienza V4 per ogni sezione

- **Dashboard / Daily Briefing**: pulse live, agenda delle 48 ore, segnale Intelligence e copertura, senza ticker o anteprime duplicate.
- **Partite / Matchday Command**: ora ufficiale Europe/Rome, live control, prossimo kickoff, densità del programma e calendario a giornate.
- **Radar / Signal Studio**: podio delle priorità e tavolo completo di selezione, senza un secondo registro dei segnali ridondante.
- **News / VANTAGGIO Newsroom**: apertura editoriale, titoli secondari, classificazione tematica, data ed editore visibili.
- **Classifiche / Table Lab**: capolista, distacco, miglior attacco/difesa, ritmo gol, PPG e lettura della corsa.
- **Preferiti / My Matchroom**: countdown, prossimo evento, dossier consultati, alert e privacy locale.
- **Scout Search**: ricerca trasversale di partite, squadre, competizioni e notizie con navigazione da tastiera.
- **Match dossier**: Deep Research/Review è il primo contenuto; il Power Model 2.1 resta disponibile in un cassetto tecnico separato.

## Transparency & Availability Intelligence V4.4

- **Model Track Record**: salva localmente solo la prima lettura realmente vista prima del kickoff. Lo snapshot è immutabile, viene riconciliato con il finale anche nelle visite successive e mostra accuratezza 1-X-2, Brier normalizzato, fiducia media e gap di calibrazione. Non esiste backfill post-hoc.
- **Source Health Center**: espone stato osservato, ultimo successo, errori, chiamate valide, latenza media, ruolo e copertura di ciascuna fonte senza mostrare credenziali o URL sensibili. Salute tecnica e completezza editoriale restano concetti distinti.
- **Availability Intelligence**: combina formazioni ufficiali dell'evento, injury feed espliciti, dataset ufficiale Fantasy Premier League per la sola Premier League e rassegna datata su infortuni, squalifiche, fitness e lineup.
- **Gerarchia delle prove**: lineup e comunicati ufficiali → dataset ufficiali/provider espliciti → reporting forte → segnali da verificare. Sono visibili tier, timestamp, fonte, stato del giocatore e riscontri fra editori; un riscontro editoriale non diventa automaticamente conferma medica.
- **Unknown by design**: feed vuoti, assenza di titoli e silenzio delle fonti non vengono mai tradotti in “rosa al completo”. Le formazioni ufficiali prevalgono su segnalazioni precedenti incompatibili.
- **What Changed per partita**: ogni dossier contiene la propria cronologia locale di orario, sede, stato, punteggio, lineup e nuovi segnali, oltre al desk aggregato in dashboard.
- **Table Lab esteso**: il catalogo classifiche è separato da quello del calendario e comprende 16 competizioni verificate sul feed, senza appesantire le richieste dello scoreboard globale.
- L'estensione **offline PWA** non è stata implementata, come richiesto: aggiornamenti e fonti live richiedono connessione.

## Dossier Cleanup V4.3

- **Analisi approfondita in primo piano su ogni partita**: il modal carica Match Intelligence prima del modello numerico e rende subito evidente il Deep Research Brief o la Deep Match Review.
- **Copertura garantita ma trasparente**: se la richiesta Intelligence fallisce, compare un dossier ridotto con soli dati verificati di calendario, forma e modello eventualmente disponibile. La copertura parziale è dichiarata e non viene presentata come ricerca completa.
- **Gerarchia più pulita**: sotto l'analisi principale restano tre sintesi di evidenza, red flags compatte e cinque cassetti opzionali per verificare tattica, calendario, numeri, news e affidabilità.
- **Power Model separato**: probabilità e scenari quantitativi sono conservati in un cassetto tecnico chiuso, così non nascondono più la lettura editoriale.
- **Meno ripetizioni**: rimossi ticker broadcast, anteprima Newsroom duplicata, Signal Ledger e blocchi del dossier che ripetevano contesto, copione e quesiti già spiegati dalla Deep Analysis.

## Audit Hardening V4.3.1

- URL immagine vuoti non vengono più trasformati nell'indirizzo della homepage: squadre senza stemma usano le iniziali e le news senza foto restano schede editoriali pulite.
- Le classifiche a zero partite sono dichiarate **pre-season**: nessuna falsa capolista, miglior attacco, miglior difesa o zona europea prima dell'inizio reale del torneo.
- Date impossibili, intervalli invertiti, competizioni inesistenti e percorsi URL malformati ricevono una risposta controllata senza generare dati fuorvianti o interrompere il server.
- Migliorati stato accessibile e descrizione del controllo notifiche; la transizione tra classifiche non conserva errori di una competizione precedente.
- Aumentata la leggibilità del Deep Research, delle evidenze e dei testi mobile che risultavano troppo piccoli.
- Gli asset con versione usano cache immutabile annuale, mentre la homepage continua a essere rivalidata: caricamento più rapido senza bloccare gli aggiornamenti.
- Aggiunti audit API e test di rendering frontend per tutte le viste, dossier pre/post partita, fallback, URL, immagini mancanti e pre-season.

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

Ogni partita apre due livelli distinti. Match Intelligence è sempre il primo; se la copertura completa non è raggiungibile, il frontend mantiene un dossier ridotto e chiaramente etichettato.

### Power Model 2.1

- probabilità 1-X-2 e confronto con il solo modello statistico;
- gol attesi, risultato modale, Over/Under e Goal/No Goal;
- ultime cinque partite, rendimento casa/trasferta e precedenti;
- classifica e consenso di mercato senza margine, quando disponibili;
- segnali ordinati, qualità del campione e profilo di rischio.

### Deep Analysis / Intelligence Room

- fase della competizione, andata/ritorno, aggregato e posta reale;
- stadio e contesto casa/trasferta;
- giorni di riposo, partite nei 14 giorni precedenti e prossimo impegno;
- campioni tecnici recenti con possesso, tiri, tiri in porta, corner, passaggi, contrasti, respinte e cartellini;
- profili tattici e possibile copione della gara, derivati da evidenze visibili;
- statistiche nel torneo e leader per gol, assist, tiri, passaggi o parate;
- stato esplicito delle formazioni ufficiali;
- Availability Desk per squadra con infortuni, squalifiche, dubbi, fuori rosa, timestamp, tier e provenienza;
- riscontro multi-editore dichiarato come corroborazione e mai come conferma primaria;
- News Pulse datato e filtrato sulla partita;
- Red Flags su campione ridotto, rotazioni, nuova stagione, calendario e dati mancanti;
- separazione visiva fra **Fatto**, **Lettura** e **Da verificare**.

La Intelligence Room viene caricata solo quando si apre una partita. La lettura editoriale viene mostrata prima; le evidenze di supporto sono raccolte in cassetti consultabili. Le chiamate più costose sono limitate e memorizzate in cache.

## Altre funzioni

- dashboard premium responsive con tema scuro/chiaro;
- scoperta globale delle partite, non limitata ai cinque principali campionati;
- filtri dinamici per data e competizione;
- aggiornamento automatico ogni 90 secondi;
- live score e stato degli incontri;
- Match Radar con indice trasparente 0–100;
- Power Picks ordinati per segnale, rischio e qualità;
- notizie aggregate con link alla fonte originale;
- classifiche di 16 competizioni: top five, Serie B, Championship, Portogallo, Paesi Bassi, Turchia, Belgio, Scozia, MLS, Brasile, Argentina e Messico;
- ricerca globale (`Ctrl/Cmd + K`);
- preferiti e alert locali persistenti nel browser;
- cache server con fallback sull'ultima risposta valida;
- interfaccia responsive dedicata ad Android Chrome; nessuna modalità offline o service worker.

## Fonti gratuite

- **ESPN public feeds**: calendario, risultati, classifiche, summary dell'evento, aggregato, venue, statistiche tecniche, calendari squadra, leader, lineup e route injury quando pubblica record espliciti.
- **Fantasy Premier League ufficiale**: status, news, chance dichiarata e timestamp dei giocatori della sola Premier League; il dato fantasy non viene descritto come cartella clinica.
- **Google News RSS**: titoli datati e link agli editori per News Pulse e segnali di disponibilità, filtrati e classificati per fonte.
- **ANSA Calcio, Football Italia, ESPN**: flusso generale delle notizie.

Le fonti possono essere parziali o cambiare formato. Il backend normalizza i dati, limita i campioni a tre gare tecniche recenti per squadra e rende visibile quando un'informazione manca. Un feed infortuni vuoto **non** viene interpretato come rosa al completo; un titolo di giornale **non** viene presentato come conferma medica; una shell rosa pre-partita **non** viene chiamata formazione ufficiale.

## Architettura e cache

- Node.js 18+, zero dipendenze runtime;
- `/api/analysis`: Power Model e contesto essenziale, cache 10 minuti;
- `/api/intelligence`: calendario, tattica, copione, giocatori, Availability Desk, news e Reliability Ledger, cache separata 10 minuti;
- `/api/team-dna`: profilo squadra, split, fingerprint tecnico e ledger, cache 30 minuti;
- `/api/health`: telemetria sicura e senza segreti su stato, freschezza, errori, latenza e copertura delle fonti;
- disponibilità FPL cache 30 minuti, injury feed 20 minuti, rassegna availability 15 minuti;
- snapshot tecnici recenti: massimo tre eventi per squadra, cache 30 minuti;
- endpoint leggeri per partite, classifiche, notizie e stato servizio;
- asset statici con versionamento cache `4.4.0`; cambio data automatico a mezzanotte nel fuso Europe/Rome.

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
npm run audit
```

I test verificano homepage e asset V4.4.0, tutte le viste frontend, gerarchia dossier-first, fallback trasparente, Model Track Record rigorosamente pre-kickoff, Brier e riconciliazione, Source Health Center, Availability Intelligence, immagini mancanti, pre-season, richieste non valide, archivio globale di ieri, Deep Match Review, 16 classifiche, Power Model 2.1, Match Intelligence 1.2, Reliability Ledger e Team DNA. L'audit esteso contiene 107 controlli.

## Struttura

- `server.js` — server statico, proxy dati, cache, Power Model e motore Intelligence;
- `public/index.html` — shell accessibile dell'app;
- `public/styles.css` — design system responsive e Intelligence Room;
- `public/app.js` — routing, filtri, ricerca, preferiti, modal e rendering Intelligence;
- `scripts/smoke-test.js` — smoke test end-to-end delle funzioni principali;
- `scripts/frontend-test.js` — rendering VM di viste, dossier e stati limite;
- `scripts/audit-test.js` — matrice estesa di integrità API, dati e richieste non valide.

## Nota responsabile

VANTAGGIO ordina informazioni e scenari descrittivi: non costituisce una promessa o garanzia di vincita. Le probabilità dipendono dalla disponibilità e qualità dei dati. Nessun modello conosce in anticipo episodi, rotazioni tardive o decisioni tecniche. Uso responsabile, 18+.
