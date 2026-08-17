# VANTAGGIO V5 — Evidence Mesh Architecture

**Specificazione di discussione**  
**Data:** 17 agosto 2026  
**Stato:** proposta architetturale; nessuna modifica al codice di produzione  
**Decisione già approvata:** architettura a tre piani — Render operativo, GitHub baseline, browser immutabile

---

## 1. North Star di prodotto

Il nome **VANTAGGIO** nasce dalla volontà di scoprire e conoscere tutto ciò che conta su una partita, fino a ottenere un quadro dettagliato e completo.

La promessa corretta del prodotto è:

> VANTAGGIO ricostruisce il quadro più completo, corrente e verificabile possibile di ogni partita. Distingue fatti, letture e punti ancora ignoti; conserva ciò che era noto prima del kickoff e spiega perché una nuova evidenza cambia o non cambia la decisione.

### Completezza non significa accumulo

Il dossier è completo quando:

- ogni domanda essenziale ha una risposta oppure uno stato esplicito `non disponibile / atteso / in conflitto`;
- ogni risposta ha provenienza e timestamp;
- gli elementi decisivi sono più visibili di quelli accessori;
- una lacuna importante non è nascosta da molti dati secondari;
- la Sintesi rimane breve, mentre le prove complete sono raggiungibili nell’area corretta.

### Le nove domande che VANTAGGIO deve coprire

1. **Che partita è?** Competizione, fase, importanza, formato e situazione dell’eventuale doppio confronto.
2. **Quando e dove si gioca davvero?** Kickoff, fuso, sede, rinvii e cambi di programma.
3. **Come arrivano le squadre?** Forma pesata, forza, split casa/trasferta, qualità degli avversari e campione.
4. **Come possono affrontarsi?** Identità tattica, stili, produzione, vulnerabilità e possibili accoppiamenti.
5. **Chi può giocare?** Disponibilità rosa, assenze, dubbi, rientri, squalifiche e qualità delle fonti.
6. **Chi dovrebbe o sta per giocare?** Probabili XI, ufficiali, modulo, continuità e forza disponibile.
7. **Qual è il contesto esterno?** Riposo, densità del calendario, viaggio quando verificabile, motivazioni e notizie rilevanti.
8. **Cosa dicono numeri e mercato?** Modello, benchmark, differenze, rischio, calibrazione e astensione.
9. **Quanto sappiamo davvero?** Provenienza, copertura, freschezza, conflitti, cambiamenti e prossimi controlli.

Queste nove domande formeranno la futura **Match Knowledge Coverage**. Non saranno nove nuove schede: sono un modello di copertura interno proiettato nelle quattro aree esistenti del Match Control Room.

---

## 2. Architettura a tre piani

## 2.1 Piano A — Operational Now

**Esecuzione:** server Render mentre è attivo.  
**Responsabilità:** dato corrente e risposta alle richieste dell’utente.

### Include

- calendario e stato evento;
- score e minuto;
- riepilogo evento;
- lineup e boxscore;
- disponibilità e news correnti;
- dossier richiesto;
- controlli Kickoff Watch mentre il portale è aperto;
- cache, retry, circuit breaker e bounded stale;
- reconciliation fra evidenze già disponibili.

### Non promette

- sorveglianza continua quando il servizio gratuito è spento;
- filesystem persistente;
- esecuzioni garantite a un minuto preciso;
- recupero retroattivo di informazioni prematch non osservate.

### Regola operativa

Ogni chiamata esterna deve essere condivisa dalla cache server e non moltiplicata per utente. La priorità delle richieste dipende da:

1. distanza dal kickoff;
2. partita aperta dall’utente;
3. partita salvata nel Kickoff Watch;
4. criticità dell’evidenza mancante;
5. costo e rate limit della fonte.

---

## 2.2 Piano B — Verified Baseline

**Esecuzione:** GitHub Actions su workflow programmati.  
**Persistenza:** branch separato `data`, non collegato al deploy Render di `main`.  
**Responsabilità:** dati lenti, versionati, riproducibili e condivisi.

### Include progressivamente

- snapshot ClubElo;
- import e normalizzazione Football-Data.co.uk;
- eventuale shadow verification football-data.org;
- baseline delle competizioni;
- Entity Registry e alias;
- report di schema, volume, anomalie e copertura;
- manifest di generazione e checksum;
- artefatti di backtest e calibrazione aggregata.

### Non include

- live score;
- lineup T−60;
- notizie urgenti;
- dati personali;
- chiavi o segreti;
- copie integrali di dataset esterni non necessarie o non autorizzate.

### Regole di pubblicazione

1. Scaricare nella workspace temporanea dell’Action.
2. Validare schema, volume, date e valori.
3. Confrontare con l’ultima versione valida.
4. Bloccare la pubblicazione se il nuovo artefatto è anomalo.
5. Pubblicare soltanto file derivati consentiti e metadati di provenienza.
6. Aggiornare `manifest.json` come ultima operazione atomica.
7. Conservare l’ultima versione valida se un job fallisce.

### Struttura proposta del branch `data`

```text
/
├── manifest.json
├── registry/
│   ├── entities-v1.json
│   ├── aliases-v1.json
│   └── conflicts-v1.json
├── snapshots/
│   ├── clubelo/latest.json.gz
│   └── football-data/latest.json.gz
├── baselines/
│   ├── competition-strength-v1.json
│   └── model-validation-v1.json
├── quality/
│   ├── latest-run.json
│   ├── schema-report.json
│   └── coverage-report.json
└── licenses/
    └── source-manifest.json
```

### Esempio `manifest.json`

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-08-17T03:17:00Z",
  "runId": "baseline-20260817-0317",
  "state": "valid",
  "artifacts": [
    {
      "id": "clubelo-latest",
      "path": "snapshots/clubelo/latest.json.gz",
      "sha256": "…",
      "observedAt": "2026-08-17T03:18:10Z",
      "validFor": "P2D",
      "quality": "passed"
    }
  ],
  "checks": {
    "schema": "passed",
    "volume": "passed",
    "dates": "passed",
    "identityConflicts": 3
  }
}
```

### Controllo della crescita

- non duplicare un dataset se il checksum non cambia;
- conservare `latest` e snapshot periodici, non ogni esecuzione completa;
- usare file compressi per artefatti derivati;
- non importare l’intero StatsBomb Open Data nel repository;
- registrare nel manifest la versione sorgente e la trasformazione.

---

## 2.3 Piano C — Immutable Observation

**Esecuzione e persistenza:** browser dell’utente.  
**Responsabilità:** conservare ciò che era realmente noto quando la partita era ancora prematch.

### Ogni snapshot conserva

- evento canonico e kickoff osservato;
- versione del dossier;
- Decision Passport complessivo;
- Model Gate e Data Readiness separati;
- probabilità e segnale, se non HOLD;
- evidenze critiche utilizzate;
- lineup e availability osservate;
- conflitti aperti;
- versioni di modello, registry e baseline;
- timestamp di cattura;
- risultato finale aggiunto successivamente.

### Regola di immutabilità

Il contenuto prematch non viene modificato dopo il kickoff. Una correzione successiva può essere collegata come nuova evidenza, ma non riscrive ciò che il portale conosceva al momento della decisione.

---

## 3. Entity Registry V1

## 3.1 Ambito iniziale

La prima versione copre:

- competizioni;
- squadre;
- eventi;
- giocatori soltanto quando compaiono in lineup, availability o leader.

I giocatori non devono essere risolti globalmente con il solo nome: all’inizio vengono contestualizzati per squadra e stagione.

## 3.2 Entità squadra

```json
{
  "entityId": "vantaggio:team:ita:pisa",
  "entityType": "team",
  "canonicalName": "Pisa",
  "shortName": "Pisa",
  "country": "IT",
  "status": "active",
  "providerRefs": [
    {
      "provider": "espn",
      "id": "3956",
      "state": "confirmed",
      "observedAt": "2026-08-17T01:48:00Z"
    },
    {
      "provider": "clubelo",
      "id": "Pisa",
      "state": "candidate",
      "observedAt": null
    }
  ],
  "aliases": [
    {
      "value": "Pisa SC",
      "normalized": "pisa sc",
      "language": "it",
      "source": "manual-registry",
      "state": "confirmed"
    }
  ],
  "competitionMemberships": [
    {
      "competitionId": "vantaggio:competition:ita:coppa-italia",
      "season": "2026-27"
    }
  ],
  "resolution": {
    "locked": true,
    "method": "provider-id-plus-manual-review",
    "updatedAt": "2026-08-17T01:48:00Z"
  }
}
```

## 3.3 Regole di risoluzione squadre

### Auto-conferma consentita

- stesso ID nello stesso provider;
- alias già confermato nel Registry;
- nome normalizzato esatto, stesso paese, stessa competizione e un solo candidato.

### Solo candidato, mai auto-merge

- similarità fuzzy;
- abbreviazione senza paese/competizione;
- nome storico o sponsor non registrato;
- squadre riserve, femminili, U21 o omonime;
- due candidati compatibili nella stessa federazione.

### Stato

- `confirmed`: collegamento utilizzabile;
- `candidate`: possibile collegamento, escluso dai fatti critici;
- `conflict`: due identità incompatibili;
- `retired`: entità storica;
- `redirect`: vecchio ID canonico sostituito, senza perdere la storia.

## 3.4 Entità evento

```json
{
  "entityId": "vantaggio:event:2026-08-17:pisa:empoli:coppa-italia",
  "entityType": "event",
  "competitionId": "vantaggio:competition:ita:coppa-italia",
  "season": "2026-27",
  "homeTeamId": "vantaggio:team:ita:pisa",
  "awayTeamId": "vantaggio:team:ita:empoli",
  "scheduledAt": "2026-08-17T16:00:00Z",
  "providerRefs": [
    { "provider": "espn", "id": "401881678", "state": "confirmed" }
  ],
  "identityState": "confirmed",
  "revision": 1
}
```

### Matching eventi

Per proporre lo stesso evento servono:

- stesse squadre canoniche;
- stessa competizione e stagione;
- kickoff compatibile o reschedule documentato;
- round/fase compatibile quando presente.

Una grande differenza di orario non viene “corretta” automaticamente: crea un conflitto di kickoff.

## 3.5 Entità giocatore

```json
{
  "entityId": "vantaggio:player:espn:123456",
  "entityType": "player",
  "canonicalName": "Nome Giocatore",
  "teamContexts": [
    {
      "teamId": "vantaggio:team:ita:pisa",
      "season": "2026-27",
      "from": "2026-07-01"
    }
  ],
  "providerRefs": [
    { "provider": "espn", "id": "123456", "state": "confirmed" }
  ],
  "resolution": {
    "state": "confirmed",
    "method": "provider-id"
  }
}
```

Se manca un ID stabile, nome + squadra + stagione produce soltanto una identità contestuale. L’unione cross-provider richiede almeno un secondo attributo affidabile: data di nascita, nazionalità, numero/ruolo stabile o conferma manuale.

---

## 4. Source Manifest V1

Ogni sorgente ha un passaporto macchina leggibile.

```json
{
  "sourceId": "espn-event-summary",
  "label": "ESPN Event Summary",
  "operator": "ESPN",
  "class": "structured-provider",
  "documentedApi": false,
  "cost": "free-access",
  "authentication": "none",
  "factTypes": [
    "event.identity",
    "event.kickoff",
    "event.state",
    "event.result",
    "lineup.official",
    "match.statistics"
  ],
  "coverage": {
    "geography": "global-variable",
    "competitions": "provider-dependent"
  },
  "cadence": {
    "expected": "request-driven",
    "liveTargetSeconds": 90
  },
  "defaultTierByFact": {
    "lineup.official": 1,
    "event.result": 1,
    "player.availability": 2
  },
  "resilience": {
    "timeoutMs": 14000,
    "retryAttempts": 1,
    "circuitThreshold": 4,
    "stalePolicy": "fact-specific"
  },
  "legal": {
    "storeRawBody": false,
    "storeMetadataOnly": true,
    "attribution": "ESPN public feed"
  }
}
```

### Principio importante

Il tier appartiene alla coppia **fonte + tipo di fatto**. La stessa fonte può essere forte per il risultato e debole per la disponibilità medica.

---

## 5. Evidence Contract V1

## 5.1 Involucro comune

```json
{
  "schemaVersion": "1.0",
  "evidenceId": "ev:lineup:401881678:20260817T150800Z:espn",
  "factType": "lineup.official",
  "subject": {
    "entityType": "event",
    "entityId": "vantaggio:event:2026-08-17:pisa:empoli:coppa-italia",
    "teamId": "vantaggio:team:ita:pisa"
  },
  "value": {
    "formation": "3-4-2-1",
    "starters": []
  },
  "source": {
    "sourceId": "espn-event-summary",
    "tier": 1,
    "class": "structured-provider"
  },
  "time": {
    "validFrom": "2026-08-17T15:08:00Z",
    "validTo": null,
    "publishedAt": "2026-08-17T15:08:00Z",
    "observedAt": "2026-08-17T15:08:23Z",
    "expiresAt": "2026-08-17T18:30:00Z"
  },
  "scope": {
    "coverage": "home-team-starting-xi",
    "competition": "ita.coppa_italia"
  },
  "provenance": {
    "locator": "event/401881678/roster/home",
    "rawHash": "sha256:…",
    "transform": "normalizeLineups@2.0",
    "derivedFrom": []
  },
  "quality": {
    "provenance": 96,
    "coverage": 100,
    "freshness": 100
  },
  "state": "confirmed",
  "supersedes": [],
  "conflictsWith": [],
  "decisionImpact": "essential"
}
```

## 5.2 Tipi di fatto iniziali

### Evento

- `event.identity`
- `event.competition_context`
- `event.kickoff`
- `event.venue`
- `event.state`
- `event.result`

### Squadra e calendario

- `team.recent_result`
- `team.schedule_event`
- `team.rest_days`
- `team.strength_baseline`
- `team.tactical_metric`

### Rosa e formazione

- `player.availability`
- `player.suspension`
- `player.return`
- `lineup.probable`
- `lineup.official`
- `lineup.formation`
- `lineup.omission`

### Numeri e mercato

- `model.forecast`
- `market.price`
- `market.consensus`
- `match.statistics`

### Editoriale

- `news.article`
- `news.claim`
- `coach.statement`

Un articolo e una sua affermazione sono due evidenze differenti. Il titolo può essere conservato come metadato; la pretesa “giocatore assente” richiede una claim separata con stato `observed` finché non corroborata.

## 5.3 Stati dell’evidenza

- `observed`: acquisita, ma non sufficiente per conferma;
- `confirmed`: soddisfa le regole del tipo di fatto;
- `expected`: evidenza non ancora pubblicata nella normale finestra;
- `conflicted`: incompatibile con un’altra evidenza rilevante;
- `superseded`: sostituita da una prova più recente o forte;
- `expired`: oltre il TTL;
- `rejected`: schema o identità non validi.

---

## 6. Modello temporale

VANTAGGIO deve distinguere quattro tempi:

1. **Valid time:** quando il fatto vale nel mondo reale.
2. **Published time:** quando la fonte lo pubblica.
3. **Observed time:** quando VANTAGGIO lo vede.
4. **Decision time:** quando il dossier o snapshot usa l’evidenza.

### Esempio

- 14:20: un club pubblica che un giocatore è indisponibile.
- 14:26: Google News indicizza il comunicato.
- 14:31: VANTAGGIO lo acquisisce.
- 14:35: il Decision Passport passa da READY a CAUTION.

La UI deve poter dire:

> Segnalazione valida dalle 14:20, osservata da VANTAGGIO alle 14:31, applicata alla decisione delle 14:35.

### TTL per tipo

| Evidenza | Politica iniziale |
|---|---|
| Stato live | 90 secondi mentre il portale è aperto |
| Kickoff lontano | 6 ore; più frequente nel giorno gara |
| Kickoff da T−180 | 30 minuti |
| Lineup non pubblicata | attesa prima di T−75, critica dopo |
| Lineup ufficiale | valida per l’evento, salvo correzione |
| Availability ufficiale | 24 ore, accelerata vicino al kickoff |
| Segnale editoriale | dipende dalla data dell’articolo, non dal fetch |
| ClubElo | 48 ore |
| Boxscore finale | immutabile salvo correzione |
| Storico CSV | valido fino al successivo ciclo atteso |

I valori saranno configurabili nel Source Manifest e testati per tipo di fatto.

---

## 7. Reconciliation Engine V1

## 7.1 Output: Resolved Fact

```json
{
  "resolvedFactId": "rf:event:401881678:kickoff:r3",
  "factType": "event.kickoff",
  "subjectId": "vantaggio:event:2026-08-17:pisa:empoli:coppa-italia",
  "value": "2026-08-17T16:00:00Z",
  "state": "confirmed",
  "chosenEvidenceId": "ev:kickoff:espn:…",
  "alternatives": [],
  "resolution": {
    "policy": "event-kickoff-v1",
    "reason": "Provider evento corrente; nessuna fonte indipendente in conflitto",
    "resolvedAt": "2026-08-17T13:00:00Z"
  },
  "quality": {
    "provenance": 94,
    "coverage": 100,
    "freshness": 96
  },
  "criticality": "essential"
}
```

## 7.2 La precedenza è specifica del fatto

### Kickoff

1. comunicazione ufficiale competizione/club;
2. feed evento corrente;
3. secondo provider documentato;
4. calendario storico/statico.

Un conflitto vicino al kickoff produce `CAUTION` o `HOLD` secondo gravità.

### Lineup

1. starter pubblicati nel roster evento;
2. comunicazione ufficiale del club/competizione;
3. probabile derivata dalle lineup storiche;
4. reporting editoriale.

Una probabile non viene mai trasformata in ufficiale per consenso.

### Availability

1. comunicato ufficiale o squalifica verificata;
2. fonte strutturata esplicita;
3. reporting forte e datato;
4. segnale editoriale corroborato;
5. titolo singolo.

La presenza nell’XI ufficiale supera la claim “non partirà titolare”, ma non prova che il giocatore sia pienamente sano. La presenza in panchina supera “assente dalla distinta”, non necessariamente “in condizioni ottimali”.

### Risultato

1. feed evento finale;
2. secondo provider indipendente;
3. correzione ufficiale.

Una correzione post-partita genera una nuova revisione senza cancellare il risultato precedentemente osservato.

## 7.3 Conflitti

Ogni conflitto ha:

- evidenze coinvolte;
- campo;
- severità `critical / material / informational`;
- stato `open / resolved / accepted-uncertainty`;
- impatto sui moduli;
- regola applicata;
- prossimo controllo.

### Esempio kickoff

```json
{
  "conflictId": "conflict:kickoff:401881678:1",
  "factType": "event.kickoff",
  "severity": "critical",
  "values": [
    { "value": "18:00 Europe/Rome", "source": "espn-event-summary" },
    { "value": "20:45 Europe/Rome", "source": "shadow-fixtures" }
  ],
  "state": "open",
  "decisionImpact": "hold-near-kickoff",
  "nextCheck": "official-competition-source"
}
```

## 7.4 Corroborazione

- La corroborazione richiede fonti realmente indipendenti.
- Due siti che copiano la stessa agenzia contano come una catena, non due conferme.
- Il numero di fonti non sostituisce il tier.
- La fonte ufficiale può prevalere senza quorum.
- Una claim editoriale rimane distinta dal fatto risolto.

## 7.5 Nessuna compensazione

Il punteggio aggregato continua a esistere per compatibilità, ma la readiness applica gate per dominio:

- identità evento;
- kickoff;
- lineup nella finestra critica;
- availability;
- campione minimo del modello;
- benchmark quando richiesto.

Molte news o statistiche storiche non possono compensare un’identità o lineup critica.

---

## 8. Quattro scenari reali

## 8.1 Lineup non ancora dovuta

**T−180**

- nessun XI ufficiale;
- stato evidenza: `expected`;
- copertura lineup: bassa;
- criticità: nessuna;
- prossimo controllo: T−60;
- Data Readiness può restare READY se le altre evidenze essenziali sono mature.

**T−52**

- XI ancora assente;
- stato: `critical`;
- Data Readiness: almeno CAUTION;
- se anche availability è critica: HOLD.

**T−47**

- XI ufficiali acquisiti;
- precedente osservazione “non pubblicati” diventa `superseded`;
- nuova evidenza `confirmed`;
- recalcolo permesso perché ancora prematch;
- What Changed spiega la variazione.

## 8.2 Availability in conflitto

- articolo: “Giocatore X in forte dubbio”;
- fonte strutturata: chance di giocare 75%;
- XI ufficiale: titolare.

Risoluzione:

- “non sarà titolare” viene superato;
- “aveva un problema fisico” può restare come contesto storico;
- stato attuale: disponibile a partire;
- nessuna conclusione sulla piena condizione atletica;
- la forza XI usa la presenza ufficiale, non una diagnosi inventata.

## 8.3 Due kickoff diversi

- feed corrente: 18:00;
- shadow verifier: 20:45;
- nessuna comunicazione ufficiale disponibile.

Risoluzione:

- conflitto aperto;
- la UI mostra l’orario del feed operativo con badge `da verificare`;
- vicino all’evento il gate diventa HOLD;
- nessuna notifica o dossier congelato usa un orario presentato come certo.

## 8.4 Correzione dopo il finale

- alle 20:02 VANTAGGIO osserva finale 2–1;
- alle 20:18 il provider corregge a 1–1.

Risoluzione:

- nuova revisione del risultato;
- Track Record riconcilia con il risultato valido più recente;
- audit conserva il valore 2–1 precedentemente osservato;
- la previsione prematch non viene ricalcolata.

---

## 9. Data Readiness V2

## 9.1 Gate separati

### Model Gate

Valuta:

- campione;
- qualità statistica;
- benchmark;
- forza del segnale;
- stabilità del modello.

### Evidence Gate

Valuta:

- identità e contesto;
- kickoff;
- lineup;
- availability;
- conflitti;
- freshness;
- copertura essenziale.

### Decision Passport

Usa lo stato più prudente fra i due gate.

## 9.2 Regole iniziali

### HOLD

- identità evento non risolta;
- kickoff in conflitto critico vicino al via;
- due domini essenziali critici;
- Model Gate HOLD;
- evidenza scaduta senza fallback valido su un dominio decisivo.

### CAUTION

- un dominio essenziale critico;
- uno o più domini essenziali parziali;
- Model Gate CAUTION;
- conflitto materiale non risolto;
- benchmark assente quando non indispensabile ma utile.

### READY

- nessun conflitto critico;
- domini essenziali sufficienti per la finestra temporale corrente;
- Model Gate READY;
- nessuna evidenza scaduta usata come corrente.

READY significa quadro utilizzabile, non risultato certo.

---

## 10. Match Knowledge Coverage

La copertura futura non sarà una media che consente compensazioni. Sarà una matrice per dominio.

```json
{
  "overallCompatibilityScore": 79,
  "domains": [
    {
      "id": "competition-context",
      "essential": true,
      "state": "complete",
      "coverage": 100
    },
    {
      "id": "lineups",
      "essential": true,
      "state": "expected",
      "coverage": 20
    },
    {
      "id": "availability",
      "essential": true,
      "state": "critical",
      "coverage": 36
    }
  ],
  "readiness": "caution"
}
```

### Proiezione nella Sintesi

- `6/9 aree documentate`;
- `2 parziali o attese`;
- `1 criticità`;
- priorità: “Copertura disponibilità rosa”;
- prossimo controllo.

### Proiezione nell’area Verifiche

- Source Passport;
- Evidence Ledger;
- conflict card;
- timeline validità/osservazione/decisione;
- revisioni e supersessioni;
- lineage fino al modulo influenzato.

---

## 11. Health Center V2

La salute di una fonte diventa multidimensionale.

### Tecnica

- successi/errori;
- latenza;
- circuito;
- retry;
- cache e stale age.

### Contenuto

- schema valido;
- volume atteso;
- null rate;
- duplicati;
- distribuzioni impossibili.

### Dominio

- competizioni realmente coperte;
- squadre mappate;
- lineup disponibili;
- availability strutturata;
- ritardo medio rispetto al kickoff.

### Impatto

- dossier toccati;
- domini degradati;
- gate abbassati;
- fallback attivi;
- conflitti aperti.

Una fonte può quindi essere tecnicamente operativa ma editorialmente incompleta.

---

## 12. API compatibility

I consumer esistenti devono continuare a ricevere:

- evento normalizzato;
- score e stato;
- `reliability.overall`;
- `reliability.items[].score`;
- Decision/Model Passport;
- lineup e availability attuali.

Campi nuovi:

- `entityRefs`;
- `evidenceSummary`;
- `resolvedFacts` essenziali;
- `conflicts`;
- `sourceManifestVersion`;
- `registryVersion`;
- `baselineVersion`;
- `knowledgeCoverage`;
- `decisionTrace`.

Le evidenze complete possono essere restituite con un endpoint separato o soltanto nell’area Verifiche, evitando di gonfiare ogni risposta.

---

## 13. Sicurezza, privacy e legalità

- nessuna chiave nei file pubblici o nel frontend;
- segreti soltanto in GitHub Actions Secrets o variabili Render;
- nessun dato personale utente nel data branch;
- niente scraping di fonti escluse o endpoint competitor non documentati;
- conservare metadati, hash e locator quando non è opportuno conservare il raw body;
- attribution e licenza dichiarate nel Source Manifest;
- link alle notizie invece di copiarne il testo integrale;
- log tecnici senza token, cookie o URL segreti.

---

## 14. Test obbligatori

### Entity resolution

- alias esatto unico;
- due squadre omonime;
- riserve/U21/femminile;
- cambio nome;
- provider ID riutilizzato o assente;
- evento rinviato.

### Evidence

- publishedAt successivo a validAt;
- observedAt successivo a publishedAt;
- timestamp mancante;
- evidence scaduta;
- correzione e supersessione;
- raw hash invariato o cambiato.

### Reconciliation

- ufficiale contro titolo;
- due provider concordanti;
- due provider in conflitto;
- fonti non indipendenti;
- lineup attesa/critica/confermata;
- availability superata da XI senza inferire salute.

### Pipeline GitHub

- schema rotto;
- volume crollato;
- data futura impossibile;
- checksum invariato;
- job fallito non sovrascrive `latest`;
- manifest pubblicato per ultimo;
- artifact stale visibile.

### Decision

- optional evidence non compensa il critico;
- HOLD del modello prevale;
- HOLD delle evidenze prevale;
- snapshot prematch ricostruibile;
- nessun ricalcolo post-hoc.

### UI

- Sintesi non aumenta in modo incontrollato;
- conflitto comprensibile senza solo colore;
- dettagli raggiungibili da tastiera;
- Android 360 px senza scroll orizzontale;
- timestamp e fonte leggibili;
- target principali di almeno 44 px.

---

## 15. Sequenza incrementale proposta

## Foundation 1 — Linguaggio comune

- Entity Registry V1;
- Source Manifest V1;
- Evidence Contract V1;
- taxonomy dei fact type;
- test puri e fixture simulate;
- nessuna nuova fonte.

## Foundation 2 — Evidenze correnti

- avvolgere kickoff, venue, result, lineup e availability già esistenti;
- Resolved Fact e conflitti;
- decision trace;
- API compatibile.

## Foundation 3 — Esperienza

- Match Knowledge Coverage;
- Source Passport;
- conflict card;
- timeline delle revisioni;
- Health Center V2;
- layout Android.

## Baseline 1 — GitHub Data Plane

- branch `data`;
- workflow e manifest;
- validazione atomica;
- heartbeat e stato stale;
- nessun nuovo provider iniziale.

## Baseline 2 — Fonti indipendenti

1. ClubElo;
2. Football-Data.co.uk;
3. OpenFootball;
4. football-data.org opzionale con chiave gratuita.

Ogni fonte entra soltanto dopo test di mapping, schema, freshness, rate limit e licensing.

---

## 16. Criteri di accettazione complessivi

- VANTAGGIO risponde alle nove domande o dichiara il vuoto;
- ogni fatto essenziale è tracciabile fino alla fonte;
- valid time, published time e observed time restano distinti;
- conflitti non nascosti;
- correzioni senza perdita della storia;
- nessun fuzzy match ambiguo usato in una decisione;
- nessuna fonte opzionale compensa una lacuna critica;
- nessuna nuova dipendenza a pagamento;
- nessun database obbligatorio;
- URL invariato;
- nessun peggioramento della UX mobile;
- test locali e produzione completamente verdi;
- il dossier prematch resta immutabile dopo il kickoff.

---

## 17. Decisione proposta

La prima implementazione consigliata è **Foundation 1 — Linguaggio comune**.

Non cambia ancora il contenuto del portale e non aggiunge fonti. Crea invece gli schemi, i registri e i test necessari affinché tutte le successive integrazioni siano verificabili, sostituibili e coerenti con la promessa di VANTAGGIO: conoscere davvero la partita, non limitarsi a mostrare numeri.

---

## 18. Stato implementazione — checkpoint interno 2026-08-17

Foundation 1 e Foundation 2 backend sono implementate in V5.0.0 e restano additive rispetto allo schema V4.9.1:

- i tre artefatti V1 sono machine-readable in `data/`;
- `lib/evidence.js` applica namespace provider, identità contestuali candidate, contratto, validazione, expiry, supersessione, subject isolation, conflitti, Resolved Facts e Decision Trace;
- `/api/evidence-foundation` pubblica il manifest senza chiamate upstream;
- `/api/intelligence.evidenceFoundation` avvolge i dati già esistenti di identità evento, contesto competizione, kickoff, venue, stato/risultato, XI e availability;
- l’availability osservata oggi non viene presentata come prova retroattiva per una partita storica;
- nessun nuovo provider, costo, database o componente UI è stato aggiunto;
- i campi V4.9.1 e la versione pubblica Match Intelligence `1.4` restano invariati.

La suite dedicata `scripts/evidence-foundation-test.js` verifica artefatti, identità, timestamp, autorizzazione, precedence, supersession, expiry, isolamento, conflitti e mapping Foundation 2. La promozione in produzione resta subordinata all’intera suite locale e all’audit.
