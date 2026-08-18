# VANTAGGIO — Revisione integrale del progetto

Aggiornato: 2026-08-18 (Europe/Rome)
Stato: review integrale in corso; incremento correttivo `R-001` implementato e validato localmente come V5.0.1, non ancora distribuito.
Release pubblica di partenza: V5.0.0, commit `52ff7809249adbc739f739e1106bf63fc856280d`. URL pubblico invariato.

## Scopo

Rivedere il prodotto dalla prima pubblicazione alla release corrente, distinguendo con prove:

1. ciò che produce valore e va conservato;
2. ciò che è corretto ma va semplificato;
3. ciò che è duplicato, inutile o irraggiungibile e va rimosso;
4. ciò che è incompleto, ambiguo o manca;
5. ciò che non è verificabile nell’ambiente disponibile.

Il risultato deve restare gratuito, mantenere l’URL pubblico, non perdere funzioni utili, non falsificare completezza o affidabilità e funzionare bene su desktop e telefono.

## Protocollo per mantenere leggera la chat

- Questo file è la memoria operativa canonica della revisione.
- Decisioni, prove, problemi, stato e prossimo passo vengono aggiornati qui.
- La chat riceve soltanto checkpoint brevi.
- Git conserva ogni stato stabile; le modifiche non vengono distribuite finché i gate della fase non sono verdi.
- Si implementa un solo incremento coerente alla volta.

## Baseline ricostruita

- 23 commit dal 13 al 17 agosto 2026.
- 26 file tracciati, circa 777 KB e 10.654 righe testuali.
- Tre monoliti principali: `server.js` (2.549 righe, 131 funzioni), `public/app.js` (1.936 righe, 170 funzioni), `public/styles.css` (2.034 righe).
- Foundation Evidence separata in `lib/evidence.js` (521 righe).
- Nessuna dipendenza npm e nessun bundler.
- Viste dichiarate: dashboard, partite, radar, notizie, classifiche, preferiti; dossier Match Control Room e dialogo Team DNA.
- Pipeline attuale: sintassi, quality statica, test Foundation/modello/resilienza, smoke HTTP, VM frontend, audit API/UI, risorse e confronto fonte.
- La baseline V5.0.0 era verde prima dell’avvio di questa revisione: build, test, audit produzione 209/209, risorse produzione 558/558, confronto diretto con fonte e concorrenza 120/120.
- Browser reale locale ora disponibile senza dipendenze di progetto: Chromium 140 con Playwright 1.55.0 temporaneo. Desktop, tablet e Android emulato sono verificabili; restano non dimostrabili Android fisico e screen reader/hardware assistivo.

## Piano a gate

### Fase 0 — Ricostruzione e inventario

- Leggere la storia dei commit e classificare ogni funzione introdotta.
- Mappare viste, componenti, controlli, route, fonti, cache, storage e flussi.
- Collegare ogni promessa del prodotto a codice e test.
- Individuare codice morto, duplicazioni, accoppiamenti e documentazione divergente.

Gate: mappa completa e lista dei problemi con evidenza; nessuna soluzione decisa per intuizione.

### Fase 1 — Semplificazione strutturale sicura

- Separare responsabilità dei monoliti solo dove riduce rischio e costo cognitivo.
- Eliminare duplicazioni e codice irraggiungibile senza rimuovere valore.
- Rendere configurazioni, fonti, versioni e policy dichiarative.
- Aggiungere test di equivalenza prima dei refactor sensibili.

Gate: stesso comportamento osservabile, meno complessità, suite interamente verde.

### Fase 2 — Correttezza dati ed Evidence Mesh

- Verificare copertura reale dei nove bisogni del dossier.
- Distinguere dato corrente, baseline verificata, osservazione congelata e inferenza.
- Chiudere i gap Foundation ancora non proiettati nell’esperienza.
- Verificare conflitti, freshness, identità, lineup, availability e news.

Gate: nessuna completezza simulata; ogni claim importante ha stato e provenienza coerenti.

### Fase 3 — Prodotto e architettura dell’informazione

- Valutare utilità e unicità di ogni sezione.
- Ridurre dispersione, ripetizioni e CTA concorrenti.
- Mantenere analisi profonda immediatamente accessibile per ogni partita.
- Migliorare stati loading/error/empty e contenuto editoriale.

Gate: ogni sezione ha uno scopo distinto, percorso chiaro e nessun blocco ornamentale.

### Fase 4 — Accessibilità, responsive e interazioni

- Coprire tastiera, dialoghi sovrapposti, focus, semantica e contrasto.
- Verificare breakpoint e contenuti estremi con test deterministici.
- Preparare una matrice browser/Android e automatizzare quanto possibile senza costi.

Gate: controlli automatici verdi; limiti di verifica reale esplicitamente separati.

### Fase 5 — Resilienza, prestazioni, sicurezza e operatività

- Misurare payload, latenza, concorrenza, cache e chiamate duplicate.
- Verificare header, input, URL esterni, timeout, retry e circuit breaker.
- Valutare Render Free e aggiornamenti automatici senza promesse irrealistiche.

Gate: budget e failure mode documentati e verificati.

### Fase 6 — Validazione finale e distribuzione

- Build, suite completa, audit locale e produzione, risorse, fonti e concorrenza.
- Validazione HTML/CSS e revisione del diff.
- Commit, push, attesa deploy e verifica URL invariato.
- Rapporto finale con prove e limiti.

## Registro dei problemi

Classificazione: `BLOCKER` informazione materialmente falsa/crash grave; `HIGH` funzione importante incompleta, fuorviante o fragile; `MEDIUM` complessità, accessibilità o UX significativa; `LOW` pulizia e documentazione.

Questi sono rilievi dimostrati, non ancora soluzioni implementate.

### BLOCKER

- `R-001 · contaminazione post-partita` — **RISOLTO LOCALMENTE IN V5.0.1, DEPLOY PENDENTE**: la causa era l’invocazione incondizionata dei moduli prematch nella Sintesi e il passaggio del precedente `analysis.decision` al Decision Trace anche fuori fase. La correzione introduce un Review Passport fattuale, chiude backend e frontend dal kickoff, rimuove i moduli decisionali dalle review non osservate e ammette probabilità/cronologia soltanto da snapshot locali validamente catturati prima del kickoff. Prove e gate sono nel registro incrementi.

### HIGH

- `R-002 · suite non autosufficiente`: `npm test`, `npm run audit`, `test:resources` e `test:sources` dipendono da un server già avviato manualmente su 4173. Con server fermo, `npm test` supera i test puri e poi fallisce con `Smoke test fallito: fetch failed`.
- `R-003 · storage non affidabile`: `readLocalJson` controlla solo la sintassi JSON, non la forma. Un valore valido ma errato per `vantaggio:favorites` (`{}`) provoca `TypeError: object is not iterable` prima dell’avvio. Molte scritture non gestiscono quota o storage negato; `kickoffChecks` non viene potato.
- `R-004 · due verità sulle evidenze`: `evidenceFoundation`, `resolvedFacts`, `conflicts` e `decisionTrace` sono prodotti dal backend ma non vengono letti da `public/app.js`. Evidence Map e Decision Passport ricostruiscono un secondo gate da campi V4, con risultati divergenti dal contratto V5.
- `R-005 · entity matching ambiguo`: `sameClubName`, `samePlayerName` e `starterOverrides` usano `includes` e token parziali per auto-associare club e giocatori. Questo contraddice la policy “fuzzy = candidato, mai merge automatico” e può attribuire status o omissioni alla persona/squadra sbagliata.
- `R-006 · availability sovrastimata`: due XI ufficiali portano automaticamente lo score disponibilità almeno a 78, anche senza copertura della panchina o della rosa. Un XI prova chi parte, non una copertura medica completa. La distinction è spiegata nel copy ma non rispettata dal punteggio/gate.
- `R-007 · Radar non realmente decisionale`: l’ordine di Radar, hero e molte priorità usa `opportunityScore`, composto soprattutto da peso della competizione, grandi club, vicinanza temporale e differenza di forma. Non misura value, robustezza o vantaggio sul mercato. I Power Picks analizzano solo cinque candidate e il Radar resta ordinato con l’euristica precedente; schermate diverse possono indicare partite diverse come priorità.
- `R-008 · degradazione parziale nascosta`: se una delle competizioni fallisce, `getMatches` pubblica il resto come nuovo successo e sostituisce la cache aggregata; il calendario può perdere una lega senza fallback per sorgente. `updateSyncStatus` dichiara errore solo se falliscono sia partite sia news, quindi un dominio fallito può apparire “Aggiornato”. `getLeagueInjuries` converte un errore upstream in un successo vuoto, impedendo il last-known-good.
- `R-009 · cache e chiamate duplicabili`: cache senza limite/eviction e senza single-flight; range data arbitrari e chiavi Team DNA possono farla crescere. `fresh=1` è pubblico e senza cooldown. Primo dossier e Kickoff Watch chiedono analysis e intelligence insieme, mentre intelligence richiama analysis: su cache fredda partono richieste upstream duplicate.
- `R-010 · copertura calendario ambigua`: il backend copre globalmente solo ieri/oggi/domani, mentre per il resto dei 14 giorni interroga sette tornei. La vista usa “Calendario globale” e “Tutte le competizioni” senza mostrare questa differenza temporale. Il requisito di non dichiarare falsamente l’assenza di gare è rispettato per il giorno corrente, non comunicato bene per i giorni successivi.
- `R-011 · semantica HTTP e hardening`: un asset inesistente restituisce `200 text/html` con la homepage (`/missing-asset.js`), anche in produzione. POST e HEAD sugli endpoint vengono accettati come GET. Mancano CSP, protezione framing, Permissions Policy e HSTS applicativo.
- `R-012 · deploy senza build gate`: Render esegue solo `npm install --omit=dev`; una regressione di build può essere pubblicata perché `npm run build` non è nel `buildCommand`. Non esiste ancora CI GitHub.
- `R-013 · modello non allineato alla ricerca`: il modello usa medie gol delle ultime cinque con prior fisso, senza forza avversari/lega; il mercato pesa circa 62–68%, intervallo chiamato dinamico ma quasi fisso e senza freshness propria. Il blueprint richiede benchmark separato, valutazione temporale e astensione calibrata. Prima di chiamarlo selettore delle migliori giocate serve un backtest globale versionato.

### MEDIUM

- `R-014 · CSS append-only`: 2.034 righe, numerosi blocchi responsive ripetuti e gruppi certamente orfani delle interfacce precedenti (`metric-grid`, vecchio radar, vecchia newsroom, vecchio intelligence room, vecchi deep-story). Il controllo iniziale ha trovato 67 classi candidate; le classi dinamiche vanno escluse prima della rimozione.
- `R-015 · monoliti ad alto accoppiamento`: server 2.549 righe/131 funzioni, frontend 1.936 righe/170 funzioni e CSS 2.034 righe. Foundation è separata, ma route, provider, modello, intelligence, storage, rendering e interazioni sono ancora accorpati.
- `R-016 · input e limiti API`: Team DNA valida solo la presenza dell’ID, non formato, lunghezza o lega. `/api/matches` non limita l’ampiezza del range. Gli errori di input lanciati vengono restituiti come 502 anziché 400.
- `R-017 · navigazione iniziale`: un hash iniziale non valido rende la dashboard per fallback ma lascia `state.currentView` invalido e nessuna voce attiva finché non avviene una navigazione.
- `R-018 · race Team DNA`: una richiesta lenta per la squadra A può completarsi dopo la chiusura e riapertura sulla squadra B e sostituire il contenuto perché viene controllato solo `layer.hidden`, non la chiave attiva.
- `R-019 · refresh mobile`: polling ogni 90 secondi anche con scheda nascosta; health viene chiesto in parallelo alle fonti e può fotografare il ciclo precedente; una classifica viene precaricata anche se l’utente non visita la sezione.
- `R-020 · semantica dei contenuti cliccabili`: molte card usano `article role=button/link` e listener delegati invece di `button`/`a`; funziona nei test VM ma aumenta codice e rischio tastiera. Mancano skip link e annuncio dei risultati della ricerca.
- `R-021 · documentazione dispersiva`: README organizzato come successione V4.0–V5.0, con storia mescolata allo stato corrente. Va alleggerito spostando la cronologia in un changelog senza perdere decisioni.
- `R-022 · incoerenze minori`: `normalizeLineups` considera ufficiale `>=11` mentre Evidence richiede esattamente 11; esiste un’assegnazione duplicata di `keyQuestion`; `lastStates` è scritto ma mai letto e `refreshTimer` è assegnato ma mai usato; la telemetria resta “operativa con errori” per ogni errore storico dal boot.
- `R-023 · provenienza da precisare`: `provenance.rawHash` è calcolato sul valore normalizzato e sul locator, non sul payload grezzo del provider. Il nome promette più di ciò che è conservato; i Resolved Fact ID includono il tempo di risoluzione e cambiano anche a evidenza invariata.

## Prime decisioni di sequenza

1. Correggere `R-001` con test di non contaminazione post-hoc prima di qualsiasi refactor.
2. Rendere suite e storage autonomi/robusti (`R-002`, `R-003`) per creare una rete di sicurezza reale.
3. Correggere semantica HTTP, build gate, single-flight e degradazione per sorgente (`R-008`–`R-012`).
4. Proiettare l’unica verità Evidence Foundation nel frontend e poi correggere identity/availability (`R-004`–`R-006`, `R-023`).
5. Ridisegnare ranking e modello solo dopo un protocollo di backtest (`R-007`, `R-013`).
6. Semplificare architettura, CSS e UX con test di equivalenza e browser reali (`R-014`–`R-021`).

## Registro degli incrementi

### R-001 — Review post-partita fail-closed · V5.0.1

Stato: implementato e validato localmente; commit, push, deploy e gate produzione ancora pendenti.

Modifiche coerenti:

- `server.js`: `decisionTrace.applicable` è vero soltanto in stato prematch con kickoff futuro verificabile; stato post/live o kickoff raggiunto chiudono Model Gate a `CLOSED`, Effective Gate a `HOLD` e dichiarano la fase effettiva.
- `public/app.js`: la Sintesi conclusa usa un `REVIEW PASSPORT`; senza osservazione prematch mostra soltanto risultato, fatti, copertura review e zero previsioni post-hoc. Decision Passport, Pre-Match Total Intelligence e Decision Watch non vengono invocati. Uno snapshot locale con `capturedAt < kickoff` resta invece visibile e congelato con probabilità e metriche osservate.
- `public/styles.css`: stato chiuso e stato osservato hanno trattamento distinto, layout mobile a tre colonne e colori testuali conformi sia nel tema chiaro sia nello scuro.
- Test permanenti aggiornati in `evidence-foundation-test.js`, `frontend-test.js`, `smoke-test.js` e `audit-test.js`; `source-consistency-test.js` mantiene cinque confronti diretti ma scorre una finestra più ampia quando ESPN elenca un evento senza pubblicarne il summary.
- Versione e cache key portate a `5.0.1` in `package.json`, `public/index.html`, test e README.

Gate locali conclusivi sulla build V5.0.1:

- `npm run build`: superato; sintassi, quality, accessibilità statica, responsive e contrasto verdi.
- `npm test`: superato integralmente.
- Audit HTTP/API: `211/211`.
- Risorse dinamiche: `394/394` URL valide, zero rotte o non verificabili.
- Coerenza fonte: cinque partite correnti più PSG–Aston Villa storico e 22 titolari confrontati direttamente con ESPN.
- HTTP storico `401873624`: `applicable=false`, `phase=post`, `modelGate=CLOSED`, `evidenceGate=HOLD`, `effectiveGate=HOLD`.
- Chromium reale: desktop chiaro 1440×1000 e Android emulato scuro 360×800; review senza snapshot, CTA Verifiche, rifiuto dello snapshot catturato dopo il kickoff, snapshot prematch congelato, tre probabilità osservate, target 44 px, nessun overflow, nessun errore console/page/request.
- Contrasto del nuovo stato chiuso: 6,03:1 nel tema chiaro e 5,37:1 nello scuro; screenshot desktop/mobile esaminati e rimossi dopo la verifica.

Evento di gate gestito: il primo confronto fonti ha incontrato un `HTTP 400` ufficiale sul summary ESPN dell’evento ASEAN `401906724`, pur presente nello scoreboard. Il test non ignora il requisito: cerca fino a 30 candidati su tre giorni, salta soltanto summary ESPN esplicitamente non pubblicati con 400 e richiede comunque esattamente cinque confronti completi.

Limiti: nessun Android fisico e nessuno screen reader hardware disponibile. Nessun codice V5.0.1 è ancora in produzione.

## Stato corrente

In corso: primo incremento di sicurezza `R-001`, localmente verde e pronto al gate di distribuzione.
Prossimo passo immediato: rieseguire i gate essenziali con cache key V5.0.1, revisionare il diff, committare e distribuire all’URL invariato; poi verificare produzione. Solo dopo la chiusura produzione di `R-001` iniziare `R-002` (suite autonoma).
