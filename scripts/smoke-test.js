'use strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function get(path, type = 'json') {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return type === 'json' ? response.json() : response.text();
}

(async () => {
  const html = await get('/', 'text');
  if (!html.includes('VANTAGGIO') || !html.includes('/app.js?v=4.2.0') || !html.includes('/styles.css?v=4.2.0')) throw new Error('Homepage o asset V4 non validi');
  const [appJs, styles] = await Promise.all([get('/app.js?v=4.2.0', 'text'), get('/styles.css?v=4.2.0', 'text')]);
  const v4Modules = ['DAILY BRIEFING', 'MATCHDAY COMMAND', 'SIGNAL STUDIO', 'VANTAGGIO NEWSROOM', 'TABLE LAB', 'MY MATCHROOM', 'SCOUT SEARCH', 'WHAT CHANGED DESK', 'KICKOFF WATCH', 'TEAM DNA', 'RELIABILITY LEDGER', 'deepDiveMarkup', 'MATCH ARCHIVE'];
  if (!v4Modules.every(module => appJs.includes(module)) || !styles.includes('VANTAGGIO 4.0')) throw new Error('Moduli esperienza V4 incompleti');

  const status = await get('/api/status');
  if (!status.ok || status.timezone !== 'Europe/Rome' || status.leagues.length < 5) throw new Error('Status API non valido');

  const from = new Date(new Date(status.today + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const to = new Date(new Date(status.today + 'T12:00:00Z').getTime() + 13 * 86400000).toISOString().slice(0, 10);
  const matches = await get(`/api/matches?league=all&from=${from}&to=${to}`);
  if (!matches.ok || !Array.isArray(matches.data.matches) || !Array.isArray(matches.data.sources)) throw new Error('Matches API non valida');

  const news = await get('/api/news');
  if (!news.ok || !Array.isArray(news.data.articles) || !news.data.articles.length) throw new Error('News API non valida');

  const standings = await get('/api/standings?league=ita.1');
  if (!standings.ok || !Array.isArray(standings.data.table)) throw new Error('Standings API non valida');

  const analyzable = matches.data.matches.find(item => item.state !== 'post');
  if (!analyzable) throw new Error('Nessuna partita analizzabile');
  const analysis = await get(`/api/analysis?event=${encodeURIComponent(analyzable.id)}&league=${encodeURIComponent(analyzable.league.id)}`);
  const power = analysis.data;
  if (!analysis.ok || power.engine?.version !== '2.1' || !power.probabilities || !Array.isArray(power.signals)) throw new Error('Power Analysis API non valida');
  if (!power.context || !Array.isArray(power.context.facts) || !power.context.venue || !power.lineups || !Array.isArray(power.tournamentStats) || !Array.isArray(power.leaders)) throw new Error('Contesto Power Analysis incompleto');

  const intelligence = await get(`/api/intelligence?event=${encodeURIComponent(analyzable.id)}&league=${encodeURIComponent(analyzable.league.id)}`);
  const intel = intelligence.data;
  if (!intelligence.ok || intel.engine?.version !== '1.1' || !intel.event || !intel.context || !intel.calendar || !intel.tactical || !intel.reliability || !intel.deepDive) throw new Error('Match Intelligence API non valida');
  if (!Array.isArray(intel.critical) || !intel.critical.every(item => ['Fatto', 'Lettura', 'Verifica'].includes(item.type))) throw new Error('Separazione fatto/lettura/verifica non valida');
  if (!Array.isArray(intel.script) || !intel.script.length || !Array.isArray(intel.alerts) || !intel.lineups || !intel.availability || !Array.isArray(intel.news?.articles)) throw new Error('Match Intelligence incompleta');
  if (typeof intel.tactical.home?.observedGames !== 'number' || typeof intel.tactical.away?.observedGames !== 'number') throw new Error('Campione tattico non dichiarato');
  if (!Number.isFinite(intel.reliability.overall) || !Array.isArray(intel.reliability.items) || intel.reliability.items.length < 5) throw new Error('Reliability Ledger non valido');

  const teamDna = await get(`/api/team-dna?team=${encodeURIComponent(analyzable.home.id)}&league=${encodeURIComponent(analyzable.league.id)}&name=${encodeURIComponent(analyzable.home.name)}`);
  const dna = teamDna.data;
  if (!teamDna.ok || dna.engine?.name !== 'VANTAGGIO Team DNA' || !dna.team || !dna.profile || !Array.isArray(dna.fingerprint) || dna.fingerprint.length < 5) throw new Error('Team DNA API non valida');
  if (!dna.reliability || !Number.isFinite(dna.reliability.overall) || !Array.isArray(dna.recentEvents) || !dna.splits?.home || !dna.splits?.away) throw new Error('Team DNA incompleto');

  const archived = matches.data.matches.find(item => item.id === '401873624');
  if (!archived || archived.state !== 'post' || archived.league.id !== 'uefa.super_cup') throw new Error('Archivio globale di ieri incompleto');
  const review = await get('/api/intelligence?event=401873624&league=uefa.super_cup');
  if (review.data.deepDive?.mode !== 'post' || review.data.event.home.score !== 2 || review.data.event.away.score !== 1 || !review.data.deepDive.paragraphs?.length) throw new Error('Deep Match Review non valida');
  if (!review.data.deepDive.paragraphs.some(item => item.title === 'Season Vault') || !review.data.deepDive.teamCases.every(item => item.season?.played > 0) || !review.data.deepDive.unavailable.some(item => item.includes('xG'))) throw new Error('Season Vault o trasparenza dati incompleti');

  console.log(`✓ Homepage V4 e asset cache serviti`);
  console.log(`✓ ${matches.data.matches.length} partite in ${matches.data.coverage?.competitions || 0} competizioni`);
  console.log(`✓ Power Model 2.1 operativo su ${analyzable.home.name}–${analyzable.away.name}`);
  console.log(`✓ Match Intelligence: ${intel.critical.length} evidenze, ${intel.alerts.length} alert, affidabilità ${intel.reliability.overall}/100`);
  console.log(`✓ Team DNA ${dna.team.name}: ${dna.profile.observedGames} boxscore, affidabilità ${dna.reliability.overall}/100`);
  console.log(`✓ Deep Match Review PSG–Aston Villa: 2-1, ${review.data.deepDive.paragraphs.length} blocchi editoriali verificati`);
  console.log(`✓ ${news.data.articles.length} notizie da ${news.data.sources.filter(item => item.ok).length} fonti`);
  console.log(`✓ ${standings.data.table.length} righe classifica Serie A`);
  console.log('Smoke test completato senza errori.');
})().catch(error => {
  console.error('Smoke test fallito:', error.message);
  process.exit(1);
});
