# 06 — Problemi noti e parti incomplete

Questo file è volutamente diretto. Non descrive desideri astratti: elenca difetti osservati o limiti reali della release 5.0.1.

## Problema già risolto

### R-001 — Contaminazione post-partita

**Stato: risolto e distribuito in V5.0.1.**

Prima una review poteva mostrare probabilità e Decision Passport ricostruiti dopo il risultato. Ora il backend chiude il gate dal kickoff e il frontend usa un Review Passport fattuale. Gli snapshot vengono accettati solo se catturati prima del kickoff.

## Problemi ad alta priorità

### R-002 — I test HTTP non si avviano da soli

`npm test`, audit, resources e sources si aspettano un server già attivo su porta 4173.

Effetto pratico: su una macchina pulita `npm test` può fallire con `fetch failed` anche se il codice puro è corretto.

### R-003 — LocalStorage fragile

`readLocalJson()` controlla che il JSON sia valido, ma non che abbia il tipo atteso.

Esempio verificato: `vantaggio:favorites={}` causa `TypeError: object is not iterable` durante l’avvio.

Altri rischi:

- quota piena;
- storage negato;
- dati vecchi o corrotti;
- chiavi non potate, come alcuni controlli kickoff.

### R-004 — Due verità sulle evidenze

Il backend produce `resolvedFacts`, `conflicts` e `decisionTrace`, ma il frontend ricostruisce ancora parte del Decision Passport dai campi V4.

Conseguenza: Evidence Foundation e interfaccia possono divergere.

### R-005 — Matching entità troppo permissivo

Alcuni confronti squadra/giocatore usano `includes` e token parziali. Nomi simili possono essere auto-associati senza certezza sufficiente.

### R-006 — Availability sovrastimata

Due XI ufficiali possono alzare lo score availability anche se panchina e resto della rosa non sono documentati.

Sapere chi parte non equivale a conoscere tutti gli indisponibili.

### R-007 — Radar non realmente “value-based”

Il punteggio Radar usa torneo, grandi club, orario e forma. Può sembrare un ranking delle migliori giocate, ma non dimostra value rispetto al mercato.

### R-008 — Degradazione parziale poco visibile

Se una lega fallisce e le altre rispondono, il calendario aggregato può essere pubblicato e memorizzato senza conservare il last-known-good specifico della lega fallita.

L’interfaccia può quindi apparire aggiornata mentre manca una parte del calendario.

### R-009 — Cache e richieste duplicabili

- cache senza eviction generale;
- nessun single-flight;
- `fresh=1` pubblico;
- range date arbitrari;
- Team DNA con molte chiavi;
- Intelligence richiama Analysis mentre il frontend può richiederle entrambe.

Rischio: memoria crescente e chiamate upstream duplicate.

### R-010 — “Calendario globale” ambiguo

Il globale copre ieri/oggi/domani. Il periodo più lungo copre soprattutto sette tornei.

La UI non rende questa differenza abbastanza evidente.

### R-011 — Semantica HTTP e hardening incompleti

Problemi verificati:

- asset inesistente → homepage `200 text/html`;
- `POST /api/status` può essere trattato come GET;
- errori input non sempre distinti da errori provider;
- mancano CSP, protezione framing, Permissions Policy e HSTS applicativo.

### R-012 — Deploy senza build gate

Render esegue `npm install --omit=dev`, non `npm run build`.

Un commit rotto potrebbe arrivare in produzione prima che un test lo blocchi.

### R-013 — Modello non ancora dimostrato

Il Power Model usa un campione recente corto e non corregge in modo completo per forza avversari/lega.

Mancano:

- backtest globale versionato;
- calibrazione stabile su molti finali;
- validazione temporale rigorosa;
- confronto persistente con benchmark;
- prova di un edge reale.

## Problemi di UX e “pugno nell’occhio”

### Densità eccessiva

La Dashboard e il Match Control Room mostrano molti blocchi, badge, gate, etichette uppercase e micro-metriche. L’utente può non capire subito cosa guardare per primo.

### Gergo misto italiano/inglese

“Daily Briefing”, “Power Picks”, “Readiness Gate”, “Evidence Map”, “Watch Assistant”, “Review Passport” e altri nomi convivono con testi italiani. L’identità è distintiva, ma l’insieme può sembrare più complesso del necessario.

### Ripetizione del concetto di affidabilità

Model Gate, Data Readiness, Reliability score, Decision Passport, Evidence Gate e badge di qualità possono comunicare concetti vicini in punti diversi.

### Testi piccoli

Il test statico impedisce font sotto 11 px, ma 11 px resta piccolo su molti telefoni. Tabelle, ledger e note metodologiche sono faticosi da leggere.

### Dialoghi molto lunghi

Il dossier può richiedere molto scroll dentro un modal. Su mobile l’utente può perdere contesto e orientamento.

### Theme toggle nascosto su mobile

A 360 px il controllo tema è nascosto dal CSS. Il tema iniziale segue sistema/storage, ma non sempre può essere cambiato dal telefono.

### Target touch non tutti da 44 px

Nel browser reale sono stati osservati controlli visibili sotto 44×44 px: alcuni filtri, select, ricerca, brand mobile e pulsanti Team DNA.

### Sezioni naturalmente vuote

- Preferiti vuoti su nuovo dispositivo;
- What Changed vuoto alla prima visita;
- Track Record vuoto senza snapshot locali conclusi;
- Kickoff Watch vuoto senza preferiti;
- Source Health quasi vuoto appena riavviato il server.

Gli empty state esistono, ma una prima visita può sembrare meno ricca di quanto prometta la pagina.

### Microcopy talvolta troppo sicuro

Etichette come “Analisi potente”, “Power Picks” o “partite da studiare” possono sembrare più conclusive dei dati effettivi, soprattutto quando il ranking è ancora euristico.

## Problemi strutturali medi

### R-014 — CSS append-only

`styles.css` supera 2.000 righe e contiene breakpoint/gruppi accumulati. Alcune classi sono probabilmente obsolete, ma vanno rimosse solo dopo test di equivalenza.

### R-015 — Monoliti

- `server.js`: circa 2.580 righe;
- `public/app.js`: circa 1.970 righe;
- `public/styles.css`: circa 2.042 righe.

Una piccola modifica può influenzare molte aree.

### R-016 — Input API non abbastanza limitati

- Team DNA verifica soprattutto che esista un ID;
- `/api/matches` non limita l’ampiezza del range;
- molti errori lanciati finiscono come HTTP 502 anche se sono input 400.

### R-017 — Hash iniziale invalido

Un URL con hash sconosciuto rende la Dashboard di fallback, ma può lasciare hash e `aria-current` incoerenti finché l’utente non naviga.

### R-018 — Race Team DNA

Una risposta lenta della squadra A può arrivare quando il dialogo mostra già la squadra B e sostituirne il contenuto.

### R-019 — Polling non ottimizzato

- refresh ogni 90 secondi anche con tab nascosta;
- health può fotografare il ciclo precedente;
- una classifica viene precaricata anche se non visitata.

### R-020 — Semantica cliccabile

Alcune card usano `article role=button/link` e listener delegati invece di elementi nativi. Aumenta il rischio tastiera/screen reader.

Mancano anche:

- skip link;
- annuncio live dei risultati ricerca;
- verifica con screen reader hardware.

### R-021 — Documentazione storica dispersiva

Il README mescola versioni V4.0–V5.0 con lo stato corrente. Questa nuova cartella `docs/` riduce il problema, ma il README non è ancora stato ripulito.

### R-022 — Incoerenze minori

- `normalizeLineups` e Evidence non hanno esattamente la stessa regola sul numero di starter;
- assegnazioni duplicate;
- stato scritto ma non letto (`lastStates`);
- timer assegnato ma poco gestito;
- “operativa con errori” resta per errori storici dal boot.

### R-023 — Provenienza meno forte del nome

`rawHash` non è hash del payload grezzo completo. I payload raw non vengono conservati e alcuni ID risolti cambiano con il tempo di risoluzione.

## Limiti di verifica

Sono stati verificati Chromium desktop/tablet/Android emulato e numerosi test automatici. Non sono stati verificati:

- Android fisico;
- Safari iOS;
- screen reader hardware;
- comportamento con rete mobile realmente instabile;
- uptime continuativo del piano Render Free;
- qualità editoriale completa di tutte le fonti nel tempo.
