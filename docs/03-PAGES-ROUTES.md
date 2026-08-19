# 03 — Pagine, dialoghi e route

## Come funziona il routing

Il frontend è una single-page application basata sull’hash dell’URL.

Esempio:

```text
https://vantaggio-calcio-live.onrender.com/#dashboard
```

Le route frontend consentite sono:

- `#dashboard`
- `#matches`
- `#radar`
- `#news`
- `#standings`
- `#favorites`

Non esiste un router esterno. `goTo()` aggiorna lo stato, l’hash, `aria-current` e renderizza la vista.

## 1. Dashboard — `#dashboard`

### Cosa mostra oggi

- hero con una partita in evidenza;
- Daily Briefing con prossima partita, agenda 48 ore, Model Gate e copertura;
- What Changed Desk;
- Kickoff Watch per le partite salvate;
- Model Track Record locale;
- Source Health Center;
- fino a sette partite da studiare;
- Power Picks o, mentre il modello carica, il ranking Radar di fallback.

### Cosa è scarno o dipendente dal contesto

- What Changed è vuoto alla prima visita, perché deve prima creare una baseline locale;
- Track Record è vuoto finché quel browser non ha osservato e poi chiuso partite prematch;
- Kickoff Watch è vuoto senza preferiti;
- Source Health mostra soltanto fonti già chiamate dal processo server corrente;
- i Power Picks analizzano un massimo di cinque candidate.

### Cosa manca

- un ranking dimostrato di value/robustezza;
- storico condiviso fra dispositivi;
- spiegazione più evidente della differenza fra copertura globale breve e copertura estesa;
- una gerarchia meno densa: oggi molte sezioni competono nello stesso schermo.

## 2. Partite — `#matches`

### Cosa mostra oggi

- programma di oggi e periodo esteso;
- filtri per competizione e data;
- conteggi gare future/concluse;
- gruppi per giorno;
- stato prematch, live o finale;
- forma sintetica e indice di interesse prematch;
- accesso al dossier;
- preferiti.

La vista “Oggi” prova a mostrare il programma giornaliero completo. Per intervalli molto grandi può applicare un limite visuale dichiarato.

### Cosa è scarno

- competizioni globali meno conosciute hanno spesso etichetta e pochi metadati;
- le righe live sono volutamente ridotte a score/minuto/stato;
- alcuni eventi gratuiti non hanno venue, forma o dettagli sufficienti.

### Cosa manca

- filtro/ricerca completo per tutte le competizioni globali;
- comunicazione visiva forte della copertura temporale diversa;
- paginazione o virtualizzazione strutturale;
- gestione per sorgente della degradazione parziale.

## 3. Match Radar — `#radar`

### Cosa mostra oggi

- partite future ordinate per `opportunityScore`;
- spotlight delle prime candidate;
- forma sintetica, torneo, orario e punteggio di interesse;
- tavolo di selezione;
- apertura diretta del Match Control Room.

### Cosa è scarno o fuorviante

Il Radar sembra una graduatoria decisionale, ma il punteggio deriva soprattutto da:

- peso statico della competizione;
- presenza di grandi club;
- vicinanza del kickoff;
- differenza di forma recente.

Non misura direttamente quota, edge, calibrazione o robustezza delle evidenze.

### Cosa manca

- ranking basato su modello calibrato + Evidence Gate + benchmark separato;
- backtest globale;
- spiegazione completa del motivo per cui una partita supera un’altra;
- coerenza garantita con i Power Picks della Dashboard.

## 4. Notizie — `#news`

### Cosa mostra oggi

- lead story;
- notizie secondarie;
- filtro per fonte;
- titolo, editore, data e immagine quando presente;
- argomento stimato;
- link all’articolo originale.

Le fonti aggregate sono ANSA, Football Italia ed ESPN. Le news specifiche di una partita vengono cercate anche via Google News RSS nel dossier.

### Cosa è scarno

- il sito mostra soprattutto metadati e titoli;
- non riassume o verifica integralmente il contenuto dell’articolo;
- la classificazione tematica è euristica;
- immagini e feed dipendono dal publisher.

### Cosa manca

- deduplicazione semantica avanzata;
- estrazione/validazione delle singole affermazioni;
- collegamento forte fra notizia, giocatore, squadra e Evidence Fact;
- filtri per squadra/competizione/data.

## 5. Classifiche — `#standings`

### Cosa mostra oggi

- 16 competizioni selezionabili;
- classifica con PG, V/P/S, GF/GS, differenza, PPG e punti;
- capolista, distacco dalla seconda e dalla sesta;
- miglior attacco e difesa;
- ritmo gol;
- fasce alte/basse indicative;
- stato pre-season separato;
- pulsante Team DNA.

### Cosa è scarno

- le letture sono semplici aggregazioni della tabella;
- le fasce non conoscono tutte le regole specifiche dei tornei;
- nessuna forma nelle ultime giornate dentro la tabella;
- nessun confronto storico.

### Cosa manca

- regole ufficiali per coppe, playoff, spareggi e posti europei;
- trend temporale e proiezione punti;
- filtri casa/trasferta;
- stato esplicito della freshness della singola classifica.

## 6. Preferiti — `#favorites`

### Cosa mostra oggi

- partite salvate localmente;
- prossimo appuntamento;
- numero di prematch, dossier aperti e stato alert;
- watchlist;
- Watch Assistant;
- accesso al dossier.

### Cosa è scarno

- su un browser nuovo la pagina è completamente vuota;
- l’informazione “dossier aperti” vale solo per la sessione/memoria client corrente;
- gli alert dipendono dalla pagina aperta e dai permessi browser.

### Cosa manca

- account e sincronizzazione cloud;
- import/export dei preferiti;
- notifiche push affidabili a sito chiuso;
- cronologia multipiattaforma.

Queste assenze sono coerenti con l’obiettivo di costo zero, ma vanno dichiarate chiaramente.

## 7. Scout Search — dialogo globale

### Apertura

- pulsante di ricerca nella topbar;
- scorciatoia `Ctrl/Cmd + K`.

### Cosa cerca

- partite;
- squadre;
- competizioni principali;
- notizie già caricate.

### Limiti

- cerca soltanto nei dati presenti in `state`;
- non interroga un indice server globale;
- non annuncia ancora in modo completo il numero dei risultati agli screen reader;
- le squadre non presenti nel calendario corrente non vengono trovate.

## 8. Match Control Room — dialogo partita

Non ha una URL dedicata: viene aperto da una card e vive in un dialogo.

### Tab Sintesi

Mostra Decision/Review Passport, Readiness Gate, brief editoriale, Pre-Match Total Intelligence, Signal Lifecycle e watchlist decisionale quando applicabili.

**Limite:** alcune informazioni sul gate vengono ancora calcolate nel frontend dai campi precedenti invece di usare direttamente `evidenceFoundation.decisionTrace`.

### Tab Squadre

Mostra profilo, forma, tattica, calendario, availability e XI.

**Limite:** qualità molto variabile fra competizioni; availability strutturata forte soprattutto in Premier League.

### Tab Numeri

Mostra Power Model, probabilità, gol attesi, scenari, forma, precedenti e leader.

**Limite:** il campione è corto e il modello non è ancora validato con backtest globale.

### Tab Verifiche

Mostra Evidence Map, news, What Changed, Reliability Ledger, dati assenti e metodologia.

**Limite:** è la parte più trasparente ma anche una delle più dense e lunghe da leggere.

### Stato live

Il dossier decisionale è disattivato. Rimangono score e stato essenziale, più l’eventuale Pre-Match Vault già osservato.

### Stato post-partita

Mostra una review fattuale. Dalla V5.0.1 non ricostruisce Decision Passport o probabilità dopo il risultato. Uno snapshot prematch valido può essere confrontato con l’esito.

## 9. Team DNA — dialogo squadra

### Cosa mostra

- identità sintetica;
- risultati recenti;
- split casa/trasferta;
- fingerprint tecnico;
- tratti/vulnerabilità;
- fatti, letture e verifiche;
- prossimi impegni;
- Reliability Ledger.

### Limiti

- usa un campione piccolo;
- può avere pochi boxscore completi;
- non è una scheda rosa completa;
- esiste una race nota se due richieste squadra si sovrappongono.

## 10. Trasparenza — dialogo “Fonti & trasparenza”

Spiega fonti, aggiornamenti, Power Model, calendario globale, lineup, Pre-Match Vault e Signal Lifecycle.

Non è una pagina autonoma. Parte del testo è lungo e mescola versioni/metodo; può diventare difficile da consultare su mobile.

# Route backend

Tutte le API rispondono JSON.

| Endpoint | Parametri | Cosa restituisce | Limiti attuali |
|---|---|---|---|
| `GET /api/status` | nessuno | ora, timezone, leghe, competizioni globali e policy | Non certifica che ogni fonte sia sana |
| `GET /api/health` | nessuno | chiamate, successi, errori, latenze, circuiti | Telemetria solo dal boot corrente |
| `GET /api/evidence-foundation` | nessuno | manifest e versioni Evidence pubbliche | Non restituisce evidenze di una partita |
| `GET /api/matches` | `league`, `from`, `to`, `fresh` | calendario, fonti e copertura | Range non limitato; copertura globale solo -1/0/+1 giorno |
| `GET /api/standings` | `league`, `fresh` | classifica normalizzata | Solo leghe dichiarate |
| `GET /api/news` | `fresh` | feed news aggregato | Titoli/metadati, non fact-check completo |
| `GET /api/analysis` | `event`, `league`, `fresh` | Power Model e segnali | Input/force non abbastanza protetti |
| `GET /api/intelligence` | `event`, `league`, `fresh` | dossier completo + Evidence Foundation | Payload ampio; può duplicare chiamate analysis |
| `GET /api/team-dna` | `team`, `league`, `name`, `fresh` | profilo squadra | Validazione parametri incompleta |

## Route statiche

Il server serve i file di `public/`. Le route sconosciute cadono sulla homepage per supportare la SPA.

Problema noto: anche un asset inesistente come `/file-mancante.js` può ricevere `200 text/html` invece di un vero 404. Inoltre i metodi HTTP non previsti non sono bloccati rigorosamente.
