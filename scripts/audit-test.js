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
  check(home.body.includes('V4.5') && home.body.includes('app.js?v=4.5.0'), 'Homepage V4.5.0 e cache key corrette');
  check(home.response.headers.get('x-content-type-options') === 'nosniff', 'Header nosniff presente');
  check(home.response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer policy sicura presente');

  const [manifest, favicon, app, css, status] = await Promise.all([
    request('/manifest.webmanifest'), request('/favicon.svg', 'text'), request('/app.js?v=4.5.0', 'text'),
    request('/styles.css?v=4.5.0', 'text'), request('/api/status')
  ]);
  check(manifest.response.status === 200 && manifest.body?.start_url === '/#dashboard' && manifest.body?.display === 'standalone', 'Manifest PWA valido');
  check(favicon.response.status === 200 && favicon.body.includes('<svg'), 'Favicon SVG valida');
  check(app.response.status === 200 && app.body.includes('renderFallbackDeepAnalysis'), 'Bundle frontend completo');
  check(app.body.includes('MATCH CONTROL ROOM') && app.body.includes('MATCH READINESS GATE') && app.body.includes('EVIDENCE MAP'), 'Control Room, Readiness Gate ed Evidence Map presenti');
  check(['summary', 'teams', 'numbers', 'verify'].every(tab => app.body.includes(`id: '${tab}'`)), 'Quattro aree del dossier presenti');
  check(app.body.includes('role="tablist"') && app.body.includes('aria-selected=') && app.body.includes("['ArrowRight', 'ArrowLeft', 'Home', 'End']"), 'Tab Control Room accessibili da tastiera');
  check(!app.body.includes('class="model-drawer"') && app.body.includes('id="roomPowerMount"'), 'Power Model raggruppato nell’area Numeri');
  check(css.response.status === 200 && css.body.includes('@media (max-width: 720px)'), 'CSS responsive servito');
  check(css.body.includes('.match-room-tabs') && css.body.includes('.readiness-gate') && css.body.includes('.evidence-map'), 'Design system Control Room servito');
  check(app.response.headers.get('cache-control')?.includes('immutable') && css.response.headers.get('cache-control')?.includes('immutable'), 'Asset versionati serviti con cache immutabile');
  check(status.response.status === 200 && status.body?.ok && status.body.timezone === 'Europe/Rome', 'Status API e timezone validi');
  check(Array.isArray(status.body?.standingsLeagues) && status.body.standingsLeagues.length >= 12, 'Catalogo classifiche estese valido');

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

  const byLeague = [...new Map(matches.map(match => [match.league.id, match])).values()];
  const upcoming = byLeague.filter(match => match.state !== 'post').slice(0, 5);
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
    check(intel.response.status === 200 && intel.body?.ok && i?.engine?.version === '1.2', `Match Intelligence valida: ${match.league.id}`);
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
