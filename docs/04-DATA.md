# 04 — Fonti dati, endpoint e limiti

## Principio generale

VANTAGGIO usa soltanto fonti gratuite e senza credenziali applicative. Questo rende il progetto sostenibile a costo zero, ma significa che:

- gli endpoint possono cambiare senza preavviso;
- non esiste uno SLA;
- non tutte le competizioni espongono gli stessi campi;
- “risposta HTTP valida” non significa “dato completo”;
- assenza di un record non significa assenza reale di un infortunio o evento.

Il Source Manifest dichiara per quali fatti ogni fonte è autorizzata. I payload grezzi non vengono conservati integralmente.

## 1. ESPN scoreboard per competizione

### Endpoint

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={range}&limit=100
```

### Usato per

- ID evento;
- competizione;
- data e kickoff;
- stato prematch/live/post;
- squadre, stemmi e abbreviazioni;
- punteggio;
- venue quando presente;
- forma/record sintetici quando pubblicati.

### Non garantisce

- calendario mondiale completo su periodi lunghi;
- lineup;
- lista completa degli indisponibili;
- statistiche avanzate uniformi;
- correzioni storiche persistenti nel progetto;
- dati identici per ogni torneo.

## 2. ESPN global scoreboard

### Endpoint

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates={date}&limit=1000
```

### Usato per

- scoprire competizioni e partite oltre alle sette leghe principali;
- coprire il programma globale di ieri, oggi e domani;
- evitare il falso messaggio “nessuna partita” quando esistono eventi rilevanti.

### Policy attuale

- globale soltanto per ieri/oggi/domani;
- nel resto del periodo esteso vengono interrogate le sette competizioni principali;
- le amichevoli entrano solo se coinvolgono una squadra nella lista `BIG_CLUBS`;
- competizioni sconosciute possono mantenere l’etichetta del provider.

### Cosa non prende

- copertura globale completa per tutti i 10–14 giorni mostrabili;
- un catalogo editoriale stabile di ogni competizione;
- garanzia che ogni evento globale abbia anche un endpoint summary funzionante.

È stato osservato un evento presente nello scoreboard ma con summary ESPN `HTTP 400`.

## 3. ESPN event summary

### Endpoint primario

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={eventId}
```

### Fallback

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={eventId}
```

### Usato per

- contesto della competizione e fase;
- andata/ritorno e aggregato quando disponibili;
- venue;
- head-to-head;
- forma e risultati recenti;
- lineup ufficiali e moduli;
- statistiche della partita;
- eventi chiave;
- leader;
- quote/consenso quando il feed li espone;
- review post-partita.

### Cosa non garantisce

- summary disponibile per ogni evento dello scoreboard;
- stesso schema per tutte le competizioni;
- lineup prima della pubblicazione ufficiale;
- xG e metriche avanzate per tutte le gare;
- panchina/rosa completa coerente;
- market price con bookmaker, timestamp e freshness sufficienti;
- disponibilità medica completa.

## 4. ESPN standings

### Endpoint

```text
https://site.api.espn.com/apis/v2/sports/soccer/{league}/standings
```

### Usato per

- rango;
- partite giocate;
- vittorie, pareggi e sconfitte;
- gol fatti/subiti;
- differenza reti;
- punti;
- nome e logo squadra.

### Non prende

- regole ufficiali complete di qualificazione/spareggio;
- penalizzazioni spiegate;
- storico della classifica nel tempo;
- split casa/trasferta;
- proiezioni.

Le fasce europee/retrocessione mostrate nel frontend sono indicative.

## 5. ESPN team schedule

### Endpoint

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{teamId}/schedule?season={season}
https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{teamId}/schedule?season={season}
```

### Usato per

- risultati recenti;
- prossimi impegni;
- riposo fra gare;
- carico calendario;
- split casa/trasferta;
- campione di base Team DNA;
- recupero di alcuni boxscore passati.

### Non prende

- allenamenti;
- viaggio reale;
- rotazioni pianificate;
- condizione fisica;
- forza dell’avversario già normalizzata dal modello;
- storico completo garantito per ogni squadra.

## 6. ESPN injury feed

### Endpoint

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/injuries
```

### Usato per

- status giocatore quando la route pubblica dati;
- dettaglio disponibile;
- availability per alcune competizioni.

### Limiti importanti

- route non uniforme e spesso vuota;
- copertura non certificata;
- assenza di un giocatore non significa disponibilità;
- non copre in modo potente tutte le rose e tutte le leghe;
- oggi un errore può essere degradato a lista vuota, rendendo più difficile usare last-known-good.

## 7. Fantasy Premier League

### Endpoint

```text
https://fantasy.premierleague.com/api/bootstrap-static/
```

### Usato per

- status strutturati dei giocatori Premier League;
- `chance_of_playing_*`;
- news/status;
- aggiornamento availability;
- baseline di forza squadra come segnale secondario.

### Non prende

- giocatori fuori dalla Premier League;
- diagnosi medica ufficiale completa;
- lineup ufficiali della partita;
- squalifiche/assenze sempre complete;
- garanzia di stabilità dell’endpoint, che non è un’API pubblica formalmente supportata per questo uso.

## 8. Google News RSS

### Endpoint

```text
https://news.google.com/rss/search?q={query}&hl=it&gl=IT&ceid=IT:it
```

### Usato per

- cercare articoli collegati a una partita;
- scoprire segnali su assenze, rientri e dichiarazioni;
- titolo, editore, data e link.

### Non prende

- testo integrale verificato;
- verità dell’affermazione;
- identità giocatore garantita;
- distinzione sicura fra indiscrezione e comunicato ufficiale;
- accesso a contenuti protetti/paywall.

Per availability è una fonte debole/editoriale: non deve diventare automaticamente un fatto confermato.

## 9. Newsroom

### Endpoint/feed

```text
https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml
https://football-italia.net/feed/
https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news?limit=16
```

### Usato per

- feed generale notizie;
- titolo;
- fonte;
- data;
- link;
- immagine quando disponibile.

### Non prende

- archivio completo;
- deduplicazione semantica robusta;
- fact-check;
- riassunto affidabile dell’articolo;
- copertura uniforme di tutte le competizioni.

## 10. VANTAGGIO Evidence Engine

Non è una fonte esterna. Produce dati derivati:

- probabili;
- omissioni;
- rest days;
- metriche tattiche;
- coverage availability;
- forecast del modello.

Nel Source Manifest è Tier 4/derived. Una derivazione non deve essere presentata come comunicato ufficiale.

## Cache attuali

| Dato | TTL indicativo |
|---|---:|
| Partite | 1 minuto |
| Classifiche | 10 minuti |
| Newsroom | 5 minuti |
| Analysis | 5 minuti |
| Intelligence | 10 minuti |
| Team DNA | 30 minuti |
| Snapshot partita passata | 30 minuti |
| Archivio stagione squadra | 6 ore |
| FPL availability | 30 minuti |
| ESPN injuries | 20 minuti |
| News availability | 15 minuti |

Il fallback stale è limitato in base al TTL, ma la cache vive soltanto nella memoria del processo Render.

## Resilienza

`fetchText()` applica:

- timeout;
- retry limitato per errori transitori;
- telemetria per host;
- circuit breaker dopo errori consecutivi;
- cooldown crescente;
- cache last-known-good limitata.

Problema ancora aperto: la cache aggregata delle partite può essere sostituita anche se una singola competizione è fallita.

## Dati che il progetto non possiede in modo affidabile

- database medico globale e completo;
- squalifiche centralizzate e certificate per tutte le competizioni;
- rose complete e contratti;
- allenamenti e conferenze stampa strutturate;
- tracking fisico/GPS;
- eventi Opta/StatsBomb correnti per ogni partita;
- xG uniforme e corrente per tutte le leghe;
- quote bookmaker versionate con timestamp e storico;
- meteo, arbitro e campo in modo sistematico;
- archivio raw immutabile server 24/7;
- storico condiviso delle previsioni fra utenti/dispositivi.

## Evidence: cosa viene conservato

Ogni record Evidence prova a conservare:

- soggetto canonico;
- tipo di fatto;
- valore;
- fonte e tier;
- validità temporale;
- momento di osservazione;
- scadenza;
- locator;
- trasformazione;
- qualità;
- supersessioni e conflitti;
- impatto decisionale.

### Limite di provenienza

`rawHash` è calcolato sul valore normalizzato e sul locator, non sul payload grezzo completo. Inoltre `storeRawBody` è `false` per le fonti correnti. Quindi oggi non esiste una prova raw integrale versionata di ogni risposta provider.
