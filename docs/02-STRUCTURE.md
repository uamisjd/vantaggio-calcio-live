# 02 — Struttura del progetto

## Albero leggibile

```text
vantaggio-calcio/
├── .gitignore
├── package.json
├── render.yaml
├── server.js
├── README.md
├── DEPLOY-RENDER.md
├── PROJECT_REVIEW_MASTER.md
├── ARCHITECTURE_V5_EVIDENCE_MESH.md
├── RESEARCH_V4.9.md
├── RESEARCH_V5_DATA_FOUNDATION.md
├── data/
│   ├── entity-registry.v1.json
│   ├── evidence-contract.v1.json
│   └── source-manifest.v1.json
├── lib/
│   └── evidence.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── favicon.svg
│   └── manifest.webmanifest
├── scripts/
│   ├── audit-test.js
│   ├── evidence-foundation-test.js
│   ├── foundation-test.js
│   ├── frontend-test.js
│   ├── quality-test.js
│   ├── resource-test.js
│   ├── smoke-test.js
│   └── source-consistency-test.js
└── docs/
    ├── 00-OVERVIEW.md
    ├── 01-STACK.md
    ├── 02-STRUCTURE.md
    ├── 03-PAGES-ROUTES.md
    ├── 04-DATA.md
    ├── 05-FEATURES.md
    ├── 06-KNOWN_ISSUES.md
    └── 07-TODO.md
```

Non sono mostrati `node_modules/`, `.git/`, `.deploy/`, cache o file temporanei.

## File principali

### `server.js`

È il cuore backend del progetto, circa 2.580 righe.

Contiene:

- configurazione competizioni;
- server HTTP;
- routing API;
- static file serving;
- chiamate ESPN/FPL/RSS;
- normalizzazione eventi;
- cache e resilienza;
- classifiche e notizie;
- Power Model;
- Match Intelligence;
- Team DNA;
- availability e lineup;
- costruzione della Evidence Foundation.

È il file più delicato da modificare perché responsabilità molto diverse sono accoppiate.

### `public/app.js`

È l’intero frontend applicativo, circa 1.970 righe.

Contiene:

- stato globale client;
- lettura/scrittura `localStorage`;
- routing hash;
- caricamento API;
- tutte le funzioni di rendering;
- Match Control Room;
- Team DNA;
- ricerca;
- preferiti e alert;
- snapshot prematch;
- What Changed e Signal Lifecycle;
- gestione tastiera, focus e dialoghi;
- polling ogni 90 secondi.

Non esiste separazione in componenti o moduli importati.

### `public/styles.css`

È l’intero stile dell’app, circa 2.042 righe.

Contiene:

- token colore e temi;
- layout desktop/mobile;
- tutti i componenti;
- dialoghi;
- dossier;
- Radar, Newsroom, classifiche, Team DNA;
- breakpoint 980/720/420;
- regole per pointer coarse e reduced motion.

Il file è cresciuto per append successive e contiene gruppi da riclassificare prima di una pulizia.

### `public/index.html`

È la shell statica:

- metadati e manifest;
- sprite SVG;
- sidebar desktop;
- topbar;
- navigazione mobile;
- area principale;
- dialoghi ricerca/partita/Team DNA;
- footer;
- riferimenti versionati a CSS e JS.

### `lib/evidence.js`

È la parte più modulare del backend, circa 521 righe.

Gestisce:

- identità canoniche;
- validazione delle evidenze;
- stato temporale;
- precedenza fra fonti;
- supersessione;
- conflitti;
- Resolved Facts;
- Evidence Summary;
- Decision Trace.

### `data/*.json`

Sono contratti dichiarativi versionati:

- `entity-registry.v1.json`: regole e namespace delle identità;
- `evidence-contract.v1.json`: schema di un record Evidence;
- `source-manifest.v1.json`: fonti autorizzate, tier, costo, cadenza e tipi di fatto.

### `package.json`

Dichiara:

- versione 5.0.1;
- runtime Node >=18;
- comandi build/test/start;
- nessuna dipendenza npm.

### `render.yaml`

Descrive il servizio Render gratuito e l’auto deploy.

### `PROJECT_REVIEW_MASTER.md`

È il registro tecnico canonico della revisione integrale:

- baseline;
- gate;
- problemi R-001–R-023;
- correzioni concluse;
- prove locali e produzione;
- prossimo incremento.

È più aggiornato del README per quanto riguarda i difetti conosciuti.

## Test

### `scripts/evidence-foundation-test.js`

Test puri su contratti, identità, tempo, conflitti, storico e chiusura decisionale post-kickoff.

### `scripts/foundation-test.js`

Test puri su modello, Reliability Ledger, retry, circuit breaker e stale fallback.

### `scripts/smoke-test.js`

Legge sito/API da un server in esecuzione e controlla i percorsi principali.

### `scripts/frontend-test.js`

Carica `public/app.js` in una VM Node con DOM semplificato e genera tutte le viste. Verifica HTML, stati e regressioni note.

### `scripts/quality-test.js`

Controlla file, sintassi, accessibilità statica, CSS, contrasto e riferimenti.

### `scripts/audit-test.js`

Audit HTTP/API esteso: input, dossier, Evidence, classifiche, news, error handling e route.

### `scripts/resource-test.js`

Raccoglie e verifica URL dinamici esposti dai payload.

### `scripts/source-consistency-test.js`

Confronta partite correnti e una fixture storica direttamente con ESPN.

## Documenti storici e di ricerca

- `README.md`: descrizione pubblica, ma mescola molte versioni V4/V5.
- `RESEARCH_V4.9.md`: ricerca su modello, availability, UX e resilienza.
- `RESEARCH_V5_DATA_FOUNDATION.md`: ricerca sulle fonti e sulla Evidence Mesh.
- `ARCHITECTURE_V5_EVIDENCE_MESH.md`: architettura target della Evidence Mesh, non tutta implementata.
- `DEPLOY-RENDER.md`: istruzioni di pubblicazione.

## File locali da non distribuire

Possono esistere fuori dal codice tracciato:

- `.git/`: storia e configurazione Git;
- `.deploy/`: chiavi locali di deploy;
- `node_modules/`: dipendenze temporanee usate per diagnostica;
- screenshot e report browser;
- ZIP/export generati.

Non sono necessari per capire o avviare il progetto e non devono contenere segreti in un archivio condiviso.
