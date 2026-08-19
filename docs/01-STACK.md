# 01 — Stack, build e deploy

## Riassunto semplice

VANTAGGIO non usa framework frontend o backend. È costruito con **Node.js, JavaScript, HTML e CSS puri**.

Non c’è un bundler: il browser riceve direttamente `public/index.html`, `public/app.js` e `public/styles.css`.

## Runtime

| Elemento | Scelta attuale |
|---|---|
| Linguaggio backend | JavaScript CommonJS |
| Runtime | Node.js `>=18` |
| Versione Render | Node `20.20.2` |
| Server HTTP | modulo standard `http` di Node |
| Host locale | `0.0.0.0` |
| Porta | `process.env.PORT` oppure `4173` |
| Timezone di prodotto | `Europe/Rome` |

## Frontend

- HTML statico.
- JavaScript vanilla, senza TypeScript.
- CSS vanilla, senza Sass/Tailwind.
- Routing tramite hash (`#dashboard`, `#matches`, ecc.).
- Rendering tramite template string in `public/app.js`.
- Stato in un grande oggetto `state` nel browser.
- Persistenza locale tramite `localStorage`.
- API browser usate: `fetch`, DOM, `Intl`, `matchMedia`, `Notification`, `localStorage`.
- Icone: sprite SVG incorporato in `public/index.html`.
- Font: stack di sistema; nessun font esterno necessario.

## Backend

`server.js` svolge contemporaneamente più ruoli:

1. server dei file statici;
2. router delle API;
3. client dei feed pubblici;
4. normalizzatore dei dati;
5. cache in memoria;
6. retry, circuit breaker e fallback stale;
7. Power Model;
8. Match Intelligence;
9. Reliability Ledger;
10. generatore della Evidence Foundation.

È pratico per un progetto gratuito e piccolo, ma è un monolite difficile da modificare senza regressioni.

## Evidence Foundation

La parte più separata è `lib/evidence.js`, supportata da tre file JSON in `data/`:

- Entity Registry V1;
- Evidence Contract V1;
- Source Manifest V1.

Questa libreria usa il modulo standard `crypto` per hash e identificativi deterministici. Non usa database o librerie esterne.

## Dipendenze npm

`package.json` non dichiara né `dependencies` né `devDependencies`.

Questo significa:

- installazione molto leggera;
- meno rischio di supply-chain;
- nessun framework da aggiornare;
- più codice applicativo scritto a mano;
- test browser reali non inclusi nel progetto.

Playwright è stato usato temporaneamente durante la revisione, ma non fa parte di `package.json` e non viene installato in produzione.

## Script disponibili

| Comando | Cosa fa oggi | Limite noto |
|---|---|---|
| `npm start` | Avvia `server.js` | Nessun process manager interno |
| `npm run dev` | Uguale a `npm start` | Nessun hot reload |
| `npm run check` | `node --check` sui file JS principali | Controlla sintassi, non comportamento |
| `npm run quality` | Audit statico di file, asset, CSS, accessibilità e riferimenti | Non sostituisce un browser reale |
| `npm run build` | Esegue `check` + `quality` | Non genera bundle o cartella `dist` |
| `npm test` | Foundation, modello/resilienza, smoke HTTP, frontend VM, quality | Richiede attualmente un server già avviato su 4173 |
| `npm run audit` | Audit HTTP/API/UI esteso | Richiede server raggiungibile |
| `npm run test:resources` | Controlla le risorse dinamiche | Richiede rete e server |
| `npm run test:sources` | Confronta dati locali con ESPN | Richiede rete e feed ESPN disponibili |

## Build

La “build” è una **build di validazione**, non di compilazione:

```bash
npm run build
```

Controlla:

- sintassi JavaScript;
- presenza dei file essenziali;
- riferimenti agli asset;
- contratti Evidence;
- marker responsive;
- dimensione minima dei font;
- target touch dichiarati;
- contrasto dei token principali;
- funzioni duplicate o riferimenti mancanti selezionati.

Non esegue:

- minificazione;
- tree shaking;
- transpiling;
- code splitting;
- generazione di sourcemap;
- fingerprint automatici degli asset.

Le cache key sono scritte manualmente nell’HTML, per esempio `app.js?v=5.0.1`.

## Deploy

Il deploy usa GitHub + Render Blueprint.

`render.yaml` configura:

```yaml
runtime: node
plan: free
region: frankfurt
buildCommand: npm install --omit=dev
startCommand: npm start
healthCheckPath: /api/status
autoDeploy: true
```

### Flusso

1. Il branch principale viene aggiornato su GitHub.
2. Render avvia automaticamente un deploy.
3. Esegue `npm install --omit=dev`.
4. Avvia `npm start`.
5. Controlla `/api/status`.
6. Mantiene lo stesso URL pubblico.

### Debolezza del deploy

Il `buildCommand` non esegue `npm run build`. Quindi Render può pubblicare un commit anche se i test o la validazione statica fallirebbero. Questo è il problema noto `R-012`.

## Hosting Render Free

Vantaggi:

- costo zero;
- HTTPS e URL pubblico;
- auto deploy da GitHub;
- compatibile con Chrome Android.

Limiti:

- il servizio può addormentarsi dopo inattività;
- il primo accesso può avere un cold start lungo;
- filesystem effimero;
- nessun disco persistente nel piano gratuito;
- cache server azzerata a ogni restart/deploy;
- nessuna osservazione prematch 24/7 garantita dal server.

## Configurazione e segreti

Il progetto non richiede chiavi API per i feed attuali.

Sono ignorati da Git:

- `node_modules/`;
- `.env` e `.env.*`;
- `.deploy/`;
- log e coverage.

Le chiavi usate localmente per il deploy non fanno parte del codice applicativo e non devono entrare negli ZIP condivisi.

## PWA

Esiste `public/manifest.webmanifest`, quindi il sito può essere aggiunto alla schermata Home. Non esistono però service worker, cache offline o strategia PWA completa. L’offline PWA non è un obiettivo attivo.
