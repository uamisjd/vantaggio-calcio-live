'use strict';

const fs = require('fs');
const vm = require('vm');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function get(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function createNode() {
  return {
    hidden: true, innerHTML: '', textContent: '', dataset: {}, title: '', value: '',
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, addEventListener() {}, append() {}, remove() {}, focus() {}, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, matches() { return false; }
  };
}

(async () => {
  const status = await get('/api/status');
  const day = new Date(`${status.today}T12:00:00Z`);
  const iso = offset => new Date(day.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const [matchesPayload, newsPayload, tablePayload] = await Promise.all([
    get(`/api/matches?league=all&from=${iso(-1)}&to=${iso(13)}`),
    get('/api/news'),
    get('/api/standings?league=ita.1')
  ]);
  const pre = matchesPayload.data.matches.find(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now());
  if (!pre) throw new Error('Nessuna partita pre-match disponibile per il test frontend');
  const [analysisPayload, intelligencePayload, reviewPayload] = await Promise.all([
    get(`/api/analysis?event=${encodeURIComponent(pre.id)}&league=${encodeURIComponent(pre.league.id)}`),
    get(`/api/intelligence?event=${encodeURIComponent(pre.id)}&league=${encodeURIComponent(pre.league.id)}`),
    get('/api/intelligence?event=401873624&league=uefa.super_cup')
  ]);

  const storage = new Map();
  const document = {
    querySelector() { return createNode(); }, querySelectorAll() { return []; }, createElement: createNode,
    documentElement: { dataset: {} }, body: { style: {} }, activeElement: null, addEventListener() {}
  };
  const context = {
    console, URL, Intl, Date, Math, JSON, Number, String, Array, Object, Promise, Set, Map,
    document, location: { hash: '#dashboard', origin: base }, history: { pushState() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    window: { addEventListener() {}, open() {}, scrollTo() {} }, matchMedia: () => ({ matches: false }),
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {}, fetch,
    Notification: function Notification() {}, globalThis: null
  };
  context.Notification.permission = 'denied';
  context.window.Notification = context.Notification;
  context.globalThis = context;

  let source = fs.readFileSync('public/app.js', 'utf8').replace(/\ninit\(\);\s*$/, '\n');
  source += '\nglobalThis.__test={state,localDateKey,safeUrl,teamLogo,newsCard,matchRow,renderDashboard,renderMatchesView,renderRadarView,renderNewsView,renderStandingsView,renderFavoritesView,renderIntelligence,renderFallbackDeepAnalysis,renderPowerAnalysis,lineupIntel,archivePreKickoffModel,reconcileModelSnapshots,modelTrackStats,preserveMonotonicMatchState,readinessAssessment,contextDateConflict,captureSignalLifecycle,reconcileSignalLifecycles,capturePrematchVault,archivedPrematchData,renderPrematchVault};';
  vm.runInNewContext(source, context, { filename: 'public/app.js' });
  const test = context.__test;
  test.state.today = status.today;
  test.state.leagues = status.leagues;
  test.state.standingsLeagues = status.standingsLeagues;
  test.state.matches = matchesPayload.data.matches;
  test.state.news = newsPayload.data.articles;
  test.state.coverage = matchesPayload.data.coverage || {};
  test.state.tables['ita.1'] = tablePayload.data;
  test.state.analyses[`${pre.league.id}:${pre.id}`] = analysisPayload.data;
  test.state.intelligence[`${pre.league.id}:${pre.id}`] = intelligencePayload.data;
  test.state.powerPicks = [{ match: pre, analysis: analysisPayload.data }];
  test.state.favorites.add(pre.id);
  test.state.favoriteSnapshots[pre.id] = pre;

  test.state.matchRoomTabs[pre.id] = 'summary';
  const roomSummary = test.renderIntelligence(intelligencePayload.data);
  test.state.matchRoomTabs[pre.id] = 'teams';
  const roomTeams = test.renderIntelligence(intelligencePayload.data);
  test.state.matchRoomTabs[pre.id] = 'numbers';
  const roomNumbers = test.renderIntelligence(intelligencePayload.data);
  test.state.matchRoomTabs[pre.id] = 'verify';
  const roomVerify = test.renderIntelligence(intelligencePayload.data);
  test.state.matchRoomTabs[String(reviewPayload.data.event.id)] = 'teams';
  const officialLineups = test.renderIntelligence(reviewPayload.data);
  delete test.state.matchRoomTabs[String(reviewPayload.data.event.id)];
  const renders = {
    dashboard: test.renderDashboard(), matches: test.renderMatchesView(), radar: test.renderRadarView(),
    news: test.renderNewsView(), standings: test.renderStandingsView(), favorites: test.renderFavoritesView(),
    roomSummary, roomTeams, roomNumbers, roomVerify, officialLineups, postDossier: test.renderIntelligence(reviewPayload.data),
    fallback: test.renderFallbackDeepAnalysis(pre, analysisPayload.data, 'Errore simulato'),
    power: test.renderPowerAnalysis(analysisPayload.data)
  };
  for (const [name, html] of Object.entries(renders)) {
    if (typeof html !== 'string' || html.length < 300) throw new Error(`${name}: rendering troppo corto`);
    if (/\b(?:NaN|undefined)\b/.test(html)) throw new Error(`${name}: token non valido nell’HTML`);
    let buttonDepth = 0;
    for (const token of html.match(/<\/?button\b[^>]*>/gi) || []) {
      if (token.startsWith('</')) buttonDepth -= 1;
      else {
        if (buttonDepth > 0) throw new Error(`${name}: pulsante interattivo annidato in un altro pulsante`);
        buttonDepth += 1;
      }
      if (buttonDepth < 0) throw new Error(`${name}: chiusura button non valida`);
    }
    if (buttonDepth !== 0) throw new Error(`${name}: markup button sbilanciato`);
    console.log(`✓ ${name.padEnd(12)} ${String(html.length).padStart(6)} caratteri`);
  }

  if (!renders.roomSummary.includes('MATCH CONTROL ROOM') || !renders.roomSummary.includes('DECISION PASSPORT') || !renders.roomSummary.includes('MATCH READINESS GATE') || !renders.roomSummary.includes('PRE-MATCH TOTAL INTELLIGENCE') || !renders.roomSummary.includes('SIGNAL LIFECYCLE')) throw new Error('Sintesi Decision Passport o Pre-Match Total Intelligence non valida');
  if ((renders.roomSummary.match(/data-prematch-jump=/g) || []).length < 7 || !renders.roomSummary.includes('non documentate')) throw new Error('Manifesto di copertura prematch incompleto');
  const conflict = test.contextDateConflict({ event: { date: '2026-08-13T18:00:00Z' }, context: { phase: '2021-22 Qualifying' } });
  if (!conflict.includes('Metadato contraddittorio') || test.contextDateConflict({ event: { date: '2026-08-13T18:00:00Z' }, context: { phase: '2025-26 Qualifying' } })) throw new Error('Contraddizioni temporali del contesto non rilevate correttamente');
  if (!renders.roomTeams.includes('TACTICAL MATCHUP') || !renders.roomTeams.includes('AVAILABILITY INTELLIGENCE') || !renders.roomTeams.includes('XI INTELLIGENCE') || !renders.roomTeams.includes('Affidabilità XI') || !renders.roomTeams.includes('Forza disponibile')) throw new Error('Area Squadre o XI Intelligence non raggruppata correttamente');
  if ((renders.officialLineups.match(/XI UFFICIALE/g) || []).length !== 2 || (renders.officialLineups.match(/>100</g) || []).length < 2 || !renders.officialLineups.includes('in panchina') || !renders.officialLineups.includes('non a referto')) throw new Error('XI ufficiali, punteggio certo o classificazione omissioni non renderizzati');
  if (!renders.roomNumbers.includes('POWER MODEL 3.0') || !renders.roomNumbers.includes('roomPowerMount')) throw new Error('Area Numeri non valida');
  if (!renders.roomVerify.includes('EVIDENCE MAP') || !renders.roomVerify.includes('What Changed · storia della partita') || !renders.roomVerify.includes('Data Reliability Ledger') || !renders.roomVerify.includes('Fonti e news collegate')) throw new Error('Area Verifiche non valida');
  if (!renders.dashboard.includes('MODEL TRACK RECORD') || !renders.dashboard.includes('SOURCE HEALTH CENTER')) throw new Error('Track Record o Source Health Center non renderizzati');
  if (!renders.dashboard.includes('PRE-MATCH WINDOW') || renders.dashboard.includes('LIVE PULSE')) throw new Error('Dashboard non centrata sul prematch');
  if (!renders.matches.includes('PROGRAMMA DI OGGI') || !renders.matches.includes('da giocare') || !renders.matches.includes('concluse') || !renders.matches.includes('Prossime') || renders.matches.includes('LIVE CONTROL')) throw new Error('Calendario giornaliero non trasparente o ancora orientato al live');
  const futureCount = test.state.matches.filter(match => match.state === 'in' || (match.state === 'pre' && new Date(match.date).getTime() > Date.now() - 3 * 3600000)).length;
  if (futureCount > 100 && !renders.matches.includes('calendar-limit-note')) throw new Error('La Regia globale non dichiara il limite prestazionale');
  test.state.selectedDate = status.today;
  const completeToday = test.renderMatchesView();
  const expectedToday = test.state.matches.filter(match => test.localDateKey(match.date) === status.today).length;
  if ((completeToday.match(/class="match-row/g) || []).length !== expectedToday || completeToday.includes('calendar-limit-note')) throw new Error('Il filtro Oggi non mostra il programma giornaliero completo');
  test.state.selectedDate = 'all';
  if (!renders.postDossier.includes('REVIEW') || !renders.postDossier.includes('Decisione chiusa') || !renders.fallback.includes('COPERTURA RIDOTTA')) throw new Error('Review adattiva o fallback trasparente non renderizzato');
  const inProgressIntel = { ...intelligencePayload.data, event: { ...intelligencePayload.data.event, state: 'in', home: { ...intelligencePayload.data.event.home, score: 1 }, away: { ...intelligencePayload.data.event.away, score: 0 } } };
  const scoreOnly = test.renderIntelligence(inProgressIntel);
  const pausedModel = test.renderPowerAnalysis({ ...analysisPayload.data, event: inProgressIntel.event });
  if (!scoreOnly.includes('SCORE ESSENZIALE') || !scoreOnly.includes('Analisi live disattivata') || scoreOnly.includes('MATCH CONTROL ROOM') || scoreOnly.includes('Probabilità 1-X-2')) throw new Error('Un incontro in corso espone ancora il dossier live');
  if (!pausedModel.includes('Analisi live disattivata') || pausedModel.includes('Probabilità 1-X-2')) throw new Error('Il modello rimane impropriamente attivo durante la gara');
  const scoreRow = test.matchRow({ ...pre, state: 'in', home: { ...pre.home, score: 1, form: 'VVVVV' }, away: { ...pre.away, score: 0, form: 'SSSSS' } });
  if (!scoreRow.includes('score-only-row') || scoreRow.includes('power-mini') || scoreRow.includes('form-dot') || scoreRow.includes('/100') || scoreRow.includes('Analisi profonda')) throw new Error('La riga calendario live espone informazioni oltre allo score essenziale');
  const closedPrematchRow = test.matchRow({ ...pre, state: 'pre', date: new Date(Date.now() - 60000).toISOString() });
  if (!closedPrematchRow.includes('score-only-row') || closedPrematchRow.includes('/100') || closedPrematchRow.includes('form-dot')) throw new Error('Una finestra pre-match scaduta espone ancora analisi');
  const reviewRow = test.matchRow({ ...pre, state: 'post', home: { ...pre.home, score: 2 }, away: { ...pre.away, score: 1 } });
  if (!reviewRow.includes('REVIEW') || !reviewRow.includes('Archivio partita') || reviewRow.includes('/100')) throw new Error('La riga post-partita espone ancora un indice post-hoc');
  if (!renders.matches.includes('Analisi profonda') && !renders.matches.includes('Analisi pronta') && !renders.matches.includes('Review pronta')) throw new Error('Indicatore Deep Analysis assente dalle partite');

  if (test.safeUrl('') !== '' || test.safeUrl('   ') !== '' || test.safeUrl('javascript:alert(1)') !== '') throw new Error('safeUrl accetta URL vuoti o pericolosi');
  const queryUrl = test.safeUrl('https://example.com/news?a=1&b=2');
  if (!queryUrl.includes('?a=1&b=2') || queryUrl.includes('&amp;')) throw new Error('safeUrl altera i parametri degli URL esterni');
  const linkedCard = test.newsCard({ title: 'Titolo', source: 'Fonte', link: queryUrl, image: '', published: status.today });
  if (!linkedCard.includes('a=1&amp;b=2')) throw new Error('URL news non escapato correttamente nell’attributo HTML');
  const missingLogo = test.teamLogo({ name: 'Club senza logo', logo: '' });
  if (!missingLogo.includes('logo-fallback') || missingLogo.includes('<img')) throw new Error('Fallback logo non valido');
  const missingImageCard = test.newsCard({ title: 'Titolo', source: 'Fonte', link: 'https://example.com', image: '', published: status.today });
  if (missingImageCard.includes('has-image') || missingImageCard.includes('background-image')) throw new Error('Una news senza immagine viene trattata come se avesse una foto');

  const originalTable = test.state.tables['ita.1'];
  test.state.tables['ita.1'] = {
    ...originalTable,
    table: originalTable.table.map(row => ({ ...row, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, difference: 0, points: 0 }))
  };
  const preseason = test.renderStandingsView();
  if (!preseason.includes('STAGIONE NON INIZIATA') || preseason.includes('CAPOLISTA') || preseason.includes('zone-ucl')) throw new Error('La pre-season viene presentata come classifica competitiva');
  test.state.tables['ita.1'] = originalTable;

  const originalMatches = test.state.matches;
  const monotonicLive = { ...pre, id: 'monotonic-state', state: 'in', home: { ...pre.home, score: 1 }, away: { ...pre.away, score: 0 }, status: { detail: '55’' } };
  test.state.matches = [monotonicLive];
  const regressed = test.preserveMonotonicMatchState({ ...monotonicLive, state: 'pre', home: { ...monotonicLive.home, score: 0 }, status: { detail: 'Programmato' } });
  if (regressed.state !== 'in' || regressed.home.score !== 1 || !regressed.continuityGuard?.applied) throw new Error('Una regressione live→prematch non è stata bloccata');
  const advanced = test.preserveMonotonicMatchState({ ...monotonicLive, state: 'post', home: { ...monotonicLive.home, score: 2 }, away: { ...monotonicLive.away, score: 1 } });
  if (advanced.state !== 'post' || advanced.home.score !== 2) throw new Error('Una transizione monotona live→finale è stata bloccata');
  test.state.matches = originalMatches;

  const modelMatch = { ...pre, id: 'strict-model-test', state: 'pre', date: new Date(Date.now() + 86400000).toISOString(), home: { ...pre.home, score: 0 }, away: { ...pre.away, score: 0 } };
  test.archivePreKickoffModel(modelMatch, { ...analysisPayload.data, event: { ...analysisPayload.data.event, state: 'pre', date: modelMatch.date }, probabilities: { home: 55, draw: 25, away: 20 } });
  if (!test.state.modelSnapshots[modelMatch.id] || new Date(test.state.modelSnapshots[modelMatch.id].capturedAt) >= new Date(modelMatch.date)) throw new Error('Snapshot pre-kickoff non congelato correttamente');
  test.reconcileModelSnapshots([{ ...modelMatch, state: 'post', home: { ...modelMatch.home, score: 2 }, away: { ...modelMatch.away, score: 0 } }]);
  const track = test.modelTrackStats();
  if (track.settled.length !== 1 || track.accuracy !== 100 || !Number.isFinite(track.brier) || !Number.isFinite(track.logLoss) || track.calibrationReady) throw new Error('Riconciliazione Track Record, Brier, log-loss o soglia calibrazione non validi');
  test.archivePreKickoffModel({ ...modelMatch, id: 'post-hoc-block', state: 'post' }, analysisPayload.data);
  if (test.state.modelSnapshots['post-hoc-block']) throw new Error('Il Track Record accetta un output post-hoc');

  const lifecycleMatch = { ...modelMatch, id: 'lifecycle-test' };
  const lifecycleKey = `${lifecycleMatch.league.id}:${lifecycleMatch.id}`;
  test.state.analyses[lifecycleKey] = { ...analysisPayload.data, event: { ...analysisPayload.data.event, id: lifecycleMatch.id, state: 'pre', date: lifecycleMatch.date }, probabilities: { home: 51, draw: 28, away: 21 } };
  test.state.intelligence[lifecycleKey] = { ...intelligencePayload.data, event: { ...intelligencePayload.data.event, id: lifecycleMatch.id, state: 'pre', completed: false, date: lifecycleMatch.date }, generatedAt: new Date().toISOString(), lineups: { ...intelligencePayload.data.lineups, official: false }, availability: { ...intelligencePayload.data.availability, score: 48, structuredCount: 1 } };
  if (!test.captureSignalLifecycle(lifecycleMatch) || test.state.signalLifecycle[lifecycleMatch.id]?.snapshots.length !== 1) throw new Error('Prima fotografia Signal Lifecycle non registrata');
  test.state.intelligence[lifecycleKey] = { ...test.state.intelligence[lifecycleKey], lineups: { ...test.state.intelligence[lifecycleKey].lineups, official: true }, availability: { ...test.state.intelligence[lifecycleKey].availability, score: 72, structuredCount: 2 }, reliability: { ...test.state.intelligence[lifecycleKey].reliability, overall: 81 } };
  if (!test.captureSignalLifecycle(lifecycleMatch, 'T-60') || test.state.signalLifecycle[lifecycleMatch.id].snapshots.length !== 2) throw new Error('Checkpoint T-60 non registrato');
  const lifecycleHtml = test.renderIntelligence(test.state.intelligence[lifecycleKey]);
  if (!lifecycleHtml.includes('Dal primo segnale al kickoff') || !lifecycleHtml.includes('XI ufficiali pubblicati') || !lifecycleHtml.includes('2 fotografie')) throw new Error('Signal Lifecycle non rende variazioni e checkpoint');
  test.reconcileSignalLifecycles([{ ...lifecycleMatch, state: 'post', home: { ...lifecycleMatch.home, score: 1 }, away: { ...lifecycleMatch.away, score: 1 } }]);
  if (test.state.signalLifecycle[lifecycleMatch.id]?.result?.homeScore !== 1) throw new Error('Signal Lifecycle non riconciliato con il finale');
  if (test.captureSignalLifecycle({ ...lifecycleMatch, state: 'post' }, 'T-10')) throw new Error('Signal Lifecycle accetta uno snapshot post-hoc');

  if (!test.capturePrematchVault(lifecycleMatch)) throw new Error('Pre-Match Vault non salva un dossier realmente osservato prima del kickoff');
  const vaultBefore = test.state.prematchVault[lifecycleMatch.id];
  const liveMatch = { ...lifecycleMatch, state: 'in', minute: 27, home: { ...lifecycleMatch.home, score: 1 }, away: { ...lifecycleMatch.away, score: 0 } };
  const frozen = test.archivedPrematchData(liveMatch);
  if (!frozen?.intelligence?.archiveMode || frozen.intelligence.event.state !== 'pre' || frozen.intelligence.event.home.score === liveMatch.home.score) throw new Error('Il dossier nel Vault non resta congelato allo stato prematch');
  test.state.matchRoomTabs[lifecycleMatch.id] = 'summary';
  const vaultSummary = test.renderPrematchVault(frozen);
  test.state.matchRoomTabs[lifecycleMatch.id] = 'teams';
  const vaultHtml = test.renderPrematchVault(frozen);
  if (!vaultHtml.includes('PRE-MATCH VAULT') || !vaultHtml.includes('sola lettura') || !vaultHtml.includes('MATCH CONTROL ROOM') || !vaultHtml.includes('Dossier prematch congelato') || !vaultHtml.includes('XI INTELLIGENCE')) throw new Error('Il dossier congelato non è completo o chiaramente etichettato');
  if (vaultHtml.includes('SCORE ESSENZIALE') || !vaultHtml.includes('Congelata') || !vaultSummary.includes('CONGELATA') || !vaultSummary.includes('non descrive la situazione live') || vaultSummary.includes('Prima fotografia in preparazione')) throw new Error('Il Vault viene confuso con una ricalcolazione o una ricerca live');
  if (test.capturePrematchVault({ ...lifecycleMatch, state: 'in' }) || test.state.prematchVault[lifecycleMatch.id].capturedAt !== vaultBefore.capturedAt) throw new Error('Il Pre-Match Vault accetta un backfill post-kickoff');
  if (test.archivedPrematchData({ ...liveMatch, id: 'vault-inesistente' })) throw new Error('Il Vault inventa un dossier mai osservato');
  for (let index = 0; index < 27; index += 1) {
    const boundedMatch = { ...lifecycleMatch, id: `vault-bounded-${index}` };
    const boundedKey = `${boundedMatch.league.id}:${boundedMatch.id}`;
    test.state.intelligence[boundedKey] = { ...test.state.intelligence[lifecycleKey], event: { ...test.state.intelligence[lifecycleKey].event, id: boundedMatch.id } };
    test.capturePrematchVault(boundedMatch);
  }
  if (Object.keys(test.state.prematchVault).length !== 24) throw new Error('Il Pre-Match Vault non rispetta il limite di 24 partite');
  const normalSetItem = context.localStorage.setItem;
  context.localStorage.setItem = (key, value) => {
    if (key === 'vantaggio:prematchVault:v1' && Object.keys(JSON.parse(value)).length > 10) throw new Error('QuotaExceededError simulato');
    storage.set(key, String(value));
  };
  const quotaMatch = { ...lifecycleMatch, id: 'vault-quota-fallback' };
  test.state.intelligence[`${quotaMatch.league.id}:${quotaMatch.id}`] = test.state.intelligence[lifecycleKey];
  test.capturePrematchVault(quotaMatch);
  context.localStorage.setItem = normalSetItem;
  if (Object.keys(test.state.prematchVault).length !== 10) throw new Error('Fallback quota del Vault non riduce la conservazione a 10 partite');

  const css = fs.readFileSync('public/styles.css', 'utf8');
  for (const marker of ['@media (max-width: 720px)', '@media (max-width: 420px)', '@media (pointer: coarse)', 'prefers-reduced-motion', 'content-visibility: auto', 'width: min(1180px', '.deep-dive.fallback', '.preseason-reading', '.operations-deck', '.availability-desk', '.match-history', '.match-control-room', '.match-room-tabs', '.readiness-gate', '.evidence-map', '.signal-lifecycle', '.lifecycle-card', '.prematch-total-intelligence', '.prematch-manifest', '.score-only-live', '.xi-intelligence', '.xi-team-grid', '.prematch-vault-banner', '.calendar-limit-note', '.summary-decision-passport', '.model-passport', '.deep-story p { margin: 0; color: var(--muted); font-size: 11px;']) {
    if (!css.includes(marker)) throw new Error(`Regola CSS mancante: ${marker}`);
  }
  const fontSizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map(match => Number(match[1]));
  if (!fontSizes.length || fontSizes.some(value => value < 11)) throw new Error('Microtesto CSS sotto 11px rilevato');
  console.log('Frontend test completato: viste, dossier, responsive duale, metriche e fallback validi.');
})().catch(error => {
  console.error('Frontend test fallito:', error.stack || error.message);
  process.exit(1);
});
