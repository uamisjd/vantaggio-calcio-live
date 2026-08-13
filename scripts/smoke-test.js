'use strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function get(path, type = 'json') {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return type === 'json' ? response.json() : response.text();
}

(async () => {
  const html = await get('/', 'text');
  if (!html.includes('VANTAGGIO') || !html.includes('/app.js')) throw new Error('Homepage non valida');

  const status = await get('/api/status');
  if (!status.ok || status.timezone !== 'Europe/Rome' || status.leagues.length < 5) throw new Error('Status API non valido');

  const matches = await get(`/api/matches?league=all&from=${status.today}&to=${new Date(new Date(status.today + 'T12:00:00Z').getTime() + 13 * 86400000).toISOString().slice(0, 10)}`);
  if (!matches.ok || !Array.isArray(matches.data.matches) || !Array.isArray(matches.data.sources)) throw new Error('Matches API non valida');

  const news = await get('/api/news');
  if (!news.ok || !Array.isArray(news.data.articles) || !news.data.articles.length) throw new Error('News API non valida');

  const standings = await get('/api/standings?league=ita.1');
  if (!standings.ok || !Array.isArray(standings.data.table)) throw new Error('Standings API non valida');

  const analyzable = matches.data.matches.find(item => item.state !== 'post');
  if (!analyzable) throw new Error('Nessuna partita analizzabile');
  const analysis = await get(`/api/analysis?event=${encodeURIComponent(analyzable.id)}&league=${encodeURIComponent(analyzable.league.id)}`);
  if (!analysis.ok || !analysis.data.probabilities || !Array.isArray(analysis.data.signals)) throw new Error('Power Analysis API non valida');

  console.log(`✓ Homepage servita`);
  console.log(`✓ ${matches.data.matches.length} partite in ${matches.data.coverage?.competitions || 0} competizioni`);
  console.log(`✓ Power Model operativo su ${analyzable.home.name}–${analyzable.away.name}`);
  console.log(`✓ ${news.data.articles.length} notizie da ${news.data.sources.filter(item => item.ok).length} fonti`);
  console.log(`✓ ${standings.data.table.length} righe classifica Serie A`);
  console.log('Smoke test completato senza errori.');
})().catch(error => {
  console.error('Smoke test fallito:', error.message);
  process.exit(1);
});
