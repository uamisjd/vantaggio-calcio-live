# VANTAGGIO

Portale calcistico responsive in italiano con partite, live score, Match Radar, notizie, classifiche, preferiti e alert locali. Funziona senza API a pagamento e senza dipendenze npm.

## Funzioni

- Dashboard premium responsive, tema scuro/chiaro
- Calendario dei principali campionati europei
- Aggiornamento automatico ogni 90 secondi
- Live score e stato degli incontri
- Match Radar con indice trasparente 0–100
- Dettaglio partita, forma recente e profilo di rischio
- News aggregate con link alla fonte originale
- Classifiche di Serie A, Premier League, LaLiga, Bundesliga e Ligue 1
- Ricerca globale (`Ctrl/Cmd + K`)
- Preferiti persistenti nel browser
- Alert browser per l'inizio delle partite salvate, mentre il sito è aperto
- Cache server con fallback sull'ultima risposta valida
- PWA manifest e interfaccia mobile dedicata

## Fonti gratuite

- Partite e classifiche: feed pubblico ESPN
- Notizie: ANSA Calcio, Football Italia, ESPN

Le fonti possono modificare disponibilità o formato. Il backend centralizza e normalizza i dati, quindi è semplice sostituire un provider senza rifare l'interfaccia.

## Pubblicazione con URL stabile

Il progetto include `render.yaml` per il deploy gratuito su Render, con URL invariato e aggiornamenti automatici da GitHub. Le istruzioni sono in `DEPLOY-RENDER.md`.

## Avvio locale

Richiede Node.js 18 o successivo.

```bash
npm start
```

Il server usa `PORT=4173` per impostazione predefinita e ascolta su `0.0.0.0`.

## Verifica

Con il server avviato:

```bash
npm run check
npm test
```

Lo smoke test verifica homepage, stato servizio, partite, notizie e classifica.

## Struttura

- `server.js` — server statico, proxy dati, cache e normalizzazione
- `public/index.html` — shell accessibile dell'app
- `public/styles.css` — design system e responsive design
- `public/app.js` — routing, filtri, ricerca, preferiti, modal e auto-refresh
- `scripts/smoke-test.js` — test end-to-end degli endpoint principali

## Nota responsabile

Il Match Radar ordina segnali descrittivi e non costituisce una promessa o garanzia di vincita. Non usa quote bookmaker e invita sempre a un comportamento responsabile (18+).
