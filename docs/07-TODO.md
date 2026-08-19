# 07 — TODO prioritario

Obiettivo: avvicinare il prodotto all’idea originale — conoscere una partita in modo completo, aggiornato e affidabile — senza riscrivere tutto e senza aggiungere complessità prima delle fondamenta.

## Regola di lavoro

Procedere con un solo incremento coerente alla volta:

1. scrivere il test/regola di accettazione;
2. applicare la correzione minima;
3. eseguire build, test, audit HTTP e browser;
4. distribuire solo uno stato completo;
5. verificare produzione;
6. aggiornare il registro.

## P0 — Rendere sicura la base

### 1. Rendere la suite autonoma (`R-002`)

Da fare:

- creare un runner che avvia il server su porta libera;
- attendere `/api/status`;
- impostare `BASE_URL` per gli script;
- chiudere sempre il processo, anche in caso di errore;
- mantenere la possibilità di testare un server esterno;
- provare esplicitamente `npm test` con server inizialmente spento.

Accettazione:

```bash
npm test
```

deve funzionare da clone pulito senza preparazione manuale.

### 2. Rendere robusto il localStorage (`R-003`)

Da fare:

- validare tipo e schema di ogni chiave;
- ripristinare fallback sicuri;
- gestire `QuotaExceededError` e storage negato;
- potare snapshot, fixture ledger e kickoff checks;
- aggiungere test con array/oggetti/stringhe corrotti;
- offrire un reset dati locali non distruttivo per il resto dell’app.

Accettazione: nessun valore JSON valido ma malformato deve impedire l’avvio.

### 3. Correggere HTTP e deploy gate (`R-011`, `R-012`, `R-016`)

Da fare:

- accettare solo metodi previsti;
- 404 reale per asset mancanti;
- distinguere errori 400 da errori provider 502;
- limitare range, ID e parametri `fresh`;
- aggiungere CSP, frame protection, Permissions Policy e HSTS compatibile;
- eseguire `npm run build` nel buildCommand Render;
- aggiungere CI GitHub gratuita.

Accettazione: commit con build/test falliti non distribuibile.

## P1 — Correttezza e resilienza dati

### 4. Fallback per singola sorgente/competizione (`R-008`)

Da fare:

- cache separata per lega/data;
- conservare last-known-good per ogni job;
- pubblicare copertura parziale esplicita;
- non chiamare “Aggiornato” un payload con una lega persa;
- non convertire automaticamente injury error in successo vuoto.

### 5. Single-flight, limiti cache e cooldown (`R-009`)

Da fare:

- condividere promesse per chiavi identiche;
- limitare dimensione e durata delle cache;
- cooldown/autorizzazione per `fresh=1`;
- eliminare doppia Analysis fra frontend e Intelligence;
- sospendere polling quando la tab è nascosta.

### 6. Evidence Foundation come unica verità (`R-004`)

Da fare:

- leggere `decisionTrace`, `resolvedFacts` e `conflicts` nel frontend;
- eliminare la seconda ricostruzione del gate;
- collegare Evidence Map ai Resolved Facts reali;
- mostrare freshness e conflitti dal contratto V5;
- mantenere compatibilità API durante la migrazione.

Accettazione: stesso gate in API, Sintesi e Verifiche.

### 7. Correggere identità e availability (`R-005`, `R-006`, `R-023`)

Da fare:

- fuzzy matching solo come candidato;
- mai auto-merge da semplice `includes`;
- separare XI ufficiale da copertura rosa;
- non alzare availability per il solo fatto che esistano 22 titolari;
- rinominare `rawHash` o conservare davvero il raw in un piano compatibile;
- rendere stabili gli ID dei Resolved Facts a evidenza invariata.

## P2 — Rendere il prodotto davvero utile per scegliere le partite

### 8. Chiarire la copertura del calendario (`R-010`)

Da fare:

- mostrare “globale -1/0/+1 giorno” e “sette leghe nel periodo esteso”;
- distinguere “nessun evento” da “fonte non coperta”;
- indicare fonte e finestra per ogni filtro;
- evitare promesse assolute di calendario globale.

### 9. Definire il protocollo di backtest prima di cambiare il modello (`R-013`)

Da fare prima dell’algoritmo:

- dataset storico versionato;
- split temporali, mai random leakage;
- baseline semplici;
- Brier, log-loss, calibrazione e coverage;
- risultati per lega e stagione;
- confronto modello vs mercato separato;
- policy `HOLD` misurabile;
- report riproducibile.

Solo dopo:

- forza avversari/lega;
- Dixon–Coles/low-score più rigoroso;
- recency calibrata;
- benchmark indipendente;
- ensemble davvero dinamico.

### 10. Rifare il ranking, non il sito (`R-007`)

Il Radar deve ordinare per:

- applicabilità della decisione;
- qualità e completezza Evidence;
- incertezza del modello;
- freshness;
- eventuale divergenza dal benchmark;
- rischio e copertura.

Il peso del torneo o la presenza di un grande club possono essere contesto editoriale, non prova di value.

## P3 — Migliorare l’esperienza senza aggiungere clutter

### 11. Ridurre densità e duplicazioni

Da fare:

- scegliere una gerarchia primaria per pagina;
- unificare le spiegazioni di Gate/Reliability;
- ridurre etichette inglesi non necessarie;
- portare il testo importante sopra i dettagli;
- usare disclosure per metodo e diagnostica;
- mantenere Deep Analysis immediatamente accessibile.

### 12. Migliorare mobile e accessibilità (`R-017`, `R-020`)

Da fare:

- correggere hash invalido;
- rendere disponibile il tema su mobile;
- portare tutti i target a 44×44 px;
- usare `button` e `a` nativi;
- aggiungere skip link;
- annunciare i risultati ricerca;
- ridurre microtesto;
- testare TalkBack/VoiceOver su dispositivi reali quando possibile.

### 13. Correggere Team DNA e polling (`R-018`, `R-019`)

Da fare:

- token/AbortController per richiesta Team DNA attiva;
- non aggiornare un dialogo riutilizzato per un’altra squadra;
- fermare polling con `document.hidden`;
- evitare preload non necessari;
- sincronizzare health dopo il ciclo dati.

## P4 — Semplificazione tecnica controllata

### 14. Pulire il CSS (`R-014`)

Prima:

- snapshot visuali;
- matrice classi renderizzate/dinamiche;
- test desktop/mobile.

Poi:

- rimuovere gruppi certamente orfani;
- consolidare breakpoint;
- separare token, layout e componenti;
- non cambiare il design nello stesso commit della pulizia.

### 15. Dividere i monoliti (`R-015`)

Possibile direzione, senza riscrittura totale:

```text
server/
  routes/
  providers/
  cache/
  model/
  intelligence/
public/js/
  state/
  api/
  views/
  components/
  storage/
public/css/
  tokens.css
  layout.css
  components.css
  responsive.css
```

La divisione va fatta per comportamento coperto da test, non per estetica del codice.

### 16. Ripulire documentazione e incoerenze (`R-021`, `R-022`)

Da fare:

- README corto sullo stato corrente;
- CHANGELOG separato;
- docs come manuale tecnico;
- allineare regole lineup;
- rimuovere stato inutilizzato;
- chiarire telemetria “operativa con errori”.

## Cose da non fare adesso

- non aggiungere provider solo per aumentare il numero dei loghi/fonti;
- non creare Scenario Lab;
- non implementare PWA offline;
- non aggiungere nuove dashboard prima di semplificare quelle esistenti;
- non dichiarare il modello profittevole;
- non ricostruire snapshot prematch dopo il kickoff;
- non eseguire un grande refactor senza regressioni permanenti;
- non cambiare l’URL pubblico.

## Definizione pratica di “più vicino all’idea originale”

Il prodotto migliora davvero quando, per ogni partita:

1. mostra ciò che sa;
2. mostra da dove lo sa;
3. distingue ciò che deduce;
4. dichiara ciò che manca;
5. conserva ciò che era noto prima del kickoff;
6. non usa il risultato per riscrivere il passato;
7. sa fermarsi quando le prove non bastano;
8. ordina le partite per utilità reale, non per notorietà.
