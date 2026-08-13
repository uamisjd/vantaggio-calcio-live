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

const STANDINGS_LEAGUES = {
  'ita.1': LEAGUES['ita.1'], 'eng.1': LEAGUES['eng.1'], 'esp.1': LEAGUES['esp.1'], 'ger.1': LEAGUES['ger.1'], 'fra.1': LEAGUES['fra.1'],
  'ita.2': { id: 'ita.2', label: 'Serie B', country: 'Italia', accent: '#4d8ee8' },
  'eng.2': { id: 'eng.2', label: 'Championship', country: 'Inghilterra', accent: '#9b6de3' },
  'por.1': { id: 'por.1', label: 'Primeira Liga', country: 'Portogallo', accent: '#5bc87a' },
  'ned.1': { id: 'ned.1', label: 'Eredivisie', country: 'Paesi Bassi', accent: '#ff8a4c' },
  'tur.1': { id: 'tur.1', label: 'Süper Lig', country: 'Turchia', accent: '#ef5665' },
  'bel.1': { id: 'bel.1', label: 'Pro League', country: 'Belgio', accent: '#d9a52e' },
  'sco.1': { id: 'sco.1', label: 'Scottish Premiership', country: 'Scozia', accent: '#6b88d9' },
  'usa.1': { id: 'usa.1', label: 'MLS', country: 'Stati Uniti', accent: '#5c9de6' },
  'bra.1': { id: 'bra.1', label: 'Brasileirão', country: 'Brasile', accent: '#50bd68' },
  'arg.1': { id: 'arg.1', label: 'Liga Profesional', country: 'Argentina', accent: '#6fbce9' },
  'mex.1': { id: 'mex.1', label: 'Liga MX', country: 'Messico', accent: '#d35b76' }
};

const BIG_CLUBS = new Set([
  'internazionale', 'inter milan', 'ac milan', 'juventus', 'napoli', 'roma', 'lazio', 'atalanta',
  'manchester city', 'manchester united', 'liverpool', 'arsenal', 'chelsea', 'tottenham hotspur',
  'real madrid', 'barcelona', 'atlético madrid', 'atletico madrid', 'bayern munich', 'borussia dortmund',
  'paris saint-germain', 'paris fc', 'marseille', 'benfica', 'fc porto', 'sporting cp',
  'inter miami cf', 'américa', 'cruz azul', 'besiktas', 'partizan belgrade', 'santos', 'flamengo',
  'palmeiras', 'river plate', 'boca juniors', 'al hilal', 'al nassr'
]);

// Competizioni rilevanti presenti nel calendario globale ESPN. La chiave è
// l'identificativo numerico incluso nell'UID degli eventi globali.
const GLOBAL_COMPETITIONS = {
  '19425': { id: 'concacaf.leagues.cup', label: 'Leagues Cup', country: 'Nord America', accent: '#44d6bd', weight: 19 },
  '19887': { id: 'uefa.europa_qual', label: 'Qualificazioni Europa League', country: 'Europa', accent: '#ff9f43', weight: 21 },
  '20221': { id: 'uefa.europa.conf_qual', label: 'Qualificazioni Conference', country: 'Europa', accent: '#6bdc7d', weight: 17 },
  '783': { id: 'conmebol.libertadores', label: 'Copa Libertadores', country: 'Sud America', accent: '#d9b85b', weight: 23 },
  '5454': { id: 'conmebol.sudamericana', label: 'Copa Sudamericana', country: 'Sud America', accent: '#ee7d45', weight: 19 },
  '21231': { id: 'ksa.1', label: 'Saudi Pro League', country: 'Arabia Saudita', accent: '#62ca74', weight: 12 },
  '3932': { id: 'mex.2', label: 'Liga de Expansión MX', country: 'Messico', accent: '#d65c70', weight: 9 },
  '8313': { id: 'col.1', label: 'Primera A Colombia', country: 'Colombia', accent: '#f3c849', weight: 11 },
  '22947': { id: 'pan.1', label: 'Liga Panamense', country: 'Panama', accent: '#5d91e8', weight: 8 },
  '5462': { id: 'uefa.super_cup', label: 'Supercoppa UEFA', country: 'Europa', accent: '#8da2ff', weight: 25 }
};

const ANALYSIS_LEAGUES = new Set([
  ...Object.keys(LEAGUES),
  ...Object.values(GLOBAL_COMPETITIONS).map(item => item.id),
  'uefa.champions_qual', 'uefa.super_cup', 'uefa.europa.conf', 'ita.coppa_italia',
  'eng.2', 'ita.2', 'por.1', 'ned.1', 'tur.1', 'bel.1', 'sco.1', 'usa.1', 'mex.1', 'arg.1', 'bra.1'
]);

const memoryCache = new Map();
const sourceTelemetry = new Map();
const SOURCE_CATALOG = {
  'site.api.espn.com': 'ESPN Sports Feed',
  'site.web.api.espn.com': 'ESPN Web Feed',
  'fantasy.premierleague.com': 'Fantasy Premier League ufficiale',
  'news.google.com': 'Google News RSS',
  'www.ansa.it': 'ANSA Calcio',
  'football-italia.net': 'Football Italia',
  'www.espn.com': 'ESPN News'
};
const SOURCE_COVERAGE = {
  'site.api.espn.com': 'Calendario, risultati, dossier, classifiche e injury feed',
  'site.web.api.espn.com': 'Calendari squadra e archivio stagionale',
  'fantasy.premierleague.com': 'Disponibilità giocatori · sola Premier League',
  'news.google.com': 'Titoli datati e segnali disponibilità',
  'www.ansa.it': 'News editoriali italiane',
  'football-italia.net': 'News editoriali Serie A',
  'www.espn.com': 'News editoriali internazionali'
};

function recordSource(url, ok, latencyMs, error = '') {
  let host = 'fonte-sconosciuta';
  try { host = new URL(url).hostname; } catch {}
  const current = sourceTelemetry.get(host) || { host, label: SOURCE_CATALOG[host] || host, calls: 0, successes: 0, failures: 0, totalLatency: 0 };
  current.calls += 1;
  current.totalLatency += latencyMs;
  current.lastLatencyMs = latencyMs;
  if (ok) { current.successes += 1; current.consecutiveFailures = 0; current.lastSuccessAt = nowIso(); current.lastError = ''; }
  else { current.failures += 1; current.consecutiveFailures = (current.consecutiveFailures || 0) + 1; current.lastErrorAt = nowIso(); current.lastError = String(error || 'Errore fonte').slice(0, 160); }
  sourceTelemetry.set(host, current);
}

function sourceHealthSnapshot() {
  const hosts = new Set([...Object.keys(SOURCE_CATALOG), ...sourceTelemetry.keys()]);
  const sources = [...hosts].map(host => {
    const item = sourceTelemetry.get(host) || { host, label: SOURCE_CATALOG[host] || host, calls: 0, successes: 0, failures: 0, totalLatency: 0 };
    const state = !item.calls ? 'non_testata' : !item.successes || (item.consecutiveFailures || 0) >= 3 ? 'degradata' : item.failures ? 'operativa_con_errori' : 'operativa';
    return { ...item, coverage: SOURCE_COVERAGE[host] || 'Fonte esterna osservata', state, averageLatencyMs: item.calls ? Math.round(item.totalLatency / item.calls) : null };
  }).sort((a, b) => (b.lastSuccessAt || '').localeCompare(a.lastSuccessAt || '') || a.label.localeCompare(b.label));
  return { ok: true, service: 'VANTAGGIO', generatedAt: nowIso(), sources, cache: { entries: memoryCache.size, staleEntries: [...memoryCache.values()].filter(item => item.stale).length }, rule: 'Lo stato misura le risposte osservate dal server gratuito; non certifica completezza editoriale o medica.' };
}

function nowIso() {
  return new Date().toISOString();
}

function romeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, item) => ({ ...acc, [item.type]: item.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isIsoDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(isoDate, count) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
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
    const text = await response.text();
    recordSource(url, true, Date.now() - started);
    return text;
  } catch (error) {
    recordSource(url, false, Date.now() - started, error.message);
    throw error;
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

function eventLeagueNumericId(event) {
  return String(event.uid || '').match(/~l:([^~]+)/)?.[1] || '';
}

async function getGlobalMatches(date) {
  const compactDate = date.replaceAll('-', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${compactDate}&limit=1000`;
  const json = await fetchJson(url, 14_000);
  return (json.events || [])
    .map(event => ({ event, league: GLOBAL_COMPETITIONS[eventLeagueNumericId(event)] }))
    .filter(item => item.league)
    .map(item => normalizeEvent(item.event, item.league));
}

async function getMatches({ leagueId = 'all', from, to, force = false }) {
  const selected = leagueId === 'all' ? Object.values(LEAGUES) : [LEAGUES[leagueId]].filter(Boolean);
  if (!selected.length) throw new Error('Competizione non valida');
  const key = `matches:v2:${selected.map(l => l.id).join(',')}:${from}:${to}`;
  return cached(key, 60_000, async () => {
    const jobs = selected.map(league => ({ id: league.id, type: 'league', promise: getLeagueMatches(league, from, to) }));
    if (leagueId === 'all') {
      const today = romeDate();
      [addDays(today, -1), today, addDays(today, 1)].filter(date => date >= from && date <= to).forEach(date => {
        jobs.push({ id: `global:${date}`, type: 'global', promise: getGlobalMatches(date) });
      });
    }
    const results = await Promise.allSettled(jobs.map(job => job.promise));
    const matchesById = new Map();
    const sources = [];
    results.forEach((result, index) => {
      const job = jobs[index];
      if (result.status === 'fulfilled') {
        result.value.forEach(match => {
          const localDate = romeDate(new Date(match.date));
          if (localDate >= from && localDate <= to) matchesById.set(match.id, match);
        });
        sources.push({ id: job.id, ok: true, count: result.value.length, type: job.type });
      } else {
        sources.push({ id: job.id, ok: false, count: 0, type: job.type, error: result.reason?.message || 'Errore' });
      }
    });
    const matches = [...matchesById.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!matches.length && sources.every(item => !item.ok)) throw new Error('Le fonti sportive non sono raggiungibili');
    return { matches, sources, coverage: { competitions: new Set(matches.map(item => item.league.id)).size, globalCalendar: true } };
  }, force);
}

function getStat(entry, names, fallback = 0) {
  const set = new Set(Array.isArray(names) ? names : [names]);
  const stat = (entry.stats || []).find(item => set.has(item.name) || set.has(item.abbreviation));
  return stat ? Number(stat.value ?? stat.displayValue ?? fallback) : fallback;
}

async function getStandings(leagueId = 'ita.1', force = false) {
  const league = STANDINGS_LEAGUES[leagueId];
  if (!league) throw new Error('Competizione non valida');
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function americanImplied(odds) {
  const value = Number(odds);
  if (!Number.isFinite(value) || value === 0) return null;
  return value < 0 ? (-value) / ((-value) + 100) : 100 / (value + 100);
}

function normalizeRecentTeam(block = {}) {
  const teamId = String(block.team?.id || '');
  const events = (block.events || []).map(event => {
    const homeScore = Number(event.homeTeamScore || 0);
    const awayScore = Number(event.awayTeamScore || 0);
    const isHome = String(event.homeTeamId) === teamId;
    const goalsFor = isHome ? homeScore : awayScore;
    const goalsAgainst = isHome ? awayScore : homeScore;
    return {
      id: String(event.id || ''),
      date: event.gameDate || '',
      opponent: event.opponent?.displayName || 'Avversario',
      opponentLogo: event.opponentLogo || event.opponent?.logo || '',
      venue: isHome ? 'Casa' : 'Trasferta',
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? 'V' : goalsFor < goalsAgainst ? 'S' : 'P',
      competition: event.leagueAbbreviation || event.competitionName || ''
    };
  }).filter(event => event.date);
  const played = events.length;
  const wins = events.filter(item => item.result === 'V').length;
  const draws = events.filter(item => item.result === 'P').length;
  const losses = events.filter(item => item.result === 'S').length;
  const goalsFor = events.reduce((sum, item) => sum + item.goalsFor, 0);
  const goalsAgainst = events.reduce((sum, item) => sum + item.goalsAgainst, 0);
  const btts = events.filter(item => item.goalsFor > 0 && item.goalsAgainst > 0).length;
  const over25 = events.filter(item => item.goalsFor + item.goalsAgainst >= 3).length;
  return {
    team: {
      id: teamId,
      name: block.team?.displayName || 'Squadra',
      abbreviation: block.team?.abbreviation || '',
      logo: block.team?.logo || block.team?.logos?.[0]?.href || ''
    },
    played, wins, draws, losses,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: played ? round1(goalsFor / played) : null,
    avgGoalsAgainst: played ? round1(goalsAgainst / played) : null,
    pointsPerGame: played ? round1((wins * 3 + draws) / played) : null,
    bttsRate: played ? Math.round((btts / played) * 100) : null,
    over25Rate: played ? Math.round((over25 / played) * 100) : null,
    cleanSheets: events.filter(item => item.goalsAgainst === 0).length,
    failedToScore: events.filter(item => item.goalsFor === 0).length,
    events
  };
}

function normalizeH2H(series = {}, homeTeamId, awayTeamId) {
  const events = (series.events || []).map(event => {
    const home = event.competitors?.find(item => item.homeAway === 'home') || event.competitors?.[0] || {};
    const away = event.competitors?.find(item => item.homeAway === 'away') || event.competitors?.[1] || {};
    return {
      id: String(event.id || ''),
      date: event.date || '',
      home: { id: String(home.team?.id || ''), name: home.team?.displayName || 'Casa', logo: home.team?.logo || '', score: Number(home.score || 0) },
      away: { id: String(away.team?.id || ''), name: away.team?.displayName || 'Ospite', logo: away.team?.logo || '', score: Number(away.score || 0) }
    };
  }).filter(item => item.date);
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  events.forEach(event => {
    const homeGoals = event.home.id === homeTeamId ? event.home.score : event.away.score;
    const awayGoals = event.home.id === awayTeamId ? event.home.score : event.away.score;
    if (homeGoals > awayGoals) homeWins += 1;
    else if (awayGoals > homeGoals) awayWins += 1;
    else draws += 1;
  });
  return { summary: series.summary || '', total: events.length, homeWins, awayWins, draws, events };
}

function standingFor(summary, teamId) {
  const entries = (summary.standings?.groups || []).flatMap(group => group.standings?.entries || []);
  const entry = entries.find(item => String(item.id) === String(teamId));
  if (!entry) return null;
  const stat = names => {
    const list = Array.isArray(names) ? names : [names];
    const item = (entry.stats || []).find(value => list.includes(value.name) || list.includes(value.abbreviation));
    return item ? Number(item.value ?? item.displayValue ?? 0) : 0;
  };
  return {
    rank: stat(['rank', 'R']), played: stat(['gamesPlayed', 'GP']),
    wins: stat(['wins', 'W']), draws: stat(['ties', 'D']), losses: stat(['losses', 'L']),
    points: stat(['points', 'P'])
  };
}

function poisson(k, lambda) {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

function statisticalModel(homeRecent, awayRecent) {
  const hasHome = homeRecent.played >= 2;
  const hasAway = awayRecent.played >= 2;
  const homeFor = hasHome ? homeRecent.goalsFor / homeRecent.played : 1.35;
  const homeAgainst = hasHome ? homeRecent.goalsAgainst / homeRecent.played : 1.2;
  const awayFor = hasAway ? awayRecent.goalsFor / awayRecent.played : 1.15;
  const awayAgainst = hasAway ? awayRecent.goalsAgainst / awayRecent.played : 1.35;
  const expectedHome = clamp(((homeFor + awayAgainst) / 2) * 1.08, 0.35, 3.4);
  const expectedAway = clamp(((awayFor + homeAgainst) / 2) * 0.94, 0.3, 3.2);
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let under35 = 0;
  let totalMass = 0;
  let likely = { home: 0, away: 0, probability: 0 };
  for (let home = 0; home <= 8; home += 1) {
    for (let away = 0; away <= 8; away += 1) {
      const probability = poisson(home, expectedHome) * poisson(away, expectedAway);
      totalMass += probability;
      if (home > away) homeWin += probability;
      else if (home === away) draw += probability;
      else awayWin += probability;
      if (home > 0 && away > 0) btts += probability;
      if (home + away >= 2) over15 += probability;
      if (home + away >= 3) over25 += probability;
      if (home + away <= 3) under35 += probability;
      if (probability > likely.probability) likely = { home, away, probability };
    }
  }
  const normalize = value => value / totalMass;
  return {
    expectedGoals: { home: round1(expectedHome), away: round1(expectedAway), total: round1(expectedHome + expectedAway) },
    outcome: { home: normalize(homeWin), draw: normalize(draw), away: normalize(awayWin) },
    goals: { btts: normalize(btts), over15: normalize(over15), over25: normalize(over25), under35: normalize(under35) },
    likelyScore: `${likely.home}-${likely.away}`
  };
}

function marketModel(summary) {
  const item = summary.pickcenter?.[0] || summary.odds?.[0];
  if (!item) return null;
  const home = americanImplied(item.homeTeamOdds?.moneyLine);
  const draw = americanImplied(item.drawOdds?.moneyLine);
  const away = americanImplied(item.awayTeamOdds?.moneyLine);
  let outcome = null;
  if (home && draw && away) {
    const total = home + draw + away;
    outcome = { home: home / total, draw: draw / total, away: away / total };
  }
  const over = americanImplied(item.overOdds);
  const under = americanImplied(item.underOdds);
  let totals = null;
  if (over && under) {
    const total = over + under;
    totals = { line: Number(item.overUnder), over: over / total, under: under / total };
  }
  return {
    available: Boolean(outcome || totals),
    provider: item.provider?.name || 'Mercato',
    updated: 'Snapshot disponibile nel feed',
    outcome,
    totals,
    raw: {
      home: item.homeTeamOdds?.moneyLine ?? null,
      draw: item.drawOdds?.moneyLine ?? null,
      away: item.awayTeamOdds?.moneyLine ?? null
    }
  };
}

function percentageTriplet(values) {
  const raw = [values.home, values.draw, values.away].map(value => Math.max(0, value || 0));
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  const rounded = raw.map(value => Math.round((value / total) * 100));
  rounded[0] += 100 - rounded.reduce((sum, value) => sum + value, 0);
  return { home: rounded[0], draw: rounded[1], away: rounded[2] };
}

function buildSignals(probabilities, goals, homeName, awayName) {
  const candidates = [
    { code: '1X', label: `${homeName} o pareggio`, probability: probabilities.home + probabilities.draw, reason: 'Copertura del fattore campo e del pareggio' },
    { code: 'X2', label: `${awayName} o pareggio`, probability: probabilities.away + probabilities.draw, reason: 'Copertura del trend ospite e del pareggio' },
    { code: 'O1.5', label: 'Più di 1,5 gol', probability: goals.over15, reason: 'Distribuzione dei gol recenti delle due squadre' },
    { code: 'U3.5', label: 'Meno di 3,5 gol', probability: goals.under35, reason: 'Scenario protetto contro punteggi molto larghi' },
    { code: 'GG', label: 'Entrambe a segno', probability: goals.btts, reason: 'Frequenza realizzativa e vulnerabilità recenti' },
    { code: 'NG', label: 'Almeno una non segna', probability: 1 - goals.btts, reason: 'Probabilità combinata di almeno una porta inviolata' }
  ];
  if (probabilities.home >= 0.52) candidates.push({ code: '1', label: `Vittoria ${homeName}`, probability: probabilities.home, reason: 'Vantaggio nel consenso statistico 1-X-2' });
  if (probabilities.away >= 0.52) candidates.push({ code: '2', label: `Vittoria ${awayName}`, probability: probabilities.away, reason: 'Vantaggio nel consenso statistico 1-X-2' });
  return candidates
    .map(item => ({ ...item, probability: Math.round(item.probability * 100) }))
    .filter(item => item.probability >= 58)
    .sort((a, b) => b.probability - a.probability)
    .filter((item, index, all) => all.findIndex(other => other.code === item.code) === index)
    .slice(0, 4);
}

function italianCompetitionPhase(value) {
  if (!value) return null;
  return String(value)
    .replace(/UEFA Europa League Qualifying/gi, 'Qualificazioni Europa League')
    .replace(/UEFA Champions League Qualifying/gi, 'Qualificazioni Champions League')
    .replace(/UEFA Conference League Qualifying/gi, 'Qualificazioni Conference League')
    .replace(/Third Round/gi, 'Terzo turno')
    .replace(/Second Round/gi, 'Secondo turno')
    .replace(/First Round/gi, 'Primo turno')
    .replace(/\bQuarterfinals?\b/gi, 'Quarti di finale')
    .replace(/\bSemifinals?\b/gi, 'Semifinale')
    .replace(/\bFinal\b/gi, 'Finale');
}

function normalizeCompetitionContext(summary, competition, homeTeam, awayTeam) {
  const series = competition.series?.[0] || {};
  const leg = Number(competition.leg?.value || series.leg || 0);
  const aggregateEntries = series.competitors || [];
  const aggregateFor = teamId => {
    const entry = aggregateEntries.find(item => String(item.id) === String(teamId));
    return Number(entry?.aggregateScore ?? 0);
  };
  const homeAggregate = aggregateFor(homeTeam.id);
  const awayAggregate = aggregateFor(awayTeam.id);
  const gap = Math.abs(homeAggregate - awayAggregate);
  const leader = homeAggregate > awayAggregate ? homeTeam : awayAggregate > homeAggregate ? awayTeam : null;
  const trailer = leader ? (leader.id === homeTeam.id ? awayTeam : homeTeam) : null;
  const isTwoLeg = Boolean(leg || Number(series.totalCompetitions) === 2);
  const phase = italianCompetitionPhase(competition.groups?.name || competition.altGameNote || summary.header?.season?.name || '');
  const sourceNote = competition.notes?.[0]?.headline || '';
  const facts = [];
  const incentives = [];
  let keyQuestion = `Quale squadra riuscirà a imporre il proprio ritmo senza concedere il primo episodio decisivo?`;
  let scenario = 'Partita singola';
  let urgency = 'normale';

  if (isTwoLeg && leg === 2) {
    scenario = 'Gara di ritorno';
    if (leader && gap > 0) {
      urgency = gap >= 3 ? 'estrema' : gap >= 2 ? 'alta' : 'elevata';
      facts.push(`${leader.name} parte avanti ${leader.id === homeTeam.id ? `${homeAggregate}-${awayAggregate}` : `${awayAggregate}-${homeAggregate}`} nel punteggio aggregato.`);
      facts.push(`${trailer.name} deve recuperare ${gap} ${gap === 1 ? 'gol' : 'gol'} per portare l’aggregato in parità.`);
      incentives.push(`${trailer.name} non può gestire un risultato ordinario: con il passare dei minuti dovrà aumentare uomini e rischio offensivo.`);
      incentives.push(`${leader.name} non ha necessariamente bisogno di vincere la singola partita: può privilegiare controllo, protezione centrale e transizioni.`);
      if (gap >= 3) incentives.push(`Il margine ampio aumenta il rischio di rotazioni o di un approccio conservativo da parte di ${leader.name}.`);
      keyQuestion = `Quanto ${leader.name} cercherà davvero la vittoria della singola gara, avendo già ${gap} gol di margine?`;
    } else {
      urgency = 'alta';
      facts.push(`Il ritorno comincia con aggregato in parità: la gara vale di fatto come un’eliminazione diretta.`);
      incentives.push(`Il primo gol avrà un peso tattico superiore al normale perché rompe l’equilibrio dell’intera sfida.`);
      keyQuestion = `Chi gestirà meglio il rischio sapendo che il primo gol può cambiare completamente il piano partita?`;
    }
  } else if (isTwoLeg && leg === 1) {
    scenario = 'Gara di andata';
    urgency = 'controllata';
    facts.push(`È la prima di due gare: il risultato va letto sull’arco di 180 minuti.`);
    incentives.push(`Nessuna squadra è obbligata a risolvere subito la qualificazione; evitare un danno strutturale pesa più che in una partita di campionato.`);
    keyQuestion = `Chi riuscirà a creare un vantaggio senza esporsi eccessivamente in vista del ritorno?`;
  } else {
    facts.push(`La partita è una gara singola: il risultato dei 90 minuti coincide con l’obiettivo immediato.`);
  }

  if (phase) facts.push(`Contesto competizione: ${phase}.`);
  return {
    scenario, phase, leg: leg || null, isTwoLeg, urgency,
    aggregate: isTwoLeg ? { home: homeAggregate, away: awayAggregate, leaderId: leader?.id || null, gap } : null,
    sourceNote, facts, incentives, keyQuestion,
    venue: {
      name: summary.gameInfo?.venue?.fullName || '',
      city: summary.gameInfo?.venue?.address?.city || '',
      country: summary.gameInfo?.venue?.address?.country || ''
    }
  };
}

function normalizeTournamentStats(summary) {
  return (summary.boxscore?.teams || []).map(item => {
    const stats = Object.fromEntries((item.statistics || []).map(stat => [stat.name, Number(stat.displayValue ?? stat.value ?? 0)]));
    return {
      teamId: String(item.team?.id || ''),
      name: item.team?.shortDisplayName || item.team?.displayName || 'Squadra',
      logo: item.team?.logo || '',
      goals: stats.totalGoals ?? null,
      conceded: stats.goalsConceded ?? null,
      assists: stats.goalAssists ?? null,
      goalDifference: stats.goalDifference ?? null
    };
  });
}

function normalizeTeamLeaders(summary) {
  const wanted = new Set(['goalsLeaders', 'assistsLeaders', 'totalShots', 'accuratePasses', 'saves']);
  return (summary.leaders || []).map(teamBlock => ({
    teamId: String(teamBlock.team?.id || ''),
    teamName: teamBlock.team?.displayName || 'Squadra',
    logo: teamBlock.team?.logo || '',
    categories: (teamBlock.leaders || []).filter(category => wanted.has(category.name)).map(category => ({
      id: category.name,
      label: category.displayName || category.name,
      players: (category.leaders || []).slice(0, 3).map(entry => ({
        id: String(entry.athlete?.id || ''),
        name: entry.athlete?.displayName || 'Giocatore',
        shortName: entry.athlete?.shortName || entry.athlete?.displayName || 'Giocatore',
        position: entry.athlete?.position?.abbreviation || '',
        jersey: entry.athlete?.jersey || '',
        value: entry.shortDisplayValue || entry.displayValue || ''
      }))
    }))
  }));
}

function normalizeLineups(summary) {
  const teams = (summary.rosters || []).map(block => {
    const players = block.roster || block.athletes || [];
    const starters = players.filter(player => player.starter).map(player => ({
      id: String(player.athlete?.id || player.id || ''),
      name: player.athlete?.displayName || player.displayName || 'Giocatore',
      shortName: player.athlete?.shortName || player.shortName || player.athlete?.displayName || '',
      jersey: player.jersey || player.athlete?.jersey || '',
      position: player.position?.abbreviation || player.athlete?.position?.abbreviation || ''
    }));
    return {
      side: block.homeAway || '', teamId: String(block.team?.id || ''),
      teamName: block.team?.displayName || 'Squadra', formation: block.formation || '', starters
    };
  });
  const official = teams.length === 2 && teams.every(team => team.starters.length >= 11);
  return {
    status: official ? 'ufficiali' : 'in_attesa',
    official,
    message: official ? 'Formazioni ufficiali disponibili nel feed.' : 'Formazioni ufficiali non ancora pubblicate. Di norma arrivano vicino al calcio d’inizio.',
    teams
  };
}

async function fetchEventSummary(eventId, leagueId) {
  const primary = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/summary?event=${encodeURIComponent(eventId)}`;
  try {
    const data = await fetchJson(primary, 12_000);
    if (data.header?.competitions?.length) return data;
    throw new Error('Riepilogo vuoto');
  } catch (error) {
    const fallback = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(eventId)}`;
    const data = await fetchJson(fallback, 12_000);
    if (!data.header?.competitions?.length) throw error;
    return data;
  }
}

function normalizeCurrentMatchStats(summary) {
  return (summary.boxscore?.teams || []).map(block => ({
    teamId: String(block.team?.id || ''),
    teamName: block.team?.shortDisplayName || block.team?.displayName || 'Squadra',
    logo: block.team?.logo || '',
    metrics: {
      possession: statFromTeamBlock(block, 'possessionPct'),
      shots: statFromTeamBlock(block, 'totalShots'),
      shotsOnTarget: statFromTeamBlock(block, 'shotsOnTarget'),
      corners: statFromTeamBlock(block, 'wonCorners'),
      passAccuracy: statFromTeamBlock(block, 'passPct'),
      accuratePasses: statFromTeamBlock(block, 'accuratePasses'),
      totalPasses: statFromTeamBlock(block, 'totalPasses'),
      tackles: statFromTeamBlock(block, 'totalTackles'),
      clearances: statFromTeamBlock(block, 'totalClearance'),
      saves: statFromTeamBlock(block, 'saves'),
      fouls: statFromTeamBlock(block, 'foulsCommitted'),
      yellowCards: statFromTeamBlock(block, 'yellowCards'),
      redCards: statFromTeamBlock(block, 'redCards'),
      offsides: statFromTeamBlock(block, 'offsides')
    }
  }));
}

function normalizeKeyEvents(summary) {
  return (summary.keyEvents || []).filter(event => event.scoringPlay || ['yellow-card', 'red-card'].includes(event.type?.type)).map(event => ({
    id: String(event.id || ''),
    type: event.type?.type || '',
    label: event.type?.text || '',
    minute: event.clock?.displayValue || '',
    text: event.shortText || event.text || '',
    teamId: String(event.team?.id || ''),
    teamName: event.team?.displayName || '',
    player: event.participants?.[0]?.athlete?.displayName || '',
    scoring: Boolean(event.scoringPlay)
  })).slice(0, 20);
}

async function getAnalysis(eventId, leagueId, force = false) {
  if (!/^\d{5,15}$/.test(String(eventId))) throw new Error('Evento non valido');
  if (!ANALYSIS_LEAGUES.has(leagueId)) throw new Error('Competizione non supportata per l’analisi avanzata');
  return cached(`analysis:v2:${leagueId}:${eventId}`, 5 * 60_000, async () => {
    const summary = await fetchEventSummary(eventId, leagueId);
    const competition = summary.header?.competitions?.[0] || {};
    const homeEntry = competition.competitors?.find(item => item.homeAway === 'home') || competition.competitors?.[0] || {};
    const awayEntry = competition.competitors?.find(item => item.homeAway === 'away') || competition.competitors?.[1] || {};
    const homeTeam = {
      id: String(homeEntry.team?.id || homeEntry.id || ''),
      name: homeEntry.team?.shortDisplayName || homeEntry.team?.displayName || 'Casa',
      logo: homeEntry.team?.logos?.[0]?.href || '',
      score: Number(homeEntry.score || 0), winner: Boolean(homeEntry.winner)
    };
    const awayTeam = {
      id: String(awayEntry.team?.id || awayEntry.id || ''),
      name: awayEntry.team?.shortDisplayName || awayEntry.team?.displayName || 'Ospite',
      logo: awayEntry.team?.logos?.[0]?.href || '',
      score: Number(awayEntry.score || 0), winner: Boolean(awayEntry.winner)
    };
    const recentBlocks = summary.lastFiveGames || [];
    const homeRecent = normalizeRecentTeam(recentBlocks.find(item => String(item.team?.id) === homeTeam.id) || recentBlocks[0] || { team: homeTeam });
    const awayRecent = normalizeRecentTeam(recentBlocks.find(item => String(item.team?.id) === awayTeam.id) || recentBlocks[1] || { team: awayTeam });
    const h2h = normalizeH2H(summary.seasonseries?.[0] || {}, homeTeam.id, awayTeam.id);
    const standings = { home: standingFor(summary, homeTeam.id), away: standingFor(summary, awayTeam.id) };
    const market = marketModel(summary);
    const context = normalizeCompetitionContext(summary, competition, homeTeam, awayTeam);
    const tournamentStats = normalizeTournamentStats(summary);
    const leaders = normalizeTeamLeaders(summary);
    const lineups = normalizeLineups(summary);
    const matchStats = normalizeCurrentMatchStats(summary);
    const keyEvents = normalizeKeyEvents(summary);
    const matchState = competition.status?.type?.state || 'pre';
    const model = statisticalModel(homeRecent, awayRecent);
    const consensus = market?.outcome ? {
      home: model.outcome.home * 0.58 + market.outcome.home * 0.42,
      draw: model.outcome.draw * 0.58 + market.outcome.draw * 0.42,
      away: model.outcome.away * 0.58 + market.outcome.away * 0.42
    } : model.outcome;
    const probabilities = percentageTriplet(consensus);
    const probabilityDecimals = { home: probabilities.home / 100, draw: probabilities.draw / 100, away: probabilities.away / 100 };
    const recentSamples = homeRecent.played + awayRecent.played;
    const quality = clamp(Math.round(Math.min(50, recentSamples * 5) + Math.min(20, h2h.total * 4) + (market?.available ? 20 : 0) + (standings.home && standings.away ? 10 : 0)), 18, 95);
    const signals = buildSignals(probabilityDecimals, model.goals, homeTeam.name, awayTeam.name);
    const strongest = signals[0] || { probability: Math.max(probabilities.home, probabilities.draw, probabilities.away), label: 'Esito ancora aperto' };
    const risk = quality < 45 || strongest.probability < 64 ? 'Alto' : strongest.probability >= 78 && quality >= 70 ? 'Contenuto' : 'Medio';
    const findings = [];
    if (homeRecent.played) findings.push(`${homeTeam.name}: ${homeRecent.avgGoalsFor} gol fatti e ${homeRecent.avgGoalsAgainst} subiti di media nelle ultime ${homeRecent.played}.`);
    if (awayRecent.played) findings.push(`${awayTeam.name}: ${awayRecent.avgGoalsFor} gol fatti e ${awayRecent.avgGoalsAgainst} subiti di media nelle ultime ${awayRecent.played}.`);
    if (h2h.total) findings.push(`Precedenti disponibili: ${h2h.homeWins}-${h2h.draws}-${h2h.awayWins} dal punto di vista casa-pareggi-ospite.`);
    if (market?.totals) findings.push(`Il feed di mercato colloca la linea gol a ${market.totals.line}.`);
    const seasonTransition = (standings.home?.played === 0 && standings.away?.played === 0);
    return {
      event: { id: String(eventId), leagueId, date: competition.date || '', state: matchState, completed: Boolean(competition.status?.type?.completed), status: competition.status?.type?.shortDetail || competition.status?.type?.detail || '', home: homeTeam, away: awayTeam },
      context,
      tournamentStats,
      matchStats,
      keyEvents,
      leaders,
      lineups,
      engine: { version: '2.1', name: 'VANTAGGIO Power Model', generatedAt: nowIso(), quality, sampleSize: recentSamples + h2h.total },
      probabilities,
      statisticalProbabilities: percentageTriplet(model.outcome),
      expectedGoals: model.expectedGoals,
      goals: {
        over15: Math.round(model.goals.over15 * 100),
        over25: Math.round(model.goals.over25 * 100),
        under35: Math.round(model.goals.under35 * 100),
        btts: Math.round(model.goals.btts * 100),
        noBtts: Math.round((1 - model.goals.btts) * 100),
        likelyScore: model.likelyScore
      },
      signals,
      assessment: { risk, strongestSignal: strongest.label, strongestProbability: strongest.probability, findings, seasonTransition },
      recent: { home: homeRecent, away: awayRecent },
      h2h,
      standings,
      market,
      methodology: 'Modello Poisson sui gol recenti, forma, precedenti e consenso di mercato quando disponibile. Le fonti possono avere ritardi o campioni incompleti.'
    };
  }, force);
}

function statFromTeamBlock(teamBlock, name) {
  const item = (teamBlock?.statistics || []).find(stat => stat.name === name);
  if (!item) return null;
  const value = Number(String(item.displayValue ?? item.value ?? '').replace('%', ''));
  if (!Number.isFinite(value)) return null;
  if (['passPct', 'shotPct', 'crossPct', 'tacklePct', 'longballPct'].includes(name) && value <= 1) return value * 100;
  return value;
}

async function getPastMatchSnapshot(event, teamId) {
  const key = `snapshot:${event.id}:${teamId}`;
  const result = await cached(key, 30 * 60_000, async () => {
    const summary = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(event.id)}`, 14_000);
    const block = (summary.boxscore?.teams || []).find(item => String(item.team?.id) === String(teamId));
    if (!block || !(block.statistics || []).length) return null;
    return {
      eventId: String(event.id), date: event.date || '', opponent: event.opponent || '',
      result: event.result || '', score: `${event.goalsFor}-${event.goalsAgainst}`,
      metrics: {
        possession: statFromTeamBlock(block, 'possessionPct'),
        shots: statFromTeamBlock(block, 'totalShots'),
        shotsOnTarget: statFromTeamBlock(block, 'shotsOnTarget'),
        corners: statFromTeamBlock(block, 'wonCorners'),
        passAccuracy: statFromTeamBlock(block, 'passPct'),
        clearances: statFromTeamBlock(block, 'totalClearance'),
        tackles: statFromTeamBlock(block, 'totalTackles'),
        yellowCards: statFromTeamBlock(block, 'yellowCards'),
        redCards: statFromTeamBlock(block, 'redCards')
      }
    };
  });
  return result.value;
}

function averageMetric(snapshots, key) {
  const values = snapshots.map(item => item?.metrics?.[key]).filter(value => Number.isFinite(value));
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function buildTacticalProfile(teamName, snapshots, recent) {
  const valid = snapshots.filter(Boolean);
  const metrics = {
    possession: averageMetric(valid, 'possession'),
    shots: averageMetric(valid, 'shots'),
    shotsOnTarget: averageMetric(valid, 'shotsOnTarget'),
    corners: averageMetric(valid, 'corners'),
    passAccuracy: averageMetric(valid, 'passAccuracy'),
    clearances: averageMetric(valid, 'clearances'),
    tackles: averageMetric(valid, 'tackles'),
    yellowCards: averageMetric(valid, 'yellowCards'),
    redCards: averageMetric(valid, 'redCards')
  };
  let style = 'Profilo da confermare';
  const traits = [];
  const vulnerabilities = [];
  if (metrics.possession != null) {
    if (metrics.possession >= 57) {
      style = 'Controllo e territorio';
      traits.push(`Nelle gare osservate tiene mediamente il ${metrics.possession}% di possesso.`);
    } else if (metrics.possession <= 43) {
      style = 'Verticalità e transizione';
      traits.push(`Accetta spesso di giocare senza palla: ${metrics.possession}% di possesso medio nel campione.`);
    } else {
      style = 'Struttura equilibrata';
      traits.push(`Il possesso medio (${metrics.possession}%) indica un approccio non estremo.`);
    }
  }
  if (metrics.shots != null) {
    if (metrics.shots >= 14) traits.push(`Produce un volume offensivo alto: ${metrics.shots} tiri medi.`);
    else if (metrics.shots <= 8) vulnerabilities.push(`Volume di tiro contenuto: ${metrics.shots} conclusioni medie.`);
  }
  if (metrics.shotsOnTarget != null && metrics.shots != null && metrics.shots > 0) {
    const accuracy = Math.round((metrics.shotsOnTarget / metrics.shots) * 100);
    if (accuracy >= 42) traits.push(`Buona precisione recente: circa il ${accuracy}% dei tiri centra la porta.`);
    if (accuracy <= 27) vulnerabilities.push(`Precisione recente bassa: solo il ${accuracy}% dei tiri centra la porta.`);
  }
  if (metrics.corners != null && metrics.corners >= 6) traits.push(`Pressione territoriale visibile anche nei corner: ${metrics.corners} di media.`);
  if (metrics.clearances != null && metrics.clearances >= 25) traits.push(`È abituata a difendere l’area: ${metrics.clearances} respinte medie.`);
  if (metrics.passAccuracy != null && metrics.passAccuracy >= 85) traits.push(`Circolazione pulita nel campione: ${metrics.passAccuracy}% di passaggi riusciti.`);
  if (metrics.yellowCards != null && metrics.yellowCards >= 3) vulnerabilities.push(`Disciplina da monitorare: ${metrics.yellowCards} cartellini gialli medi nel campione.`);
  if (metrics.redCards != null && metrics.redCards > 0) vulnerabilities.push(`Nel piccolo campione compare una media di ${metrics.redCards} espulsioni: dato sensibile agli episodi.`);
  if (recent.avgGoalsAgainst != null && recent.avgGoalsAgainst >= 1.8) vulnerabilities.push(`Ha concesso ${recent.avgGoalsAgainst} gol di media nelle ultime ${recent.played}.`);
  if (recent.failedToScore >= 2) vulnerabilities.push(`È rimasta senza segnare in ${recent.failedToScore} delle ultime ${recent.played}.`);
  if (!valid.length) traits.push(`Il feed non offre ancora statistiche tecniche complete sulle gare recenti di ${teamName}.`);
  return { teamName, style, observedGames: valid.length, metrics, traits: traits.slice(0, 4), vulnerabilities: vulnerabilities.slice(0, 3), snapshots: valid };
}

function buildTacticalMatchup(home, away, homeName, awayName) {
  const readings = [];
  const hp = home.metrics.possession;
  const ap = away.metrics.possession;
  if (hp != null && ap != null && Math.abs(hp - ap) >= 12) {
    const controller = hp > ap ? homeName : awayName;
    const reactor = hp > ap ? awayName : homeName;
    readings.push(`${controller} mostra un profilo più orientato al possesso; ${reactor} può trovare la sua partita nelle transizioni e negli spazi alle spalle della pressione.`);
  }
  if ((home.metrics.shots || 0) >= 13 && (away.metrics.shots || 0) >= 13) readings.push(`Entrambe producono volume: il controllo delle seconde palle e delle transizioni può contare più del possesso sterile.`);
  if ((home.metrics.corners || 0) >= 6 || (away.metrics.corners || 0) >= 6) {
    const team = (home.metrics.corners || 0) >= (away.metrics.corners || 0) ? homeName : awayName;
    readings.push(`${team} arriva con una pressione territoriale che genera molti corner: le palle inattive sono una battaglia da monitorare.`);
  }
  if (home.vulnerabilities.length && away.vulnerabilities.length) readings.push(`Entrambe presentano fragilità recenti: il primo errore può cambiare un piano inizialmente prudente.`);
  if (!readings.length) readings.push(`I profili disponibili non mostrano un contrasto netto: formazione ufficiale e primi quindici minuti saranno decisivi per capire il vero assetto.`);
  return readings.slice(0, 3);
}

async function getTeamScheduleIntelligence(teamId, leagueId, eventDate) {
  const season = new Date(eventDate).getUTCFullYear();
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`
  ];
  for (const url of urls) {
    try {
      const json = await fetchJson(url, 10_000);
      if (json.events) return json;
    } catch { /* prova il fallback */ }
  }
  return { events: [], team: {} };
}

function calendarProfile(schedule, recent, eventDate, eventId) {
  const matchTime = new Date(eventDate).getTime();
  const latestRecent = [...(recent.events || [])].filter(item => new Date(item.date).getTime() < matchTime).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const restDays = latestRecent ? Math.max(0, round1((matchTime - new Date(latestRecent.date).getTime()) / 86400000)) : null;
  const future = (schedule.events || []).filter(item => String(item.id) !== String(eventId) && new Date(item.date).getTime() > matchTime).sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = future[0];
  const nextDays = next ? round1((new Date(next.date).getTime() - matchTime) / 86400000) : null;
  const matchesLast14 = (recent.events || []).filter(item => {
    const time = new Date(item.date).getTime();
    return time < matchTime && time >= matchTime - 14 * 86400000;
  }).length;
  return {
    restDays, matchesLast14,
    previous: latestRecent ? { date: latestRecent.date, opponent: latestRecent.opponent, score: `${latestRecent.goalsFor}-${latestRecent.goalsAgainst}`, result: latestRecent.result } : null,
    next: next ? { id: String(next.id), date: next.date, name: next.name || next.shortName || 'Prossima partita', days: nextDays } : null,
    standingSummary: schedule.team?.standingSummary || '', recordSummary: schedule.team?.recordSummary || ''
  };
}

function normalizeTeamScheduleEvents(schedule, teamId) {
  return (schedule.events || []).map(event => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const team = competitors.find(item => String(item.id || item.team?.id) === String(teamId));
    const opponent = competitors.find(item => String(item.id || item.team?.id) !== String(teamId));
    if (!team || !opponent) return null;
    const goalsFor = Number(team.score?.value ?? team.score?.displayValue ?? team.score ?? 0);
    const goalsAgainst = Number(opponent.score?.value ?? opponent.score?.displayValue ?? opponent.score ?? 0);
    const completed = competition.status?.type?.completed || competition.status?.type?.state === 'post';
    return {
      id: String(event.id || competition.id || ''),
      date: event.date || competition.date || '',
      completed,
      state: competition.status?.type?.state || (completed ? 'post' : 'pre'),
      homeAway: team.homeAway || '',
      opponent: opponent.team?.shortDisplayName || opponent.team?.displayName || 'Avversario',
      opponentLogo: opponent.team?.logos?.[0]?.href || opponent.team?.logo || '',
      goalsFor, goalsAgainst,
      result: !completed ? '' : goalsFor > goalsAgainst ? 'V' : goalsFor === goalsAgainst ? 'P' : 'S',
      score: completed ? `${goalsFor}-${goalsAgainst}` : '',
      competition: event.league?.name || event.league?.abbreviation || event.seasonType?.name || '',
      venue: competition.venue?.fullName || '',
      status: competition.status?.type?.shortDetail || competition.status?.type?.detail || ''
    };
  }).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function recentSummaryForDna(events) {
  const completed = events.filter(event => event.completed).slice(-5);
  const played = completed.length;
  const wins = completed.filter(event => event.result === 'V').length;
  const draws = completed.filter(event => event.result === 'P').length;
  const losses = completed.filter(event => event.result === 'S').length;
  const goalsFor = completed.reduce((sum, event) => sum + event.goalsFor, 0);
  const goalsAgainst = completed.reduce((sum, event) => sum + event.goalsAgainst, 0);
  return {
    played, wins, draws, losses, goalsFor, goalsAgainst,
    avgGoalsFor: played ? round1(goalsFor / played) : null,
    avgGoalsAgainst: played ? round1(goalsAgainst / played) : null,
    pointsPerGame: played ? round1((wins * 3 + draws) / played) : null,
    cleanSheets: completed.filter(event => event.goalsAgainst === 0).length,
    failedToScore: completed.filter(event => event.goalsFor === 0).length,
    events: completed
  };
}

async function getTeamSeasonArchive(teamId, leagueId, eventDate) {
  const eventYear = new Date(eventDate).getUTCFullYear();
  const season = eventYear - 1;
  return (await cached(`season-archive:v2:${teamId}:${season}`, 6 * 60 * 60_000, async () => {
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`,
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`
    ];
    let schedule = { events: [], team: {} };
    for (const url of urls) {
      try {
        const candidate = await fetchJson(url, 12_000);
        if (candidate.events?.length) { schedule = candidate; break; }
      } catch { /* fallback */ }
    }
    const events = normalizeTeamScheduleEvents(schedule, teamId).filter(event => event.completed && new Date(event.date).getTime() < new Date(eventDate).getTime());
    const wins = events.filter(event => event.result === 'V').length;
    const draws = events.filter(event => event.result === 'P').length;
    const losses = events.filter(event => event.result === 'S').length;
    const goalsFor = events.reduce((sum, event) => sum + event.goalsFor, 0);
    const goalsAgainst = events.reduce((sum, event) => sum + event.goalsAgainst, 0);
    const competitions = new Map();
    events.forEach(event => {
      const name = event.competition || 'Competizione';
      const item = competitions.get(name) || { name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      item.played += 1;
      item.wins += event.result === 'V' ? 1 : 0;
      item.draws += event.result === 'P' ? 1 : 0;
      item.losses += event.result === 'S' ? 1 : 0;
      item.goalsFor += event.goalsFor;
      item.goalsAgainst += event.goalsAgainst;
      competitions.set(name, item);
    });
    return {
      season: `${season}-${String(season + 1).slice(-2)}`, played: events.length, wins, draws, losses, goalsFor, goalsAgainst,
      avgGoalsFor: events.length ? round1(goalsFor / events.length) : null,
      avgGoalsAgainst: events.length ? round1(goalsAgainst / events.length) : null,
      cleanSheets: events.filter(event => event.goalsAgainst === 0).length,
      competitions: [...competitions.values()].sort((a, b) => b.played - a.played).slice(0, 8),
      scope: 'Tutte le competizioni presenti nel calendario della squadra'
    };
  })).value;
}

function reliabilityLabel(score) {
  return score >= 82 ? 'Solida' : score >= 65 ? 'Buona' : score >= 45 ? 'Parziale' : 'Debole';
}

function buildMatchReliability(analysis, homeCalendar, awayCalendar, tactical, news, availability = null) {
  const contextSignals = [analysis.context.phase, analysis.context.venue?.name, analysis.context.isTwoLeg ? analysis.context.aggregate : true].filter(Boolean).length;
  const contextScore = clamp(55 + contextSignals * 15, 0, 100);
  const calendarKnown = [homeCalendar.restDays, awayCalendar.restDays].filter(value => value != null).length;
  const calendarScore = calendarKnown === 2 ? 88 : calendarKnown === 1 ? 58 : 25;
  const technicalGames = tactical.home.observedGames + tactical.away.observedGames;
  const technicalScore = clamp(25 + technicalGames * 11, 25, 92);
  const lineupScore = analysis.lineups.official ? 100 : 32;
  const strongNews = news.filter(item => item.reliability === 'forte').length;
  const knownNews = news.filter(item => item.reliability === 'media').length;
  const newsScore = news.length ? clamp(38 + strongNews * 18 + knownNews * 10, 38, 92) : 28;
  const availabilityScore = availability?.score ?? 24;
  const items = [
    { id: 'context', label: 'Contesto competizione', score: contextScore, source: 'ESPN event summary', note: analysis.context.isTwoLeg ? 'Fase, gara e aggregato letti dal feed evento.' : 'Fase, sede e stato gara letti dal feed evento.' },
    { id: 'calendar', label: 'Riposo e calendario', score: calendarScore, source: 'ESPN team schedules', note: `${calendarKnown}/2 calendari con riposo calcolabile.` },
    { id: 'technical', label: 'DNA tecnico recente', score: technicalScore, source: 'ESPN completed boxscores', note: `${technicalGames} campioni tecnici osservati su un massimo di 6.` },
    { id: 'lineups', label: 'Formazioni', score: lineupScore, source: 'ESPN event rosters', note: analysis.lineups.official ? 'Entrambi gli undici ufficiali presenti.' : 'Undici ufficiali non ancora completi.' },
    { id: 'news', label: 'News collegate', score: newsScore, source: 'Google News RSS + editori', note: `${news.length} articoli; ${strongNews} da fonte classificata forte.` },
    { id: 'availability', label: 'Infortuni e squalifiche', score: availabilityScore, source: availability?.sources?.filter(item => item.state === 'disponibile').map(item => item.label).join(' + ') || 'Copertura non documentata', note: availability?.message || 'Dato non elevato a fatto senza una fonte ufficiale affidabile.' }
  ].map(item => ({ ...item, level: reliabilityLabel(item.score) }));
  const weights = { context: .2, calendar: .15, technical: .25, lineups: .2, news: .1, availability: .1 };
  const overall = Math.round(items.reduce((sum, item) => sum + item.score * weights[item.id], 0));
  return { overall, level: reliabilityLabel(overall), items, rule: 'L’affidabilità misura copertura, provenienza e completezza dei dati; non la probabilità che un pronostico si realizzi.' };
}

async function getTeamDna(teamId, leagueId, teamName = '', force = false) {
  if (!teamId) throw new Error('Squadra non specificata');
  const season = new Date().getUTCFullYear();
  return cached(`team-dna:v1:${teamId}:${leagueId}:${season}`, 30 * 60_000, async () => {
    const schedule = await getTeamScheduleIntelligence(teamId, leagueId || 'all', nowIso());
    const events = normalizeTeamScheduleEvents(schedule, teamId);
    const recent = recentSummaryForDna(events);
    const technicalCandidates = recent.events.slice(-3).reverse();
    const settled = await Promise.allSettled(technicalCandidates.map(event => getPastMatchSnapshot(event, teamId)));
    const snapshots = settled.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
    const name = schedule.team?.displayName || schedule.team?.name || teamName || 'Squadra';
    const profile = buildTacticalProfile(name, snapshots, recent);
    profile.teamId = String(teamId);
    const splitFor = side => {
      const sample = recent.events.filter(event => event.homeAway === side);
      const wins = sample.filter(event => event.result === 'V').length;
      const goalsFor = sample.reduce((sum, event) => sum + event.goalsFor, 0);
      const goalsAgainst = sample.reduce((sum, event) => sum + event.goalsAgainst, 0);
      return { played: sample.length, wins, pointsPerGame: sample.length ? round1((wins * 3 + sample.filter(event => event.result === 'P').length) / sample.length) : null, goalsFor: sample.length ? round1(goalsFor / sample.length) : null, goalsAgainst: sample.length ? round1(goalsAgainst / sample.length) : null };
    };
    const now = Date.now();
    const next = events.filter(event => !event.completed && new Date(event.date).getTime() >= now).slice(0, 3);
    const competitionMap = new Map();
    recent.events.forEach(event => competitionMap.set(event.competition || 'Competizione', (competitionMap.get(event.competition || 'Competizione') || 0) + 1));
    const metrics = profile.metrics;
    const fingerprint = [
      { id: 'territory', label: 'Controllo territoriale', value: metrics.possession == null ? null : Math.round(metrics.possession), raw: metrics.possession == null ? 'n/d' : `${metrics.possession}% possesso` },
      { id: 'pressure', label: 'Pressione offensiva', value: metrics.shots == null ? null : clamp(Math.round(metrics.shots / 20 * 100), 0, 100), raw: metrics.shots == null ? 'n/d' : `${metrics.shots} tiri medi` },
      { id: 'accuracy', label: 'Precisione al tiro', value: metrics.shots && metrics.shotsOnTarget != null ? clamp(Math.round(metrics.shotsOnTarget / metrics.shots * 100), 0, 100) : null, raw: metrics.shotsOnTarget == null ? 'n/d' : `${metrics.shotsOnTarget} in porta` },
      { id: 'circulation', label: 'Pulizia del possesso', value: metrics.passAccuracy == null ? null : Math.round(metrics.passAccuracy), raw: metrics.passAccuracy == null ? 'n/d' : `${metrics.passAccuracy}% passaggi` },
      { id: 'defensiveLoad', label: 'Carico difensivo', value: metrics.clearances == null ? null : clamp(Math.round(metrics.clearances / 35 * 100), 0, 100), raw: metrics.clearances == null ? 'n/d' : `${metrics.clearances} respinte` },
      { id: 'discipline', label: 'Disciplina', value: metrics.yellowCards == null ? null : clamp(Math.round(100 - metrics.yellowCards / 4 * 100), 0, 100), raw: metrics.yellowCards == null ? 'n/d' : `${metrics.yellowCards} gialli medi` }
    ];
    const resultScore = Math.min(25, recent.played * 5);
    const technicalScore = Math.min(45, profile.observedGames * 15);
    const scheduleScore = events.length ? 15 : 0;
    const sourceScore = 15;
    const reliabilityScore = resultScore + technicalScore + scheduleScore + sourceScore;
    const reliability = {
      overall: reliabilityScore,
      level: reliabilityLabel(reliabilityScore),
      items: [
        { label: 'Risultati recenti', score: resultScore / 25 * 100, note: `${recent.played}/5 gare disponibili` },
        { label: 'Boxscore tecnici', score: technicalScore / 45 * 100, note: `${profile.observedGames}/3 gare con metriche` },
        { label: 'Calendario squadra', score: scheduleScore / 15 * 100, note: events.length ? 'Feed calendario disponibile' : 'Feed non disponibile' },
        { label: 'Provenienza', score: 100, note: 'Feed ESPN pubblico normalizzato' }
      ].map(item => ({ ...item, score: Math.round(item.score), level: reliabilityLabel(item.score) })),
      rule: 'Il Team DNA descrive il campione osservato e non viene presentato come identità permanente quando la copertura è ridotta.'
    };
    const facts = [];
    if (recent.played) facts.push(`${name} ha raccolto ${recent.wins} vittorie, ${recent.draws} pareggi e ${recent.losses} sconfitte nelle ultime ${recent.played} disponibili.`);
    if (recent.avgGoalsFor != null) facts.push(`Media recente: ${recent.avgGoalsFor} gol fatti e ${recent.avgGoalsAgainst} subiti.`);
    if (profile.observedGames) facts.push(`Il profilo tecnico usa ${profile.observedGames} boxscore completi.`);
    const readings = [profile.style, ...profile.traits].filter(Boolean).slice(0, 4);
    const verifications = [];
    if (profile.observedGames < 3) verifications.push(`Campione tecnico parziale: ${profile.observedGames}/3 gare complete.`);
    if (!next.length) verifications.push('Prossimi impegni non disponibili nel calendario gratuito.');
    return {
      engine: { version: '1.0', name: 'VANTAGGIO Team DNA', generatedAt: nowIso() },
      team: { id: String(teamId), name, abbreviation: schedule.team?.abbreviation || '', logo: schedule.team?.logo || '', color: schedule.team?.color || '', standingSummary: schedule.team?.standingSummary || '', recordSummary: schedule.team?.recordSummary || '' },
      profile, fingerprint, recent, splits: { home: splitFor('home'), away: splitFor('away') },
      recentEvents: recent.events.slice().reverse(), nextEvents: next,
      competitions: [...competitionMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      facts, readings, verifications, reliability,
      methodology: 'Team DNA combina risultati recenti, split casa/trasferta e massimo tre boxscore tecnici completi. Ogni valore resta legato al campione visibile.'
    };
  }, force);
}

function parseGoogleNews(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match, index) => {
    const block = match[1];
    const title = stripHtml(xmlValue(block, 'title'));
    const publisher = stripHtml(xmlValue(block, 'source')) || title.split(' - ').pop() || 'Fonte web';
    const normalizedTitle = title.endsWith(` - ${publisher}`) ? title.slice(0, -(publisher.length + 3)) : title;
    const lower = normalizedTitle.toLowerCase();
    let tag = 'Approfondimento';
    if (/infortun|injur|assen|squalif|suspend|out\b|doubt|fitness|rientr/.test(lower)) tag = 'Disponibilità';
    else if (/formazion|lineup|starting xi|undici|probabil/.test(lower)) tag = 'Formazioni';
    else if (/allenator|coach|manager|conferenza|press conference/.test(lower)) tag = 'Dichiarazioni';
    else if (/preview|probabilit|pronostic|prediction|verso la/.test(lower)) tag = 'Pre-partita';
    return {
      id: `gnews-${index}-${Buffer.from(xmlValue(block, 'guid') || normalizedTitle).toString('base64url').slice(0, 12)}`,
      title: normalizedTitle,
      publisher,
      link: stripHtml(xmlValue(block, 'link')),
      published: xmlValue(block, 'pubDate') || '', tag
    };
  }).filter(item => item.title && item.link).sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0)).slice(0, 12);
}

async function getMatchNews(homeName, awayName) {
  const query = `"${homeName}" "${awayName}" -pronostico -quote -scommesse -streaming -betting`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=it&gl=IT&ceid=IT:it`;
  try {
    const homeTokens = homeName.toLowerCase().split(/\s+/).filter(token => token.length >= 4);
    const awayTokens = awayName.toLowerCase().split(/\s+/).filter(token => token.length >= 4);
    const parsed = parseGoogleNews(await fetchText(url, 12_000)).filter(article => {
      const title = article.title.toLowerCase();
      const commercialTip = /pronostic|\bquot[ae]\b|scommess|betting|diretta tv gratis|live streaming gratis/.test(title);
      return !commercialTip && (!homeTokens.length || homeTokens.some(token => title.includes(token))) && (!awayTokens.length || awayTokens.some(token => title.includes(token)));
    }).map(article => {
      const publisher = article.publisher.toLowerCase();
      const officialTeamSource = [...homeTokens, ...awayTokens].some(token => publisher.includes(token));
      const strongSource = officialTeamSource || /uefa|fifa|reuters|associated press|\bansa\b|bbc|sky sport|espn|the athletic/.test(publisher);
      const establishedSource = /fotmob|dazn|eurosport|gazzetta|corriere dello sport|tuttosport|sportmediaset|football italia|guardian|independent/.test(publisher);
      return { ...article, reliability: strongSource ? 'forte' : establishedSource ? 'media' : 'da_verificare' };
    });
    const reliabilityRank = { forte: 3, media: 2, da_verificare: 1 };
    return parsed.sort((a, b) => reliabilityRank[b.reliability] - reliabilityRank[a.reliability] || new Date(b.published || 0) - new Date(a.published || 0)).slice(0, 8);
  } catch {
    return [];
  }
}

function normalizeAvailabilityName(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|afc|cf|calcio|football club)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function sameClubName(a, b) {
  const left = normalizeAvailabilityName(a); const right = normalizeAvailabilityName(b);
  if (!left || !right) return false;
  const aliases = { 'manchester united': 'man utd', 'man united': 'man utd', 'manchester city': 'man city', 'tottenham hotspur': 'tottenham', 'spurs': 'tottenham', 'brighton hove albion': 'brighton', 'wolverhampton wanderers': 'wolves', 'west ham united': 'west ham', 'nottingham forest': 'nott m forest', 'nottm forest': 'nott m forest', 'c palace': 'crystal palace' };
  const aa = aliases[left] || left; const bb = aliases[right] || right;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

async function getPremierLeagueAvailability(force = false) {
  return cached('availability:fpl:v1', 30 * 60_000, async () => {
    const fetchedAt = nowIso();
    const payload = await fetchJson('https://fantasy.premierleague.com/api/bootstrap-static/', 16_000);
    const teams = new Map((payload.teams || []).map(team => [Number(team.id), team]));
    const players = (payload.elements || []).filter(player => player.status !== 'a' || player.news).map(player => {
      const team = teams.get(Number(player.team));
      const text = String(player.news || 'Stato non disponibile').trim();
      let category = 'indisponibile';
      if (/has joined|transferr|permanent|on loan|loaned/.test(text.toLowerCase())) category = 'fuori rosa / trasferito';
      else if (player.status === 's' || /suspend|squalif/.test(text.toLowerCase())) category = 'squalifica';
      else if (player.status === 'd') category = 'dubbio';
      else if (/injur|infortun|knock|hamstring|knee|ankle|groin|back|illness/.test(text.toLowerCase())) category = 'infortunio';
      return {
        id: String(player.id), player: player.web_name || `${player.first_name || ''} ${player.second_name || ''}`.trim(),
        teamName: team?.name || '', teamCode: team?.short_name || '', category,
        statusCode: player.status, chance: player.chance_of_playing_next_round,
        detail: text, updatedAt: player.news_added || '', source: 'Fantasy Premier League ufficiale', tier: 2,
        reliability: player.status === 'd' ? 'media' : 'forte'
      };
    });
    return { available: true, fetchedAt, players };
  }, force);
}

async function getLeagueInjuries(leagueId, force = false) {
  return cached(`availability:espn:v1:${leagueId}`, 20 * 60_000, async () => {
    const fetchedAt = nowIso();
    try {
      const payload = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/injuries`, 12_000);
      const groups = Array.isArray(payload.injuries) ? payload.injuries : [];
      const players = groups.flatMap(group => {
        const teamName = group.team?.displayName || group.team?.name || group.displayName || '';
        const entries = group.injuries || group.items || group.athletes || [];
        return (Array.isArray(entries) ? entries : []).map((entry, index) => ({
          id: String(entry.id || entry.athlete?.id || `${teamName}-${index}`), teamName,
          player: entry.athlete?.displayName || entry.athlete?.fullName || entry.displayName || entry.name || 'Giocatore',
          category: /suspend|squalif/.test(String(entry.type?.description || entry.type || entry.status || '').toLowerCase()) ? 'squalifica' : 'indisponibile',
          detail: entry.details?.detail || entry.details?.type || entry.shortComment || entry.description || entry.status || 'Segnalazione nel feed infortuni',
          updatedAt: entry.date || entry.details?.returnDate || '', source: 'ESPN injury feed', tier: 2, reliability: 'forte'
        }));
      });
      return { available: true, reportedCount: players.length, fetchedAt, players, emptyMeansUnknown: players.length === 0 };
    } catch (error) {
      return { available: false, reportedCount: 0, fetchedAt, players: [], error: error.message, emptyMeansUnknown: true };
    }
  }, force);
}

async function getAvailabilityNews(homeName, awayName, force = false) {
  const query = `(${homeName} OR ${awayName}) (infortunio OR squalificato OR assente OR injury OR suspended OR fitness OR formazione) -pronostico -quote -scommesse`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=it&gl=IT&ceid=IT:it`;
  return cached(`availability:news:v1:${normalizeAvailabilityName(homeName)}:${normalizeAvailabilityName(awayName)}`, 15 * 60_000, async () => {
    try {
      const cutoff = Date.now() - 21 * 86400_000;
      return parseGoogleNews(await fetchText(url, 12_000)).filter(article => {
        const title = article.title.toLowerCase();
        const dated = new Date(article.published || 0).getTime();
        const relevant = [homeName, awayName].some(name => normalizeAvailabilityName(name).split(' ').filter(token => token.length > 3).some(token => normalizeAvailabilityName(title).includes(token)));
        return relevant && dated >= cutoff && /infortun|injur|assen|squalif|suspend|doubt|fitness|rientr|formazion|lineup/.test(title) && !/pronostic|scommess|\bquot[ae]\b|betting/.test(title);
      }).map(article => {
        const publisher = article.publisher.toLowerCase();
        const teamName = [homeName, awayName].find(name => normalizeAvailabilityName(article.title).includes(normalizeAvailabilityName(name))) || '';
        const official = [homeName, awayName].some(name => normalizeAvailabilityName(publisher).includes(normalizeAvailabilityName(name)));
        const strong = official || /uefa|fifa|premier league|serie a|\bfa\b|reuters|associated press|\bansa\b|bbc|sky sport|espn|the athletic/.test(publisher);
        const known = /dazn|eurosport|gazzetta|corriere dello sport|tuttosport|sportmediaset|football italia|guardian|independent/.test(publisher);
        return { ...article, teamName, tier: official ? 1 : strong ? 3 : 4, reliability: strong ? 'forte' : known ? 'media' : 'da_verificare' };
      }).sort((a, b) => (a.tier - b.tier) || new Date(b.published) - new Date(a.published)).slice(0, 10);
    } catch { return []; }
  }, force);
}

function availabilityCorroboration(articles) {
  const stop = new Set(['della', 'delle', 'degli', 'contro', 'verso', 'formazione', 'formazioni', 'probabile', 'injury', 'infortunio', 'assente', 'squalificato', 'fitness']);
  const tokens = article => new Set(normalizeAvailabilityName(article.title).split(' ').filter(token => token.length > 4 && !stop.has(token)));
  return articles.map((article, index) => {
    const own = tokens(article);
    const publishers = new Set(articles.filter((other, otherIndex) => {
      if (otherIndex === index || normalizeAvailabilityName(other.publisher) === normalizeAvailabilityName(article.publisher)) return false;
      const overlap = [...own].filter(token => tokens(other).has(token)).length;
      return overlap >= 2;
    }).map(other => other.publisher));
    return { ...article, corroboratedBy: publishers.size, corroboration: publishers.size ? `Ripreso da ${publishers.size + 1} editori distinti; resta da verificare alla fonte primaria.` : 'Singolo segnale editoriale.' };
  });
}

function starterOverrides(item, lineups) {
  if (!lineups?.official || !item.player) return false;
  const target = normalizeAvailabilityName(item.player).replace(/\b(?:jr|sr)\b/g, '').trim();
  return lineups.teams.some(team => sameClubName(team.teamName, item.teamName) && team.starters.some(player => {
    const starter = normalizeAvailabilityName(player.name);
    return starter.includes(target) || target.split(' ').some(token => token.length > 3 && starter.includes(token));
  }));
}

function buildAvailabilityDesk(analysis, fpl, leagueInjuries, availabilityNews) {
  const corroboratedNews = availabilityCorroboration(availabilityNews);
  const teams = [analysis.event.home, analysis.event.away].map(team => {
    const structured = [...(leagueInjuries?.players || []), ...(fpl?.players || [])]
      .filter(item => sameClubName(item.teamName, team.name))
      .map(item => starterOverrides(item, analysis.lineups) ? { ...item, overriddenByLineup: true } : item);
    const active = structured.filter(item => !item.overriddenByLineup);
    const signals = corroboratedNews.filter(item => !item.teamName || sameClubName(item.teamName, team.name));
    return { teamId: team.id, teamName: team.name, structured: active, lineupOverrides: structured.filter(item => item.overriddenByLineup), signals };
  });
  const structuredCount = teams.reduce((sum, team) => sum + team.structured.length, 0);
  const strongSignals = corroboratedNews.filter(item => item.reliability === 'forte').length;
  const corroboratedSignals = corroboratedNews.filter(item => item.corroboratedBy > 0).length;
  const hasFpl = Boolean(fpl?.available && analysis.event.leagueId === 'eng.1');
  const hasEspnItems = Boolean(leagueInjuries?.players?.length);
  const officialLineups = Boolean(analysis.lineups?.official);
  const score = officialLineups
    ? clamp(78 + (hasFpl ? 10 : 0) + (hasEspnItems ? 6 : 0) + Math.min(4, strongSignals * 2), 78, 96)
    : clamp(24 + (hasFpl ? 42 : 0) + (hasEspnItems ? 28 : 0) + Math.min(18, strongSignals * 6 + corroboratedSignals * 3), 20, 90);
  const status = officialLineups ? 'lineup_ufficiali' : hasFpl || hasEspnItems ? 'strutturata_parziale' : corroboratedNews.length ? 'segnali_editoriali' : 'non_documentata';
  const sources = [
    { id: 'lineups', label: 'Formazioni evento', tier: 1, state: officialLineups ? 'disponibile' : 'in_attesa', updatedAt: analysis.engine?.generatedAt || nowIso(), note: 'Gli undici ufficiali prevalgono su segnalazioni precedenti.' },
    { id: 'fpl', label: 'Fantasy Premier League ufficiale', tier: 2, state: analysis.event.leagueId !== 'eng.1' ? 'non_applicabile' : hasFpl ? 'disponibile' : 'non_disponibile', updatedAt: fpl?.fetchedAt || '', note: 'Copertura Premier League; stato fantasy, non cartella clinica.' },
    { id: 'espn-injuries', label: 'ESPN injury feed', tier: 2, state: hasEspnItems ? 'disponibile' : leagueInjuries?.available ? 'nessun_record_pubblicato' : 'non_disponibile', updatedAt: leagueInjuries?.fetchedAt || '', note: 'Un feed vuoto non prova la piena disponibilità della rosa.' },
    { id: 'news', label: 'Rassegna disponibilità datata', tier: 3, state: corroboratedNews.length ? 'disponibile' : 'nessun_segnale', updatedAt: corroboratedNews[0]?.published || '', note: `${corroboratedNews.length} titoli pertinenti; ${corroboratedSignals} con riscontro multi-editore negli ultimi 21 giorni.` }
  ];
  return {
    status, score, level: reliabilityLabel(score), generatedAt: nowIso(), teams, sources,
    structuredCount, signalCount: corroboratedNews.length, corroboratedSignals,
    message: officialLineups ? 'Gli undici ufficiali sono la prova più forte della disponibilità a partire; restano possibili assenze dalla panchina.' : structuredCount ? `${structuredCount} segnalazioni strutturate disponibili. Verificare gli aggiornamenti vicino al kickoff.` : corroboratedNews.length ? 'Sono presenti segnali editoriali datati, ma manca un registro strutturato completo per entrambe le rose.' : 'Nessuna evidenza sufficiente: lo stato delle rose resta sconosciuto, non “tutti disponibili”.',
    rule: 'Gerarchia: lineup/club ufficiali → dataset ufficiali o provider espliciti → reporting forte → segnali da verificare. Il silenzio non equivale mai a piena disponibilità.'
  };
}

function buildMatchScript(context, tactical, homeName, awayName) {
  if (context.isTwoLeg && context.leg === 2 && context.aggregate?.gap > 0) {
    const leader = context.aggregate.leaderId === tactical.home.teamId ? homeName : awayName;
    const trailer = leader === homeName ? awayName : homeName;
    return [
      { phase: '0’–25’', title: 'Il test dell’urgenza', text: `${trailer} deve capire quanto presto alzare pressione e numero di uomini. ${leader} può iniziare proteggendo il centro e scegliendo quando accelerare.` },
      { phase: '25’–70’', title: 'L’aggregato detta il ritmo', text: `Se il margine non cambia, la necessità di ${trailer} cresce. Le perdite di palla possono aprire transizioni molto più importanti del possesso complessivo.` },
      { phase: '70’–90’', title: 'Partita potenzialmente asimmetrica', text: `Il risultato della singola gara e quello della qualificazione possono raccontare due storie diverse. Rotazioni, gestione e spazi aumentano con il passare dei minuti.` }
    ];
  }
  if (context.isTwoLeg && context.leg === 2) {
    return [
      { phase: '0’–30’', title: 'Equilibrio ad alta tensione', text: 'Con aggregato in parità, il costo del primo errore è superiore a quello di una normale gara di campionato.' },
      { phase: '30’–70’', title: 'Il primo gol cambia tutto', text: 'Chi passa avanti può abbassare rischio e densità; chi va sotto è costretto ad allungare la partita.' },
      { phase: '70’–90’', title: 'Gestione o assalto', text: 'Il finale dipende interamente dallo stato dell’aggregato: prudenza se pari, assalto e transizioni se una squadra insegue.' }
    ];
  }
  return [
    { phase: '0’–25’', title: 'Conquista del territorio', text: `${homeName} proverà a sfruttare campo e pubblico; il contrasto iniziale tra ${tactical.home.style.toLowerCase()} e ${tactical.away.style.toLowerCase()} chiarirà il copione.` },
    { phase: '25’–70’', title: 'La battaglia strutturale', text: tactical.matchup[0] || 'Il controllo delle transizioni e delle seconde palle può spostare l’equilibrio.' },
    { phase: '70’–90’', title: 'Peso della panchina', text: 'Se il risultato resta corto, qualità delle sostituzioni, stanchezza e palle inattive diventano più importanti delle medie pre-partita.' }
  ];
}

function buildDeepDive(analysis, tactical, homeCalendar, awayCalendar, homeSeason, awaySeason) {
  const { home, away, state } = analysis.event;
  const homeMatch = (analysis.matchStats || []).find(item => item.teamId === home.id);
  const awayMatch = (analysis.matchStats || []).find(item => item.teamId === away.id);
  const homeMetrics = homeMatch?.metrics || {};
  const awayMetrics = awayMatch?.metrics || {};
  const completed = state === 'post' || analysis.event.completed;
  const h2hGoals = (analysis.h2h?.events || []).reduce((sum, event) => sum + Number(event.home.score || 0) + Number(event.away.score || 0), 0);
  const paragraphs = [];
  const keyNumbers = [];
  const watchlist = [];
  let label = 'DEEP RESEARCH BRIEF';
  let title = `${home.name}–${away.name}: la partita oltre le percentuali`;
  let dek = analysis.context.facts?.[0] || 'Contesto, forma, stili e qualità dei dati riuniti in una lettura editoriale verificabile.';

  if (completed) {
    label = 'DEEP MATCH REVIEW';
    const winner = home.score > away.score ? home : away.score > home.score ? away : null;
    title = winner ? `${winner.name} vince ${home.score}-${away.score}: come si è decisa davvero` : `${home.name} e ${away.name} chiudono ${home.score}-${away.score}`;
    dek = `${analysis.context.phase || 'Partita ufficiale'} · ${analysis.context.venue?.name || 'sede non disponibile'} · analisi costruita sui dati effettivi della gara.`;
    paragraphs.push({ type: 'Fatto', title: 'Il risultato', text: `${home.name} ${home.score}-${away.score} ${away.name}. ${(analysis.keyEvents || []).filter(event => event.scoring).map(event => `${event.player || event.teamName} ${event.minute}`).join(', ') || 'Marcatori non disponibili nel feed.'}` });
    if (homeMetrics.possession != null && awayMetrics.possession != null) {
      const controller = homeMetrics.possession >= awayMetrics.possession ? home : away;
      const reactor = controller.id === home.id ? away : home;
      paragraphs.push({ type: 'Fatto', title: 'Territorio', text: `${controller.name} ha avuto il ${Math.max(homeMetrics.possession, awayMetrics.possession)}% di possesso contro il ${Math.min(homeMetrics.possession, awayMetrics.possession)}% di ${reactor.name}.` });
    }
    if (homeMetrics.shots != null && awayMetrics.shots != null) {
      const volumeTeam = homeMetrics.shots >= awayMetrics.shots ? home : away;
      const volume = Math.max(homeMetrics.shots, awayMetrics.shots);
      paragraphs.push({ type: 'Lettura', title: 'Volume contro precisione', text: `${volumeTeam.name} ha prodotto più tiri (${volume}), ma il rapporto fra conclusioni e tiri in porta mostra perché il solo volume non spiega il risultato: ${home.name} ${homeMetrics.shotsOnTarget ?? '–'} in porta, ${away.name} ${awayMetrics.shotsOnTarget ?? '–'}.` });
    }
    if (homeMetrics.passAccuracy != null && awayMetrics.passAccuracy != null) paragraphs.push({ type: 'Lettura', title: 'Controllo tecnico', text: `Precisione passaggi: ${home.name} ${homeMetrics.passAccuracy}%, ${away.name} ${awayMetrics.passAccuracy}%. Il dato va letto insieme a possesso e stato del punteggio, non come qualità assoluta.` });
    if ((homeMetrics.yellowCards || 0) !== (awayMetrics.yellowCards || 0)) paragraphs.push({ type: 'Fatto', title: 'Disciplina', text: `Cartellini gialli: ${home.name} ${homeMetrics.yellowCards ?? 0}, ${away.name} ${awayMetrics.yellowCards ?? 0}.` });
    keyNumbers.push(
      { label: 'Risultato', value: `${home.score}-${away.score}`, note: 'dato finale' },
      { label: 'Possesso', value: homeMetrics.possession == null ? 'n/d' : `${homeMetrics.possession}%`, note: home.name },
      { label: 'Tiri', value: homeMetrics.shots == null ? 'n/d' : `${homeMetrics.shots}-${awayMetrics.shots}`, note: 'casa-ospite' },
      { label: 'In porta', value: homeMetrics.shotsOnTarget == null ? 'n/d' : `${homeMetrics.shotsOnTarget}-${awayMetrics.shotsOnTarget}`, note: 'casa-ospite' },
      { label: 'Passaggi', value: homeMetrics.passAccuracy == null ? 'n/d' : `${homeMetrics.passAccuracy}%`, note: home.name },
      { label: 'Eventi chiave', value: String((analysis.keyEvents || []).length), note: 'gol e cartellini' }
    );
    watchlist.push('Le quote e i consigli pre-partita vengono archiviati dopo il fischio finale: non presentiamo raccomandazioni retroattive come se fossero previsioni.');
  } else {
    const homeRest = homeCalendar.restDays == null ? 'n/d' : `${homeCalendar.restDays} giorni`;
    const awayRest = awayCalendar.restDays == null ? 'n/d' : `${awayCalendar.restDays} giorni`;
    paragraphs.push({ type: 'Fatto', title: 'Forma recente', text: `${home.name}: ${analysis.recent.home.wins}V-${analysis.recent.home.draws}P-${analysis.recent.home.losses}S, ${analysis.recent.home.avgGoalsFor ?? '–'} gol fatti di media. ${away.name}: ${analysis.recent.away.wins}V-${analysis.recent.away.draws}P-${analysis.recent.away.losses}S, ${analysis.recent.away.avgGoalsFor ?? '–'} gol fatti di media.` });
    paragraphs.push({ type: 'Fatto', title: 'Recupero', text: `${home.name}: ${homeRest} dall’ultima gara; ${away.name}: ${awayRest}. Carico negli ultimi 14 giorni: ${homeCalendar.matchesLast14} contro ${awayCalendar.matchesLast14}.` });
    paragraphs.push({ type: 'Lettura', title: 'Incrocio di stili', text: tactical.matchup?.[0] || `${tactical.home.style} contro ${tactical.away.style}: il campione non mostra ancora un contrasto tattico netto.` });
    if (analysis.h2h?.total) paragraphs.push({ type: 'Fatto', title: 'Precedenti', text: `${analysis.h2h.total} ${analysis.h2h.total === 1 ? 'confronto disponibile' : 'confronti disponibili'}, ${h2hGoals} gol complessivi nel campione del feed.` });
    const topSignals = (analysis.signals || []).slice(0, 3);
    topSignals.forEach(signal => keyNumbers.push({ label: signal.label, value: `${signal.probability}%`, note: 'stima modello' }));
    keyNumbers.push({ label: 'Qualità modello', value: `${analysis.engine.quality}/100`, note: reliabilityLabel(analysis.engine.quality) });
    keyNumbers.push({ label: 'Riposo casa', value: homeRest, note: home.name });
    keyNumbers.push({ label: 'Riposo ospite', value: awayRest, note: away.name });
    watchlist.push(...(analysis.context.incentives || []).slice(0, 2));
    if (!analysis.lineups.official) watchlist.push('Formazioni ufficiali non ancora disponibili: turnover e assenze possono cambiare la lettura.');
  }

  if (homeSeason?.played || awaySeason?.played) {
    const homeText = homeSeason?.played ? `${home.name}: ${homeSeason.played} gare, ${homeSeason.wins}V-${homeSeason.draws}P-${homeSeason.losses}S, ${homeSeason.goalsFor} gol fatti e ${homeSeason.goalsAgainst} subiti` : `${home.name}: archivio non disponibile`;
    const awayText = awaySeason?.played ? `${away.name}: ${awaySeason.played} gare, ${awaySeason.wins}V-${awaySeason.draws}P-${awaySeason.losses}S, ${awaySeason.goalsFor} gol fatti e ${awaySeason.goalsAgainst} subiti` : `${away.name}: archivio non disponibile`;
    paragraphs.push({ type: 'Fatto', title: 'Season Vault', text: `${homeText}. ${awayText}. Totali su tutte le competizioni presenti nel calendario ${homeSeason?.season || awaySeason?.season || 'precedente'}.` });
  }
  const teamCases = [
    { side: 'home', actualMatch: completed, team: home, style: tactical.home.style, observedGames: tactical.home.observedGames, recent: analysis.recent.home, season: homeSeason, sample: tactical.home.metrics, actual: homeMetrics, traits: tactical.home.traits, vulnerabilities: tactical.home.vulnerabilities },
    { side: 'away', actualMatch: completed, team: away, style: tactical.away.style, observedGames: tactical.away.observedGames, recent: analysis.recent.away, season: awaySeason, sample: tactical.away.metrics, actual: awayMetrics, traits: tactical.away.traits, vulnerabilities: tactical.away.vulnerabilities }
  ];
  const toDecimal = value => {
    const american = Number(value);
    if (!Number.isFinite(american) || american === 0) return null;
    return round1(american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american));
  };
  const marketSnapshot = !completed && analysis.market?.available ? {
    provider: analysis.market.provider || 'Provider del feed',
    updated: analysis.market.updated || analysis.engine.generatedAt,
    prices: [
      { id: 'home', label: home.name, decimal: toDecimal(analysis.market.raw?.home) },
      { id: 'draw', label: 'Pareggio', decimal: toDecimal(analysis.market.raw?.draw) },
      { id: 'away', label: away.name, decimal: toDecimal(analysis.market.raw?.away) }
    ].filter(item => item.decimal),
    totalLine: analysis.market.totals?.line ?? null,
    note: 'Snapshot informativo del provider incluso nel feed. Può variare o risultare non disponibile; non è una raccomandazione.'
  } : null;
  const unavailable = [];
  if (![homeMetrics, awayMetrics].some(metrics => metrics.xg != null)) unavailable.push('xG della singola gara non disponibile nel feed primario: non viene stimato o inventato.');
  if (!analysis.lineups.official && !completed) unavailable.push('Undici ufficiali non confermati.');
  unavailable.push('Assenze e condizione medica richiedono comunicati ufficiali: titoli e feed vuoti non sono conferme.');
  return {
    mode: completed ? 'post' : 'pre', label, title, dek, paragraphs: paragraphs.slice(0, 6), keyNumbers: keyNumbers.slice(0, 6),
    teamCases, keyMoments: (analysis.keyEvents || []).filter(event => event.scoring).slice(0, 8), watchlist, unavailable, marketSnapshot,
    sourceNote: 'Testo generato da regole trasparenti sui dati del feed e sulle letture dichiarate; nessun dato numerico viene aggiunto senza un campo sorgente.'
  };
}

async function getIntelligence(eventId, leagueId, force = false) {
  return cached(`intelligence:v2:${leagueId}:${eventId}`, 10 * 60_000, async () => {
    const analysisResult = await getAnalysis(eventId, leagueId, force);
    const analysis = analysisResult.value;
    const { home, away, date } = analysis.event;
    const homeRecentEvents = (analysis.recent.home.events || []).slice(-3).reverse();
    const awayRecentEvents = (analysis.recent.away.events || []).slice(-3).reverse();
    const currentAvailability = analysis.event.state !== 'post' && !analysis.event.completed;
    const jobs = [
      getTeamScheduleIntelligence(home.id, leagueId, date),
      getTeamScheduleIntelligence(away.id, leagueId, date),
      getMatchNews(home.name, away.name),
      getTeamSeasonArchive(home.id, leagueId, date),
      getTeamSeasonArchive(away.id, leagueId, date),
      currentAvailability && leagueId === 'eng.1' ? getPremierLeagueAvailability(force) : Promise.resolve(null),
      currentAvailability ? getLeagueInjuries(leagueId, force) : Promise.resolve({ available: false, players: [], historical: true, emptyMeansUnknown: true }),
      currentAvailability ? getAvailabilityNews(home.name, away.name, force) : Promise.resolve([]),
      ...homeRecentEvents.map(event => getPastMatchSnapshot(event, home.id)),
      ...awayRecentEvents.map(event => getPastMatchSnapshot(event, away.id))
    ];
    const settled = await Promise.allSettled(jobs);
    const valueAt = index => settled[index]?.status === 'fulfilled' ? settled[index].value : null;
    const homeSchedule = valueAt(0) || { events: [], team: {} };
    const awaySchedule = valueAt(1) || { events: [], team: {} };
    const news = valueAt(2) || [];
    const homeSeason = valueAt(3) || null;
    const awaySeason = valueAt(4) || null;
    const fplAvailability = valueAt(5)?.value ?? valueAt(5);
    const leagueInjuries = valueAt(6)?.value ?? valueAt(6) ?? { available: false, players: [], emptyMeansUnknown: true };
    const availabilityEvidence = valueAt(7)?.value ?? valueAt(7) ?? [];
    const homeSnapshots = homeRecentEvents.map((_, index) => valueAt(8 + index)).filter(Boolean);
    const awayStart = 8 + homeRecentEvents.length;
    const awaySnapshots = awayRecentEvents.map((_, index) => valueAt(awayStart + index)).filter(Boolean);
    const homeTactical = buildTacticalProfile(home.name, homeSnapshots, analysis.recent.home);
    const awayTactical = buildTacticalProfile(away.name, awaySnapshots, analysis.recent.away);
    homeTactical.teamId = home.id;
    awayTactical.teamId = away.id;
    const matchup = buildTacticalMatchup(homeTactical, awayTactical, home.name, away.name);
    const homeCalendar = calendarProfile(homeSchedule, analysis.recent.home, date, eventId);
    const awayCalendar = calendarProfile(awaySchedule, analysis.recent.away, date, eventId);
    const critical = [];
    analysis.context.facts.forEach((text, index) => critical.push({ type: 'Fatto', level: index === 0 && analysis.context.isTwoLeg ? 'alta' : 'normale', title: index === 0 ? 'Posta in palio' : 'Contesto', text }));
    if (homeCalendar.restDays != null) critical.push({ type: 'Fatto', level: homeCalendar.restDays <= 3 ? 'alta' : 'normale', title: `Recupero ${home.name}`, text: `${homeCalendar.restDays} giorni dall’ultima partita; ${homeCalendar.matchesLast14} gare negli ultimi 14 giorni disponibili.` });
    if (awayCalendar.restDays != null) critical.push({ type: 'Fatto', level: awayCalendar.restDays <= 3 ? 'alta' : 'normale', title: `Recupero ${away.name}`, text: `${awayCalendar.restDays} giorni dall’ultima partita; ${awayCalendar.matchesLast14} gare negli ultimi 14 giorni disponibili.` });
    matchup.forEach((text, index) => critical.push({ type: 'Lettura', level: index === 0 ? 'alta' : 'normale', title: index === 0 ? 'Incrocio tattico' : 'Battaglia secondaria', text }));
    critical.push({ type: 'Verifica', level: analysis.lineups.official ? 'normale' : 'alta', title: 'Formazioni', text: analysis.lineups.message });

    const alerts = [];
    if (analysis.context.aggregate?.gap >= 3) alerts.push({ level: 'alta', title: 'Rischio motivazionale', text: 'Un largo vantaggio aggregato può rendere meno utile la probabilità di vittoria della squadra più forte nella singola gara.' });
    if ((homeCalendar.restDays != null && homeCalendar.restDays <= 3) || (awayCalendar.restDays != null && awayCalendar.restDays <= 3)) alerts.push({ level: 'media', title: 'Recupero breve', text: 'Almeno una squadra arriva con tre giorni o meno: intensità e rotazioni vanno controllate nelle formazioni.' });
    if (analysis.assessment.seasonTransition) alerts.push({ level: 'media', title: 'Inizio stagione', text: 'Classifiche e medie stagionali hanno ancora poco peso: amichevoli e gare di qualificazione possono mescolare livelli diversi.' });
    if (homeTactical.observedGames < 2 || awayTactical.observedGames < 2 || homeTactical.observedGames + awayTactical.observedGames < 5) alerts.push({ level: 'media', title: 'Campione tecnico ridotto', text: `Le medie tecniche usano solo ${homeTactical.observedGames} gare per ${home.name} e ${awayTactical.observedGames} per ${away.name}: sono segnali, non un'identità tattica definitiva.` });
    if (!analysis.lineups.official) alerts.push({ level: 'alta', title: 'Undici non confermati', text: 'La lettura può cambiare con turnover, assenze o un attaccante lasciato fuori. Ricontrolla vicino al calcio d’inizio.' });
    const matchAvailabilityNews = news.filter(item => ['Disponibilità', 'Formazioni'].includes(item.tag));
    const availability = buildAvailabilityDesk(analysis, fplAvailability, leagueInjuries, availabilityEvidence);
    if (availability.signalCount || matchAvailabilityNews.length) alerts.push({ level: 'media', title: 'Availability Watch', text: `${availability.signalCount + matchAvailabilityNews.length} segnali datati riguardano disponibilità o formazione: distingui dataset strutturati, fonte e semplici titoli.` });
    if (availability.structuredCount) alerts.push({ level: 'alta', title: 'Assenze o dubbi registrati', text: `${availability.structuredCount} giocatori risultano segnalati nei dataset strutturati. Apri l’Availability Desk per dettaglio, timestamp e gerarchia della fonte.` });

    const tactical = { home: homeTactical, away: awayTactical, matchup };
    const reliability = buildMatchReliability(analysis, homeCalendar, awayCalendar, tactical, news, availability);
    const deepDive = buildDeepDive(analysis, tactical, homeCalendar, awayCalendar, homeSeason, awaySeason);
    return {
      engine: { version: '1.2', name: 'VANTAGGIO Match Intelligence', generatedAt: nowIso() },
      event: analysis.event,
      generatedAt: nowIso(),
      context: analysis.context,
      deepDive,
      critical: critical.slice(0, 9),
      calendar: { home: homeCalendar, away: awayCalendar },
      tactical,
      script: buildMatchScript(analysis.context, tactical, home.name, away.name),
      tournamentStats: analysis.tournamentStats,
      leaders: analysis.leaders,
      lineups: analysis.lineups,
      availability,
      reliability,
      news: { articles: news.slice(0, 8), availabilitySignals: availability.signalCount + matchAvailabilityNews.length, disclaimer: 'I titoli sono segnali informativi, non conferme mediche o ufficiali: verifica sempre la fonte originale.' },
      alerts,
      keyQuestion: analysis.context.keyQuestion,
      methodology: 'Context Engine: distingue dati del feed, letture derivate e punti da verificare. Availability Intelligence ordina lineup ufficiali, dataset espliciti e reporting datato senza trasformare silenzi o feed vuoti in piena disponibilità.'
    };
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

function serveStatic(reqPath, res, versioned = false) {
  const pathname = reqPath === '/' ? '/index.html' : reqPath;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return jsonResponse(res, 403, { error: 'Accesso negato' });
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(filePath, (readError, data) => {
        if (readError) return jsonResponse(res, 404, { error: 'Pagina non trovata' });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
        res.end(data);
      });
    }
    fs.readFile(filePath, (readError, data) => {
      if (readError) return jsonResponse(res, 500, { error: 'Errore lettura file' });
      const immutable = versioned && ['.css', '.js'].includes(path.extname(filePath).toLowerCase());
      res.writeHead(200, {
        'content-type': contentType(filePath),
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
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
      if (pathname === '/api/health') return jsonResponse(res, 200, sourceHealthSnapshot());
      if (pathname === '/api/status') {
        return jsonResponse(res, 200, {
          ok: true,
          service: 'VANTAGGIO',
          time: nowIso(),
          today: romeDate(),
          timezone: 'Europe/Rome',
          leagues: Object.values(LEAGUES),
          standingsLeagues: Object.values(STANDINGS_LEAGUES)
        });
      }
      if (pathname === '/api/matches') {
        const rawFrom = requestUrl.searchParams.get('from') || '';
        const rawTo = requestUrl.searchParams.get('to') || '';
        if ((rawFrom && !isIsoDate(rawFrom)) || (rawTo && !isIsoDate(rawTo))) return jsonResponse(res, 400, { ok: false, error: 'Data non valida: usa YYYY-MM-DD' });
        const from = rawFrom || romeDate();
        const to = rawTo || addDays(from, 10);
        if (from > to) return jsonResponse(res, 400, { ok: false, error: 'Intervallo non valido: la data iniziale supera quella finale' });
        const leagueId = requestUrl.searchParams.get('league') || 'all';
        if (leagueId !== 'all' && !LEAGUES[leagueId]) return jsonResponse(res, 400, { ok: false, error: 'Competizione non valida' });
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
        if (!STANDINGS_LEAGUES[leagueId]) return jsonResponse(res, 400, { ok: false, error: 'Competizione non valida' });
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getStandings(leagueId, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale } });
      }
      if (pathname === '/api/news') {
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getNews(force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale } });
      }
      if (pathname === '/api/analysis') {
        const eventId = requestUrl.searchParams.get('event') || '';
        const leagueId = requestUrl.searchParams.get('league') || '';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getAnalysis(eventId, leagueId, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale, cache: result.cache } });
      }
      if (pathname === '/api/intelligence') {
        const eventId = requestUrl.searchParams.get('event') || '';
        const leagueId = requestUrl.searchParams.get('league') || '';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getIntelligence(eventId, leagueId, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale, cache: result.cache } });
      }
      if (pathname === '/api/team-dna') {
        const teamId = requestUrl.searchParams.get('team') || '';
        const leagueId = requestUrl.searchParams.get('league') || 'all';
        const teamName = requestUrl.searchParams.get('name') || '';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getTeamDna(teamId, leagueId, teamName, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale, cache: result.cache } });
      }
      return jsonResponse(res, 404, { ok: false, error: 'Endpoint non trovato' });
    } catch (error) {
      console.error(`[api] ${pathname}:`, error.message);
      return jsonResponse(res, 502, { ok: false, error: error.message || 'Errore sorgente dati', time: nowIso() });
    }
  }
  try {
    serveStatic(decodeURIComponent(pathname), res, requestUrl.searchParams.has('v'));
  } catch {
    jsonResponse(res, 400, { ok: false, error: 'Percorso non valido' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`VANTAGGIO disponibile su http://${HOST}:${PORT}`);
  console.log(`Dati gratuiti • timezone Europe/Rome • ${romeDate()}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
