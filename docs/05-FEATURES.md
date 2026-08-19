# 05 — Funzionalità attuali

Questa lista descrive ciò che esiste oggi. Non indica che ogni funzione abbia dati completi in ogni competizione.

## Navigazione e interfaccia

- Sei viste principali via hash route.
- Sidebar desktop e barra inferiore mobile.
- Tema chiaro/scuro salvato nel browser.
- Refresh manuale.
- Stato sintetico dell’ultimo aggiornamento.
- Dialoghi per ricerca, partita, trasparenza e Team DNA.
- Gestione focus, Escape e tab trapping nei dialoghi.
- Navigazione tastiera nelle tab del Match Control Room.
- Layout responsive desktop/tablet/mobile.
- Supporto `prefers-reduced-motion`.

## Calendario e partite

- Calendario delle sette competizioni principali su intervallo esteso.
- Scoperta globale per ieri, oggi e domani.
- Etichette provider per competizioni globali non ancora catalogate.
- Amichevoli globali filtrate alle grandi squadre.
- Filtri per competizione e data.
- Conteggio gare future e concluse.
- Stato prematch/live/finale.
- Score essenziale per le partite in corso.
- Review post-partita.
- Protezione contro regressioni di stato live → prematch nel browser.

## Dashboard

- Hero della partita in evidenza.
- Daily Briefing.
- Finestra prematch e agenda 48 ore.
- Coverage Desk.
- Model Gate della migliore candidata analizzata.
- What Changed Desk basato sulla visita precedente.
- Kickoff Watch per i preferiti.
- Model Track Record locale.
- Source Health Center.
- Elenco partite da studiare.
- Power Picks.

## Radar

- Ranking delle partite future tramite `opportunityScore`.
- Spotlight delle prime candidate.
- Indicatore forma sintetica.
- Punteggio di interesse.
- Apertura diretta del dossier.
- In Dashboard, analisi delle prime cinque candidate e ordinamento dei primi quattro Power Picks tramite segnale, qualità e gate.

Nota: il Radar è una priorità editoriale/euristica, non un vero ranking di valore dimostrato.

## Match Control Room

Ogni dossier completo è diviso in quattro aree.

### Sintesi

- Decision Passport prematch.
- Review Passport post-partita.
- Match Readiness Gate.
- Deep Research Brief o Deep Match Review.
- Pre-Match Total Intelligence.
- Signal Lifecycle.
- Decision Watch.
- Snapshot prematch congelato, quando realmente osservato.

### Squadre

- Team Picture.
- Forma e profilo delle due squadre.
- Tactical Matchup.
- calendario, riposo e carico;
- availability;
- XI Intelligence;
- probabili e ufficiali;
- omissioni/panchina/non a referto quando disponibili.

### Numeri

- Power Model 3.0.
- Probabilità 1-X-2.
- Gol attesi.
- Punteggio modale.
- Over/Under e Goal/No Goal.
- Segnali ordinati.
- Forma e produzione gol.
- Precedenti.
- Numeri torneo e leader.
- In post-partita, archivio fattuale invece di ricalcolo della previsione.

### Verifiche

- Evidence Map.
- News collegate.
- What Changed della partita.
- Data Reliability Ledger.
- Dati non disponibili.
- Metodo e note sulle fonti.

## Power Model

- Poisson per distribuzione gol.
- Recency weighting.
- Shrinkage verso un prior prudente.
- Fattore casa/trasferta.
- Correzione limitata dei punteggi bassi.
- Probabilità 1-X-2.
- Derivati gol.
- Benchmark mercato quando disponibile nel feed.
- Ensemble modello/mercato.
- Qualità del campione.
- Decision Gate `READY / CAUTION / HOLD`.
- Nessun ricalcolo decisionale live/post.

## Evidence e affidabilità

- Entity Registry V1.
- Source Manifest V1.
- Evidence Contract V1.
- Resolved Facts.
- Conflitti e supersessioni.
- Scadenza delle prove.
- Evidence Summary.
- Decision Trace.
- Reliability Ledger con provenienza, copertura e freshness.
- Critical Evidence Gate.
- Chiusura `CLOSED/HOLD` dal kickoff in poi.

Limite: il frontend usa ancora in parte i vecchi campi e non tratta l’Evidence Foundation come unica fonte di verità.

## Lineup e availability

- Lineup ufficiali dagli starter evento ESPN.
- Probabili derivate da XI recenti e availability.
- Formazione dichiarata quando presente.
- Affidabilità XI separata.
- Forza disponibile e continuità.
- Status strutturati FPL per la Premier League.
- Injury feed ESPN quando disponibile.
- News availability tramite ricerca RSS.
- Distinzione fra fonte strutturata e segnale editoriale.

## Team DNA

- Profilo squadra.
- Campione recente.
- Split casa/trasferta.
- Fingerprint tecnico.
- Tratti e vulnerabilità.
- Fatti, letture e verifiche.
- Prossimi impegni.
- Reliability Ledger dedicato.
- Apertura da ricerca, dossier e classifiche.

## Notizie

- Aggregazione ANSA, Football Italia ed ESPN.
- Titolo, fonte, data, link e immagine quando disponibile.
- Filtro per fonte.
- Lead story e notizie secondarie.
- Classificazione tematica semplice.
- Apertura nel sito originale.
- News di partita tramite Google News RSS.

Non vengono scaricati o verificati integralmente gli articoli.

## Classifiche

- 16 competizioni selezionabili.
- Posizione, PG, V/P/S, GF/GS, differenza, PPG e punti.
- Capolista, distacco, miglior attacco/difesa e ritmo gol.
- Zone alte/basse puramente indicative.
- Stato pre-season separato dalla classifica reale.
- Accesso Team DNA dalla tabella.

## Preferiti e funzioni locali

- Salvataggio partite senza account.
- Snapshot minimo della partita per conservarla anche fuori dal payload corrente.
- Prossimo evento salvato.
- Contatori prematch/dossier/alert.
- Kickoff Watch T-60/T-30/T-10.
- Alert browser mentre il sito è aperto.
- Pre-Match Vault locale.
- Signal Lifecycle locale.
- Model Track Record locale con hit, Brier e log-loss.
- What Changed locale.

Tutto resta sul singolo browser/dispositivo: non esiste sincronizzazione cloud.

## Resilienza backend

- Cache in memoria con TTL.
- Last-known-good limitato nel tempo.
- Retry su errori transitori.
- Timeout.
- Circuit breaker per host.
- Telemetria chiamate/successi/errori/latenza.
- Endpoint Source Health.
- Error states nel frontend.

## Funzioni volutamente assenti

- Nessun Scenario Lab.
- Nessun account utente.
- Nessun pagamento.
- Nessun database persistente.
- Nessun sistema per piazzare scommesse.
- Nessuna analisi live decisionale.
- Nessuna PWA offline completa.
