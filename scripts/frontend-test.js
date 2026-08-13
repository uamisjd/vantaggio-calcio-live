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
  const pre = matchesPayload.data.matches.find(match => match.state !== 'post');
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
  source += '\nglobalThis.__test={state,safeUrl,teamLogo,newsCard,renderDashboard,renderMatchesView,renderRadarView,renderNewsView,renderStandingsView,renderFavoritesView,renderIntelligence,renderFallbackDeepAnalysis,renderPowerAnalysis};';
  vm.runInNewContext(source, context, { filename: 'public/app.js' });
  const test = context.__test;
  test.state.today = status.today;
  test.state.leagues = status.leagues;
  test.state.matches = matchesPayload.data.matches;
  test.state.news = newsPayload.data.articles;
  test.state.coverage = matchesPayload.data.coverage || {};
  test.state.tables['ita.1'] = tablePayload.data;
  test.state.analyses[`${pre.league.id}:${pre.id}`] = analysisPayload.data;
  test.state.intelligence[`${pre.league.id}:${pre.id}`] = intelligencePayload.data;
  test.state.powerPicks = [{ match: pre, analysis: analysisPayload.data }];
  test.state.favorites.add(pre.id);
  test.state.favoriteSnapshots[pre.id] = pre;

  const renders = {
    dashboard: test.renderDashboard(), matches: test.renderMatchesView(), radar: test.renderRadarView(),
    news: test.renderNewsView(), standings: test.renderStandingsView(), favorites: test.renderFavoritesView(),
    preDossier: test.renderIntelligence(intelligencePayload.data), postDossier: test.renderIntelligence(reviewPayload.data),
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

  if (!renders.preDossier.includes('Analisi approfondita') || renders.preDossier.indexOf('deep-dive') > renders.preDossier.indexOf('EVIDENZE CONSULTABILI')) throw new Error('Gerarchia Deep Analysis non valida');
  if (!renders.postDossier.includes('REVIEW') || !renders.fallback.includes('COPERTURA RIDOTTA')) throw new Error('Review o fallback trasparente non renderizzato');
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

  const css = fs.readFileSync('public/styles.css', 'utf8');
  for (const marker of ['@media (max-width: 720px)', '@media (max-width: 420px)', 'prefers-reduced-motion', '.deep-dive.fallback', '.preseason-reading', '.deep-story p { margin: 0; color: var(--muted); font-size: 10.5px;']) {
    if (!css.includes(marker)) throw new Error(`Regola CSS mancante: ${marker}`);
  }
  console.log('Frontend test completato: viste, dossier, URL, fallback grafici e pre-season validi.');
})().catch(error => {
  console.error('Frontend test fallito:', error.stack || error.message);
  process.exit(1);
});
