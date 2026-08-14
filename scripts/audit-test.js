'use strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const failures = [];
const checks = [];

function check(condition, message) {
  checks.push(message);
  if (!condition) failures.push(message);
}

async function request(path, type = 'json') {
  const started = Date.now();
  const response = await fetch(`${base}${path}`, { headers: { accept: type === 'json' ? 'application/json' : '*/*' } });
  const body = type === 'json' ? await response.json().catch(() => null) : await response.text();
  return { response, body, ms: Date.now() - started };
}

function noInvalidNumbers(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(noInvalidNumbers);
  if (value && typeof value === 'object') return Object.values(value).every(noInvalidNumbers);
  return true;
}

(async () => {
  const home = await request('/', 'text');
  check(home.response.status === 200, 'Homepage HTTP 200');
  check(home.body.includes('V4.8') && home.body.includes('app.js?v=4.8.1'), 'Homepage V4.8.1 e cache key corrette');
  check(home.response.headers.get('x-content-type-options') === 'nosniff', 'Header nosniff presente');
  check(home.response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer policy sicura presente');

  const [manifest, favicon, app, css, status] = await Promise.all([
    request('/manifest.webmanifest'), request('/favicon.svg', 'text'), request('/app.js?v=4.8.1', 'text'),
    request('/styles.css?v=4.8.1', 'text'), request('/api/status')
  ]);
  check(manifest.response.status === 200 && manifest.body?.start_url === '/#dashboard' && manifest.body?.display === 'standalone', 'Manifest PWA valido');
  check(favicon.response.status === 200 && favicon.body.includes('<svg'), 'Favicon SVG valida');
  check(app.response.status === 200 && app.body.includes('renderFallbackDeepAnalysis'), 'Bundle frontend completo');
  check(app.body.includes('MATCH CONTROL ROOM') && app.body.includes('MATCH READINESS GATE') && app.body.includes('EVIDENCE MAP'), 'Control Room, Readiness Gate ed Evidence Map presenti');
  check(app.body.includes('PRE-MATCH TOTAL INTELLIGENCE') && app.body.includes('prematchTotalIntelligence') && app.body.includes('data-prematch-jump'), 'Manifesto Pre-Match Total Intelligence presente');
  check(app.body.includes('contextDateConflict') && app.body.includes('Metadato contraddittorio'), 'Contraddizioni fra fase e data dichiarate');
  check(app.body.includes('PRE-MATCH WINDOW') && app.body.includes('PROGRAMMA DI OGGI') && app.body.includes('scegli “Oggi”') && !app.body.includes('LIVE PULSE') && !app.body.includes('LIVE CONTROL'), 'Dashboard prematch e calendario giornaliero trasparente');
  check(!app.body.includes('function notifyLive') && !app.body.includes("addChange('live'") && app.body.includes('Analisi live disattivata'), 'Nessun segnale, notifica o analisi ricalcolata durante il live');
  check(app.body.includes('PRE-MATCH VAULT') && app.body.includes('vantaggio:prematchVault:v1') && app.body.includes('archivedPrematchData(match)'), 'Pre-Match Vault locale e dossier congelato presenti');
  check(app.body.includes('Fotografia al salvataggio prematch') && app.body.includes('non descrive la situazione live') && app.body.includes('Timeline non osservata prima del kickoff'), 'Timestamp ed evidenze archiviate non presentate come ricerca corrente');
  check(app.body.includes("match.state !== 'pre'") && app.body.includes('Date.now() >= kickoffMs') && app.body.includes("archiveMode: 'prematch-live'"), 'Vault protetto dal backfill post-kickoff');
  check(app.body.includes('XI INTELLIGENCE') && app.body.includes('lineupIntel(data.lineups'), 'XI Intelligence visibile nel Control Room');
  check(app.body.includes('minutes > 0 && minutes <= 65') && app.body.includes('Finestra pre-match chiusa'), 'Nessun ricontrollo dossier dopo il kickoff programmato');
  check(app.body.includes('SIGNAL LIFECYCLE') && app.body.includes('captureSignalLifecycle') && app.body.includes("'T-60', 'T-30', 'T-10'"), 'Signal Lifecycle e checkpoint pre-kickoff presenti');
  check(app.body.includes('vantaggio:signalLifecycle:v1') && app.body.includes("match.state !== 'pre'") && app.body.includes('now.getTime() >= kickoffMs'), 'Signal Lifecycle locale e protezione post-hoc presenti');
  check(['summary', 'teams', 'numbers', 'verify'].every(tab => app.body.includes(`id: '${tab}'`)), 'Quattro aree del dossier presenti');
  check(app.body.includes('role="tablist"') && app.body.includes('aria-selected=') && app.body.includes("['ArrowRight', 'ArrowLeft', 'Home', 'End']"), 'Tab Control Room accessibili da tastiera');
  check(!app.body.includes('class="model-drawer"') && app.body.includes('id="roomPowerMount"'), 'Power Model raggruppato nell’area Numeri');
  check(css.response.status === 200 && css.body.includes('@media (max-width: 720px)'), 'CSS responsive servito');
  check(css.body.includes('.match-room-tabs') && css.body.includes('.readiness-gate') && css.body.includes('.evidence-map'), 'Design system Control Room servito');
  check(css.body.includes('.signal-lifecycle') && css.body.includes('.lifecycle-card'), 'Timeline Signal Lifecycle responsive servita');
  check(app.body.includes('matchingMatches.slice(0, 100)') && app.body.includes('calendar-limit-note'), 'Regia globale limitata per prestazioni con giornate complete accessibili');
  check(css.body.includes('.prematch-total-intelligence') && css.body.includes('.prematch-manifest') && css.body.includes('.score-only-live'), 'Design system Pre-Match Total Intelligence servito');
  check(css.body.includes('.xi-intelligence') && css.body.includes('.xi-team-grid') && css.body.includes('.prematch-vault-banner'), 'Design responsive XI Intelligence e Pre-Match Vault servito');
  check(app.response.headers.get('cache-control')?.includes('immutable') && css.response.headers.get('cache-control')?.includes('immutable'), 'Asset versionati serviti con cache immutabile');
  check(status.response.status === 200 && status.body?.ok && status.body.timezone === 'Europe/Rome', 'Status API e timezone validi');
  check(Array.isArray(status.body?.standingsLeagues) && status.body.standingsLeagues.length >= 12, 'Catalogo classifiche estese valido');
  check(Array.isArray(status.body?.globalCompetitions) && status.body.globalCompetitions.length >= 40 && status.body.globalPolicy?.includes('competitivo globale'), 'Catalogo competitivo globale esteso e policy dichiarata');

  const today = status.body.today;
  const day = new Date(`${today}T12:00:00Z`);
  const iso = offset => new Date(day.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const matchesResult = await request(`/api/matches?league=all&from=${iso(-1)}&to=${iso(13)}`);
  const payload = matchesResult.body?.data;
  const matches = payload?.matches || [];
  check(matchesResult.response.status === 200 && matchesResult.body?.ok, 'Matches API HTTP 200');
  check(matches.length > 0, 'Calendario globale non vuoto');
  check((payload?.coverage?.competitions || 0) >= 8, 'Copertura globale multi-competizione');
  check(new Set(matches.map(match => match.id)).size === matches.length, 'Nessun ID partita duplicato');
  check(matches.every(match => match.id && !Number.isNaN(new Date(match.date).getTime()) && ['pre', 'in', 'post'].includes(match.state)), 'ID, date e stati partita validi');
  check(matches.every(match => match.home?.name && match.away?.name && match.league?.id && Number.isFinite(match.opportunity) && match.opportunity >= 0 && match.opportunity <= 100), 'Squadre, competizioni e indici validi');
  check(noInvalidNumbers(matchesResult.body), 'Nessun numero JSON non finito nelle partite');

  const byLeague = [...new Map(matches.filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now()).map(match => [match.league.id, match])).values()];
  const upcoming = byLeague.slice(0, 5);
  check(upcoming.length >= 3, 'Campione multi-competizione analizzabile');
  const dossiers = await Promise.all(upcoming.map(async match => {
    const [power, intel] = await Promise.all([
      request(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}`),
      request(`/api/intelligence?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}`)
    ]);
    return { match, power, intel };
  }));
  dossiers.forEach(({ match, power, intel }) => {
    const p = power.body?.data;
    const i = intel.body?.data;
    check(power.response.status === 200 && power.body?.ok && p?.engine?.version === '2.1', `Power Model valido: ${match.league.id}`);
    const probabilitySum = p?.probabilities ? p.probabilities.home + p.probabilities.draw + p.probabilities.away : 0;
    check(Math.abs(probabilitySum - 100) <= 1, `Probabilità 1-X-2 coerenti: ${match.league.id}`);
    check(noInvalidNumbers(power.body), `Power Model senza numeri invalidi: ${match.league.id}`);
    check(intel.response.status === 200 && intel.body?.ok && i?.engine?.version === '1.3', `Match Intelligence valida: ${match.league.id}`);
    const xi = i?.lineupIntelligence;
    check(Array.isArray(xi?.teams) && xi.teams.length === 2 && ['ufficiale', 'probabili_parziali', 'non_disponibile'].includes(xi.status), `XI Intelligence presente: ${match.league.id}`);
    check(xi?.teams?.every(team => ['ufficiale', 'probabile', 'non_disponibile'].includes(team.mode) && Number.isFinite(team.confidence) && Number.isFinite(team.strength) && Number.isFinite(team.continuity)), `Punteggi XI distinti e validi: ${match.league.id}`);
    check(xi?.teams?.every(team => team.mode === 'non_disponibile' || team.selected?.length === 11), `Probabile/ufficiale completa o non pubblicata: ${match.league.id}`);
    check(xi?.teams?.every(team => team.importantMissing?.every(player => player.category && player.evidence?.length && Number.isFinite(player.importance))), `Assenze importanti documentate: ${match.league.id}`);
    check(Array.isArray(i?.availability?.teams) && i.availability.teams.length === 2 && Array.isArray(i.availability.sources) && Number.isFinite(i.availability.score), `Availability Intelligence valida: ${match.league.id}`);
    check(['pre', 'post'].includes(i?.deepDive?.mode) && Array.isArray(i?.deepDive?.paragraphs) && i.deepDive.paragraphs.length > 0, `Deep Analysis presente: ${match.league.id}`);
    check(Number.isFinite(i?.reliability?.overall) && Array.isArray(i?.reliability?.items) && i.reliability.items.length >= 5, `Reliability Ledger valido: ${match.league.id}`);
    check(Array.isArray(i?.critical) && i.critical.every(item => ['Fatto', 'Lettura', 'Verifica'].includes(item.type)), `Fatti/letture/verifiche separati: ${match.league.id}`);
    check(noInvalidNumbers(intel.body), `Intelligence senza numeri invalidi: ${match.league.id}`);
  });

  const review = await request('/api/intelligence?event=401873624&league=uefa.super_cup');
  check(review.response.status === 200 && review.body?.data?.deepDive?.mode === 'post', 'Deep Match Review post-partita valida');
  check(review.body?.data?.event?.home?.score === 2 && review.body?.data?.event?.away?.score === 1, 'Risultato storico non alterato');
  check(!JSON.stringify(review.body).includes('statisticalProbabilities'), 'Nessuna probabilità live riciclata nella review');
  const officialXi = review.body?.data?.lineupIntelligence;
  check(officialXi?.status === 'ufficiale' && officialXi.teams?.every(team => team.mode === 'ufficiale' && team.confidence === 100 && team.selected?.length === 11), 'XI ufficiali distinti e completi');
  check(officialXi?.teams?.flatMap(team => team.omissions || []).every(item => ['in panchina', 'non a referto', 'infortunio', 'indisponibile', 'squalifica', 'dubbio'].includes(item.status)), 'Panchina e non a referto distinti nelle omissioni');

  const dnaMatch = upcoming[0];
  const dna = await request(`/api/team-dna?team=${encodeURIComponent(dnaMatch.home.id)}&league=${encodeURIComponent(dnaMatch.league.id)}&name=${encodeURIComponent(dnaMatch.home.name)}`);
  check(dna.response.status === 200 && dna.body?.data?.engine?.name === 'VANTAGGIO Team DNA', 'Team DNA valida');
  check(Number.isFinite(dna.body?.data?.reliability?.overall), 'Affidabilità Team DNA valida');

  const standingsLeagues = ['ita.1', 'eng.1', 'esp.1', 'ger.1', 'fra.1', 'ita.2', 'por.1', 'ned.1'];
  const tables = await Promise.all(standingsLeagues.map(league => request(`/api/standings?league=${league}`)));
  tables.forEach((table, index) => {
    const rows = table.body?.data?.table || [];
    check(table.response.status === 200 && table.body?.ok && rows.length >= 18, `Classifica valida: ${standingsLeagues[index]}`);
    check(new Set(rows.map(row => row.rank)).size === rows.length && rows.every(row => Number.isInteger(row.rank)), `Posizioni uniche: ${standingsLeagues[index]}`);
    check(rows.every(row => row.team?.name && Number.isFinite(row.points)), `Squadre e punti validi: ${standingsLeagues[index]}`);
  });

  const news = await request('/api/news');
  const articles = news.body?.data?.articles || [];
  check(news.response.status === 200 && news.body?.ok && articles.length >= 10, 'News API valida e non vuota');
  check(new Set(articles.map(article => article.link)).size === articles.length, 'Nessun link news duplicato');
  check(articles.every(article => article.title && article.source && /^https?:\/\//.test(article.link)), 'Titoli, fonti e URL news validi');

  const health = await request('/api/health');
  check(health.response.status === 200 && Array.isArray(health.body?.sources) && health.body.sources.some(source => source.calls > 0), 'Source Health Center operativo');
  check(health.body.sources.filter(source => source.calls).every(source => Number.isFinite(source.averageLatencyMs) && source.averageLatencyMs >= 0), 'Latenza e contatori fonti validi');
  check(typeof health.body?.rule === 'string' && health.body.rule.includes('completezza'), 'Health Center distingue salute e completezza');

  const missingApi = await request('/api/not-existent');
  check(missingApi.response.status === 404 && missingApi.body?.ok === false, 'Endpoint API inesistente gestito con 404');
  const missingEvent = await request('/api/analysis?event=evento-inesistente&league=ita.1');
  check(missingEvent.response.status >= 400 && missingEvent.body?.ok === false, 'Evento inesistente gestito senza falso dossier');
  const [badDate, reversedDates, badMatchesLeague, badTableLeague] = await Promise.all([
    request('/api/matches?from=2026-99-99&to=2026-99-99'),
    request('/api/matches?from=2026-08-20&to=2026-08-10'),
    request('/api/matches?league=competizione-inesistente'),
    request('/api/standings?league=competizione-inesistente')
  ]);
  check(badDate.response.status === 400 && badDate.body?.ok === false, 'Data impossibile rifiutata con 400');
  check(reversedDates.response.status === 400 && reversedDates.body?.ok === false, 'Intervallo date invertito rifiutato con 400');
  check(badMatchesLeague.response.status === 400 && badMatchesLeague.body?.ok === false, 'Competizione partite inesistente rifiutata');
  check(badTableLeague.response.status === 400 && badTableLeague.body?.ok === false, 'Competizione classifica inesistente rifiutata');
  const malformedPath = await request('/%E0%A4%A');
  check(malformedPath.response.status >= 400, 'Percorso malformato rifiutato dall’edge o dal server');
  const healthAfterErrors = await request('/api/status');
  check(healthAfterErrors.response.status === 200 && healthAfterErrors.body?.ok, 'Server operativo dopo le richieste malformate');

  console.log(`Audit ${base}: ${checks.length - failures.length}/${checks.length} controlli superati.`);
  if (failures.length) {
    console.error('\nControlli falliti:');
    failures.forEach(item => console.error(`- ${item}`));
    process.exit(1);
  }
})().catch(error => {
  console.error('Audit interrotto:', error.stack || error.message);
  process.exit(1);
});
