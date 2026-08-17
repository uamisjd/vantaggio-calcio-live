# VANTAGGIO V5 Discovery 01 — Data & Evidence Foundation

**Data:** 17 agosto 2026  
**Stato:** ricerca e proposta; nessuna modifica applicativa inclusa  
**Vincoli:** costo zero, URL invariato, Render gratuito, aggiornamento automatico, trasparenza e comportamento fail-closed

## North Star di prodotto

Il nome **VANTAGGIO** nasce dalla volontà di scoprire e sapere tutto ciò che è realmente utile su una partita, fino a ottenere un quadro dettagliato e completo. La completezza non viene misurata dal numero di card o statistiche: ogni domanda essenziale deve avere una risposta verificabile oppure uno stato esplicito `non disponibile`, `atteso` o `in conflitto`. La Sintesi mostra ciò che conta; le prove complete restano accessibili nell’area corretta.

## 1. Domanda di ricerca

Come può VANTAGGIO ottenere dati più completi, aggiornati e verificabili senza dipendere da una singola fonte gratuita, senza introdurre costi e senza fingere una precisione che le fonti non permettono?

## 2. Conclusione principale

Non esiste nel 2026 una API gratuita, documentata e permanente che offra contemporaneamente:

- calendario mondiale;
- live score affidabile;
- statistiche profonde;
- lineup;
- indisponibilità complete;
- quote e benchmark;
- storico ampio;
- frequenza adatta a un prodotto pubblico;
- licenza e SLA da produzione.

La soluzione raccomandata è una **VANTAGGIO Evidence Mesh**: più fonti con ruoli limitati e dichiarati, un registro canonico delle entità, un contratto comune delle evidenze, riconciliazione per tipo di fatto e gate che si astiene quando le prove essenziali non sono mature.

## 3. Valutazione delle fonti

| Fonte | Valore reale | Limite principale | Ruolo consigliato |
|---|---|---|---|
| ESPN public feeds | Calendario globale, stato evento, risultati, roster evento, boxscore e classifiche già integrati | Endpoint non documentati come API pubblica con SLA; schema modificabile | **Sorgente operativa primaria**, mai unica verità |
| football-data.org free | Fixture, risultati, classifiche e marcatori su 12 competizioni; API documentata; 10 richieste/minuto | Risultati ritardati, niente lineup/statistiche profonde nel piano gratuito, chiave necessaria | **Shadow verifier** per principali competizioni, non live primario |
| ClubElo | Ranking giornaliero e storico per club, più fixture/probabilità proprie | Copertura soprattutto europea; mapping nomi necessario | **Baseline indipendente di forza**, separata dal modello VANTAGGIO |
| Football-Data.co.uk | Decenni di risultati, statistiche e quote storiche; aggiornamento almeno bisettimanale | Non adatto a live o disponibilità; il publisher invita alla cautela nelle analisi di betting | **Backtest, benchmark e calibrazione storica** |
| OpenFootball | Dataset public domain, JSON/TXT, ampia varietà di campionati | Aggiornamento comunitario e profondità variabile | **Fallback storico e supporto al registro identità**, non fonte live |
| StatsBomb Open Data | Eventi e lineup molto dettagliati per competizioni selezionate | Open data storico/selettivo; API completa riservata ai clienti | **Laboratorio offline** per validare feature e metodi, non dati correnti |
| Fantasy Premier League | Stato giocatori, chance, news, minuti, partenze e contributi per Premier League | Endpoint pubblicamente accessibili ma non formalmente documentati; copertura solo Premier | **Availability strutturata Premier**, con circuit breaker e disclaimer |
| Google News RSS | Scoperta rapida di articoli e segnali datati | Titolo non equivale a fatto; copertura e indicizzazione variabili | **Discovery editoriale**, mai conferma unica |
| GDELT | Scoperta globale e multilingue, aggiornamento frequente | API di ricerca complessa, throttling instabile, risultati rumorosi | **Discovery supplementare sperimentale**, tier basso |
| TheSportsDB | Metadati, immagini e catalogo ampio | Crowdsourced, accuratezza e free tier non adatti a decisioni critiche | Solo **fallback visuale/metadati**, non raccomandato per fatti |
| API-Football / Highlightly free | Lineup e player data potenzialmente utili | Circa 100 richieste/giorno: insufficiente per il calendario globale e difficile da governare su Render effimero | Eventuale **pilota selettivo**, mai dipendenza centrale |
| FotMob/SofaScore/Understat/Transfermarkt non documentati | Apparente profondità | Scraping o endpoint non documentati, instabilità e possibili limiti d’uso | **Esclusi** dalla fondazione affidabile |

## 4. Architettura raccomandata: Evidence Mesh a tre piani

### Piano A — Operational Now

Esegue su Render soltanto quando il servizio è attivo:

- calendario e stato evento;
- dossier richiesto dall’utente;
- lineup e boxscore;
- refresh vicino al kickoff;
- cache, retry, circuit breaker e stale limitato.

Non deve fingere una sorveglianza 24/7: Render gratuito si spegne dopo 15 minuti senza traffico e perde le modifiche al filesystem.

### Piano B — Verified Baseline

Una GitHub Action programmata genera artefatti pubblici, piccoli e versionati su un branch dati separato:

- snapshot ClubElo giornaliero;
- import Football-Data.co.uk bisettimanale;
- eventuale verifica football-data.org sulle 12 competizioni gratuite;
- alias e controlli delle identità;
- baseline statistiche per competizione;
- manifest con timestamp, schema, checksum, fonte e stato dei controlli.

Il repository è pubblico, quindi i runner standard di GitHub Actions restano gratuiti. Il job non serve il live e non sostituisce i checkpoint T−60/T−30/T−10: i workflow schedulati possono essere ritardati e si disattivano dopo 60 giorni di inattività del repository. Ogni artefatto deve quindi dichiarare la propria freschezza e scadere in modo fail-closed.

### Piano C — Immutable Observation

Rimane nel browser, come già avviene per Vault e Track Record:

- fotografia realmente osservata prima del kickoff;
- Decision Passport e Data Readiness del momento;
- fonti ed evidenze usate;
- esito finale riconciliato senza ricalcolare il passato.

Questo piano protegge la verità temporale senza richiedere account, database o dati personali.

## 5. Registro canonico delle entità

Il difetto più pericoloso di una strategia multi-fonte è unire squadre o partite sbagliate. Serve un `Entity Registry` versionato.

Ogni squadra dovrebbe avere:

- `vantaggioTeamId` stabile;
- paese e competizione;
- nome ufficiale e nome breve;
- alias normalizzati;
- ID per ciascun provider;
- dominio ufficiale quando verificabile;
- data e metodo dell’ultimo collegamento;
- stato `confirmed / candidate / conflict`.

Regole:

1. ID esplicito dello stesso provider prima di tutto.
2. Alias + paese + competizione + stagione per i collegamenti cross-provider.
3. Similarità testuale solo per produrre candidati, mai per unire automaticamente casi ambigui.
4. Nessun merge se due squadre omonime possono appartenere allo stesso spazio competitivo.
5. Ogni correzione conserva l’alias precedente e la ragione.

## 6. Evidence Contract

Ogni fatto importante deve entrare nel sistema con un involucro comune, non come campo anonimo:

```json
{
  "factId": "stable-id",
  "factType": "lineup | player_status | kickoff | result | venue | statistic",
  "subjectId": "canonical-entity-id",
  "value": {},
  "source": {
    "id": "provider-id",
    "tier": 1,
    "mode": "official | structured | reporting | discovery",
    "documented": false
  },
  "validAt": "quando il fatto vale nel mondo reale",
  "publishedAt": "quando la fonte lo ha pubblicato",
  "observedAt": "quando VANTAGGIO lo ha acquisito",
  "expiresAt": "quando non è più utilizzabile senza verifica",
  "coverageScope": "home | away | both | competition",
  "state": "observed | confirmed | conflicted | superseded",
  "derivedFrom": []
}
```

La distinzione fra `validAt` e `observedAt` introduce un modello bitemporale leggero: permette di sapere sia quando un fatto era vero, sia cosa VANTAGGIO conosceva al momento della decisione.

## 7. Reconciliation Engine

La riconciliazione deve operare **per campo e per tipo di fatto**, non scegliere un provider vincente per tutto.

### Precedenza iniziale

1. Fonte ufficiale specifica del fatto: XI pubblicato per l’evento, comunicato club/lega.
2. Feed strutturato esplicito e datato.
3. Secondo provider indipendente per fixture, risultato o classifica.
4. Reporting forte con autore, data e URL.
5. Discovery editoriale o titolo non corroborato.

### Regole importanti

- Una fonte ufficiale può prevalere su due articoli: non si usa una semplice maggioranza.
- Due fonti indipendenti concordanti aumentano la corroborazione, non trasformano automaticamente il dato in ufficiale.
- I conflitti non vengono cancellati: entrambi i valori restano nel ledger con stato `conflicted`.
- Una correzione crea una nuova versione e marca la precedente `superseded`.
- I moduli opzionali non compensano i vuoti essenziali.
- Il dato riconciliato eredita la provenienza completa delle fonti usate.

## 8. Freshness Policy per tipo di fatto

Non esiste un unico TTL corretto.

| Tipo | Comportamento raccomandato |
|---|---|
| Stato live | 60–90 secondi mentre la pagina è aperta |
| Kickoff/sede lontani | ore, con controllo più frequente nel giorno gara |
| Lineup ufficiale | attesa prima di T−75; controllo prioritario da T−75 |
| Disponibilità strutturata | 6–24 ore secondo fonte; scadenza accelerata vicino al via |
| News | età dell’articolo, non età della richiesta RSS |
| Boxscore concluso | immutabile salvo correzione esplicita |
| Elo | snapshot giornaliero |
| Storico CSV | aggiornamento bisettimanale e versione del file |

## 9. Data Observability senza piattaforme a pagamento

VANTAGGIO può implementare direttamente cinque controlli:

1. **Freshness:** ritardo rispetto alla frequenza attesa.
2. **Volume:** crolli o picchi anomali nel numero di partite, lineup o record.
3. **Schema:** campi rimossi, tipo cambiato, strutture inattese.
4. **Distribution:** valori impossibili o fortemente anomali.
5. **Lineage:** quali fonti e trasformazioni alimentano ogni modulo e decisione.

Il Source Health Center dovrebbe distinguere:

- salute tecnica della chiamata;
- qualità del contenuto;
- copertura del dominio;
- freschezza rispetto allo SLA del fatto;
- impatto sui dossier già calcolati.

## 10. Alternative considerate

### A. Sostituire ESPN con una API freemium

**Non consigliata.** Le quote gratuite non coprono il volume globale, lineup e statistiche spesso richiedono piani a pagamento e si introdurrebbe un nuovo single point of failure.

### B. Aggiungere molte API gratuite direttamente al server

**Non consigliata.** Aumenta conflitti, rate limit e rotture senza una semantica comune. Prima servono Entity Registry, Evidence Contract e reconciliation.

### C. Database esterno gratuito

**Non necessario nella prima fase.** Aggiunge un account, limiti, privacy e un ulteriore servizio. Il modello GitHub data branch + Render on-demand + browser immutable soddisfa meglio il vincolo zero costi.

### D. Evidence Mesh incrementale

**Raccomandata.** Migliora affidabilità e verificabilità senza promettere copertura che le fonti non offrono.

## 11. Pacchetto incrementale raccomandato — Foundation 1

Questa prima implementazione non dovrebbe ancora aggiungere nuove API operative. Dovrebbe preparare la struttura corretta:

1. Entity Registry V1 per squadre e competizioni già osservate.
2. Evidence Contract V1 per kickoff, venue, lineup, availability e risultati.
3. Reconciliation Engine con conflitti e supersessioni visibili.
4. Source Manifest con frequenza attesa, tier, copertura e modalità.
5. Controlli automatici su schema, volume, freshness e valori impossibili.
6. Health Center V2 che separi salute tecnica da qualità/copertura.
7. Test deterministici su omonimie, conflitti, correzioni e dati scaduti.

Solo dopo questa fondazione conviene integrare, in ordine:

- ClubElo come baseline indipendente;
- Football-Data.co.uk per backtest e benchmark;
- football-data.org come shadow verifier opzionale con chiave gratuita;
- OpenFootball come fallback storico;
- eventuale GDELT esclusivamente come discovery tier basso.

## 12. Acceptance criteria Foundation 1

- nessun nuovo costo o database;
- URL invariato;
- nessun provider nuovo può promuovere da solo un segnale;
- ogni fatto critico espone fonte, validità, osservazione e scadenza;
- conflitti conservati e visibili;
- nessun fuzzy match ambiguo viene accettato automaticamente;
- correzioni senza perdita della versione precedente;
- ogni Decision Passport è ricostruibile dalle evidenze osservate;
- dati scaduti o schema rotto producono `CAUTION/HOLD`, non un fallback silenzioso;
- suite locale e produzione completamente verdi.

## 13. Fonti consultate

- football-data.org API policies: https://docs.football-data.org/general/v4/policies.html
- Football-Data.co.uk: https://www.football-data.co.uk/data.php
- ClubElo API: http://clubelo.com/API
- OpenFootball football.json: https://github.com/openfootball/football.json
- StatsBomb Open Data: https://github.com/statsbomb/open-data
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub scheduled workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Render free services: https://render.com/docs/free
- W3C PROV Data Model: https://www.w3.org/TR/prov-dm/
- Data observability overview: https://www.databricks.com/blog/what-is-data-observability
- Entity resolution review: https://www.science.org/doi/10.1126/sciadv.abi8021
