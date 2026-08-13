# VANTAGGIO 4.8.0 — XI Intelligence + Pre-Match Vault

Portale calcistico responsive in italiano che unisce calendario globale, score essenziale, probabilità e **Pre-Match Total Intelligence** in un’identità ibrida esclusiva: regia broadcast, data room e magazine editoriale. Funziona senza API a pagamento, senza account utente e senza dipendenze npm.

## Esperienza V4 per ogni sezione

- **Dashboard / Daily Briefing**: finestra prematch, agenda delle 48 ore, segnale Intelligence e copertura, senza ticker o anteprime duplicate.
- **Partite / Pre-Match Command**: ora ufficiale Europe/Rome, dossier da preparare, prossimo kickoff, densità del programma e calendario a giornate. Durante la gara score, minuto e stato restano attuali, mentre il dossier eventualmente osservato prima del kickoff rimane congelato e in sola lettura.
- **Radar / Signal Studio**: podio delle priorità e tavolo completo di selezione, senza un secondo registro dei segnali ridondante.
- **News / VANTAGGIO Newsroom**: apertura editoriale, titoli secondari, classificazione tematica, data ed editore visibili.
- **Classifiche / Table Lab**: capolista, distacco, miglior attacco/difesa, ritmo gol, PPG e lettura della corsa.
- **Preferiti / My Matchroom**: countdown, prossimo evento, dossier consultati, alert e privacy locale.
- **Scout Search**: ricerca trasversale di partite, squadre, competizioni e notizie con navigazione da tastiera.
- **Match dossier / Control Room**: un’unica architettura adattiva raggruppa Sintesi, Squadre, Numeri e Verifiche; il Power Model vive soltanto nell’area Numeri.

## XI Intelligence + Pre-Match Vault V4.8

- **Dossier preservato durante il live**: score, minuto e stato sono correnti; Intelligence e Power Model già caricati prima del kickoff sono conservati localmente, congelati, timestampati e mostrati in sola lettura.
- **Nessuna ricostruzione post-hoc**: a kickoff avvenuto il browser non avvia chiamate a Match Intelligence o Power Model. Se quel dispositivo non aveva osservato il dossier prematch, lo dichiara invece di inventarlo.
- **Archivio locale controllato**: il Vault conserva al massimo 24 partite, ridotte a 10 in caso di quota insufficiente. Non richiede account, sincronizzazione cloud o servizi a pagamento.
- **Probabile e ufficiale distinte**: l’XI ufficiale deriva soltanto dal roster starter dell’evento; la probabile usa le ultime tre formazioni ufficiali osservate con pesi di recenza 5-3-2, ruoli, disponibilità e FPL ufficiale quando applicabile. Con meno di otto candidati supportati non viene neppure tentata e viene pubblicata soltanto se si possono comporre undici nomi documentati.
- **Tre misure, nessuna falsa previsione**: Affidabilità XI misura la solidità dell’identificazione; Forza disponibile confronta i selezionati con il nucleo osservato; Continuità confronta l’XI con l’ultima formazione nota. Nessuna delle tre è una probabilità di vittoria.
- **Assenze importanti spiegate**: il portale distingue assente confermato, dubbio, non a referto, in panchina e non documentato. L’importanza richiede prove leggibili: partenze recenti, minuti/contributi FPL, leader del torneo, stato strutturato o lineup ufficiale.
- **Omissioni e rientri**: un titolare abituale fuori dall’XI ufficiale è classificato come panchina o non a referto, non automaticamente come assente; i rientri da una precedente segnalazione sono messi in evidenza.
- **Design Android-first**: due schede squadra su desktop diventano una colonna ordinata su mobile; rose, impatti ed evidenze restano progressive e non sovraccaricano la Sintesi.

## Pre-Match Total Intelligence V4.7

- **Manifesto di copertura in Sintesi**: sei righe mostrano stato completo, parziale o non disponibile per contesto; forma e calendario; matchup tattico; rosa e formazioni; modello e mercato; fonti, news e punti oscuri.
- **Navigazione guidata**: ogni riga porta direttamente a Sintesi, Squadre, Numeri o Verifiche. Il dettaglio resta completo senza moltiplicare schede o livelli di navigazione.
- **Vuoti e contraddizioni espliciti**: feed mancanti, campioni ridotti, mercato assente e metadati stagionali incompatibili con la data dell’evento vengono dichiarati; nessun dato viene inventato per far apparire il dossier completo.
- **Prematch come unica priorità operativa**: Dashboard, badge e calendario contano esclusivamente eventi futuri realmente in stato pre-kickoff.

## Signal Lifecycle V4.6

- **Timeline pre-kickoff nella Sintesi**: conserva la prima fotografia disponibile e i checkpoint Kickoff Watch T-60, T-30 e T-10, oltre agli aggiornamenti realmente materiali.
- **Cosa viene congelato**: maturità del Readiness Gate, probabilità 1-X-2, segnale principale, stato lineup, Availability score e record rosa, Reliability score e campione tecnico.
- **Delta leggibili**: ogni fotografia spiega cosa è cambiato rispetto alla precedente, per esempio XI ufficiali pubblicati, maturità aumentata, nuovo segnale o variazioni di disponibilità e affidabilità.
- **Protezione post-hoc**: uno snapshot è accettato soltanto quando match, modello e Intelligence risultano tutti pre-partita e l'orario di cattura precede il kickoff. Nessun backfill retroattivo.
- **Chiusura col risultato**: dopo il finale la timeline viene riconciliata con lo score ma gli snapshot non vengono ricalcolati.
- **Archiviazione locale controllata**: massimo otto fotografie per partita e ottanta lifecycle sul dispositivo. I checkpoint automatici richiedono che la partita sia salvata nel Kickoff Watch e che il sito sia operativo nel browser.

## Match Control Room V4.5

- **Quattro aree, nessun contenuto sparso**: Sintesi per la decisione, Squadre per tattica/calendario/lineup/availability, Numeri per Power Model e dati del torneo, Verifiche per fonti, What Changed, vuoti informativi e Reliability Ledger.
- **Match Readiness Gate**: prima di qualsiasi segnale controlla formazioni, disponibilità, affidabilità complessiva, campione tecnico e freschezza. Può indicare Pronta, Cautela o Attendi senza trasformarsi in promessa di risultato.
- **Evidence Map**: separa e conta fatti verificati, letture derivate, punti da verificare e segnalazioni superate dalle lineup ufficiali.
- **Dossier adattivo**: pre-partita mostra il brief decisionale completo; a gara iniziata il server non ricalcola l’analisi e il browser può mostrare soltanto la copia prematch già osservata, congelata dal Vault; dopo il finale chiude ogni consiglio e apre la review. Radar e Power Picks selezionano soltanto eventi realmente pre-kickoff.
- **Progressive disclosure controllata**: un solo livello di tab principali e un secondo livello esclusivamente nell’area Verifiche. Su Android la navigazione rimane sticky e scorrevole.
- **Accessibilità**: tab con ruoli e stati ARIA, focus visibile, attivazione standard e navigazione con frecce, Home ed End.
- La Sintesi pre-partita è stata ridotta da oltre 21.000 a circa 6.000 caratteri di markup nel test reale, senza eliminare i dettagli: sono stati ricollocati nell’area corretta.

## Transparency & Availability Intelligence V4.4

- **Model Track Record**: salva localmente solo la prima lettura realmente vista prima del kickoff. Lo snapshot è immutabile, viene riconciliato con il finale anche nelle visite successive e mostra accuratezza 1-X-2, Brier normalizzato, fiducia media e gap di calibrazione. Non esiste backfill post-hoc.
- **Source Health Center**: espone stato osservato, ultimo successo, errori, chiamate valide, latenza media, ruolo e copertura di ciascuna fonte senza mostrare credenziali o URL sensibili. Salute tecnica e completezza editoriale restano concetti distinti.
- **Availability Intelligence**: combina formazioni ufficiali dell'evento, injury feed espliciti, dataset ufficiale Fantasy Premier League per la sola Premier League e rassegna datata su infortuni, squalifiche, fitness e lineup.
- **Gerarchia delle prove**: lineup e comunicati ufficiali → dataset ufficiali/provider espliciti → reporting forte → segnali da verificare. Sono visibili tier, timestamp, fonte, stato del giocatore e riscontri fra editori; un riscontro editoriale non diventa automaticamente conferma medica.
- **Unknown by design**: feed vuoti, assenza di titoli e silenzio delle fonti non vengono mai tradotti in “rosa al completo”. Le formazioni ufficiali prevalgono su segnalazioni precedenti incompatibili.
- **What Changed per partita**: ogni dossier contiene la propria cronologia locale pre-kickoff di orario, sede, lineup, disponibilità e nuovi segnali, oltre alla riconciliazione finale. Non produce aggiornamenti durante la gara.
- **Table Lab esteso**: il catalogo classifiche è separato da quello del calendario e comprende 16 competizioni verificate sul feed, senza appesantire le richieste dello scoreboard globale.
- L'estensione **offline PWA** non è stata implementata, come richiesto: calendario e fonti aggiornate richiedono connessione.

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

- **What Changed Desk**: crea una baseline locale e segnala nuovi eventi, variazioni di orario o sede, lineup, disponibilità e nuovi segnali pre-partita; al termine può registrare il risultato finale. Il registro resta sul dispositivo.
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

Ogni partita futura apre due livelli distinti. Match Intelligence è sempre il primo; se la copertura completa non è raggiungibile, il frontend mantiene un dossier ridotto e chiaramente etichettato. Durante la gara questi livelli sono accessibili soltanto dalla fotografia prematch realmente salvata sul dispositivo e sono marcati come archivio congelato.

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

La Intelligence Room viene caricata solo quando si apre una partita futura. La lettura editoriale viene mostrata prima; le evidenze di supporto sono raccolte nelle quattro aree della Control Room. Le chiamate più costose sono limitate e memorizzate in cache.

## Altre funzioni

- dashboard premium responsive con tema scuro/chiaro;
- scoperta globale delle partite, non limitata ai cinque principali campionati;
- filtri dinamici per data e competizione;
- aggiornamento automatico ogni 90 secondi;
- score, minuto e stato corrente degli incontri in corso, con eventuale dossier prematch congelato e senza ricalcolo live;
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
- asset statici con versionamento cache `4.8.0`; cambio data automatico a mezzanotte nel fuso Europe/Rome.

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

I test verificano homepage e asset V4.8.0, tutte le viste frontend, Match Control Room, Pre-Match Total Intelligence, XI probabile/ufficiale, punteggi separati, assenze documentate, Pre-Match Vault, congelamento e blocco post-hoc, Readiness Gate, Evidence Map, Signal Lifecycle, checkpoint T-60/T-30/T-10, delta e riconciliazione, navigazione ARIA, assenza di notifiche e ricalcoli live, fallback trasparente, Model Track Record, Source Health Center, Availability Intelligence, Deep Match Review, classifiche, Reliability Ledger e Team DNA. L’audit esteso conta dinamicamente tutti i controlli eseguiti.

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
