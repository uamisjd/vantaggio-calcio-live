# Pubblicazione permanente su Render

Configurazione consigliata per ottenere un URL stabile, accessibile da Chrome su Android.

## 1. Caricamento su GitHub

Crea un nuovo repository GitHub, ad esempio `vantaggio-calcio`, e carica **il contenuto** della cartella del progetto mantenendo `package.json` e `render.yaml` nella radice.

Il repository può essere pubblico oppure privato. Render chiederà il permesso di leggerlo.

## 2. Collegamento a Render

1. Apri https://dashboard.render.com/ e accedi con GitHub.
2. Seleziona **New +** → **Blueprint**.
3. Collega il repository `vantaggio-calcio`.
4. Render leggerà automaticamente `render.yaml`.
5. Conferma con **Apply** o **Deploy Blueprint**.
6. Attendi che lo stato diventi **Live**.

Il link sarà simile a:

`https://vantaggio-calcio-live.onrender.com`

Se quel nome è già occupato, Render aggiungerà o richiederà un suffisso. Una volta creato il servizio, il suo URL non cambia durante i successivi aggiornamenti.

## 3. Aggiornamenti futuri

Ogni modifica inviata al ramo principale del repository attiverà automaticamente una nuova pubblicazione. L’URL pubblico rimarrà identico.

## 4. Accesso da Android

Apri il link in Chrome. Dal menu `⋮` puoi scegliere **Aggiungi a schermata Home** o **Installa app**; il manifest PWA è già presente.

## Nota sul piano gratuito

Il servizio gratuito di Render può sospendersi dopo un periodo senza visite. Il primo accesso successivo può quindi richiedere alcuni secondi, ma l’URL resta invariato. La permanenza dipende dal mantenimento dell’account e del servizio Render.
