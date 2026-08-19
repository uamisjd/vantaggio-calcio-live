# 00 — Panoramica di VANTAGGIO

> Fotografia del progetto così com’è nella release **5.0.1**. Questo documento descrive il software esistente: non propone una riscrittura.

## Idea

**VANTAGGIO** nasce dall’idea di conoscere una partita nel modo più completo possibile prima del calcio d’inizio: non soltanto risultato, forma recente o una generica “spinta casa/ospite”, ma contesto, calendario, squadre, probabili/ufficiali, disponibilità, tattica, numeri, notizie, fonti e limiti dei dati.

Il nome indica il vantaggio informativo che dovrebbe derivare da un quadro ordinato e verificabile.

## Scopo attuale

Oggi il sito è un portale calcistico gratuito in italiano che unisce:

- calendario e stato delle partite;
- classifiche e notizie;
- un ranking preliminare delle partite da studiare;
- un modello quantitativo prematch;
- un dossier approfondito per ogni partita disponibile;
- controlli sulla qualità e sulla provenienza delle informazioni;
- preferiti, alert e osservazioni prematch salvati nel browser.

Il prodotto non richiede account e non usa API a pagamento. È pubblicato su Render Free e funziona come applicazione web responsive.

## Obiettivo dichiarato

L’obiettivo è aiutare una persona a rispondere, per ogni partita, a domande concrete:

1. Che partita è e in quale contesto si gioca?
2. Come arrivano davvero le due squadre?
3. Calendario e riposo possono pesare?
4. Chi dovrebbe giocare e chi potrebbe mancare?
5. Che tipo di incrocio tattico è?
6. Cosa dicono i numeri e quanto sono affidabili?
7. Le notizie confermano o contraddicono il quadro?
8. Cosa è cambiato dall’ultima osservazione?
9. È ragionevole prendere una decisione oppure è meglio fermarsi (`HOLD`)?

## Cosa è realmente oggi

VANTAGGIO 5.0.1 è una **SPA statica con backend Node.js**. Ha sei viste principali, un Match Control Room, Team DNA, un Power Model e una prima Evidence Foundation.

Il sito è già ampio e visivamente caratterizzato, ma non è ancora il prodotto definitivo immaginato:

- alcune sezioni sono ricche di interfaccia ma dipendono da dati gratuiti incompleti;
- il Radar non dimostra ancora un vero “value” statistico;
- il modello non ha ancora un backtest globale sufficiente per dichiarare un vantaggio predittivo;
- la disponibilità dei giocatori è forte soprattutto in Premier League e più fragile altrove;
- il frontend non usa ancora l’Evidence Foundation come unica verità;
- non esiste un archivio server persistente: molte osservazioni vivono solo nel browser locale.

## Principi già presenti

### Prematch prima di tutto

L’analisi decisionale è pensata per il periodo prima del kickoff. Durante la gara il sito riduce l’esperienza allo score essenziale.

### Nessun backfill post-hoc

Dalla versione 5.0.1 una partita conclusa mostra un **Review Passport** fattuale. Probabilità e gate prematch restano visibili soltanto se erano stati realmente salvati prima del kickoff sul dispositivo.

### Fail-closed

Quando dati essenziali sono assenti, scaduti o in conflitto, il sistema dovrebbe scegliere `HOLD` anziché promuovere un segnale.

### Trasparenza

Il sito prova a separare:

- fatti;
- letture derivate;
- verifiche ancora aperte;
- qualità/provenienza del dato;
- fotografia prematch congelata;
- dati successivi alla partita.

## Cosa non è

Al momento VANTAGGIO non è:

- un bookmaker o un sistema per piazzare giocate;
- una garanzia di risultato;
- un database medico completo di tutte le rose;
- un prodotto live analytics completo;
- un servizio con account, sincronizzazione cloud o storico condiviso;
- un sistema offline/PWA completo;
- un modello validato come profittevole sul mercato.

## Stato della release

- Versione: **5.0.1**
- URL pubblico: `https://vantaggio-calcio-live.onrender.com/#dashboard`
- Runtime: Node.js
- Hosting: Render Free
- Costo operativo previsto: zero, entro i limiti dei servizi gratuiti
- Ultimo problema chiuso: contaminazione post-partita (`R-001`)
- Prossimo problema prioritario: suite di test non autosufficiente (`R-002`)

## Come leggere questa documentazione

- [`01-STACK.md`](./01-STACK.md): tecnologie, build e deploy.
- [`02-STRUCTURE.md`](./02-STRUCTURE.md): cartelle e file.
- [`03-PAGES-ROUTES.md`](./03-PAGES-ROUTES.md): pagine, dialoghi e API.
- [`04-DATA.md`](./04-DATA.md): fonti, endpoint e limiti dei dati.
- [`05-FEATURES.md`](./05-FEATURES.md): elenco delle funzioni esistenti.
- [`06-KNOWN_ISSUES.md`](./06-KNOWN_ISSUES.md): problemi reali e parti incomplete.
- [`07-TODO.md`](./07-TODO.md): ordine consigliato degli interventi.
