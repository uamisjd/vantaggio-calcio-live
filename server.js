'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

const LEAGUES = {
  'ita.1': { id: 'ita.1', label: 'Serie A', country: 'Italia', accent: '#2f7cff', weight: 16 },
  'eng.1': { id: 'eng.1', label: 'Premier League', country: 'Inghilterra', accent: '#b764ff', weight: 18 },
  'esp.1': { id: 'esp.1', label: 'LaLiga', country: 'Spagna', accent: '#ff6a55', weight: 15 },
  'ger.1': { id: 'ger.1', label: 'Bundesliga', country: 'Germania', accent: '#ff4058', weight: 14 },
  'fra.1': { id: 'fra.1', label: 'Ligue 1', country: 'Francia', accent: '#37d39a', weight: 13 },
  'uefa.champions': { id: 'uefa.champions', label: 'Champions League', country: 'Europa', accent: '#6b8cff', weight: 24 },
  'uefa.europa': { id: 'uefa.europa', label: 'Europa League', country: 'Europa', accent: '#ff9f43', weight: 20 }
};

const BIG_CLUBS = new Set([
  'internazionale', 'inter milan', 'ac milan', 'juventus', 'napoli', 'roma', 'lazio', 'atalanta',
  'manchester city', 'manchester united', 'liverpool', 'arsenal', 'chelsea', 'tottenham hotspur',
  'real madrid', 'barcelona', 'atlético madrid', 'atletico madrid', 'bayern munich', 'borussia dortmund',
  'paris saint-germain', 'paris fc', 'marseille', 'benfica', 'fc porto', 'sporting cp'
]);

const memoryCache = new Map();

function nowIso() {
  return new Date().toISOString();
}

function romeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, item) => ({ ...acc, [item.type]: item.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(isoDate, count) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'curl/8.0',
        'accept': 'application/json,text/xml,application/rss+xml,text/plain,*/*',
        'referer': 'https://www.espn.com/'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 9000) {
  return JSON.parse(await fetchText(url, timeoutMs));
}

async function cached(key, ttlMs, producer, force = false) {
  const hit = memoryCache.get(key);
  if (!force && hit && hit.expires > Date.now()) return { ...hit, cache: 'hit' };
  try {
    const value = await producer();
    const item = { value, fetchedAt: nowIso(), expires: Date.now() + ttlMs, stale: false };
    memoryCache.set(key, item);
    return { ...item, cache: 'miss' };
  } catch (error) {
    if (hit) return { ...hit, stale: true, error: error.message, cache: 'stale' };
    throw error;
  }
}

function formScore(form = '') {
  const values = String(form).toUpperCase().replace(/[^WDL]/g, '').slice(-5).split('');
  if (!values.length) return 50;
  return Math.round(values.reduce((sum, item) => sum + (item === 'W' ? 100 : item === 'D' ? 48 : 0), 0) / values.length);
}

function normalizeForm(form = '') {
  return String(form).toUpperCase().replace(/[^WDL]/g, '').slice(-5).replaceAll('W', 'V').replaceAll('D', 'P').replaceAll('L', 'S');
}

function safeTeam(competitor = {}) {
  const team = competitor.team || {};
  return {
    id: team.id || competitor.id || '',
    name: team.shortDisplayName || team.displayName || team.name || 'Squadra',
    fullName: team.displayName || team.shortDisplayName || team.name || 'Squadra',
    abbreviation: team.abbreviation || '',
    logo: team.logo || team.logos?.[0]?.href || '',
    color: team.color ? `#${String(team.color).replace('#', '')}` : '#9aaba2',
    score: Number(competitor.score || 0),
    winner: Boolean(competitor.winner),
    form: normalizeForm(competitor.form || ''),
    formRaw: competitor.form || '',
    record: competitor.records?.[0]?.summary || ''
  };
}

function buildInsight(home, away, state) {
  if (state === 'in') return { label: 'In corso', text: 'Segui ritmo e variazioni live; evita decisioni basate sul solo punteggio.', risk: 'Variabile' };
  if (state === 'post') return { label: 'Finale', text: 'Partita conclusa: utile per leggere forma e rendimento recente.', risk: 'Chiuso' };
  const hs = formScore(home.formRaw);
  const as = formScore(away.formRaw);
  const gap = hs - as;
  if (!home.formRaw && !away.formRaw) return { label: 'Dati limitati', text: 'Forma recente non disponibile: attendi dati aggiuntivi prima di valutarla.', risk: 'Alto' };
  if (Math.abs(gap) <= 11) return { label: 'Equilibrio', text: 'Le forme recenti sono vicine: profilo aperto, margine statistico ridotto.', risk: 'Alto' };
  if (gap >= 28) return { label: 'Spinta casa', text: `${home.name} arriva con un trend recente sensibilmente migliore. Scenario prudente: casa protetta.`, risk: 'Medio' };
  if (gap >= 12) return { label: 'Casa in trend', text: `${home.name} mostra una continuità recente superiore, ma il divario non è netto.`, risk: 'Medio' };
  if (gap <= -28) return { label: 'Spinta ospite', text: `${away.name} arriva con un trend recente sensibilmente migliore. Scenario prudente: ospite protetta.`, risk: 'Medio' };
  return { label: 'Ospite in trend', text: `${away.name} mostra una continuità recente superiore, con margine ancora contenuto.`, risk: 'Medio' };
}

function opportunityScore(home, away, league, state, date) {
  let score = 45 + (league.weight || 10);
  const homeName = home.fullName.toLowerCase();
  const awayName = away.fullName.toLowerCase();
  if (BIG_CLUBS.has(homeName)) score += 8;
  if (BIG_CLUBS.has(awayName)) score += 8;
  if (BIG_CLUBS.has(homeName) && BIG_CLUBS.has(awayName)) score += 7;
  if (state === 'in') score += 20;
  if (state === 'post') score -= 15;
  const gap = Math.abs(formScore(home.formRaw) - formScore(away.formRaw));
  if (home.formRaw || away.formRaw) score += Math.min(9, Math.round(gap / 6));
  const hours = (new Date(date).getTime() - Date.now()) / 3600000;
  if (hours >= 0 && hours <= 48) score += 8;
  return Math.max(22, Math.min(96, Math.round(score)));
}

function normalizeEvent(event, league) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = safeTeam(competitors.find(item => item.homeAway === 'home') || competitors[0]);
  const away = safeTeam(competitors.find(item => item.homeAway === 'away') || competitors[1]);
  const type = competition.status?.type || event.status?.type || {};
  const state = type.state || (type.completed ? 'post' : 'pre');
  const date = competition.date || event.date;
  const insight = buildInsight(home, away, state);
  const broadcasts = (competition.broadcasts || []).flatMap(item => item.names || []).filter(Boolean);
  const details = competition.odds?.[0]?.details || '';
  return {
    id: String(event.id),
    league,
    date,
    state,
    status: {
      name: type.name || '',
      detail: type.shortDetail || type.detail || type.description || '',
      clock: competition.status?.displayClock || event.status?.displayClock || ''
    },
    home,
    away,
    venue: competition.venue?.fullName || competition.venue?.address?.city || 'Sede da definire',
    attendance: Number(competition.attendance || 0),
    broadcasts,
    round: competition.week?.text || competition.week?.number || event.week?.text || '',
    oddsNote: details,
    insight,
    opportunity: opportunityScore(home, away, league, state, date),
    source: 'ESPN public feed'
  };
}

async function getLeagueMatches(league, from, to) {
  const compactDates = `${from.replaceAll('-', '')}-${to.replaceAll('-', '')}`;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(league.id)}/scoreboard?dates=${compactDates}&limit=100`;
  const json = await fetchJson(url);
  return (json.events || []).map(event => normalizeEvent(event, league));
}

async function getMatches({ leagueId = 'all', from, to, force = false }) {
  const selected = leagueId === 'all' ? Object.values(LEAGUES) : [LEAGUES[leagueId]].filter(Boolean);
  if (!selected.length) throw new Error('Competizione non valida');
  const key = `matches:${selected.map(l => l.id).join(',')}:${from}:${to}`;
  return cached(key, 60_000, async () => {
    const results = await Promise.allSettled(selected.map(league => getLeagueMatches(league, from, to)));
    const matches = [];
    const sources = [];
    results.forEach((result, index) => {
      const id = selected[index].id;
      if (result.status === 'fulfilled') {
        matches.push(...result.value);
        sources.push({ id, ok: true, count: result.value.length });
      } else {
        sources.push({ id, ok: false, count: 0, error: result.reason?.message || 'Errore' });
      }
    });
    if (!matches.length && sources.every(item => !item.ok)) throw new Error('Le fonti sportive non sono raggiungibili');
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));
    return { matches, sources };
  }, force);
}

function getStat(entry, names, fallback = 0) {
  const set = new Set(Array.isArray(names) ? names : [names]);
  const stat = (entry.stats || []).find(item => set.has(item.name) || set.has(item.abbreviation));
  return stat ? Number(stat.value ?? stat.displayValue ?? fallback) : fallback;
}

async function getStandings(leagueId = 'ita.1', force = false) {
  const league = LEAGUES[leagueId] || LEAGUES['ita.1'];
  return cached(`table:${league.id}`, 10 * 60_000, async () => {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/${encodeURIComponent(league.id)}/standings`;
    const json = await fetchJson(url);
    const child = (json.children || []).find(item => item.standings?.entries?.length) || json.children?.[0];
    const entries = child?.standings?.entries || [];
    const table = entries.map((entry, index) => ({
      rank: getStat(entry, ['rank'], index + 1),
      team: {
        id: entry.team?.id || '',
        name: entry.team?.shortDisplayName || entry.team?.displayName || 'Squadra',
        logo: entry.team?.logos?.[0]?.href || ''
      },
      played: getStat(entry, ['gamesPlayed', 'GP']),
      wins: getStat(entry, ['wins', 'W']),
      draws: getStat(entry, ['ties', 'draws', 'D']),
      losses: getStat(entry, ['losses', 'L']),
      goalsFor: getStat(entry, ['pointsFor', 'goalsFor', 'F']),
      goalsAgainst: getStat(entry, ['pointsAgainst', 'goalsAgainst', 'A']),
      difference: getStat(entry, ['pointDifferential', 'goalDifference', 'GD']),
      points: getStat(entry, ['points', 'PTS'])
    })).sort((a, b) => a.rank - b.rank);
    return { league, season: child?.name || json.season?.displayName || '', table, source: 'ESPN public feed' };
  }, force);
}

function decodeEntities(value = '') {
  const entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' '
  };
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, match => entities[match] || match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripHtml(value = '') {
  return decodeEntities(String(value).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function xmlValue(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function parseRss(xml, source, language = 'it') {
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match, index) => {
    const block = match[1];
    const content = xmlValue(block, 'content:encoded');
    const imageMatch = (content || block).match(/<img[^>]+src=["']([^"']+)["']/i) || block.match(/url=["']([^"']+)["']/i);
    return {
      id: `${source}-${index}-${Buffer.from(xmlValue(block, 'guid') || xmlValue(block, 'link')).toString('base64url').slice(0, 18)}`,
      title: stripHtml(xmlValue(block, 'title')),
      description: stripHtml(xmlValue(block, 'description')).slice(0, 240),
      link: stripHtml(xmlValue(block, 'link')),
      published: xmlValue(block, 'pubDate') || xmlValue(block, 'dc:date'),
      source,
      language,
      image: imageMatch ? decodeEntities(imageMatch[1]) : ''
    };
  });
  return items.filter(item => item.title && item.link);
}

function normalizeEspnNews(json) {
  return (json.articles || []).map(article => ({
    id: `espn-${article.id}`,
    title: article.headline || '',
    description: stripHtml(article.description || '').slice(0, 240),
    link: article.links?.web?.href || '',
    published: article.published || article.lastModified || '',
    source: 'ESPN',
    language: 'en',
    image: article.images?.[0]?.url || article.images?.[0]?.href || ''
  })).filter(item => item.title && item.link);
}

async function getNews(force = false) {
  return cached('news:all', 5 * 60_000, async () => {
    const feeds = await Promise.allSettled([
      fetchText('https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml'),
      fetchText('https://football-italia.net/feed/'),
      fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news?limit=16')
    ]);
    let articles = [];
    const sources = [];
    if (feeds[0].status === 'fulfilled') {
      articles.push(...parseRss(feeds[0].value, 'ANSA Calcio', 'it'));
      sources.push({ name: 'ANSA Calcio', ok: true });
    } else sources.push({ name: 'ANSA Calcio', ok: false });
    if (feeds[1].status === 'fulfilled') {
      articles.push(...parseRss(feeds[1].value, 'Football Italia', 'en'));
      sources.push({ name: 'Football Italia', ok: true });
    } else sources.push({ name: 'Football Italia', ok: false });
    if (feeds[2].status === 'fulfilled') {
      articles.push(...normalizeEspnNews(feeds[2].value));
      sources.push({ name: 'ESPN', ok: true });
    } else sources.push({ name: 'ESPN', ok: false });
    articles = articles
      .filter((item, index, all) => all.findIndex(other => other.link === item.link) === index)
      .sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))
      .slice(0, 48);
    if (!articles.length) throw new Error('I feed delle notizie non sono raggiungibili');
    return { articles, sources };
  }, force);
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json'
  })[ext] || 'application/octet-stream';
}

function serveStatic(reqPath, res) {
  const pathname = reqPath === '/' ? '/index.html' : reqPath;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return jsonResponse(res, 403, { error: 'Accesso negato' });
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(filePath, (readError, data) => {
        if (readError) return jsonResponse(res, 404, { error: 'Pagina non trovata' });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        res.end(data);
      });
    }
    fs.readFile(filePath, (readError, data) => {
      if (readError) return jsonResponse(res, 500, { error: 'Errore lettura file' });
      res.writeHead(200, {
        'content-type': contentType(filePath),
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-content-type-options': 'nosniff'
      });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/status') {
        return jsonResponse(res, 200, {
          ok: true,
          service: 'VANTAGGIO',
          time: nowIso(),
          today: romeDate(),
          timezone: 'Europe/Rome',
          leagues: Object.values(LEAGUES)
        });
      }
      if (pathname === '/api/matches') {
        const from = /^\d{4}-\d{2}-\d{2}$/.test(requestUrl.searchParams.get('from') || '') ? requestUrl.searchParams.get('from') : romeDate();
        const to = /^\d{4}-\d{2}-\d{2}$/.test(requestUrl.searchParams.get('to') || '') ? requestUrl.searchParams.get('to') : addDays(from, 10);
        const leagueId = requestUrl.searchParams.get('league') || 'all';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getMatches({ leagueId, from, to, force });
        return jsonResponse(res, 200, {
          ok: true,
          data: result.value,
          meta: { fetchedAt: result.fetchedAt, stale: result.stale, cache: result.cache, from, to }
        });
      }
      if (pathname === '/api/standings') {
        const leagueId = requestUrl.searchParams.get('league') || 'ita.1';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getStandings(leagueId, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale } });
      }
      if (pathname === '/api/news') {
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getNews(force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale } });
      }
      return jsonResponse(res, 404, { ok: false, error: 'Endpoint non trovato' });
    } catch (error) {
      console.error(`[api] ${pathname}:`, error.message);
      return jsonResponse(res, 502, { ok: false, error: error.message || 'Errore sorgente dati', time: nowIso() });
    }
  }
  serveStatic(decodeURIComponent(pathname), res);
});

server.listen(PORT, HOST, () => {
  console.log(`VANTAGGIO disponibile su http://${HOST}:${PORT}`);
  console.log(`Dati gratuiti • timezone Europe/Rome • ${romeDate()}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
