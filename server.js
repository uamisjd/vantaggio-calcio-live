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
  '22947': { id: 'pan.1', label: 'Liga Panamense', country: 'Panama', accent: '#5d91e8', weight: 8 }
};

const ANALYSIS_LEAGUES = new Set([
  ...Object.keys(LEAGUES),
  ...Object.values(GLOBAL_COMPETITIONS).map(item => item.id),
  'uefa.champions_qual', 'uefa.super_cup', 'uefa.europa.conf', 'ita.coppa_italia',
  'eng.2', 'ita.2', 'por.1', 'ned.1', 'tur.1', 'bel.1', 'sco.1', 'usa.1', 'mex.1', 'arg.1', 'bra.1'
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
      [today, addDays(today, 1)].filter(date => date >= from && date <= to).forEach(date => {
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
      logo: homeEntry.team?.logos?.[0]?.href || ''
    };
    const awayTeam = {
      id: String(awayEntry.team?.id || awayEntry.id || ''),
      name: awayEntry.team?.shortDisplayName || awayEntry.team?.displayName || 'Ospite',
      logo: awayEntry.team?.logos?.[0]?.href || ''
    };
    const recentBlocks = summary.lastFiveGames || [];
    const homeRecent = normalizeRecentTeam(recentBlocks.find(item => String(item.team?.id) === homeTeam.id) || recentBlocks[0] || { team: homeTeam });
    const awayRecent = normalizeRecentTeam(recentBlocks.find(item => String(item.team?.id) === awayTeam.id) || recentBlocks[1] || { team: awayTeam });
    const h2h = normalizeH2H(summary.seasonseries?.[0] || {}, homeTeam.id, awayTeam.id);
    const standings = { home: standingFor(summary, homeTeam.id), away: standingFor(summary, awayTeam.id) };
    const market = marketModel(summary);
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
      event: { id: String(eventId), leagueId, date: competition.date || '', home: homeTeam, away: awayTeam },
      engine: { version: '2.0', name: 'VANTAGGIO Power Model', generatedAt: nowIso(), quality, sampleSize: recentSamples + h2h.total },
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
      if (pathname === '/api/analysis') {
        const eventId = requestUrl.searchParams.get('event') || '';
        const leagueId = requestUrl.searchParams.get('league') || '';
        const force = requestUrl.searchParams.get('fresh') === '1';
        const result = await getAnalysis(eventId, leagueId, force);
        return jsonResponse(res, 200, { ok: true, data: result.value, meta: { fetchedAt: result.fetchedAt, stale: result.stale, cache: result.cache } });
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
