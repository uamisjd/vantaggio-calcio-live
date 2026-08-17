# VANTAGGIO V4.9 — Research & Product Blueprint

_Data di ricerca: 17 agosto 2026 · timezone Europe/Rome_

## 1. Tesi di prodotto

VANTAGGIO non deve promettere di “indovinare” il calcio. Deve diventare il luogo in cui l’utente capisce, nel minor tempo possibile:

1. **quali partite meritano studio**;
2. **che cosa sappiamo davvero**;
3. **che cosa è cambiato**;
4. **quanto è solida ogni informazione**;
5. **quando è più corretto non concludere nulla**.

La caratteristica distintiva non è un altro punteggio sintetico, ma una **catena di custodia dell’informazione**: fonte → fatto osservato → trasformazione → inferenza → livello di incertezza → fotografia prematch immutabile → verifica dopo il risultato.

“Infallibile” non è un obiettivo realistico per pronostici sportivi o feed gratuiti. L’obiettivo ingegneristico corretto è **fail-closed**: in caso di dati scarsi, contraddittori, vecchi o non verificabili, il prodotto abbassa la fiducia, conserva l’ultimo dato valido con etichetta di obsolescenza oppure si astiene.

## 2. Cosa emerge dalla ricerca

### 2.1 Previsione e calibrazione

- Un modello calcistico deve essere valutato **fuori campione e nel tempo**, non con una divisione casuale che permette al futuro di contaminare il passato.
- Una base Poisson con forze di attacco/difesa, vantaggio casa, decadimento temporale e correzione prudente dei punteggi bassi è più difendibile di semplici medie sulle ultime cinque gare.
- La probabilità deve essere giudicata con **Brier score e log-loss**, non soltanto con la percentuale di pronostici “presi”.
- La calibrazione va letta per fasce di probabilità e soltanto quando il campione è sufficiente.
- Il mercato può essere un benchmark molto forte. Quando è disponibile e temporalmente coerente, va confrontato con il modello; non va nascosto né incorporato con un peso arbitrario e fisso.
- La funzione più importante è l’**astensione**: “HOLD / nessun segnale maturo” è un risultato corretto, non un errore dell’interfaccia.

### 2.2 Formazioni e disponibilità

Una formazione probabile attendibile richiede più livelli separati:

- frequenza di titolarità recente;
- recenza e minuti osservati;
- ruolo/posizione effettivamente coperti;
- continuità dell’undici e della struttura tattica;
- stato esplicito di infortunio, squalifica, dubbio o indisponibilità;
- differenza fra **assenza**, **omissione dall’XI** e **presenza in panchina**;
- riconciliazione con la formazione ufficiale quando pubblicata.

Le fonti pubbliche non danno accesso affidabile a GPS, carichi di allenamento o diagnosi mediche. VANTAGGIO deve quindi separare:

- **osservato**: comunicato ufficiale, squalifica, roster ufficiale, XI ufficiale;
- **corroborato**: più fonti indipendenti coerenti;
- **proxy**: minuti recenti, congestione, viaggio, rotazioni;
- **ignoto**: assenza di informazione, che non equivale a piena disponibilità.

### 2.3 Calendario, fatica e viaggio

Congestione e viaggio sono segnali contestuali, non penalità automatiche. La ricerca mostra effetti variabili e spesso modesti. Devono entrare come:

- giorni di riposo;
- partite nei 14 giorni;
- trasferta precedente e successiva;
- cambio di fuso/direzione quando realmente noto;
- ritorno da impegni internazionali;
- probabilità di rotazione, sempre dichiarata come inferenza.

Non devono produrre da soli una correzione meccanica della probabilità.

### 2.4 UX per desktop e Android

La stessa pagina non deve essere semplicemente rimpicciolita.

**Desktop — Analyst Workspace**

- tela più ampia e leggibile;
- elenco partite come master view e dossier come spazio di lavoro largo;
- contesto persistente, confronti affiancati e densità controllata;
- tipografia leggibile: niente testo informativo da 5–9 px;
- gerarchia chiara fra risposta, prove e approfondimento.

**Mobile — Progressive Match Journey**

- risposta primaria, stato dati e cambiamenti subito visibili;
- navigazione con una mano e target tattili da almeno 44–48 px;
- nessuna dipendenza da tabelle orizzontali per capire la risposta;
- quattro aree della Match Control Room mantenute, ma progressive;
- contenuti secondari rinviati e rendering fuori schermo differito.

### 2.5 Resilienza dei dati

Un prodotto affidabile deve avere:

- SLA di freschezza diversi per calendario, live, news, formazioni e classifiche;
- timeout, retry limitato con backoff e circuit breaker per fonte;
- cache last-known-good con età massima, mai fallback vecchio senza etichetta;
- controlli di schema, intervallo e completezza prima della pubblicazione;
- stati “operativa”, “degradata”, “circuito aperto”, “stale” e “non testata”;
- transizioni di stato monotone per le partite, evitando regressioni live → prematch;
- provenienza a livello di evidenza;
- test contrattuali con fixture sintetiche e test temporali.

## 3. Funzioni distintive da costruire

### A. Decision Passport

Una carta sintetica per ogni partita che unisce:

- stato Readiness;
- affidabilità dei dati;
- maturità della formazione;
- età dell’ultimo aggiornamento;
- tre fattori favorevoli;
- tre rischi;
- verdetto operativo: **READY / CAUTION / HOLD**.

Il verdetto non significa “vincerà”, ma “la lettura è o non è sufficientemente matura”.

### B. Evidence Chain

Ogni affermazione importante deve poter mostrare:

- origine;
- timestamp;
- tipo: fatto / lettura / da verificare;
- trasformazione applicata;
- eventuale conflitto con altre fonti;
- data di scadenza logica.

### C. Lineup Delta

Al passaggio da probabile a ufficiale:

- quanti titolari previsti sono confermati;
- cambi di modulo;
- forza relativa dell’XI;
- continuità;
- esclusioni rilevanti;
- motivo documentato o “non noto”;
- impatto sulla maturità, non correzione opaca del pronostico.

### D. Model Passport

Per ogni snapshot prematch:

- versione motore;
- ora di acquisizione;
- dati presenti e mancanti;
- probabilità solo modello;
- probabilità mercato, se disponibile;
- consenso e peso effettivamente usato;
- quality score;
- gate READY/CAUTION/HOLD;
- Brier e log-loss dopo il finale.

### E. Contradiction Radar

Rileva conflitti come:

- orari o sede discordanti;
- giocatore dato indisponibile ma presente nell’XI ufficiale;
- formazione descritta come ufficiale con meno di 11 titolari;
- stato partita che regredisce;
- news vecchia riproposta come attuale.

Il conflitto deve abbassare la maturità e restare visibile finché non è risolto.

### F. Unknowns Budget

Non basta elencare ciò che esiste. Ogni dossier deve dichiarare i vuoti che potrebbero cambiare la lettura: XI non ufficiali, availability incompleta, campione tecnico ridotto, mercato assente, contesto del turno incerto. Troppi vuoti attivano HOLD.

### G. Calibration Lab

Registro locale e trasparente con:

- snapshot realmente osservati prima del via;
- accuratezza 1-X-2 soltanto come metrica secondaria;
- Brier multicategoria;
- log-loss;
- gap di calibrazione/ECE quando il campione lo consente;
- confronto modello vs mercato quando entrambi erano disponibili;
- segmentazione futura per competizione, fascia di qualità e stato del gate.

## 4. Metodo statistico V4.9

### Baseline proposta

1. Ordina le gare recenti per data.
2. Applica decadimento temporale con half-life dichiarata.
3. Aumenta moderatamente il peso delle gare nello stesso contesto casa/trasferta.
4. Riduci le medie verso un prior prudente quando il campione è piccolo.
5. Calcola intensità gol casa/ospite con limiti conservativi.
6. Applica una correzione limitata ai punteggi 0–0, 0–1, 1–0, 1–1 solo se il campione minimo è presente.
7. Riduci gli estremi della distribuzione quando l’evidenza è scarsa.
8. Se esiste il mercato, rimuovi il margine e usa un peso dinamico dichiarato; conserva sempre anche l’output “solo modello”.
9. Attiva un gate di maturità che può bloccare il segnale.

### Metriche

- **Brier multicategoria normalizzato**: qualità complessiva delle tre probabilità.
- **Log-loss**: penalizza fortemente la sicurezza assegnata all’esito sbagliato.
- **ECE / reliability bins**: soltanto oltre una soglia minima di osservazioni.
- **Copertura del gate**: percentuale di partite su cui il sistema non si astiene.
- **Confronto con benchmark**: prior casa/pareggio/trasferta e mercato senza margine.

### Regole contro l’overconfidence

- nessuna probabilità estrema con campione minimo;
- H2H mai usato come aumento automatico della qualità del modello;
- nessuna conclusione medica da feed vuoto;
- nessuna ricalibrazione post-hoc;
- nessun backfill di snapshot mai osservati;
- nessun segnale “forte” se il gate è HOLD.

## 5. Architettura UX

### Desktop

- larghezza dossier 1080–1200 px;
- testata partita compatta e persistente;
- Match Control Room a quattro aree sempre raggiungibile;
- Sintesi: Decision Passport, cambiamenti, rischi;
- Squadre: tattica, calendario, XI e availability;
- Numeri: modello, campione e storico;
- Verifiche: Evidence Map, fonti, contraddizioni e Reliability Ledger;
- layout a due colonne solo quando il confronto è realmente utile.

### Mobile

1. Score/kickoff e identità squadre.
2. Decision Passport.
3. “Cosa è cambiato”.
4. quattro tab grandi e leggibili;
5. contenuti in stack verticale;
6. details/accordion per evidenza lunga;
7. navigazione inferiore entro safe area;
8. niente testo essenziale sotto 11 px; corpo informativo 12–15 px.

## 6. Roadmap prioritaria

### V4.9 — Trust & Responsive Foundations

- modello con recency weighting, shrinkage, low-score correction conservativa e gate;
- Model Passport e log-loss nel Track Record;
- circuit breaker, retry limitato e stale age bounded;
- tipografia leggibile e dossier desktop più ampio;
- target tattili e stack Android;
- `content-visibility` per sezioni lunghe;
- audit automatico di dimensioni testuali critiche e marker di resilienza.

### V4.10 — Lineup Delta & Contradiction Radar

- identità giocatore più robusta;
- matching probabile ↔ ufficiale;
- delta ruolo/modulo/continuità;
- conflitti availability/XI/news;
- expiry delle evidenze.

### V4.11 — Calibration Lab

- ECE e reliability bins con soglia minima;
- confronto modello/mercato;
- segmentazione per competizione e gate;
- report esportabile locale, senza account e senza costi.

### V4.12 — Context Expansion

- meteo soltanto se licenza e uso restano compatibili con la natura non commerciale;
- viaggio e geografia solo con coordinate affidabili;
- cambio allenatore e stabilità tattica da evidenze datate;
- calendario internazionale dei giocatori come proxy, mai dato medico.

## 7. Acceptance criteria V4.9

### Affidabilità

- il circuit breaker si apre dopo una sequenza configurata di errori e rientra dopo cooldown;
- un fallback stale espone età e stato;
- un elemento stale oltre il limite non viene servito;
- il frontend distingue almeno circuito aperto, fonte degradata e dato stale;
- nessun errore di una singola competizione azzera il calendario globale.

### Modello

- versione e metodologia sono esplicite;
- recenti pesate e shrinkage sono testati;
- H2H non aumenta il quality score;
- output modello, mercato e consenso restano separati;
- ogni snapshot salva gate, pesi e versione;
- riconciliazione calcola Brier e log-loss;
- calibrazione non viene dichiarata affidabile sotto la soglia minima.

### Desktop

- dossier almeno 1080 px quando il viewport lo consente;
- nessuna informazione primaria usa microtesto;
- confronto squadre leggibile senza compressione eccessiva;
- focus tastiera e tab ARIA restano funzionanti.

### Mobile Android

- nessun contenuto primario richiede scroll orizzontale;
- controlli principali ≥44 px;
- bottom navigation rispetta la safe area;
- nomi squadre, stato, gate e affidabilità sono leggibili a 360 px;
- dossier utilizzabile come bottom sheet senza coprire i controlli essenziali.

### Prestazioni

- rendering fuori schermo differito sulle sezioni lunghe;
- nessuna nuova dipendenza client;
- asset versionati e cache immutabile;
- suite syntax, smoke, frontend e audit tutte verdi prima del deploy.

## 7.1 Addendum implementato V4.9.1 — Reliability Ledger

La revisione del ledger applica una distinzione che il punteggio precedente nascondeva:

1. **Provenienza** — autorevolezza e tracciabilità della fonte.
2. **Copertura** — quota dell’informazione necessaria realmente presente.
3. **Freschezza** — età dell’ultimo riscontro disponibile.

Il campo storico `score` resta compatibile ed è calcolato come `35% provenienza + 40% copertura + 25% freschezza`, ma non determina da solo la possibilità di promuovere un segnale. Il nuovo **Critical Evidence Gate** valuta separatamente le evidenze essenziali. Una fonte autorevole può non aver ancora pubblicato gli XI; una notizia fresca può non coprire entrambe le rose; un buon boxscore storico non sostituisce un’assenza confermata. Per questo il gate applica le regole seguenti:

- lineup ufficiali mancanti: stato atteso prima di T−75, critico da T−75 e dopo il kickoff previsto;
- disponibilità rosa sotto 40 di copertura: criticità essenziale;
- due criticità essenziali: `HOLD`; una criticità o una lacuna essenziale parziale: `CAUTION`; nessuna: `READY`;
- news e altri moduli opzionali non possono compensare una criticità essenziale;
- il Decision Passport finale usa lo stato più prudente tra Model Gate e Data Readiness.

Ogni item V2 espone fonte, aggiornamento, tre dimensioni, stato testuale, criticità, prova mancante, impatto e prossimo controllo. Le etichette aggregate sono `Solida`, `Discreta`, `Parziale`, `Insufficiente`. L’interfaccia usa card espandibili native, semantica non dipendente dal solo colore e un layout Android impilato.

Acceptance criteria aggiuntivi:

- contratto compatibile con i consumer V4.9 tramite `overall`, `level`, `items[].score`, `source` e `note`;
- `schemaVersion: "2.0"`, dimensioni e Data Readiness presenti su ogni dossier;
- “Copertura disponibilità rosa” sostituisce l’etichetta generica su infortuni e squalifiche;
- lineup non ancora dovute non vengono rappresentate come errore precoce;
- lineup mancanti nella finestra critica sono visibili e abbassano il gate;
- test automatici impediscono a moduli opzionali di trasformare in `READY` un dossier con prove critiche mancanti.

## 8. Fonti principali

- Forecasting/calibration, studio Bundesliga 11 stagioni: https://journals.sagepub.com/doi/10.1177/22150218261416681
- Bradley–Terry, Poisson gerarchico e validazione temporale: https://d-nb.info/1168899656/34
- Dixon–Coles e time weighting: https://dashee87.github.io/football/python/predicting-football-results-with-statistical-modelling-dixon-coles-and-time-weighting/
- Congestione e prestazione, systematic review: https://pmc.ncbi.nlm.nih.gov/articles/PMC7846542/
- Carico, viaggio e recupero percepito: https://opus.lib.uts.edu.au/rest/bitstreams/0705c2a4-f6c9-450b-bdf9-a25f94949cc0/retrieve
- Dashboard calcistiche human-centered: https://liu.diva-portal.org/smash/get/diva2:1975420/FULLTEXT01.pdf
- Responsive web design: https://web.dev/responsive-web-design-basics/
- `content-visibility`: https://web.dev/articles/content-visibility
- Data SLAs: https://www.getdbt.com/blog/data-sla-challenges-guide
- Circuit breaker per pipeline dati: https://www.montecarlodata.com/blog-announcing-circuit-breakers-a-new-way-to-automatically-stop-broken-data-pipelines-and-avoid-backfilling-costs/
- Predicted lineups Flashscore: https://www.flashscore.co.uk/news/pre-match-football-content-boost-flashscore-introduces-predicted-line-ups/OzeY15aT/
- ClubElo API: http://clubelo.com/API
- Football-Data historical CSV: https://www.football-data.co.uk/data.php
- Open-Meteo terms (solo uso non commerciale gratuito): https://open-meteo.com/en/terms

## 9. Decisione di scope

V4.9 non introduce servizi a pagamento, PWA offline o Scenario Lab. Non finge di disporre di tracking, GPS o informazioni mediche proprietarie. Conserva URL pubblico, copertura globale filtrata, Match Control Room, Pre-Match Total Intelligence, Readiness Gate, Evidence Map, Signal Lifecycle, XI Intelligence e Pre-Match Vault.
