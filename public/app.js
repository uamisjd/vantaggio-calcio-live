'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function readLocalJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch { return fallback; }
}

const state = {
  currentView: (location.hash || '#dashboard').slice(1),
  leagues: [],
  standingsLeagues: [],
  today: '',
  matches: [],
  news: [],
  tables: {},
  analyses: {},
  analysisErrors: {},
  intelligence: {},
  matchRoomTabs: {},
  teamDna: {},
  sourceHealth: null,
  modelSnapshots: readLocalJson('vantaggio:modelSnapshots:v1', {}),
  modelReconciling: false,
  lastModelReconcileAt: 0,
  fixtureLedger: readLocalJson('vantaggio:fixtureLedger', {}),
  changeLog: readLocalJson('vantaggio:changeLog', []),
  kickoffChecks: readLocalJson('vantaggio:kickoffChecks', {}),
  kickoffRunning: false,
  powerPicks: [],
  powerLoading: false,
  coverage: { competitions: 0, globalCalendar: false },
  dataMeta: { matches: null, news: null },
  errors: {},
  loading: true,
  refreshing: false,
  dashboardLeague: 'all',
  matchLeague: 'all',
  selectedDate: 'all',
  newsSource: 'all',
  standingsLeague: 'ita.1',
  favorites: new Set(readLocalJson('vantaggio:favorites', [])),
  favoriteSnapshots: readLocalJson('vantaggio:favoriteSnapshots', {}),
  alertsEnabled: localStorage.getItem('vantaggio:alerts') === 'true',
  lastStates: {},
  refreshTimer: null
};

const fmtTime = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short' });
const fmtLongDay = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' });
const fmtNewsDate = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'short', year: 'numeric' });

function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function safeUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function localDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(value)).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function relativeTime(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return 'adesso';
  if (Math.abs(seconds) < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

function displayDate(value, long = false) {
  return (long ? fmtLongDay : fmtDay).format(new Date(value));
}

function displayNewsDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data non disponibile' : fmtNewsDate.format(date);
}

function teamLogo(team, className = 'team-logo') {
  const initials = escapeHtml((team.abbreviation || team.name || 'FC').slice(0, 3).toUpperCase());
  const src = safeUrl(team.logo);
  if (!src) return `<span class="logo-fallback ${className === 'team-logo' ? '' : className}">${initials}</span>`;
  return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(team.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="logo-fallback" style="display:none">${initials}</span>`;
}

function formMarkup(form = '') {
  if (!form) return '';
  return `<span class="team-form" aria-label="Forma ${escapeHtml(form)}">${form.split('').map(item => `<i class="form-dot ${item.toLowerCase()}">${item}</i>`).join('')}</span>`;
}

function getLeague(id) {
  return [...state.leagues, ...state.standingsLeagues].find(league => league.id === id) || { id, label: id, accent: '#c8ff52', country: '' };
}

function isUpcoming(match) {
  return match.state === 'in' || (match.state === 'pre' && new Date(match.date).getTime() > Date.now() - 3 * 3600000);
}

function statusMarkup(match) {
  if (match.state === 'in') {
    return { main: `${match.home.score} – ${match.away.score}`, sub: match.status.clock || 'LIVE', className: 'live' };
  }
  if (match.state === 'post') return { main: `${match.home.score} – ${match.away.score}`, sub: 'Finale', className: '' };
  return { main: fmtTime.format(new Date(match.date)), sub: localDateKey(match.date) === state.today ? 'Oggi' : displayDate(match.date), className: '' };
}

function saveFavorites() {
  localStorage.setItem('vantaggio:favorites', JSON.stringify([...state.favorites]));
  localStorage.setItem('vantaggio:favoriteSnapshots', JSON.stringify(state.favoriteSnapshots));
  updateBadges();
}

function toggleFavorite(id) {
  const match = state.matches.find(item => item.id === id) || state.favoriteSnapshots[id];
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    delete state.favoriteSnapshots[id];
    toast('Partita rimossa dai preferiti');
  } else if (match) {
    state.favorites.add(id);
    state.favoriteSnapshots[id] = match;
    toast('Partita salvata nei preferiti');
  }
  saveFavorites();
  render();
  void runKickoffWatch();
  if (!$('#modalLayer')?.hidden) openMatch(id);
}

function updateBadges() {
  const live = state.matches.filter(match => match.state === 'in').length;
  const liveBadge = $('#liveNavBadge');
  const favBadge = $('#favoriteBadge');
  if (liveBadge) { liveBadge.textContent = live; liveBadge.dataset.count = live; }
  if (favBadge) { favBadge.textContent = state.favorites.size; favBadge.dataset.count = state.favorites.size; }
}

async function api(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `Errore ${response.status}`);
  return payload;
}

async function loadInitial() {
  state.loading = true;
  try {
    const status = await api('/api/status');
    state.leagues = status.leagues || [];
    state.standingsLeagues = status.standingsLeagues || state.leagues.filter(league => !league.id.startsWith('uefa.'));
    state.today = status.today;
  } catch (error) {
    state.today = localDateKey(new Date());
    state.errors.status = error.message;
  }
  const from = addDays(state.today, -1);
  const to = addDays(state.today, 13);
  const [matches, news, health] = await Promise.allSettled([
    api(`/api/matches?league=all&from=${from}&to=${to}`),
    api('/api/news'),
    api('/api/health')
  ]);
  if (matches.status === 'fulfilled') applyMatches(matches.value);
  else state.errors.matches = matches.reason.message;
  if (news.status === 'fulfilled') applyNews(news.value);
  else state.errors.news = news.reason.message;
  if (health.status === 'fulfilled') state.sourceHealth = health.value;
  try { state.sourceHealth = await api('/api/health'); } catch {}
  state.loading = false;
  updateSyncStatus();
  updateBadges();
  render();
  loadStandings(state.standingsLeague, false);
  loadPowerPicks();
}

function fixtureSnapshot(match) {
  return {
    id: match.id, date: match.date, state: match.state, venue: match.venue || '',
    home: match.home.name, away: match.away.name,
    homeScore: Number(match.home.score || 0), awayScore: Number(match.away.score || 0),
    leagueId: match.league.id, leagueLabel: match.league.label,
    updatedAt: new Date().toISOString()
  };
}

function addChange(kind, title, text, match, signature = '') {
  const id = `${match.id}:${kind}:${signature || text}`;
  if (state.changeLog.some(item => item.id === id)) return;
  state.changeLog.unshift({ id, kind, title, text, eventId: match.id, leagueId: match.league.id, home: match.home.name, away: match.away.name, happenedAt: new Date().toISOString(), seen: false });
  state.changeLog = state.changeLog.slice(0, 60);
  localStorage.setItem('vantaggio:changeLog', JSON.stringify(state.changeLog));
}

function trackFixtureChanges(matches) {
  const oldLedger = state.fixtureLedger || {};
  const hasBaseline = Object.keys(oldLedger).length > 0;
  let newCount = 0;
  matches.forEach(match => {
    const old = oldLedger[match.id];
    if (!old) {
      if (hasBaseline && match.state === 'pre' && newCount < 8) {
        addChange('new', 'Nuova partita pubblicata', `${match.home.name}–${match.away.name} è entrata nel calendario del ${displayDate(match.date)}.`, match, match.date);
        newCount += 1;
      }
      return;
    }
    if (old.date && old.date !== match.date) addChange('time', 'Orario modificato', `${match.home.name}–${match.away.name}: nuovo calcio d’inizio ${displayDate(match.date)} alle ${fmtTime.format(new Date(match.date))}.`, match, match.date);
    if (old.venue && match.venue && old.venue !== match.venue) addChange('venue', 'Sede aggiornata', `La partita ora risulta programmata a ${match.venue}.`, match, match.venue);
    if (old.state !== match.state) {
      if (match.state === 'in') addChange('live', 'Partita iniziata', `${match.home.name}–${match.away.name} è ora in diretta.`, match, 'live');
      if (match.state === 'post') addChange('final', 'Risultato finale', `${match.home.name} ${match.home.score}–${match.away.score} ${match.away.name}.`, match, `${match.home.score}-${match.away.score}`);
    }
    if ((match.state === 'in' || match.state === 'post') && (old.homeScore !== Number(match.home.score || 0) || old.awayScore !== Number(match.away.score || 0))) {
      addChange('score', 'Punteggio cambiato', `${match.home.name} ${match.home.score}–${match.away.score} ${match.away.name}.`, match, `${match.home.score}-${match.away.score}`);
    }
  });
  const nextLedger = { ...oldLedger };
  matches.forEach(match => { nextLedger[match.id] = fixtureSnapshot(match); });
  const entries = Object.entries(nextLedger).sort((a, b) => new Date(b[1].updatedAt || b[1].date) - new Date(a[1].updatedAt || a[1].date)).slice(0, 500);
  state.fixtureLedger = Object.fromEntries(entries);
  localStorage.setItem('vantaggio:fixtureLedger', JSON.stringify(state.fixtureLedger));
}

function persistModelSnapshots() {
  localStorage.setItem('vantaggio:modelSnapshots:v1', JSON.stringify(state.modelSnapshots));
}

function archivePreKickoffModel(match, analysis) {
  if (!match || !analysis?.probabilities || state.modelSnapshots[match.id]) return;
  const capturedAt = new Date();
  const kickoff = new Date(analysis.event?.date || match.date);
  if (match.state !== 'pre' || (analysis.event?.state && analysis.event.state !== 'pre') || Number.isNaN(kickoff.getTime()) || capturedAt.getTime() >= kickoff.getTime()) return;
  state.modelSnapshots[match.id] = {
    eventId: match.id, capturedAt: capturedAt.toISOString(), kickoff: kickoff.toISOString(),
    leagueId: match.league.id, leagueLabel: match.league.label,
    home: match.home.name, away: match.away.name,
    probabilities: { home: Number(analysis.probabilities.home), draw: Number(analysis.probabilities.draw), away: Number(analysis.probabilities.away) },
    quality: Number(analysis.engine?.quality || 0), engine: analysis.engine?.version || analysis.engine?.name || 'Power Model',
    topSignal: analysis.signals?.[0] ? { code: analysis.signals[0].code, label: analysis.signals[0].label, probability: analysis.signals[0].probability } : null
  };
  persistModelSnapshots();
}

function reconcileModelSnapshots(matches) {
  let changed = false;
  matches.filter(match => match.state === 'post').forEach(match => {
    const snapshot = state.modelSnapshots[match.id];
    if (!snapshot || snapshot.settledAt) return;
    const homeScore = Number(match.home.score); const awayScore = Number(match.away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
    const actual = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const probabilities = snapshot.probabilities;
    const predicted = ['home', 'draw', 'away'].sort((a, b) => probabilities[b] - probabilities[a])[0];
    const brier = ['home', 'draw', 'away'].reduce((sum, key) => sum + ((probabilities[key] / 100) - (key === actual ? 1 : 0)) ** 2, 0) / 2;
    snapshot.result = { homeScore, awayScore, actual, predicted, hit: predicted === actual, brier: Math.round(brier * 1000) / 1000 };
    snapshot.settledAt = new Date().toISOString();
    changed = true;
  });
  if (changed) persistModelSnapshots();
}

async function reconcilePendingModels() {
  if (state.modelReconciling || Date.now() - state.lastModelReconcileAt < 10 * 60_000) return;
  const pending = Object.values(state.modelSnapshots).filter(item => !item.result && new Date(item.kickoff).getTime() < Date.now() - 2 * 3600_000).slice(0, 6);
  if (!pending.length) return;
  state.modelReconciling = true;
  state.lastModelReconcileAt = Date.now();
  try {
    const settled = await Promise.allSettled(pending.map(item => api(`/api/analysis?event=${encodeURIComponent(item.eventId)}&league=${encodeURIComponent(item.leagueId)}`)));
    const completed = settled.filter(item => item.status === 'fulfilled' && (item.value.data?.event?.state === 'post' || item.value.data?.event?.completed)).map(item => {
      const event = item.value.data.event;
      return { id: event.id, state: 'post', home: { score: event.home.score }, away: { score: event.away.score } };
    });
    if (completed.length) { reconcileModelSnapshots(completed); if (state.currentView === 'dashboard') render(); }
  } finally { state.modelReconciling = false; }
}

function modelTrackStats() {
  const all = Object.values(state.modelSnapshots).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  const settled = all.filter(item => item.result);
  const hits = settled.filter(item => item.result.hit).length;
  const accuracy = settled.length ? Math.round(hits / settled.length * 100) : null;
  const averageConfidence = settled.length ? Math.round(settled.reduce((sum, item) => sum + Math.max(item.probabilities.home, item.probabilities.draw, item.probabilities.away), 0) / settled.length) : null;
  return {
    all, settled, pending: all.length - settled.length, hits, accuracy, averageConfidence,
    calibrationGap: settled.length ? accuracy - averageConfidence : null,
    brier: settled.length ? Math.round(settled.reduce((sum, item) => sum + item.result.brier, 0) / settled.length * 1000) / 1000 : null
  };
}

function applyMatches(payload) {
  const previous = Object.fromEntries(state.matches.map(match => [match.id, match.state]));
  const incoming = payload.data?.matches || [];
  trackFixtureChanges(incoming);
  state.matches = incoming;
  reconcileModelSnapshots(state.matches);
  void reconcilePendingModels();
  state.coverage = payload.data?.coverage || { competitions: new Set(state.matches.map(match => match.league.id)).size, globalCalendar: false };
  state.dataMeta.matches = payload.meta || null;
  delete state.errors.matches;
  state.matches.forEach(match => {
    if (state.favorites.has(match.id)) state.favoriteSnapshots[match.id] = match;
    const oldState = previous[match.id] || state.lastStates[match.id];
    if (state.alertsEnabled && state.favorites.has(match.id) && oldState === 'pre' && match.state === 'in') {
      notifyLive(match);
    }
    state.lastStates[match.id] = match.state;
  });
  saveFavorites();
  void runKickoffWatch();
}

async function runKickoffWatch() {
  if (state.kickoffRunning || !state.favorites.size) return;
  const candidates = state.matches.filter(match => {
    const minutes = (new Date(match.date).getTime() - Date.now()) / 60000;
    return state.favorites.has(match.id) && match.state === 'pre' && minutes >= -2 && minutes <= 65;
  }).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
  if (!candidates.length) return;
  state.kickoffRunning = true;
  try {
    for (const match of candidates) {
      const minutes = Math.max(0, Math.round((new Date(match.date).getTime() - Date.now()) / 60000));
      const threshold = minutes <= 10 ? 10 : minutes <= 30 ? 30 : 60;
      const checkKey = `${match.id}:${threshold}`;
      if (state.kickoffChecks[checkKey]) continue;
      state.kickoffChecks[checkKey] = new Date().toISOString();
      localStorage.setItem('vantaggio:kickoffChecks', JSON.stringify(state.kickoffChecks));
      const key = `${match.league.id}:${match.id}`;
      const previousIntel = state.intelligence[key];
      try {
        const [analysisPayload, intelPayload] = await Promise.all([
          api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}&fresh=1`),
          api(`/api/intelligence?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}&fresh=1`)
        ]);
        state.analyses[key] = analysisPayload.data;
        archivePreKickoffModel(match, analysisPayload.data);
        state.intelligence[key] = intelPayload.data;
        addChange('kickoff', `Kickoff Watch · ${threshold}'`, `Dossier ricontrollato: ${match.home.name}–${match.away.name}.`, match, `${threshold}:${intelPayload.data.generatedAt}`);
        if (!previousIntel?.lineups?.official && intelPayload.data.lineups?.official) addChange('lineup', 'Formazioni ufficiali pubblicate', `Gli undici di ${match.home.name}–${match.away.name} sono disponibili nel dossier.`, match, 'official');
        const previousNews = new Set((previousIntel?.news?.articles || []).map(article => article.id));
        const newNews = (intelPayload.data.news?.articles || []).filter(article => !previousNews.has(article.id));
        if (previousIntel && newNews.length) addChange('news', 'Nuovi segnali pre-partita', `${newNews.length} nuovi titoli collegati a ${match.home.name}–${match.away.name}.`, match, `${threshold}:${newNews.map(article => article.id).join(',')}`);
        if (state.alertsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`Kickoff Watch · ${threshold} minuti`, { body: `${match.home.name}–${match.away.name}: dossier aggiornato${intelPayload.data.lineups?.official ? ', formazioni ufficiali disponibili' : ''}.`, icon: match.home.logo || '/favicon.svg' });
        }
      } catch {
        delete state.kickoffChecks[checkKey];
        localStorage.setItem('vantaggio:kickoffChecks', JSON.stringify(state.kickoffChecks));
      }
    }
  } finally {
    state.kickoffRunning = false;
    if (['dashboard', 'favorites'].includes(state.currentView)) render();
  }
}

function applyNews(payload) {
  state.news = payload.data?.articles || [];
  state.dataMeta.news = payload.meta || null;
  delete state.errors.news;
}

async function refreshAll(manual = false) {
  if (state.refreshing) return;
  state.refreshing = true;
  $('#refreshButton')?.classList.add('spinning');
  updateSyncStatus(true);
  const romeToday = localDateKey(new Date());
  if (romeToday !== state.today) {
    try {
      const status = await api('/api/status');
      state.today = status.today || romeToday;
      state.leagues = status.leagues || state.leagues;
      state.standingsLeagues = status.standingsLeagues || state.standingsLeagues;
    } catch {
      state.today = romeToday;
    }
    state.selectedDate = 'all';
    state.analyses = {};
    state.analysisErrors = {};
    state.intelligence = {};
    state.powerPicks = [];
  }
  const suffix = manual ? '&fresh=1' : '';
  const from = addDays(state.today, -1);
  const to = addDays(state.today, 13);
  const [matches, news, health] = await Promise.allSettled([
    api(`/api/matches?league=all&from=${from}&to=${to}${suffix}`),
    api(`/api/news?auto=1${manual ? '&fresh=1' : ''}`),
    api('/api/health')
  ]);
  if (matches.status === 'fulfilled') applyMatches(matches.value);
  else state.errors.matches = matches.reason.message;
  if (news.status === 'fulfilled') applyNews(news.value);
  else state.errors.news = news.reason.message;
  if (health.status === 'fulfilled') state.sourceHealth = health.value;
  state.refreshing = false;
  $('#refreshButton')?.classList.remove('spinning');
  updateSyncStatus();
  updateBadges();
  render();
  if (manual) {
    state.powerPicks = [];
    loadPowerPicks();
    toast(matches.status === 'fulfilled' ? 'Dati aggiornati correttamente' : 'Alcune fonti non rispondono', matches.status !== 'fulfilled');
  }
}

async function loadStandings(leagueId, force = false) {
  state.standingsLeague = leagueId;
  if (state.tables[leagueId] && !force) return;
  delete state.errors.standings;
  if (state.currentView === 'standings') render();
  try {
    const payload = await api(`/api/standings?league=${encodeURIComponent(leagueId)}${force ? '&fresh=1' : ''}`);
    state.tables[leagueId] = payload.data;
    delete state.errors.standings;
  } catch (error) {
    state.errors.standings = error.message;
  }
  if (state.currentView === 'standings') render();
}

function updateSyncStatus(loading = false) {
  const el = $('#syncStatus');
  const sourceDot = $('.source-dot');
  if (!el) return;
  el.className = 'sync-status';
  if (loading) {
    el.innerHTML = '<i></i><span>Sincronizzazione...</span>';
    return;
  }
  const failed = state.errors.matches && state.errors.news;
  if (failed) {
    el.classList.add('error');
    el.innerHTML = '<i></i><span>Fonti non disponibili</span>';
    sourceDot?.classList.add('error');
  } else {
    el.classList.add('ok');
    const updated = state.dataMeta.matches?.fetchedAt || new Date().toISOString();
    el.innerHTML = `<i></i><span>Aggiornato ${escapeHtml(relativeTime(updated))}</span>`;
    sourceDot?.classList.remove('error');
  }
}

function goTo(view) {
  const allowed = ['dashboard', 'matches', 'radar', 'news', 'standings', 'favorites'];
  state.currentView = allowed.includes(view) ? view : 'dashboard';
  if (location.hash !== `#${state.currentView}`) history.pushState(null, '', `#${state.currentView}`);
  $$('.nav-item, .mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === state.currentView));
  closeSearch();
  render();
  $('#mainContent')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (state.currentView === 'standings') loadStandings(state.standingsLeague);
}

function render() {
  const main = $('#mainContent');
  if (!main) return;
  if (state.loading) return;
  $$('.nav-item, .mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === state.currentView));
  const renderers = {
    dashboard: renderDashboard,
    matches: renderMatchesView,
    radar: renderRadarView,
    news: renderNewsView,
    standings: renderStandingsView,
    favorites: renderFavoritesView
  };
  main.innerHTML = (renderers[state.currentView] || renderDashboard)();
}

function viewHeader(eyebrow, title, subtitle, actions = '') {
  return `<header class="view-header"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="page-title">${title}</h1><p class="view-subtitle">${escapeHtml(subtitle)}</p></div>${actions ? `<div class="view-actions">${actions}</div>` : ''}</header>`;
}

function filteredDashboardMatches() {
  return state.matches
    .filter(isUpcoming)
    .filter(match => state.dashboardLeague === 'all' || match.league.id === state.dashboardLeague)
    .sort((a, b) => {
      if (a.state === 'in' && b.state !== 'in') return -1;
      if (b.state === 'in' && a.state !== 'in') return 1;
      return new Date(a.date) - new Date(b.date);
    });
}

function radarMatches(limit = 20) {
  return state.matches
    .filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now())
    .sort((a, b) => b.opportunity - a.opportunity || new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

async function loadPowerPicks() {
  if (state.powerLoading) return;
  const ranked = radarMatches(30);
  const todayFirst = ranked.filter(match => localDateKey(match.date) === state.today);
  const candidates = [...todayFirst, ...ranked.filter(match => localDateKey(match.date) !== state.today)].slice(0, 5);
  if (!candidates.length) return;
  const signature = candidates.map(match => match.id).join(',');
  if (state.powerPicks.signature === signature && state.powerPicks.length) return;
  state.powerLoading = true;
  if (state.currentView === 'dashboard') render();
  const results = await Promise.allSettled(candidates.map(match => {
    const key = `${match.league.id}:${match.id}`;
    if (state.analyses[key]) return Promise.resolve({ match, analysis: state.analyses[key] });
    return api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}`).then(payload => {
      state.analyses[key] = payload.data;
      archivePreKickoffModel(match, payload.data);
      return { match, analysis: payload.data };
    });
  }));
  state.powerPicks = results.filter(item => item.status === 'fulfilled').map(item => item.value).sort((a, b) => {
    const aScore = (a.analysis.signals?.[0]?.probability || 0) * (a.analysis.engine?.quality || 0);
    const bScore = (b.analysis.signals?.[0]?.probability || 0) * (b.analysis.engine?.quality || 0);
    return bScore - aScore;
  }).slice(0, 4);
  state.powerPicks.signature = signature;
  state.powerLoading = false;
  if (state.currentView === 'dashboard') render();
}

function powerPickItem(item, index) {
  const signal = item.analysis.signals?.[0];
  if (!signal) return radarItem(item.match, index);
  return `<article class="power-pick" data-match="${escapeHtml(item.match.id)}" role="button" tabindex="0" aria-label="Apri l’analisi di ${escapeHtml(item.match.home.name)} contro ${escapeHtml(item.match.away.name)}"><span class="radar-rank">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(item.match.home.name)} — ${escapeHtml(item.match.away.name)}</strong><small>${escapeHtml(signal.label)} · qualità ${item.analysis.engine.quality}/100</small></div><b>${signal.probability}<small>%</small></b></article>`;
}

function competitionPulse(matches) {
  const counts = new Map();
  matches.forEach(match => counts.set(match.league.label, (counts.get(match.league.label) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ['Calendario globale', 0];
}

function changeIcon(kind) {
  return ({ new: 'star', time: 'clock', venue: 'ball', live: 'radar', final: 'shield', score: 'ball', lineup: 'table', news: 'news', kickoff: 'bell' })[kind] || 'info';
}

function changeDeskItem(item) {
  return `<button class="change-item ${item.seen ? '' : 'unread'}" data-match="${escapeHtml(item.eventId)}"><span class="change-icon">${icon(changeIcon(item.kind))}</span><div><small>${escapeHtml(item.title)} · ${escapeHtml(relativeTime(item.happenedAt))}</small><strong>${escapeHtml(item.home)} — ${escapeHtml(item.away)}</strong><p>${escapeHtml(item.text)}</p></div>${icon('chevron')}</button>`;
}

function kickoffWatchItem(match) {
  const minutes = Math.max(0, Math.round((new Date(match.date).getTime() - Date.now()) / 60000));
  const armed = minutes <= 65;
  return `<button class="kickoff-watch-item ${armed ? 'armed' : ''}" data-match="${escapeHtml(match.id)}"><span>${teamLogo(match.home, 'kickoff-logo')}${teamLogo(match.away, 'kickoff-logo')}</span><div><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><small>${escapeHtml(displayDate(match.date))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</small></div><b>${armed ? `T-${minutes}'` : countdownText(match)}</b></button>`;
}

function renderTrackRecord() {
  const stats = modelTrackStats();
  const recent = stats.settled.slice(0, 3);
  return `<article class="track-record"><header><div><span class="section-code">MODEL TRACK RECORD</span><h2>Pronostici congelati prima del via</h2></div><span class="track-lock">${icon('shield')} SOLO PRE-KICKOFF</span></header><div class="track-metrics"><div><strong>${stats.settled.length}</strong><span>verificati</span></div><div><strong>${stats.accuracy == null ? '–' : `${stats.accuracy}%`}</strong><span>esito 1-X-2</span></div><div><strong>${stats.brier == null ? '–' : stats.brier.toFixed(3)}</strong><span>Brier norm. · 0 meglio</span></div><div><strong>${stats.pending}</strong><span>in attesa</span></div></div><div class="track-results">${recent.length ? recent.map(item => `<div class="track-result ${item.result.hit ? 'hit' : 'miss'}"><span>${item.result.hit ? 'HIT' : 'MISS'}</span><strong>${escapeHtml(item.home)} ${item.result.homeScore}–${item.result.awayScore} ${escapeHtml(item.away)}</strong><small>${escapeHtml(item.result.predicted === 'home' ? item.home : item.result.predicted === 'away' ? item.away : 'Pareggio')} · Brier ${item.result.brier.toFixed(3)}</small></div>`).join('') : `<div class="specialty-empty compact">${icon('shield')}<div><strong>Archivio pronto</strong><p>La prima lettura vista prima del kickoff viene resa immutabile e valutata solo dopo il finale. Nessun backfill retroattivo.</p></div></div>`}</div><p class="desk-method">${stats.settled.length ? `Calibrazione: fiducia media ${stats.averageConfidence}%, accuratezza ${stats.accuracy}%, gap ${stats.calibrationGap > 0 ? '+' : ''}${stats.calibrationGap} punti. ` : ''}Archivio locale a questo browser: trasparente, gratuito e non condiviso tra dispositivi.</p></article>`;
}

function renderSourceHealth() {
  const snapshot = state.sourceHealth;
  const active = (snapshot?.sources || []).filter(source => source.calls).slice(0, 5);
  const healthy = active.filter(source => source.state === 'operativa' || source.state === 'operativa_con_errori').length;
  return `<article class="source-health"><header><div><span class="section-code">SOURCE HEALTH CENTER</span><h2>Fonti, freschezza e latenza</h2></div><span class="health-total"><i></i>${active.length ? `${healthy}/${active.length} operative` : 'telemetria in avvio'}</span></header><div class="source-health-list">${active.length ? active.map(source => `<div class="source-health-row"><span class="health-dot ${escapeHtml(source.state)}"></span><div><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(source.coverage || 'Copertura tecnica osservata')}</small><small>${source.lastSuccessAt ? `risposta ${escapeHtml(relativeTime(source.lastSuccessAt))}` : 'nessuna risposta valida'} · ${source.successes}/${source.calls} valide${source.failures ? ` · ${source.failures} errori` : ''}</small></div><b>${source.averageLatencyMs == null ? '–' : `${source.averageLatencyMs} ms`}</b></div>`).join('') : `<div class="specialty-empty compact">${icon('radar')}<div><strong>Misurazione in corso</strong><p>Il pannello si popola con le chiamate reali del server, senza esporre credenziali o URL sensibili.</p></div></div>`}</div><p class="desk-method">${escapeHtml(snapshot?.rule || 'Lo stato tecnico non equivale alla completezza editoriale della fonte.')}</p></article>`;
}

function renderDashboard() {
  const upcoming = filteredDashboardMatches();
  const radar = radarMatches(6);
  const todayItems = state.matches.filter(match => localDateKey(match.date) === state.today);
  const todayFeatured = todayItems.filter(isUpcoming).sort((a, b) => b.opportunity - a.opportunity);
  const featured = todayFeatured[0] || radar[0] || upcoming[0];
  const liveMatches = state.matches.filter(match => match.state === 'in');
  const in48h = state.matches.filter(match => { const hours = (new Date(match.date).getTime() - Date.now()) / 3600000; return hours >= 0 && hours <= 48; });
  const coveredCompetitions = state.coverage.competitions || new Set(state.matches.map(match => match.league.id)).size;
  const [busyLeague, busyCount] = competitionPulse(todayItems);
  const strongest = state.powerPicks[0];
  const recentChanges = state.changeLog.slice(0, 5);
  const unreadChanges = state.changeLog.filter(item => !item.seen).length;
  const watchedKickoffs = state.matches.filter(match => state.favorites.has(match.id) && match.state === 'pre').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
  const romeDateLabel = fmtLongDay.format(new Date(`${state.today}T12:00:00Z`));
  return `<div class="view dashboard-view v4-dashboard">
    ${renderHero(featured)}
    <section class="daily-briefing">
      <header><div><span class="broadcast-label"><i></i>DAILY BRIEFING</span><h2>${escapeHtml(romeDateLabel)}</h2></div><span class="briefing-sync">Europe/Rome · aggiornamento automatico</span></header>
      <div class="briefing-grid">
        <article class="briefing-card live-brief"><span>LIVE PULSE</span><strong>${liveMatches.length ? `${liveMatches.length} ${liveMatches.length === 1 ? 'partita in campo' : 'partite in campo'}` : 'Nessun live adesso'}</strong><p>${liveMatches.length ? `${liveMatches[0].home.name}–${liveMatches[0].away.name} guida il flusso live.` : `Il prossimo aggiornamento ricontrolla risultati e stati tra meno di 90 secondi.`}</p></article>
        <article class="briefing-card"><span>AGENDA</span><strong>${todayItems.length} oggi · ${in48h.length} entro 48h</strong><p>${busyCount ? `${busyLeague} è la competizione più presente oggi con ${busyCount} incontri.` : 'Il calendario si amplia quando le fonti pubblicano nuovi eventi.'}</p></article>
        <article class="briefing-card intelligence-brief"><span>INTELLIGENCE SIGNAL</span><strong>${strongest?.analysis?.signals?.[0] ? `${strongest.analysis.signals[0].label} · ${strongest.analysis.signals[0].probability}%` : featured ? 'Deep Analysis disponibile' : 'Analisi in preparazione'}</strong><p>${strongest ? `${strongest.match.home.name}–${strongest.match.away.name}, qualità dati ${strongest.analysis.engine.quality}/100.` : featured ? `Apri ${escapeHtml(featured.home.name)}–${escapeHtml(featured.away.name)} per il dossier con fonti, limiti e red flags.` : 'Il sistema sta selezionando le partite con il campione più leggibile.'}</p></article>
        <article class="briefing-card coverage-brief"><span>COVERAGE DESK</span><strong>${coveredCompetitions} competizioni monitorate</strong><p>Calendario globale, feed gratuiti e controlli di qualità senza abbonamenti.</p></article>
      </div>
    </section>
    <section class="specialty-deck">
      <article class="change-desk"><header><div><span class="section-code">WHAT CHANGED DESK</span><h2>Cosa è cambiato dall’ultima visita</h2></div>${unreadChanges ? `<button data-read-changes>Segna letti <b>${unreadChanges}</b></button>` : '<span class="desk-clear">Tutto letto</span>'}</header><div>${recentChanges.length ? recentChanges.map(changeDeskItem).join('') : `<div class="specialty-empty">${icon('shield')}<div><strong>Baseline attiva</strong><p>Da questo momento confronterò orari, sedi, stati, punteggi, formazioni e nuovi eventi con la visita precedente.</p></div></div>`}</div></article>
      <article class="kickoff-watch"><header><div><span class="section-code">KICKOFF WATCH</span><h2>Controllo 60' · 30' · 10'</h2></div><span class="watch-status"><i></i>${state.alertsEnabled ? 'ALERT ON' : 'MONITOR'}</span></header><p class="kickoff-intro">Le partite salvate vengono ricontrollate vicino al calcio d’inizio: dossier, news e formazioni senza chiamate continue.</p><div>${watchedKickoffs.length ? watchedKickoffs.map(kickoffWatchItem).join('') : `<div class="specialty-empty compact">${icon('star')}<div><strong>Nessuna partita sorvegliata</strong><p>Salva una partita: entrerà automaticamente nel Kickoff Watch.</p></div></div>`}</div></article>
    </section>
    <section class="operations-deck">${renderTrackRecord()}${renderSourceHealth()}</section>
    <div class="dashboard-grid editorial-dashboard-grid">
      <section class="section-card matches-card command-card">
        <header class="section-head"><div><span class="section-code">MATCHDAY CONTROL</span><h2>Oggi sul campo</h2><p>${todayItems.length} partite oggi · poi i prossimi appuntamenti</p></div><button class="section-link" data-view="matches">Apri regia ${icon('chevron')}</button></header>
        ${leagueFilters(state.dashboardLeague, 'dashboard-league')}
        ${state.errors.matches && !state.matches.length ? errorBlock(state.errors.matches, true) : (upcoming.length ? `<div class="match-list">${upcoming.slice(0, 7).map(matchRow).join('')}</div>` : emptyInline('Nessuna partita nel periodo selezionato'))}
      </section>
      <section class="section-card radar-card signal-card">
        <header class="section-head"><div><span class="section-code">SIGNAL DESK</span><h2>Power Picks</h2><p>Priorità, robustezza e rischio prima del pronostico</p></div><button class="section-link" data-view="radar">Apri studio ${icon('chevron')}</button></header>
        <div class="radar-list">${state.powerPicks.length ? state.powerPicks.map(powerPickItem).join('') : state.powerLoading ? `<div class="power-picks-loading"><i></i><i></i><i></i></div>` : (radar.length ? radar.slice(0, 5).map((match, index) => radarItem(match, index)).join('') : emptyInline('In attesa delle prossime partite'))}</div>
        <div class="radar-disclaimer">${icon('info')}<span>Priorità non significa certezza: apri il dossier per controllare contesto, formazione e qualità del campione.</span></div>
      </section>
    </div>
  </div>`;
}

function renderHero(match) {
  if (!match) {
    return `<section class="hero-card"><div class="hero-copy"><span class="hero-kicker"><i></i>INTELLIGENZA CALCISTICA</span><h1>Il calcio,<br><em>letto meglio.</em></h1><p>Risultati, notizie e classifiche in un’unica esperienza ordinata. I dati si aggiorneranno appena le fonti torneranno disponibili.</p><button class="hero-button" data-view="news">Esplora le notizie ${icon('arrow')}</button></div></section>`;
  }
  const status = statusMarkup(match);
  const power = state.analyses[`${match.league.id}:${match.id}`];
  const powerSignal = power?.signals?.[0];
  return `<section class="hero-card">
    <div class="hero-copy"><span class="hero-kicker"><i></i>MATCH INTELLIGENCE · DATI LIVE</span><h1>Il calcio,<br><em>letto a fondo.</em></h1><p>Numeri, contesto, calendario, tattica e segnali dal campo. Apri una partita per scoprire cosa conta davvero prima del calcio d’inizio.</p><button class="hero-button" data-match="${escapeHtml(match.id)}">Analisi potente ${icon('arrow')}</button></div>
    <button class="hero-feature" data-match="${escapeHtml(match.id)}" aria-label="Analizza ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}">
      <div class="hero-feature-top"><span class="hero-feature-label">IN EVIDENZA · ${escapeHtml(match.league.label)}</span><span class="score-ring" style="--score:${match.opportunity}"><span>${match.opportunity}</span></span></div>
      <div class="hero-fixture"><div class="hero-team">${teamLogo(match.home, 'hero-logo')}<strong>${escapeHtml(match.home.name)}</strong></div><div class="hero-vs"><strong>${escapeHtml(status.main)}</strong><span>${match.state === 'pre' ? escapeHtml(displayDate(match.date)) : escapeHtml(status.sub)}</span></div><div class="hero-team">${teamLogo(match.away, 'hero-logo')}<strong>${escapeHtml(match.away.name)}</strong></div></div>
      <div class="hero-insight">${icon('radar')}<div><strong>${powerSignal ? `${escapeHtml(powerSignal.label)} · ${powerSignal.probability}%` : 'Deep Analysis disponibile'}</strong><span>${powerSignal ? `Segnale tecnico · qualità dati ${power.engine.quality}/100 · apri per verificare il contesto` : 'Apri il dossier editoriale: fatti, forma, contesto, limiti e fonti distinti con chiarezza.'}</span></div></div>
    </button>
  </section>`;
}

function metric(iconName, value, label, color) {
  return `<article class="metric-card"><div class="metric-icon ${color}">${icon(iconName)}</div><div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div></article>`;
}

function leagueFilters(active, dataName) {
  const priority = ['all', 'ita.1', 'eng.1', 'esp.1', 'ger.1', 'fra.1', 'uefa.champions'];
  return `<div class="filter-row"><button class="filter-chip ${active === 'all' ? 'active' : ''}" data-${dataName}="all">Tutte</button>${priority.slice(1).map(id => {
    const league = getLeague(id);
    return `<button class="filter-chip ${active === id ? 'active' : ''}" data-${dataName}="${id}">${escapeHtml(league.label)}</button>`;
  }).join('')}</div>`;
}

function matchRow(match) {
  const status = statusMarkup(match);
  const favorite = state.favorites.has(match.id);
  const dossier = state.intelligence[`${match.league.id}:${match.id}`];
  return `<article class="match-row">
    <button class="match-open-button" data-match="${escapeHtml(match.id)}" aria-label="Apri l’analisi di ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}"></button>
    <div class="match-meta"><span class="match-league"><i style="--league:${escapeHtml(match.league.accent)}"></i>${escapeHtml(match.league.label)}<b class="power-mini">DEEP</b></span><span class="match-date">${escapeHtml(displayDate(match.date))}</span></div>
    <div class="match-team home">${teamLogo(match.home)}<div><strong>${escapeHtml(match.home.name)}</strong>${formMarkup(match.home.form)}</div></div>
    <div class="match-center ${status.className}"><span class="match-time ${match.state === 'in' ? 'live-pill' : ''}">${escapeHtml(status.main)}</span><span class="match-status">${escapeHtml(status.sub)}</span></div>
    <div class="match-team away">${teamLogo(match.away)}<div><strong>${escapeHtml(match.away.name)}</strong>${formMarkup(match.away.form)}</div></div>
    <div class="opportunity-cell"><strong>${match.opportunity}/100</strong><span>${dossier ? (dossier.deepDive?.mode === 'post' ? 'Review pronta' : 'Analisi pronta') : 'Analisi profonda'}</span></div>
    <button class="favorite-button ${favorite ? 'active' : ''}" data-favorite="${escapeHtml(match.id)}" aria-label="${favorite ? 'Rimuovi dai' : 'Aggiungi ai'} preferiti">${icon('star')}</button>
  </article>`;
}

function radarItem(match, index) {
  const analysis = state.analyses[`${match.league.id}:${match.id}`];
  const signal = analysis?.signals?.[0];
  return `<article class="radar-item" data-match="${escapeHtml(match.id)}" role="button" tabindex="0" aria-label="Apri l’analisi di ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}"><span class="radar-rank">${String(index + 1).padStart(2, '0')}</span><div class="radar-names"><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${signal ? `${escapeHtml(signal.label)} · ${signal.probability}%` : `Deep Research · ${escapeHtml(displayDate(match.date))}`}</span></div><div class="radar-score"><strong>${match.opportunity}</strong><span>indice</span></div></article>`;
}

function newsCard(article) {
  const image = safeUrl(article.image);
  const style = image ? ` style="background-image:url('${escapeHtml(image.replaceAll("'", '%27'))}')"` : '';
  return `<article class="news-card ${image ? 'has-image' : ''}" data-news-url="${escapeHtml(safeUrl(article.link))}"${style} tabindex="0">
    <span class="news-source"><i></i>${escapeHtml(article.source)}</span>
    <h3>${escapeHtml(article.title)}</h3>
    ${article.description ? `<p>${escapeHtml(article.description)}</p>` : ''}
    <div class="news-meta"><span>${article.published ? escapeHtml(relativeTime(article.published)) : 'Ultimo aggiornamento'}</span>${icon('external')}</div>
  </article>`;
}

function renderMatchesView() {
  const dates = Array.from({ length: 12 }, (_, index) => addDays(state.today, index - 1));
  const matches = state.matches
    .filter(match => state.matchLeague === 'all' || match.league.id === state.matchLeague)
    .filter(match => state.selectedDate === 'all' || localDateKey(match.date) === state.selectedDate)
    .filter(match => state.selectedDate !== 'all' || isUpcoming(match))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const groups = Object.groupBy ? Object.groupBy(matches, match => localDateKey(match.date)) : matches.reduce((acc, match) => ((acc[localDateKey(match.date)] ||= []).push(match), acc), {});
  const availableLeagues = [...new Map([...state.leagues, ...state.matches.map(match => match.league)].map(league => [league.id, league])).values()].sort((a, b) => a.label.localeCompare(b.label, 'it'));
  const leagueOptions = [`<option value="all">Tutte le competizioni</option>`, ...availableLeagues.map(league => `<option value="${league.id}" ${state.matchLeague === league.id ? 'selected' : ''}>${escapeHtml(league.label)}</option>`)].join('');
  const live = matches.filter(match => match.state === 'in');
  const next = matches.find(match => match.state === 'pre');
  const uniqueCompetitions = new Set(matches.map(match => match.league.id)).size;
  const [busyLeague, busyCount] = competitionPulse(matches);
  return `<div class="view matches-view v4-matchday">
    ${viewHeader('MATCHDAY COMMAND', 'Tutte le partite', 'Una regia temporale: live, prossimi calci d’inizio, densità del programma e accesso immediato ai dossier.', `<button class="button" id="viewRefresh">${icon('refresh')} Sincronizza</button>`)}
    <section class="matchday-console">
      <article class="console-clock"><span>ORA UFFICIALE</span><strong>${escapeHtml(fmtTime.format(new Date()))}</strong><small>Europe/Rome</small></article>
      <article class="console-live ${live.length ? 'is-live' : ''}"><span><i></i>LIVE CONTROL</span><strong>${live.length ? `${live.length} in campo` : 'Stand-by'}</strong><small>${live[0] ? `${live[0].home.name}–${live[0].away.name}` : 'Nessun incontro live nel filtro'}</small></article>
      <article class="console-next"><span>PROSSIMO KICK-OFF</span>${next ? `<div>${teamLogo(next.home, 'console-logo')}<strong>${escapeHtml(next.home.name)}<i>vs</i>${escapeHtml(next.away.name)}</strong>${teamLogo(next.away, 'console-logo')}</div><small>${escapeHtml(displayDate(next.date))} · ${escapeHtml(fmtTime.format(new Date(next.date)))}</small>` : '<strong>Nessun evento</strong>'}</article>
      <article class="console-density"><span>PROGRAMMA</span><strong>${matches.length} gare · ${uniqueCompetitions} tornei</strong><small>${busyCount ? `${escapeHtml(busyLeague)} guida con ${busyCount}` : 'Filtro senza eventi'}</small></article>
    </section>
    <section class="controls-card command-controls"><div class="date-strip"><button class="date-button ${state.selectedDate === 'all' ? 'active' : ''}" data-date="all"><span>Regia</span><strong>Tutte</strong></button>${dates.map(date => `<button class="date-button ${state.selectedDate === date ? 'active' : ''}" data-date="${date}"><span>${escapeHtml(date === addDays(state.today, -1) ? 'Ieri' : date === state.today ? 'Oggi' : new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)))}</span><strong>${date.slice(8)}</strong><i>${state.matches.filter(match => localDateKey(match.date) === date).length}</i></button>`).join('')}</div><select class="select-control" id="matchLeagueSelect" aria-label="Filtra competizione">${leagueOptions}</select></section>
    ${state.errors.matches && !state.matches.length ? errorBlock(state.errors.matches) : (matches.length ? `<div class="matchday-days">${Object.entries(groups).map(([date, items], dayIndex) => { const liveDay = items.filter(item => item.state === 'in').length; const dayCompetitions = new Set(items.map(item => item.league.id)).size; return `<section class="day-group command-day"><header class="day-heading"><div><span>${String(dayIndex + 1).padStart(2, '0')}</span><strong>${escapeHtml(date === state.today ? `Oggi · ${displayDate(`${date}T12:00:00Z`, true)}` : displayDate(`${date}T12:00:00Z`, true))}</strong></div><p>${liveDay ? `<b>${liveDay} LIVE</b>` : ''}<span>${items.length} gare · ${dayCompetitions} competizioni</span></p></header><div class="match-list">${items.map(matchRow).join('')}</div></section>`; }).join('')}</div>` : emptyState('ball', 'Nessuna partita trovata', 'Prova una data o una competizione diversa. Il calendario si aggiorna automaticamente quando le fonti pubblicano nuovi incontri.'))}
  </div>`;
}

function radarSpotlight(match, index) {
  const analysis = state.analyses[`${match.league.id}:${match.id}`];
  const signal = analysis?.signals?.[0];
  const labels = ['PRIORITÀ DEL GIORNO', 'SECONDA LETTURA', 'OUTSIDER DA STUDIARE'];
  return `<article class="radar-spotlight rank-${index + 1}" data-match="${escapeHtml(match.id)}" role="button" tabindex="0" aria-label="Apri l’analisi di ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}"><header><span>${labels[index]}</span><b>${String(index + 1).padStart(2, '0')}</b></header><div class="radar-spotlight-teams"><div>${teamLogo(match.home, 'spotlight-logo')}<strong>${escapeHtml(match.home.name)}</strong></div><i>—</i><div>${teamLogo(match.away, 'spotlight-logo')}<strong>${escapeHtml(match.away.name)}</strong></div></div><div class="spotlight-signal"><span>${signal ? escapeHtml(signal.label) : 'Deep Research'}</span><strong>${signal ? signal.probability : match.opportunity}<small>${signal ? '%' : '/100'}</small></strong></div><footer><span>${escapeHtml(match.league.label)}</span><span>${escapeHtml(displayDate(match.date))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</span><span>Rischio ${escapeHtml(analysis?.assessment?.risk || 'da verificare')}</span></footer></article>`;
}

function radarTableRow(match, index) {
  const analysis = state.analyses[`${match.league.id}:${match.id}`];
  const signal = analysis?.signals?.[0];
  const risk = analysis?.assessment?.risk || 'Da verificare';
  const riskClass = risk === 'Alto' ? 'high' : risk === 'Basso' ? 'low' : '';
  return `<article class="radar-table-row" data-match="${escapeHtml(match.id)}" role="button" tabindex="0" aria-label="Apri l’analisi di ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}"><span class="radar-position">${index + 1}</span><div class="radar-match-main"><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</span></div><span class="insight-badge">${signal ? `${escapeHtml(signal.label)} · ${signal.probability}%` : 'Deep Research'}</span><span class="risk-badge ${riskClass}"><i></i>${escapeHtml(risk)}</span><span class="radar-value">${match.opportunity}<small>/100</small></span>${icon('chevron')}</article>`;
}

function renderRadarView() {
  const matches = radarMatches(30);
  const podium = matches.slice(0, 3);
  const highIndex = matches.filter(match => match.opportunity >= 75).length;
  const dossierAccess = matches.length ? 100 : 0;
  return `<div class="view radar-view v4-radar">
    ${viewHeader('SIGNAL STUDIO', 'Match Radar', 'Non una lista di pronostici: una sala di selezione che separa interesse, robustezza del campione e rischio contestuale.')}
    <section class="radar-studio-hero"><div><span class="broadcast-label"><i></i>MODEL ROOM</span><h2>Prima scegli cosa merita attenzione.<br><em>Poi verifica perché.</em></h2><p>Il Radar ordina il calendario; il dossier Intelligence controlla aggregato, riposo, stili, formazioni e red flags. Un indice alto senza contesto non basta.</p></div><div class="studio-orbit"><span><b>${matches.length}</b>gare lette</span><span><b>${highIndex}</b>indice 75+</span><span><b>${dossierAccess}%</b>accesso dossier</span></div></section>
    ${podium.length ? `<section class="radar-podium">${podium.map(radarSpotlight).join('')}</section>` : ''}
    ${matches.length ? `<section class="radar-table studio-table"><header class="section-head"><div><span class="section-code">RANKING COMPLETO</span><h2>Tavolo di selezione</h2><p>Tutte le partite ordinate per interesse analitico</p></div></header><header class="radar-table-head"><span>#</span><span>Partita</span><span>Lettura</span><span>Rischio</span><span>Indice</span><span></span></header>${matches.map(radarTableRow).join('')}</section>` : emptyState('radar', 'Radar in attesa', 'Nessun incontro futuro disponibile nel periodo monitorato.')}
  </div>`;
}

function newsTopic(article) {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  if (/mercato|transfer|acquist|cessione|firma|contratto/.test(text)) return 'Mercato';
  if (/infortun|assen|squalif|recuper|rientr/.test(text)) return 'Disponibilità';
  if (/champions|europa league|conference|uefa/.test(text)) return 'Coppe europee';
  if (/nazionale|mondial|europeo|fifa/.test(text)) return 'Nazionali';
  if (/intervista|dichiar|conferenza|allenatore/.test(text)) return 'Voci dal campo';
  return 'Calcio';
}

function newsroomSideStory(article, index) {
  return `<article class="newsroom-side-story" data-news-url="${escapeHtml(safeUrl(article.link))}" tabindex="0"><span>${String(index + 2).padStart(2, '0')} · ${escapeHtml(newsTopic(article))}</span><h3>${escapeHtml(article.title)}</h3><footer><b>${escapeHtml(article.source)}</b><small>${article.published ? escapeHtml(displayNewsDate(article.published)) : 'Ora'}</small>${icon('arrow')}</footer></article>`;
}

function renderNewsView() {
  const sources = [...new Set(state.news.map(article => article.source))];
  const articles = state.newsSource === 'all' ? state.news : state.news.filter(article => article.source === state.newsSource);
  const updated = state.dataMeta.news?.fetchedAt;
  const lead = articles[0];
  const leadImage = lead ? safeUrl(lead.image) : '';
  const sourceCounts = sources.map(source => ({ source, count: state.news.filter(article => article.source === source).length }));
  return `<div class="view news-view v4-newsroom">
    ${viewHeader('VANTAGGIO NEWSROOM', 'Notizie', 'Una prima pagina viva: gerarchia editoriale, temi riconoscibili, data e fonte sempre in evidenza.', `<button class="button" id="viewRefresh">${icon('refresh')} Aggiorna redazione</button>`)}
    <section class="newsroom-status"><div><span class="broadcast-label"><i></i>NEWS DESK LIVE</span><strong>${articles.length} articoli disponibili</strong></div><div class="source-ticker">${sourceCounts.map(item => `<span><b>${item.count}</b>${escapeHtml(item.source)}</span>`).join('')}</div><small>${updated ? `Ultimo desk ${escapeHtml(relativeTime(updated))}` : 'Sincronizzazione in corso'}</small></section>
    <section class="news-toolbar editorial-toolbar"><div class="filter-row"><button class="filter-chip ${state.newsSource === 'all' ? 'active' : ''}" data-news-source="all">Prima pagina</button>${sources.map(source => `<button class="filter-chip ${state.newsSource === source ? 'active' : ''}" data-news-source="${escapeHtml(source)}">${escapeHtml(source)}</button>`).join('')}</div></section>
    ${state.errors.news && !state.news.length ? errorBlock(state.errors.news) : (articles.length ? `<section class="front-page"><article class="lead-story ${leadImage ? 'has-image' : ''}" data-news-url="${escapeHtml(safeUrl(lead.link))}" tabindex="0"${leadImage ? ` style="--lead-image:url('${escapeHtml(leadImage.replaceAll("'", '%27'))}')"` : ''}><div class="lead-story-shade"></div><div class="lead-story-content"><span>${escapeHtml(newsTopic(lead))} · APERTURA</span><h2>${escapeHtml(lead.title)}</h2>${lead.description ? `<p>${escapeHtml(lead.description)}</p>` : ''}<footer><b>${escapeHtml(lead.source)}</b><small>${lead.published ? escapeHtml(displayNewsDate(lead.published)) : 'Ultimo aggiornamento'}</small><i>Leggi alla fonte ${icon('external')}</i></footer></div></article><div class="front-page-side">${articles.slice(1, 4).map(newsroomSideStory).join('') || '<div class="intel-empty">Altri titoli in arrivo.</div>'}</div></section><section class="news-archive"><header class="plain-section-head"><div><span class="section-code">ULTIME EDIZIONI</span><h2>Il resto del flusso</h2><p>Ogni scheda apre direttamente la fonte originale</p></div></header><div class="news-grid">${articles.slice(4).map(newsCard).join('') || articles.slice(1).map(newsCard).join('')}</div></section>` : emptyState('news', 'Nessuna notizia', 'Non ci sono articoli per questa fonte. Seleziona “Prima pagina”.'))}
  </div>`;
}

function renderStandingsView() {
  const data = state.tables[state.standingsLeague];
  const options = (state.standingsLeagues.length ? state.standingsLeagues : state.leagues.filter(league => !league.id.startsWith('uefa.'))).map(league => `<option value="${league.id}" ${state.standingsLeague === league.id ? 'selected' : ''}>${escapeHtml(league.label)}</option>`).join('');
  const actions = `<select class="select-control" id="standingsLeagueSelect" aria-label="Scegli classifica">${options}</select>`;
  let content;
  if (!data && state.errors.standings) content = errorBlock(state.errors.standings);
  else if (!data) content = `<section class="standings-card"><div class="skeleton sk-list"></div></section>`;
  else if (!data.table?.length) content = emptyState('table', 'Classifica non ancora disponibile', 'La nuova stagione potrebbe non essere iniziata. La tabella apparirà appena pubblicata dalla fonte.');
  else {
    const table = data.table;
    const started = table.some(row => row.played > 0);
    const activeRows = table.filter(row => row.played > 0);
    const leader = table[0];
    const second = table[1];
    const bestAttack = [...activeRows].sort((a, b) => b.goalsFor - a.goalsFor)[0];
    const bestDefense = [...activeRows].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
    const titleGap = started && second ? leader.points - second.points : 0;
    const games = activeRows.reduce((sum, row) => sum + row.played, 0) / 2;
    const goals = activeRows.reduce((sum, row) => sum + row.goalsFor, 0);
    const goalsPerGame = games ? Math.round((goals / games) * 10) / 10 : 0;
    const sixth = table[Math.min(5, table.length - 1)];
    const spread = started && sixth ? leader.points - sixth.points : 0;
    const pulse = started ? `<div class="league-pulse-grid"><article class="leader-pulse">${teamLogo({ ...leader.team, abbreviation: leader.team.name.slice(0, 3) }, 'pulse-logo')}<div><span>CAPOLISTA</span><strong>${escapeHtml(leader.team.name)}</strong><small>${leader.points} punti · ${titleGap ? `+${titleGap} sulla seconda` : 'classifica serrata'}</small></div></article><article><span>MIGLIOR ATTACCO</span><strong>${escapeHtml(bestAttack?.team.name || 'Dati in attesa')}</strong><small>${bestAttack ? `${bestAttack.goalsFor} gol segnati` : 'Campione non disponibile'}</small></article><article><span>MIGLIOR DIFESA</span><strong>${escapeHtml(bestDefense?.team.name || 'Dati in attesa')}</strong><small>${bestDefense ? `${bestDefense.goalsAgainst} gol subiti` : 'Campione non disponibile'}</small></article><article><span>RITMO DEL TORNEO</span><strong>${goalsPerGame}</strong><small>gol per partita disputata</small></article></div>` : `<div class="league-pulse-grid preseason-grid"><article class="leader-pulse preseason-pulse"><span class="pulse-status-icon">${icon('clock')}</span><div><span>STATO TORNEO</span><strong>Pre-season</strong><small>Nessuna partita di campionato registrata</small></div></article><article><span>SQUADRE PUBBLICATE</span><strong>${table.length}</strong><small>elenco ufficiale del feed</small></article><article><span>GERARCHIE</span><strong>Non disponibili</strong><small>zero risultati: nessuna capolista reale</small></article><article><span>PROSSIMO PASSO</span><strong>Prima giornata</strong><small>i dati si attiveranno automaticamente</small></article></div>`;
    const tableRows = table.map((row, index) => {
      const zoneClass = !started ? '' : index < 4 ? 'zone-ucl' : index >= table.length - 3 ? 'zone-drop' : '';
      return `<tr class="${zoneClass}"><td><span class="rank-cell">${row.rank}</span></td><td class="standings-team">${teamLogo({ ...row.team, abbreviation: row.team.name.slice(0, 3) })}<strong>${escapeHtml(row.team.name)}</strong><button class="table-dna" data-team-dna="${escapeHtml(row.team.id)}" data-team-name="${escapeHtml(row.team.name)}" data-team-logo="${escapeHtml(safeUrl(row.team.logo))}" data-team-league="${escapeHtml(state.standingsLeague)}">DNA</button></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.difference > 0 ? '+' : ''}${row.difference}</td><td>${row.played ? (row.points / row.played).toFixed(2) : '–'}</td><td class="points">${row.points}</td></tr>`;
    }).join('');
    const tableReading = started ? `<div class="league-reading"><span>DISTACCO 1ª–6ª</span><strong>${spread} pt</strong><p>${spread <= 5 ? 'La parte alta è ancora molto compatta.' : 'La vetta sta creando una separazione visibile.'}</p></div><div class="league-reading"><span>ZONA ALTA</span><strong>${table.slice(0, 4).map(row => escapeHtml(row.team.name)).join(' · ')}</strong></div><div class="zone-legend"><p><i></i>Fascia europea indicativa</p><p><i class="red"></i>Fascia retrocessione indicativa</p></div><div class="legend-note">Le fasce sono un aiuto visivo: criteri ufficiali, playoff e posti europei dipendono dalla competizione.</div>` : `<div class="league-reading preseason-reading"><span>STAGIONE NON INIZIATA</span><strong>Nessuna gerarchia sportiva ancora disponibile</strong><p>Le posizioni del feed sono soltanto un ordinamento tecnico. Vetta, distacchi, miglior attacco, miglior difesa e zone europee appariranno dopo le prime partite.</p></div><div class="legend-note">VANTAGGIO non presenta l’ordine pre-season come una classifica reale.</div>`;
    content = `<section class="league-pulse"><header><div><span class="broadcast-label"><i></i>LEAGUE PULSE</span><h2>${escapeHtml(data.league.label)}</h2><p>${escapeHtml(data.season || 'Stagione corrente')}</p></div><strong>${started ? `${leader.played} giornate lette` : 'Pre-season · dati non competitivi'}</strong></header>${pulse}</section><div class="standings-layout intelligence-table-layout"><section class="standings-card"><header class="table-broadcast-head"><span>${started ? 'CLASSIFICA LIVE' : 'ELENCO SQUADRE · PRE-SEASON'}</span><small>PG partite · DR differenza reti · PPG punti per gara</small></header><div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>P</th><th>S</th><th>GF</th><th>GS</th><th>DR</th><th>PPG</th><th>PT</th></tr></thead><tbody>${tableRows}</tbody></table></div></section><aside class="league-intelligence"><span class="section-code">TABLE INTELLIGENCE</span><h3>Come leggere la corsa</h3>${tableReading}</aside></div>`;
  }
  return `<div class="view standings-view v4-standings">${viewHeader('TABLE LAB', 'Classifiche', 'Non solo posizioni: leadership, ritmo realizzativo, equilibrio della corsa e rendimento per gara.', actions)}${content}</div>`;
}

function countdownText(match) {
  if (match.state === 'in') return 'IN CAMPO';
  if (match.state === 'post') return 'TERMINATA';
  const minutes = Math.max(0, Math.round((new Date(match.date).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `TRA ${minutes} MIN`;
  if (minutes < 1440) return `TRA ${Math.floor(minutes / 60)}H ${minutes % 60}M`;
  return `TRA ${Math.floor(minutes / 1440)} GIORNI`;
}

function renderFavoritesView() {
  const matches = [...state.favorites].map(id => state.matches.find(match => match.id === id) || state.favoriteSnapshots[id]).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = matches.find(match => match.state !== 'post') || matches[0];
  const live = matches.filter(match => match.state === 'in').length;
  const analysed = matches.filter(match => state.analyses[`${match.league.id}:${match.id}`]).length;
  const competitions = new Set(matches.map(match => match.league.id)).size;
  return `<div class="view favorites-view v4-watchroom">
    ${viewHeader('MY MATCHROOM', 'Preferiti', 'La tua sala personale: prossimi appuntamenti, dossier già aperti e alert locali senza account.')}
    ${matches.length ? `<section class="watchroom-hero"><div class="watchroom-copy"><span class="broadcast-label"><i></i>PRIVATE WATCHLIST</span><h2>La tua agenda.<br><em>Senza rumore.</em></h2><p>${matches.length} partite salvate in ${competitions} competizioni. Tutto resta esclusivamente su questo dispositivo.</p><div class="watchroom-kpis"><span><b>${live}</b>live</span><span><b>${analysed}</b>dossier aperti</span><span><b>${state.alertsEnabled ? 'ON' : 'OFF'}</b>alert</span></div></div>${next ? `<button class="next-watch" data-match="${escapeHtml(next.id)}"><header><span>NEXT ON YOUR RADAR</span><b>${escapeHtml(countdownText(next))}</b></header><div><span>${teamLogo(next.home, 'watch-logo')}<strong>${escapeHtml(next.home.name)}</strong></span><i>VS</i><span>${teamLogo(next.away, 'watch-logo')}<strong>${escapeHtml(next.away.name)}</strong></span></div><footer>${escapeHtml(next.league.label)} · ${escapeHtml(displayDate(next.date))} · ${escapeHtml(fmtTime.format(new Date(next.date)))}</footer></button>` : ''}</section><div class="watchroom-layout"><section class="section-card watchlist-card"><header class="section-head"><div><span class="section-code">SAVED FIXTURES</span><h2>Partite sotto osservazione</h2><p>Apri una riga per aggiornare il dossier completo</p></div></header><div class="match-list">${matches.map(matchRow).join('')}</div></section><aside class="watchroom-assistant"><span class="section-code">WATCH ASSISTANT</span><h3>Stato della stanza</h3><article>${icon('bell')}<div><strong>${state.alertsEnabled ? 'Alert locali attivi' : 'Alert locali disattivati'}</strong><p>${state.alertsEnabled ? 'Kickoff Watch ricontrolla dossier e formazioni a 60, 30 e 10 minuti; gli alert funzionano mentre il sito è aperto.' : 'Attivali dalla campanella in alto per seguire i cambi di stato.'}</p></div></article><article>${icon('radar')}<div><strong>${analysed}/${matches.length} dossier consultati</strong><p>Le analisi vengono ricalcolate quando apri la partita e rispettano la cache dati.</p></div></article><article>${icon('shield')}<div><strong>Privacy reale</strong><p>Nessun profilo, cookie pubblicitario o sincronizzazione esterna della watchlist.</p></div></article></aside></div>` : emptyState('star', 'La Matchroom è vuota', 'Tocca la stella accanto a una partita: qui nascerà una watchlist personale con countdown, dossier e alert.', '<button class="button primary" data-view="matches">Costruisci la Matchroom</button>')}
  </div>`;
}

function emptyInline(text) {
  return `<div style="padding:28px 18px;color:var(--muted);text-align:center;font-size:10px">${escapeHtml(text)}</div>`;
}

function emptyState(iconName, title, text, action = '') {
  return `<section class="empty-state"><div><span class="empty-icon">${icon(iconName)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>${action}</div></section>`;
}

function errorBlock(message, inline = false) {
  if (inline) return `<div style="padding:24px;color:var(--red);text-align:center;font-size:10px">Fonte temporaneamente non disponibile · ${escapeHtml(message)}</div>`;
  return `<section class="empty-state error-state"><div><span class="empty-icon">${icon('info')}</span><h2>Dati non disponibili</h2><p>${escapeHtml(message)}. Riprova tra poco: le altre sezioni continuano a funzionare.</p><button class="button" id="viewRefresh">${icon('refresh')} Riprova</button></div></section>`;
}

function reliabilityTone(score) {
  return score >= 82 ? 'solid' : score >= 65 ? 'good' : score >= 45 ? 'partial' : 'weak';
}

function reliabilityLedgerMarkup(ledger, compact = false) {
  if (!ledger) return '';
  return `<section class="reliability-ledger ${compact ? 'compact' : ''}"><header><div><span class="section-code">RELIABILITY LEDGER</span><h4>Quanto è solida questa lettura?</h4></div><div class="reliability-dial ${reliabilityTone(ledger.overall)}" style="--reliability:${ledger.overall}"><span><b>${ledger.overall}</b><small>${escapeHtml(ledger.level)}</small></span></div></header><div class="reliability-rows">${(ledger.items || []).map(item => `<article><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.source || item.note || '')}</span></div><i><b class="${reliabilityTone(item.score)}" style="width:${clampClient(item.score, 0, 100)}%"></b></i><em>${Math.round(item.score)}</em><p>${escapeHtml(item.note || '')}</p></article>`).join('')}</div><footer>${icon('shield')}<span>${escapeHtml(ledger.rule || '')}</span></footer></section>`;
}

function teamDnaEvent(event) {
  return `<article class="dna-event"><span class="result-chip ${String(event.result || '').toLowerCase()}">${escapeHtml(event.result || '–')}</span><div><strong>${escapeHtml(event.opponent)}</strong><small>${escapeHtml(event.competition)} · ${escapeHtml(displayDate(event.date))}</small></div><b>${escapeHtml(event.score || fmtTime.format(new Date(event.date)))}</b></article>`;
}

function renderTeamDna(data) {
  const team = data.team;
  const metrics = data.profile?.metrics || {};
  const split = (label, item) => `<article><span>${label}</span><strong>${item.pointsPerGame ?? '–'}<small> PPG</small></strong><p>${item.played} gare · ${item.goalsFor ?? '–'} fatti · ${item.goalsAgainst ?? '–'} subiti</p></article>`;
  return `<button class="modal-close dna-close" data-close-team-dna aria-label="Chiudi Team DNA">${icon('x')}</button><header class="dna-hero"><div class="dna-team-identity">${teamLogo(team, 'dna-hero-logo')}<div><span>VANTAGGIO TEAM DNA · CAMPIONE OSSERVATO</span><h2>${escapeHtml(team.name)}</h2><p>${escapeHtml(data.profile.style)}${team.standingSummary ? ` · ${escapeHtml(team.standingSummary)}` : ''}</p></div></div><div class="dna-confidence"><span>FIDUCIA DATI</span><strong>${data.reliability.overall}<small>/100</small></strong><p>${escapeHtml(data.reliability.level)}</p></div></header><div class="dna-body">
    <section class="dna-manifesto"><span>IDENTITÀ IN UNA FRASE</span><h3>${escapeHtml(data.readings?.[0] || 'Profilo ancora da consolidare')}</h3><p>${escapeHtml(data.facts?.[0] || 'I risultati recenti non sono ancora sufficienti per una sintesi robusta.')}</p></section>
    <section class="dna-fingerprint"><header><div><span class="section-code">FOOTBALL FINGERPRINT</span><h3>Impronta tecnica</h3></div><small>${data.profile.observedGames}/3 boxscore completi</small></header><div>${data.fingerprint.map(item => `<article class="${item.value == null ? 'missing' : ''}"><span>${escapeHtml(item.label)}</span><strong>${item.value ?? '–'}</strong><i><b style="width:${item.value ?? 0}%"></b></i><small>${escapeHtml(item.raw)}</small></article>`).join('')}</div></section>
    <div class="dna-grid"><section class="dna-panel"><header><span class="section-code">RECENT CORE</span><h3>Ultime prestazioni</h3></header><div class="dna-core-kpis"><span><b>${data.recent.wins}</b>V</span><span><b>${data.recent.draws}</b>P</span><span><b>${data.recent.losses}</b>S</span><span><b>${data.recent.avgGoalsFor ?? '–'}</b>gol fatti</span><span><b>${data.recent.avgGoalsAgainst ?? '–'}</b>subiti</span></div><div class="dna-events">${data.recentEvents.length ? data.recentEvents.map(teamDnaEvent).join('') : '<p class="dna-empty">Risultati recenti non disponibili.</p>'}</div></section><section class="dna-panel"><header><span class="section-code">HOME / AWAY SPLIT</span><h3>Come cambia il profilo</h3></header><div class="dna-splits">${split('IN CASA', data.splits.home)}${split('IN TRASFERTA', data.splits.away)}</div><div class="dna-traits">${(data.profile.traits || []).map(text => `<p>${icon('chevron')}<span>${escapeHtml(text)}</span></p>`).join('')}${(data.profile.vulnerabilities || []).map(text => `<p class="weak">${icon('info')}<span>${escapeHtml(text)}</span></p>`).join('')}</div></section></div>
    <section class="dna-evidence"><article><span>FATTI</span>${(data.facts || []).map(text => `<p>${escapeHtml(text)}</p>`).join('') || '<p>Nessun fatto sufficiente.</p>'}</article><article><span>LETTURE</span>${(data.readings || []).map(text => `<p>${escapeHtml(text)}</p>`).join('') || '<p>Lettura non disponibile.</p>'}</article><article><span>DA VERIFICARE</span>${(data.verifications || []).map(text => `<p>${escapeHtml(text)}</p>`).join('') || '<p>Nessun avviso aggiuntivo.</p>'}</article></section>
    ${data.nextEvents.length ? `<section class="dna-next"><header><span class="section-code">NEXT LOAD</span><h3>Prossimi impegni</h3></header><div>${data.nextEvents.map(event => `<article><span>${escapeHtml(displayDate(event.date))}</span><strong>${escapeHtml(event.opponent)}</strong><small>${escapeHtml(event.competition)} · ${escapeHtml(fmtTime.format(new Date(event.date)))}</small></article>`).join('')}</div></section>` : ''}
    ${reliabilityLedgerMarkup(data.reliability)}
    <div class="intel-method">${icon('shield')}<span>${escapeHtml(data.methodology)}</span></div>
  </div>`;
}

async function openTeamDna(teamId, teamName, teamLogoUrl, leagueId) {
  if (!teamId) return;
  const layer = $('#teamDnaLayer');
  const modal = $('#teamDnaModal');
  layer.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.innerHTML = `<button class="modal-close dna-close" data-close-team-dna aria-label="Chiudi Team DNA">${icon('x')}</button><header class="dna-hero loading"><div class="dna-team-identity">${teamLogo({ id: teamId, name: teamName, logo: teamLogoUrl }, 'dna-hero-logo')}<div><span>TEAM DNA</span><h2>${escapeHtml(teamName || 'Squadra')}</h2><p>Ricostruisco risultati, split e impronta tecnica…</p></div></div></header><div class="dna-loading"><i></i><i></i><i></i></div>`;
  const key = `${leagueId}:${teamId}`;
  try {
    if (!state.teamDna[key]) {
      const payload = await api(`/api/team-dna?team=${encodeURIComponent(teamId)}&league=${encodeURIComponent(leagueId || 'all')}&name=${encodeURIComponent(teamName || '')}`);
      state.teamDna[key] = payload.data;
    }
    if (!layer.hidden) modal.innerHTML = renderTeamDna(state.teamDna[key]);
  } catch (error) {
    if (!layer.hidden) modal.innerHTML = `<button class="modal-close dna-close" data-close-team-dna aria-label="Chiudi">${icon('x')}</button><div class="dna-error">${icon('info')}<h2>Team DNA non disponibile</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function closeTeamDna() {
  $('#teamDnaLayer').hidden = true;
  if ($('#modalLayer').hidden && $('#searchLayer').hidden) document.body.style.overflow = '';
}

function findMatch(id) {
  return state.matches.find(match => match.id === id) || state.favoriteSnapshots[id];
}

function openMatch(id) {
  const match = findMatch(id);
  if (!match) return;
  const status = statusMarkup(match);
  const favorite = state.favorites.has(match.id);
  const modal = $('#matchModal');
  modal.dataset.eventId = match.id;
  modal.style.setProperty('--league-color', match.league.accent || '#c8ff52');
  modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button>
    <header class="modal-hero"><span class="modal-competition"><i></i>${escapeHtml(match.league.label)} ${match.round ? `· ${escapeHtml(match.round)}` : ''}</span><div class="modal-fixture"><div class="modal-team">${teamLogo(match.home, 'modal-logo')}<strong>${escapeHtml(match.home.name)}</strong><button class="dna-trigger" data-team-dna="${escapeHtml(match.home.id)}" data-team-name="${escapeHtml(match.home.name)}" data-team-logo="${escapeHtml(safeUrl(match.home.logo))}" data-team-league="${escapeHtml(match.league.id)}">TEAM DNA</button></div><div class="modal-score"><strong>${escapeHtml(status.main)}</strong><span>${escapeHtml(status.sub)}</span></div><div class="modal-team">${teamLogo(match.away, 'modal-logo')}<strong>${escapeHtml(match.away.name)}</strong><button class="dna-trigger" data-team-dna="${escapeHtml(match.away.id)}" data-team-name="${escapeHtml(match.away.name)}" data-team-logo="${escapeHtml(safeUrl(match.away.logo))}" data-team-league="${escapeHtml(match.league.id)}">TEAM DNA</button></div></div></header>
    <div class="modal-body"><div class="modal-meta-grid"><div class="modal-meta"><span>Data e ora</span><strong>${escapeHtml(displayDate(match.date, true))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</strong></div><div class="modal-meta"><span>Stadio</span><strong title="${escapeHtml(match.venue)}">${escapeHtml(match.venue)}</strong></div><div class="modal-meta"><span>Indice interesse</span><strong>${match.opportunity}/100</strong></div></div>
      <div id="matchIntelligence"><section class="deep-first-loading"><span class="intel-mark">MATCH CONTROL ROOM</span><h3>Sto organizzando il dossier…</h3><p>Sintesi, squadre, numeri e verifiche in un’unica architettura adattiva.</p><i></i></section></div>
      <div class="modal-actions"><button class="button ${favorite ? '' : 'primary'}" data-favorite="${escapeHtml(match.id)}">${icon('star')} ${favorite ? 'Rimuovi dai salvati' : 'Salva partita'}</button><button class="button" data-close-modal>Chiudi</button></div>
    </div>`;
  $('#modalLayer').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('.modal-close', modal)?.focus(), 20);
  loadIntelligence(match).then(() => loadAnalysis(match));
}

function renderFallbackDeepAnalysis(match, analysis = null, error = '') {
  const homeRecent = analysis?.recent?.home;
  const awayRecent = analysis?.recent?.away;
  const signal = analysis?.signals?.[0];
  return `<section class="deep-dive fallback"><header><div><span>DEEP RESEARCH · COPERTURA RIDOTTA</span><h3>${escapeHtml(match.home.name)}–${escapeHtml(match.away.name)}: ciò che possiamo confermare</h3><p>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date, true))} · ${escapeHtml(fmtTime.format(new Date(match.date)))} · ${escapeHtml(match.venue || 'sede non disponibile')}</p></div><b>PARZIALE</b></header><div class="deep-number-grid"><article><span>Stato</span><strong>${escapeHtml(statusMarkup(match).main)}</strong><small>${escapeHtml(statusMarkup(match).sub)}</small></article><article><span>Forma casa</span><strong>${escapeHtml(match.home.form || 'n/d')}</strong><small>${escapeHtml(match.home.name)}</small></article><article><span>Forma ospite</span><strong>${escapeHtml(match.away.form || 'n/d')}</strong><small>${escapeHtml(match.away.name)}</small></article>${signal ? `<article><span>Segnale modello</span><strong>${signal.probability}%</strong><small>${escapeHtml(signal.label)}</small></article>` : ''}${homeRecent ? `<article><span>Gol casa</span><strong>${homeRecent.avgGoalsFor ?? '–'}</strong><small>media recente</small></article>` : ''}${awayRecent ? `<article><span>Gol ospite</span><strong>${awayRecent.avgGoalsFor ?? '–'}</strong><small>media recente</small></article>` : ''}</div><div class="fallback-evidence"><article><span>FATTI DISPONIBILI</span><p>Data, competizione, sede, stato e forma sintetica provengono dal calendario globale.</p></article><article><span>PERCHÉ È PARZIALE</span><p>${escapeHtml(error || 'Il riepilogo tecnico completo non è stato pubblicato dalla fonte.')}</p></article><article><span>REGOLA DI QUALITÀ</span><p>Non trasformiamo dati mancanti in statistiche inventate. Il dossier si completa automaticamente quando la fonte pubblica boxscore e contesto.</p></article></div></section>`;
}

function analysisLoading() {
  return `<section class="power-loading"><div class="power-loading-head"><span class="power-mark">POWER</span><strong>Sto costruendo l’analisi completa…</strong></div><div class="power-skeleton"><i></i><i></i><i></i></div><p>Forma, precedenti, distribuzione gol e consenso 1-X-2.</p></section>`;
}

async function loadAnalysis(match, force = false) {
  const key = `${match.league.id}:${match.id}`;
  const activeModelRoot = () => $('#roomPowerMount') || $('#advancedAnalysis');
  if (state.analyses[key] && !force) {
    archivePreKickoffModel(match, state.analyses[key]);
    const root = activeModelRoot();
    if (root) root.innerHTML = renderPowerAnalysis(state.analyses[key]);
    return;
  }
  try {
    const payload = await api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}${force ? '&fresh=1' : ''}`);
    state.analyses[key] = payload.data;
    delete state.analysisErrors[key];
    archivePreKickoffModel(match, payload.data);
    if ($('#matchModal')?.dataset.eventId === match.id && activeModelRoot()) activeModelRoot().innerHTML = renderPowerAnalysis(payload.data);
    const intelRoot = $('#matchIntelligence');
    if ($('#matchModal')?.dataset.eventId === match.id && intelRoot?.dataset.fallback === '1') intelRoot.innerHTML = renderFallbackDeepAnalysis(match, payload.data, intelRoot.dataset.error || 'Riepilogo completo non disponibile');
  } catch (error) {
    state.analysisErrors[key] = error.message;
    const root = activeModelRoot();
    if ($('#matchModal')?.dataset.eventId === match.id && root) {
      root.innerHTML = `<section class="power-error">${icon('info')}<div><strong>Analisi avanzata non disponibile</strong><p>${escapeHtml(error.message)}. Restano validi calendario, forma sintetica e dati live.</p></div></section>`;
    }
  }
}

function qualityLabel(value) {
  if (value >= 80) return 'Alta';
  if (value >= 60) return 'Buona';
  if (value >= 40) return 'Parziale';
  return 'Limitata';
}

function probabilityBar(label, value, tone = '') {
  return `<div class="probability-item ${tone}"><div><span>${escapeHtml(label)}</span><strong>${value}%</strong></div><i><b style="width:${clampClient(value, 0, 100)}%"></b></i></div>`;
}

function clampClient(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function recentTeamPanel(recent) {
  const events = recent.events || [];
  return `<section class="recent-team-panel"><header><div>${teamLogo(recent.team, 'power-team-logo')}<span><strong>${escapeHtml(recent.team.name)}</strong><small>Ultime ${recent.played} disponibili</small></span></div><b>${recent.wins}V · ${recent.draws}P · ${recent.losses}S</b></header><div class="recent-kpis"><span><b>${recent.avgGoalsFor ?? '–'}</b> fatti</span><span><b>${recent.avgGoalsAgainst ?? '–'}</b> subiti</span><span><b>${recent.bttsRate ?? '–'}${recent.bttsRate == null ? '' : '%'}</b> Goal</span><span><b>${recent.over25Rate ?? '–'}${recent.over25Rate == null ? '' : '%'}</b> O2.5</span></div><div class="recent-results">${events.length ? events.map(event => `<div class="recent-result"><span class="result-chip ${event.result.toLowerCase()}">${event.result}</span><div><strong>${escapeHtml(event.opponent)}</strong><small>${escapeHtml(event.venue)} · ${escapeHtml(event.competition)}</small></div><b>${event.goalsFor}–${event.goalsAgainst}</b></div>`).join('') : '<p>Dati recenti non disponibili.</p>'}</div></section>`;
}

function renderPowerAnalysis(data) {
  const quality = data.engine?.quality || 0;
  if (data.event?.state === 'post' || data.event?.completed) {
    const homeStats = (data.matchStats || []).find(item => item.teamId === data.event.home.id)?.metrics || {};
    const awayStats = (data.matchStats || []).find(item => item.teamId === data.event.away.id)?.metrics || {};
    return `<section class="power-analysis post-match-archive"><header class="power-title"><div><span class="power-mark">MATCH ARCHIVE</span><h3>La previsione si ferma, inizia la review</h3></div><span class="archive-ft">FT</span></header><div class="archive-score"><div>${teamLogo(data.event.home, 'power-team-logo')}<strong>${escapeHtml(data.event.home.name)}</strong></div><b>${data.event.home.score}–${data.event.away.score}</b><div>${teamLogo(data.event.away, 'power-team-logo')}<strong>${escapeHtml(data.event.away.name)}</strong></div></div><div class="archive-kpis"><span><b>${homeStats.possession ?? '–'}${homeStats.possession == null ? '' : '%'}</b>possesso casa</span><span><b>${homeStats.shots ?? '–'}–${awayStats.shots ?? '–'}</b>tiri</span><span><b>${homeStats.shotsOnTarget ?? '–'}–${awayStats.shotsOnTarget ?? '–'}</b>in porta</span><span><b>${homeStats.passAccuracy ?? '–'}${homeStats.passAccuracy == null ? '' : '%'}</b>passaggi casa</span></div><div class="archive-rule">${icon('shield')}<span>Il modello non viene ricalcolato dopo il risultato: sarebbe un dato retroattivo e fuorviante. La Deep Match Review usa invece ciò che è realmente accaduto.</span></div></section>`;
  }
  if (data.event?.state === 'in') {
    const homeStats = (data.matchStats || []).find(item => item.teamId === data.event.home.id)?.metrics || {};
    const awayStats = (data.matchStats || []).find(item => item.teamId === data.event.away.id)?.metrics || {};
    return `<section class="power-analysis live-model-paused"><header class="power-title"><div><span class="power-mark">LIVE CONTROL</span><h3>Modello decisionale sospeso</h3></div><span class="archive-ft">LIVE</span></header><div class="archive-score"><div>${teamLogo(data.event.home, 'power-team-logo')}<strong>${escapeHtml(data.event.home.name)}</strong></div><b>${data.event.home.score}–${data.event.away.score}</b><div>${teamLogo(data.event.away, 'power-team-logo')}<strong>${escapeHtml(data.event.away.name)}</strong></div></div><div class="archive-kpis"><span><b>${homeStats.possession ?? '–'}${homeStats.possession == null ? '' : '%'}</b>possesso casa</span><span><b>${homeStats.shots ?? '–'}–${awayStats.shots ?? '–'}</b>tiri</span><span><b>${homeStats.shotsOnTarget ?? '–'}–${awayStats.shotsOnTarget ?? '–'}</b>in porta</span><span><b>${homeStats.yellowCards ?? '–'}–${awayStats.yellowCards ?? '–'}</b>gialli</span></div><div class="archive-rule">${icon('shield')}<span>Durante il live non trasformiamo un modello pre-gara in consiglio attivo. Qui restano soltanto score e statistiche effettivamente pubblicate.</span></div></section>`;
  }
  const signals = data.signals || [];
  const primary = signals[0];
  const marketOutcome = data.market?.outcome ? {
    home: Math.round(data.market.outcome.home * 100), draw: Math.round(data.market.outcome.draw * 100), away: Math.round(data.market.outcome.away * 100)
  } : null;
  const h2hRows = (data.h2h?.events || []).slice(0, 5).map(event => `<div class="h2h-row"><span>${escapeHtml(displayDate(event.date))}</span><div><strong>${escapeHtml(event.home.name)}</strong><b>${event.home.score}–${event.away.score}</b><strong>${escapeHtml(event.away.name)}</strong></div></div>`).join('');
  return `<section class="power-analysis">
    <header class="power-title"><div><span class="power-mark">POWER MODEL 2.1</span><h3>Analisi quantitativa</h3></div><div class="quality-score" style="--quality:${quality}"><span><b>${quality}</b><small>qualità ${qualityLabel(quality)}</small></span></div></header>
    ${primary ? `<article class="primary-signal"><div><span>SEGNALE PIÙ FORTE</span><h4>${escapeHtml(primary.label)}</h4><p>${escapeHtml(primary.reason)}</p></div><strong>${primary.probability}<small>%</small></strong><i class="risk-tag ${String(data.assessment?.risk || '').toLowerCase()}">Rischio ${escapeHtml(data.assessment?.risk || 'n/d')}</i></article>` : ''}
    <section class="power-block"><header><h4>Probabilità 1-X-2</h4><span>Consenso statistico${data.market?.outcome ? ' + mercato' : ''}</span></header><div class="probabilities">${probabilityBar(data.event.home.name, data.probabilities.home, 'home')}${probabilityBar('Pareggio', data.probabilities.draw, 'draw')}${probabilityBar(data.event.away.name, data.probabilities.away, 'away')}</div><div class="model-note">Solo modello: ${data.statisticalProbabilities.home}% · ${data.statisticalProbabilities.draw}% · ${data.statisticalProbabilities.away}%</div></section>
    <div class="goal-grid"><article><span>Gol attesi</span><strong>${data.expectedGoals.total}</strong><small>${escapeHtml(data.event.home.name)} ${data.expectedGoals.home} · ${escapeHtml(data.event.away.name)} ${data.expectedGoals.away}</small></article><article><span>Risultato modale</span><strong>${escapeHtml(data.goals.likelyScore)}</strong><small>singolo punteggio più probabile</small></article><article><span>Over 1,5</span><strong>${data.goals.over15}%</strong><small>almeno due gol</small></article><article><span>Over 2,5</span><strong>${data.goals.over25}%</strong><small>almeno tre gol</small></article><article><span>Goal</span><strong>${data.goals.btts}%</strong><small>segnano entrambe</small></article><article><span>Under 3,5</span><strong>${data.goals.under35}%</strong><small>massimo tre gol</small></article></div>
    ${signals.length ? `<section class="power-block"><header><h4>Scenari da valutare</h4><span>ordinati per robustezza</span></header><div class="signal-list">${signals.map((signal, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(signal.label)}</strong><small>${escapeHtml(signal.reason)}</small></div><b>${signal.probability}%</b></article>`).join('')}</div></section>` : ''}
    <section class="power-block"><header><h4>Forma e produzione gol</h4><span>${data.engine.sampleSize} osservazioni complessive</span></header><div class="recent-grid">${recentTeamPanel(data.recent.home)}${recentTeamPanel(data.recent.away)}</div></section>
    ${(data.assessment?.findings || []).length ? `<section class="evidence-box"><h4>Cosa pesa nell’analisi</h4>${data.assessment.findings.map(text => `<p>${icon('chevron')}<span>${escapeHtml(text)}</span></p>`).join('')}${data.assessment.seasonTransition ? `<div class="season-warning">${icon('info')} Nuova stagione: la classifica è ancora poco significativa, quindi il modello pesa maggiormente risultati recenti e precedenti.</div>` : ''}</section>` : ''}
    ${data.h2h?.total ? `<section class="power-block"><header><h4>Precedenti diretti</h4><span>${data.h2h.total} incontri · ${data.h2h.homeWins}V casa · ${data.h2h.draws}P · ${data.h2h.awayWins}V ospite</span></header><div class="h2h-list">${h2hRows}</div></section>` : ''}
    ${marketOutcome ? `<section class="market-box"><div><span>CONSENSO MERCATO SENZA MARGINE</span><strong>${escapeHtml(data.market.provider)}</strong></div><div><b>1 ${marketOutcome.home}%</b><b>X ${marketOutcome.draw}%</b><b>2 ${marketOutcome.away}%</b>${data.market.totals ? `<b>Linea gol ${data.market.totals.line}</b>` : ''}</div></section>` : ''}
    <div class="modal-note">${icon('info')}<span>${escapeHtml(data.methodology)} Non considera formazioni ufficiali o eventi dell’ultimo minuto e non garantisce alcun risultato. 18+.</span></div>
  </section>`;
}

async function loadIntelligence(match, force = false) {
  const key = `${match.league.id}:${match.id}`;
  const root = $('#matchIntelligence');
  if (!root) return;
  if (state.intelligence[key] && !force) {
    root.innerHTML = renderIntelligence(state.intelligence[key]);
    return;
  }
  try {
    const previous = state.intelligence[key];
    const payload = await api(`/api/intelligence?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}${force ? '&fresh=1' : ''}`);
    state.intelligence[key] = payload.data;
    if ($('#matchIntelligence')) { delete $('#matchIntelligence').dataset.fallback; delete $('#matchIntelligence').dataset.error; }
    if (!previous?.lineups?.official && payload.data.lineups?.official) addChange('lineup', 'Formazioni ufficiali pubblicate', `Gli undici di ${match.home.name}–${match.away.name} sono disponibili nel dossier.`, match, 'official');
    if ($('#matchModal')?.dataset.eventId === match.id && $('#matchIntelligence')) $('#matchIntelligence').innerHTML = renderIntelligence(payload.data);
  } catch (error) {
    if ($('#matchModal')?.dataset.eventId === match.id && $('#matchIntelligence')) {
      const fallbackRoot = $('#matchIntelligence');
      fallbackRoot.dataset.fallback = '1';
      fallbackRoot.dataset.error = error.message;
      fallbackRoot.innerHTML = renderFallbackDeepAnalysis(match, state.analyses[key], error.message);
    }
  }
}

function tacticalCard(profile, team) {
  const metrics = profile.metrics || {};
  const metric = (label, value, suffix = '') => `<span><b>${value == null ? '–' : `${value}${suffix}`}</b>${label}</span>`;
  return `<article class="tactical-card"><header>${teamLogo(team, 'intel-team-logo')}<div><strong>${escapeHtml(profile.teamName)}</strong><span>${escapeHtml(profile.style)}</span></div><i>${profile.observedGames} ${profile.observedGames === 1 ? 'gara' : 'gare'}</i></header><div class="tactical-metrics">${metric('possesso', metrics.possession, '%')}${metric('tiri', metrics.shots)}${metric('in porta', metrics.shotsOnTarget)}${metric('corner', metrics.corners)}${metric('passaggi', metrics.passAccuracy, '%')}${metric('respinte', metrics.clearances)}${metric('contrasti', metrics.tackles)}${metric('gialli', metrics.yellowCards)}</div><div class="trait-list">${(profile.traits || []).map(text => `<p>${icon('chevron')}<span>${escapeHtml(text)}</span></p>`).join('')}${(profile.vulnerabilities || []).map(text => `<p class="weak">${icon('info')}<span>${escapeHtml(text)}</span></p>`).join('')}</div></article>`;
}

function calendarIntelCard(profile, team) {
  return `<article class="calendar-intel-card"><header>${teamLogo(team, 'intel-team-logo')}<strong>${escapeHtml(team.name)}</strong></header><div class="calendar-kpis"><span><b>${profile.restDays ?? '–'}</b>giorni di riposo</span><span><b>${profile.matchesLast14 ?? '–'}</b>gare in 14 giorni</span></div>${profile.previous ? `<p><small>ULTIMA</small><strong>${escapeHtml(profile.previous.opponent)} · ${profile.previous.score}</strong><span>${escapeHtml(displayDate(profile.previous.date))}</span></p>` : ''}${profile.next ? `<p><small>PROSSIMA</small><strong>${escapeHtml(profile.next.name)}</strong><span>tra ${profile.next.days} giorni</span></p>` : ''}${profile.standingSummary ? `<div class="standing-summary">${escapeHtml(profile.standingSummary)}</div>` : ''}</article>`;
}

function leaderIntelCard(block) {
  const labels = { goalsLeaders: 'Gol', assistsLeaders: 'Assist', totalShots: 'Tiri', accuratePasses: 'Passaggi riusciti', saves: 'Parate' };
  const categories = (block.categories || []).filter(category => category.players?.length).slice(0, 4);
  return `<article class="leader-intel-card"><header>${teamLogo({ name: block.teamName, logo: block.logo, abbreviation: block.teamName.slice(0, 3) }, 'intel-team-logo')}<strong>${escapeHtml(block.teamName)}</strong></header>${categories.map(category => { const player = category.players[0]; return `<div class="leader-row"><span>${escapeHtml(labels[category.id] || category.label)}</span><div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.position)} ${player.jersey ? `· #${escapeHtml(player.jersey)}` : ''}</small></div><b>${escapeHtml(player.value)}</b></div>`; }).join('')}</article>`;
}

function availabilityDesk(availability) {
  if (!availability?.teams) return `<div class="availability-state">${icon('shield')}<div><strong>Availability Intelligence non disponibile</strong><p>Lo stato della rosa resta sconosciuto: il silenzio non viene interpretato come piena disponibilità.</p></div></div>`;
  const sourceState = value => ({ disponibile: 'disponibile', in_attesa: 'in attesa', non_applicabile: 'non applicabile', nessun_record_pubblicato: 'feed vuoto · non conclusivo', non_disponibile: 'non disponibile', nessun_segnale: 'nessun segnale' })[value] || value.replaceAll('_', ' ');
  const teams = availability.teams.map(team => `<article class="availability-team"><header><div><span>${escapeHtml(team.teamName)}</span><strong>${team.structured.length} registrati · ${(team.signals || []).length} segnali${team.lineupOverrides?.length ? ` · ${team.lineupOverrides.length} superati dall’XI` : ''}</strong></div></header><div class="availability-players">${team.structured.length ? team.structured.map(item => `<div class="availability-player"><span class="availability-kind ${escapeHtml(item.category)}">${escapeHtml(item.category)}</span><div><strong>${escapeHtml(item.player)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.source)} · livello ${item.tier}${item.updatedAt ? ` · ${escapeHtml(displayNewsDate(item.updatedAt))}` : ''}${item.chance != null ? ` · chance dataset ${item.chance}%` : ''}</small></div></div>`).join('') : `<p class="availability-unknown">Nessun record strutturato pubblicato per questa squadra. Non significa rosa al completo.</p>`}</div>${(team.signals || []).length ? `<div class="availability-signals">${team.signals.slice(0, 3).map(item => `<button data-news-url="${escapeHtml(safeUrl(item.link))}"><span>${item.corroboratedBy ? `RISCONTRO · ${item.corroboratedBy + 1} EDITORI` : item.reliability === 'forte' ? 'FONTE FORTE' : item.reliability === 'media' ? 'FONTE NOTA' : 'DA VERIFICARE'}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher)} · ${escapeHtml(displayNewsDate(item.published))}</small></button>`).join('')}</div>` : ''}</article>`).join('');
  return `<section class="availability-desk"><header><div><span>AVAILABILITY INTELLIGENCE</span><h4>Infortuni, squalifiche, dubbi e stato lineup</h4><p>${escapeHtml(availability.message)}</p></div><b>${availability.score}/100 · ${escapeHtml(availability.level)}</b></header><div class="availability-teams">${teams}</div><div class="availability-sources">${(availability.sources || []).map(source => `<span><i class="tier-${source.tier}">T${source.tier}</i><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(sourceState(source.state))}${source.updatedAt ? ` · ${escapeHtml(relativeTime(source.updatedAt))}` : ''}</small></span>`).join('')}</div><footer>${icon('shield')}<span>${escapeHtml(availability.rule)}</span></footer></section>`;
}

function lineupIntel(data, availability) {
  const availabilityBox = availabilityDesk(availability);
  if (!data.official) return `<div class="lineup-pending">${icon('clock')}<div><strong>Formazioni non ancora ufficiali</strong><p>${escapeHtml(data.message)}</p><span>Questo è un punto da verificare, non un dato da indovinare.</span></div></div>${availabilityBox}`;
  return `<div class="official-lineups">${data.teams.map(team => `<article><header><strong>${escapeHtml(team.teamName)}</strong><span>${escapeHtml(team.formation || 'Modulo n/d')}</span></header><div>${team.starters.map(player => `<p><b>${escapeHtml(player.jersey || '–')}</b><span>${escapeHtml(player.name)}</span><small>${escapeHtml(player.position)}</small></p>`).join('')}</div></article>`).join('')}</div>${availabilityBox}`;
}

function deepTeamCase(block) {
  const metrics = block.actualMatch ? (block.actual || {}) : (block.sample || {});
  return `<article class="deep-team-case">${teamLogo(block.team, 'deep-team-logo')}<div class="deep-team-title"><strong>${escapeHtml(block.team.name)}</strong><span>${escapeHtml(block.style)} · ${block.observedGames} boxscore tecnici</span></div>${block.season?.played ? `<div class="deep-season-line"><span>SEASON VAULT ${escapeHtml(block.season.season)}</span><strong>${block.season.played} gare · ${block.season.goalsFor} gol · ${block.season.wins}V ${block.season.draws}P ${block.season.losses}S</strong>${block.season.competitions?.[0] ? `<small>${escapeHtml(block.season.competitions[0].name)}: ${block.season.competitions[0].played} gare, ${block.season.competitions[0].goalsFor} gol</small>` : ''}</div>` : ''}<div class="deep-case-kpis"><span><b>${block.recent.avgGoalsFor ?? '–'}</b>gol fatti</span><span><b>${block.recent.avgGoalsAgainst ?? '–'}</b>subiti</span><span><b>${metrics.possession ?? '–'}${metrics.possession == null ? '' : '%'}</b>${block.actualMatch ? 'possesso gara' : 'possesso campione'}</span><span><b>${metrics.shots ?? '–'}</b>${block.actualMatch ? 'tiri gara' : 'tiri medi'}</span></div>${(block.traits || []).slice(0, 2).map(text => `<p>${icon('chevron')}<span>${escapeHtml(text)}</span></p>`).join('')}${(block.vulnerabilities || []).slice(0, 1).map(text => `<p class="weak">${icon('info')}<span>${escapeHtml(text)}</span></p>`).join('')}</article>`;
}

function matchChangeHistory(eventId) {
  const history = state.changeLog.filter(item => item.eventId === String(eventId)).sort((a, b) => new Date(b.happenedAt) - new Date(a.happenedAt));
  if (!history.length) return `<div class="intel-empty">Nessuna variazione osservata in questo browser. La baseline è attiva per orario, sede, stato, score, lineups e news.</div>`;
  return `<div class="match-history">${history.map(item => `<article><span class="change-icon">${icon(changeIcon(item.kind))}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><small>${escapeHtml(displayNewsDate(item.happenedAt))} · ${escapeHtml(fmtTime.format(new Date(item.happenedAt)))}</small></div></article>`).join('')}</div>`;
}

function collectEvidence(data) {
  const unique = values => [...new Set(values.filter(Boolean).map(value => String(value).trim()))];
  const critical = data.critical || [];
  const paragraphs = data.deepDive?.paragraphs || [];
  const facts = unique([
    ...critical.filter(item => item.type === 'Fatto').map(item => item.text),
    ...paragraphs.filter(item => item.type === 'Fatto').map(item => item.text),
    data.lineups?.official ? 'Entrambi gli undici ufficiali sono presenti nel feed evento.' : ''
  ]);
  const readings = unique([
    ...critical.filter(item => item.type === 'Lettura').map(item => item.text),
    ...paragraphs.filter(item => item.type === 'Lettura').map(item => item.text)
  ]);
  const unknown = unique([
    ...critical.filter(item => item.type === 'Verifica').map(item => item.text),
    ...(data.deepDive?.unavailable || []),
    !data.lineups?.official ? data.lineups?.message : '',
    data.availability?.status === 'non_documentata' ? data.availability.message : ''
  ]);
  const revisions = unique((data.availability?.teams || []).flatMap(team => (team.lineupOverrides || []).map(item => `${item.player}: la segnalazione precedente è superata dalla presenza nell’XI ufficiale.`)));
  return { facts, readings, unknown, revisions };
}

function evidenceMapMarkup(data, expanded = false) {
  const evidence = collectEvidence(data);
  const column = (label, tone, items) => `<article class="evidence-map-column ${tone}"><header><span>${label}</span><strong>${items.length}</strong></header>${expanded ? `<div>${items.length ? items.slice(0, 8).map(text => `<p>${icon(tone === 'facts' ? 'shield' : tone === 'readings' ? 'radar' : 'info')}<span>${escapeHtml(text)}</span></p>`).join('') : '<p class="evidence-none">Nessun elemento in questa categoria.</p>'}</div>` : `<small>${escapeHtml(items[0] || (tone === 'facts' ? 'Nessun fatto aggiuntivo.' : tone === 'readings' ? 'Nessuna lettura derivata.' : 'Nessun punto aggiuntivo.'))}</small>`}</article>`;
  return `<section class="evidence-map ${expanded ? 'expanded' : 'compact'}"><header><div><span class="section-code">EVIDENCE MAP</span><h4>Fatti, letture e vuoti senza confusione</h4></div><small>${evidence.facts.length + evidence.readings.length + evidence.unknown.length + evidence.revisions.length} elementi classificati</small></header><div>${column('Fatti verificati', 'facts', evidence.facts)}${column('Letture derivate', 'readings', evidence.readings)}${column('Da verificare', 'unknown', evidence.unknown)}${evidence.revisions.length ? column('Revisioni', 'revisions', evidence.revisions) : ''}</div></section>`;
}

function readinessGate(data) {
  const eventState = data.event?.state || 'pre';
  const checkMarkup = check => `<span class="readiness-check ${check.tone}"><i></i><b>${escapeHtml(check.label)}</b><small>${escapeHtml(check.value)}</small></span>`;
  if (eventState === 'post' || data.event?.completed) {
    return `<section class="readiness-gate closed"><header><div><span>MATCH READINESS GATE</span><h4>Decisione chiusa · review attiva</h4><p>Nessun consiglio viene mantenuto live dopo il finale. Il dossier usa risultato e dati realmente accaduti.</p></div><b>ARCHIVIO</b></header><div>${[
      { tone: 'good', label: 'Stato', value: 'Finale' },
      { tone: data.lineups?.official ? 'good' : 'warn', label: 'Lineup', value: data.lineups?.official ? 'Ufficiali' : 'Parziali' },
      { tone: data.reliability?.overall >= 65 ? 'good' : 'warn', label: 'Copertura', value: `${data.reliability?.overall ?? '–'}/100` }
    ].map(checkMarkup).join('')}</div></section>`;
  }
  if (eventState === 'in') {
    return `<section class="readiness-gate live"><header><div><span>MATCH READINESS GATE</span><h4>Partita in corso · modello sospeso</h4><p>Score, eventi, formazioni e statistiche effettive sostituiscono qualsiasi lettura decisionale pre-gara.</p></div><b>LIVE</b></header><div>${[
      { tone: 'good', label: 'Feed', value: 'In diretta' },
      { tone: data.lineups?.official ? 'good' : 'warn', label: 'Lineup', value: data.lineups?.official ? 'Ufficiali' : 'Parziali' },
      { tone: data.reliability?.overall >= 65 ? 'good' : 'warn', label: 'Copertura', value: `${data.reliability?.overall ?? '–'}/100` }
    ].map(checkMarkup).join('')}</div></section>`;
  }
  const minutes = (new Date(data.event?.date).getTime() - Date.now()) / 60000;
  const sample = (data.tactical?.home?.observedGames || 0) + (data.tactical?.away?.observedGames || 0);
  const ageMinutes = Math.max(0, (Date.now() - new Date(data.generatedAt || data.engine?.generatedAt || Date.now()).getTime()) / 60000);
  const checks = [
    { label: 'Formazioni', value: data.lineups?.official ? 'Ufficiali' : minutes <= 75 ? 'Mancano vicino al via' : 'In attesa', tone: data.lineups?.official ? 'good' : minutes <= 75 ? 'bad' : 'warn' },
    { label: 'Disponibilità', value: `${data.availability?.score ?? 0}/100`, tone: (data.availability?.score || 0) >= 65 ? 'good' : (data.availability?.score || 0) >= 45 ? 'warn' : 'bad' },
    { label: 'Affidabilità', value: `${data.reliability?.overall ?? 0}/100`, tone: (data.reliability?.overall || 0) >= 65 ? 'good' : (data.reliability?.overall || 0) >= 45 ? 'warn' : 'bad' },
    { label: 'Campione', value: `${sample} boxscore`, tone: sample >= 4 ? 'good' : sample >= 2 ? 'warn' : 'bad' },
    { label: 'Freschezza', value: ageMinutes < 2 ? 'Adesso' : `${Math.round(ageMinutes)} min`, tone: ageMinutes <= 20 ? 'good' : ageMinutes <= 60 ? 'warn' : 'bad' }
  ];
  const bad = checks.filter(check => check.tone === 'bad').length;
  const warnings = checks.filter(check => check.tone === 'warn').length;
  const tone = bad >= 2 ? 'blocked' : bad || warnings >= 2 ? 'caution' : 'ready';
  const title = tone === 'ready' ? 'Pronta per una decisione informata' : tone === 'caution' ? 'Decisione possibile, ma con riserve' : 'Non pronta: troppe prove mancanti';
  const badge = tone === 'ready' ? 'PRONTA' : tone === 'caution' ? 'CAUTELA' : 'ATTENDI';
  return `<section class="readiness-gate ${tone}"><header><div><span>MATCH READINESS GATE</span><h4>${title}</h4><p>Il gate misura se le evidenze sono mature; non promette il risultato e non sostituisce il controllo delle fonti.</p></div><b>${badge}</b></header><div>${checks.map(checkMarkup).join('')}</div></section>`;
}

function executiveBriefMarkup(data) {
  const deep = data.deepDive || {};
  const live = data.event?.state === 'in';
  const post = data.event?.state === 'post' || data.event?.completed;
  const label = post ? 'DEEP MATCH REVIEW' : live ? 'LIVE MATCH BRIEF' : 'DEEP RESEARCH BRIEF';
  const title = live ? `${data.event.home.name} ${data.event.home.score}–${data.event.away.score} ${data.event.away.name}` : deep.title || `${data.event.home.name}–${data.event.away.name}`;
  const dek = live ? 'Il dossier passa dai segnali pre-gara ai fatti pubblicati durante l’incontro.' : deep.dek || '';
  const paragraphs = (deep.paragraphs || []).slice(0, 3);
  const moments = (deep.keyMoments || []).slice(0, 6);
  return `<section class="executive-brief ${post ? 'post' : live ? 'live' : 'pre'}"><header><div><span>${label}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(dek)}</p></div><b>${post ? 'REVIEW' : live ? 'LIVE' : 'BRIEF'}</b></header>${(deep.keyNumbers || []).length ? `<div class="brief-key-numbers">${deep.keyNumbers.slice(0, 4).map(item => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.note)}</small></article>`).join('')}</div>` : ''}${paragraphs.length ? `<div class="brief-story">${paragraphs.map(item => `<article class="${String(item.type || '').toLowerCase()}"><span>${escapeHtml(item.type)}</span><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div>` : ''}${moments.length ? `<div class="brief-moments"><span>MOMENTI CHIAVE</span>${moments.map(moment => `<article><b>${escapeHtml(moment.minute)}</b><strong>${escapeHtml(moment.player || moment.teamName)}</strong><small>${escapeHtml(moment.label)}</small></article>`).join('')}</div>` : ''}</section>`;
}

function summaryWatchMarkup(data) {
  const watch = data.deepDive?.watchlist || [];
  const alerts = data.alerts || [];
  if (!watch.length && !alerts.length) return '';
  return `<section class="summary-watch"><header><span class="section-code">DECISION WATCH</span><h4>Cosa può cambiare la lettura</h4></header><div>${alerts.slice(0, 3).map(alert => `<article class="${escapeHtml(alert.level)}">${icon('info')}<div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.text)}</p></div></article>`).join('')}${watch.slice(0, 3).map(text => `<article>${icon('radar')}<div><strong>Da monitorare</strong><p>${escapeHtml(text)}</p></div></article>`).join('')}</div></section>`;
}

function matchRoomSummary(data) {
  const context = data.context || {};
  const aggregate = context.aggregate;
  const stake = aggregate ? `${aggregate.home}-${aggregate.away} aggregato · ${context.scenario}` : context.phase || context.scenario || 'Partita singola';
  const sample = (data.tactical?.home?.observedGames || 0) + (data.tactical?.away?.observedGames || 0);
  return `<div class="match-room-pane summary-pane">${readinessGate(data)}${executiveBriefMarkup(data)}<section class="room-context-strip"><article><span>CONTESTO</span><strong>${escapeHtml(stake)}</strong><small>${escapeHtml(context.venue?.name || 'Sede non disponibile')}</small></article><article><span>FORMAZIONI</span><strong>${data.lineups?.official ? 'Ufficiali' : 'In attesa'}</strong><small>${data.lineups?.official ? 'Entrambi gli XI presenti' : 'Nessuna formazione ipotizzata'}</small></article><article><span>CAMPIONE</span><strong>${sample} boxscore</strong><small>Copertura dichiarata</small></article></section>${evidenceMapMarkup(data)}${summaryWatchMarkup(data)}</div>`;
}

function matchRoomTeams(data) {
  const deep = data.deepDive || {};
  return `<div class="match-room-pane teams-pane"><section class="room-group"><header><span class="section-code">TEAM PICTURE</span><h3>Identità e forma, nello stesso posto</h3><p>Season Vault, forma recente e profilo tecnico non sono più separati nel dossier.</p></header><div class="deep-team-grid">${(deep.teamCases || []).map(deepTeamCase).join('') || '<div class="intel-empty">Profili squadra non disponibili.</div>'}</div></section><section class="room-group"><header><span class="section-code">TACTICAL MATCHUP</span><h3>Stili e incrocio tecnico</h3></header><div class="tactical-grid">${tacticalCard(data.tactical.home, data.event.home)}${tacticalCard(data.tactical.away, data.event.away)}</div><div class="matchup-box"><span>INCROCIO DI STILI</span>${(data.tactical.matchup || []).map(text => `<p>${escapeHtml(text)}</p>`).join('')}</div></section><section class="room-group"><header><span class="section-code">SCHEDULE & AVAILABILITY</span><h3>Calendario, undici e disponibilità</h3></header><div class="calendar-intel-grid">${calendarIntelCard(data.calendar.home, data.event.home)}${calendarIntelCard(data.calendar.away, data.event.away)}</div>${lineupIntel(data.lineups, data.availability)}</section></div>`;
}

function matchRoomNumbers(data) {
  const key = `${data.event.leagueId}:${data.event.id}`;
  const model = state.analyses[key];
  const modelError = state.analysisErrors[key];
  const modelContent = model ? renderPowerAnalysis(model) : modelError ? `<section class="power-error">${icon('info')}<div><strong>Analisi avanzata non disponibile</strong><p>${escapeHtml(modelError)}. Restano validi calendario, forma e dati live.</p></div></section>` : analysisLoading();
  const tournamentMarkup = (data.tournamentStats || []).length ? `<div class="tournament-intel"><span class="section-overline">NUMERI NEL TORNEO</span><div>${data.tournamentStats.map(team => `<article>${teamLogo(team, 'intel-team-logo')}<strong>${escapeHtml(team.name)}</strong><span><b>${team.goals ?? '–'}</b>gol</span><span><b>${team.conceded ?? '–'}</b>subiti</span><span><b>${team.goalDifference == null ? '–' : team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</b>diff.</span></article>`).join('')}</div></div>` : '';
  return `<div class="match-room-pane numbers-pane"><section class="room-group model-room-group"><header><span class="section-code">POWER MODEL 2.1</span><h3>Modello, probabilità e campione</h3><p>Il modello vive qui soltanto: pre-gara è valutabile, durante il live viene sospeso, dopo il finale diventa archivio.</p></header><div id="roomPowerMount">${modelContent}</div></section><section class="room-group"><header><span class="section-code">TOURNAMENT DATA</span><h3>Numeri e giocatori della competizione</h3></header>${tournamentMarkup}<div class="leaders-intel-grid">${(data.leaders || []).map(leaderIntelCard).join('') || '<div class="intel-empty">Leader del torneo non disponibili nel feed.</div>'}</div></section></div>`;
}

function matchRoomVerify(data) {
  const newsMarkup = (data.news?.articles || []).length ? data.news.articles.map(article => `<article class="intel-news" data-news-url="${escapeHtml(safeUrl(article.link))}" tabindex="0"><header><span>${escapeHtml(article.tag)}</span><em class="${escapeHtml(article.reliability || 'da_verificare')}">${article.reliability === 'forte' ? 'Fonte forte' : article.reliability === 'media' ? 'Fonte nota' : 'Da verificare'}</em></header><h5>${escapeHtml(article.title)}</h5><div><b>${escapeHtml(article.publisher)}</b><small>${article.published ? escapeHtml(displayNewsDate(article.published)) : ''}</small>${icon('external')}</div></article>`).join('') : `<div class="intel-empty">Nessun articolo chiaramente collegato trovato nelle fonti indicizzate.</div>`;
  const missing = data.deepDive?.unavailable || [];
  return `<div class="match-room-pane verify-pane">${evidenceMapMarkup(data, true)}<details class="room-disclosure" open><summary><div><span>01</span><strong>Fonti e news collegate</strong></div>${icon('chevron')}</summary><div class="intel-news-grid">${newsMarkup}</div><p class="news-disclaimer">${escapeHtml(data.news?.disclaimer || '')}</p></details><details class="room-disclosure"><summary><div><span>02</span><strong>What Changed · storia della partita</strong></div>${icon('chevron')}</summary>${matchChangeHistory(data.event.id)}</details><details class="room-disclosure"><summary><div><span>03</span><strong>Data Reliability Ledger</strong></div>${icon('chevron')}</summary>${reliabilityLedgerMarkup(data.reliability, true)}</details><section class="verification-footer"><article><span>DATI NON DISPONIBILI</span>${missing.length ? missing.map(text => `<p>${icon('info')}<span>${escapeHtml(text)}</span></p>`).join('') : '<p>Nessun vuoto aggiuntivo dichiarato.</p>'}</article><article><span>METODO</span><p>${icon('shield')}<span>${escapeHtml(data.methodology)}</span></p><p>${icon('shield')}<span>${escapeHtml(data.deepDive?.sourceNote || '')}</span></p></article></section></div>`;
}

function activateMatchRoomTab(eventId, tab, focus = false) {
  const allowed = ['summary', 'teams', 'numbers', 'verify'];
  if (!allowed.includes(tab)) return;
  state.matchRoomTabs[eventId] = tab;
  const intelligence = Object.values(state.intelligence).find(item => String(item.event?.id) === String(eventId));
  const root = $('#matchIntelligence');
  if (!intelligence || !root || $('#matchModal')?.dataset.eventId !== String(eventId)) return;
  root.innerHTML = renderIntelligence(intelligence);
  if (focus) setTimeout(() => $(`[data-room-tab="${tab}"]`, root)?.focus(), 0);
  if (tab === 'numbers') {
    const match = findMatch(String(eventId));
    if (match && !state.analyses[`${match.league.id}:${match.id}`]) void loadAnalysis(match);
  }
}

function renderIntelligence(data) {
  const evidence = collectEvidence(data);
  const eventId = String(data.event.id);
  const active = state.matchRoomTabs[eventId] || 'summary';
  const stateMode = data.event.state === 'post' || data.event.completed ? 'post' : data.event.state === 'in' ? 'live' : 'pre';
  const tabs = [
    { id: 'summary', label: 'Sintesi', meta: stateMode === 'post' ? 'Review' : stateMode === 'live' ? 'Live' : 'Decisione' },
    { id: 'teams', label: 'Squadre', meta: data.lineups?.official ? 'XI ufficiali' : `${data.availability?.structuredCount || 0} status` },
    { id: 'numbers', label: 'Numeri', meta: `fonti ${data.reliability?.overall ?? '–'}/100` },
    { id: 'verify', label: 'Verifiche', meta: `${evidence.unknown.length} aperte` }
  ];
  const panes = { summary: matchRoomSummary, teams: matchRoomTeams, numbers: matchRoomNumbers, verify: matchRoomVerify };
  return `<section class="match-control-room ${stateMode}"><header class="control-room-head"><div><span class="intel-mark">MATCH CONTROL ROOM</span><h3>${stateMode === 'post' ? 'Review organizzata' : stateMode === 'live' ? 'Controllo partita live' : 'Decisione, prove, dettagli'}</h3><p>Quattro aree, una sola posizione per ogni informazione.</p></div><div class="intel-live"><i></i>AFFIDABILITÀ ${data.reliability?.overall ?? '–'}/100</div></header><div class="match-room-tabs" role="tablist" aria-label="Aree del dossier">${tabs.map(tab => `<button id="room-tab-${tab.id}-${eventId}" role="tab" aria-selected="${active === tab.id}" aria-controls="room-panel-${eventId}" tabindex="${active === tab.id ? '0' : '-1'}" class="${active === tab.id ? 'active' : ''}" data-room-tab="${tab.id}" data-room-event="${eventId}"><span>${escapeHtml(tab.label)}</span><small>${escapeHtml(tab.meta)}</small></button>`).join('')}</div><section id="room-panel-${eventId}" class="match-room-panel" role="tabpanel" aria-labelledby="room-tab-${active}-${eventId}">${(panes[active] || panes.summary)(data)}</section></section>`;
}

function openInfo() {
  const modal = $('#matchModal');
  delete modal.dataset.eventId;
  modal.style.removeProperty('--league-color');
  modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button><header class="modal-hero"><span class="modal-competition"><i></i>TRASPARENZA</span><div style="position:relative;z-index:1;margin-top:24px"><h2 style="margin:0 0 8px;font-size:26px">Dati gratuiti, metodo chiaro.</h2><p style="margin:0;color:rgba(255,255,255,.65);font-size:11px;line-height:1.5">Nessun abbonamento e nessuna chiave API a pagamento.</p></div></header><div class="modal-body"><section class="analysis-box"><div class="analysis-box-head"><span>Fonti attive</span><strong>Feed pubblici</strong></div><p>Partite, contesto, statistiche, calendari, classifiche, lineup e injury route: feed pubblici ESPN. Fantasy Premier League ufficiale aggiunge status e aggiornamenti per la sola Premier League. Google News fornisce titoli datati e link; ANSA, Football Italia ed ESPN alimentano la Newsroom.</p></section><section class="form-comparison"><h3>Come si aggiorna</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Le partite vengono ricontrollate ogni 90 secondi mentre il sito è aperto; le notizie ogni pochi minuti. A mezzanotte il calendario avanza automaticamente sul nuovo giorno nel fuso Europe/Rome. In caso di errore temporaneo, viene mantenuta l’ultima risposta valida in cache.</p><h3 style="margin-top:18px">Power Model 2.1 + Match Intelligence</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Il Power Model combina distribuzione di Poisson, forma, precedenti, fattore campo e consenso di mercato senza margine quando presente. Match Intelligence aggiunge fase e aggregato, riposo, carico gare, campioni tecnici recenti, giocatori chiave, formazioni ufficiali e news pertinenti. Ogni elemento è marcato come fatto, lettura derivata o dato da verificare. Nessun esito è garantito.</p><h3 style="margin-top:18px">Match Control Room V4.5</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Ogni partita usa quattro aree: Sintesi, Squadre, Numeri e Verifiche. Readiness Gate controlla maturità delle prove; Evidence Map separa fatti, letture e dati mancanti; il dossier cambia fra pre, live e post. Track Record, Source Health e Availability Intelligence restano integri, ma non sono più dispersi in blocchi concorrenti.</p></section><div class="modal-note">${icon('shield')}<span>Preferiti, tema e alert sono salvati localmente nel browser. Il sito non richiede account e non invia dati personali.</span></div><div class="modal-actions"><button class="button primary" data-close-modal>Ho capito</button></div></div>`;
  $('#modalLayer').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modalLayer').hidden = true;
  if ($('#teamDnaLayer').hidden) document.body.style.overflow = '';
}

function openSearch() {
  const layer = $('#searchLayer');
  layer.hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $('#globalSearch');
  input.value = '';
  renderSearchResults('');
  setTimeout(() => input.focus(), 20);
}

function closeSearch() {
  $('#searchLayer').hidden = true;
  if ($('#modalLayer').hidden && $('#teamDnaLayer').hidden) document.body.style.overflow = '';
}

function renderSearchResults(query) {
  const root = $('#searchResults');
  if (!root) return;
  const needle = query.trim().toLocaleLowerCase('it');
  const teamMap = new Map();
  state.matches.forEach(match => [match.home, match.away].forEach(team => {
    const key = `${team.id || team.name}`;
    const existing = teamMap.get(key) || { team, matches: [] };
    existing.matches.push(match);
    teamMap.set(key, existing);
  }));
  if (!needle) {
    const spotlight = radarMatches(5);
    root.innerHTML = `<header class="search-intro"><span class="broadcast-label"><i></i>SCOUT SEARCH</span><h2>Cerca nel calcio che conta</h2><p>Squadre, competizioni, partite e titoli dal flusso aggiornato.</p></header><div class="search-section-label">IN EVIDENZA ADESSO</div>${spotlight.map(match => `<button class="search-result search-match-result" data-search-match="${escapeHtml(match.id)}"><span class="search-result-score">${match.opportunity}</span><span><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date))}</span></span>${icon('chevron')}</button>`).join('') || '<div class="search-empty">Il calendario è in aggiornamento.</div>'}`;
    return;
  }
  const matchResults = state.matches.filter(match => `${match.home.name} ${match.away.name} ${match.league.label}`.toLocaleLowerCase('it').includes(needle)).slice(0, 5);
  const teams = [...teamMap.values()].filter(item => item.team.name.toLocaleLowerCase('it').includes(needle)).slice(0, 5);
  const leagues = state.leagues.filter(league => `${league.label} ${league.country}`.toLocaleLowerCase('it').includes(needle)).slice(0, 4);
  const newsResults = state.news.filter(article => `${article.title} ${article.source}`.toLocaleLowerCase('it').includes(needle)).slice(0, 4);
  const sections = [];
  if (matchResults.length) sections.push(`<div class="search-section-label">PARTITE</div>${matchResults.map(match => `<button class="search-result search-match-result" data-search-match="${escapeHtml(match.id)}"><span class="search-result-score">${match.opportunity}</span><span><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date))}</span></span>${icon('chevron')}</button>`).join('')}`);
  if (leagues.length) sections.push(`<div class="search-section-label">COMPETIZIONI</div>${leagues.map(league => `<button class="search-result" data-search-league="${league.id}"><span class="search-result-icon">${icon('table')}</span><span><strong>${escapeHtml(league.label)}</strong><span>${escapeHtml(league.country)} · calendario e classifica</span></span>${icon('chevron')}</button>`).join('')}`);
  if (teams.length) sections.push(`<div class="search-section-label">SQUADRE</div>${teams.map(item => `<button class="search-result" data-team-dna="${escapeHtml(item.team.id)}" data-team-name="${escapeHtml(item.team.name)}" data-team-logo="${escapeHtml(safeUrl(item.team.logo))}" data-team-league="${escapeHtml(item.matches[0].league.id)}">${teamLogo(item.team, 'search-logo')}<span><strong>${escapeHtml(item.team.name)}</strong><span>Team DNA · ${item.matches.length} ${item.matches.length === 1 ? 'partita disponibile' : 'partite disponibili'}</span></span>${icon('chevron')}</button>`).join('')}`);
  if (newsResults.length) sections.push(`<div class="search-section-label">NEWSROOM</div>${newsResults.map(article => `<button class="search-result" data-search-news-url="${escapeHtml(safeUrl(article.link))}"><span class="search-result-icon">${icon('news')}</span><span><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.source)} · ${escapeHtml(newsTopic(article))}</span></span>${icon('external')}</button>`).join('')}`);
  root.innerHTML = sections.length ? sections.join('') : `<div class="search-empty">Nessun risultato per “${escapeHtml(query)}”</div>`;
}

function toast(message, error = false) {
  const root = $('#toastRegion');
  const el = document.createElement('div');
  el.className = `toast ${error ? 'error' : ''}`;
  el.innerHTML = `<i></i><span>${escapeHtml(message)}</span>`;
  root.append(el);
  setTimeout(() => el.remove(), 3500);
}

function updateNotificationControl() {
  const button = $('#notificationButton');
  if (!button) return;
  const label = state.alertsEnabled ? 'Disattiva alert' : 'Attiva alert';
  button.classList.toggle('enabled', state.alertsEnabled);
  button.setAttribute('aria-pressed', String(state.alertsEnabled));
  button.setAttribute('aria-label', label);
  button.title = label;
}

async function toggleNotifications() {
  if (!('Notification' in window)) return toast('Le notifiche non sono supportate da questo browser', true);
  if (!state.alertsEnabled) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return toast('Permesso notifiche non concesso', true);
    state.alertsEnabled = true;
    localStorage.setItem('vantaggio:alerts', 'true');
    toast('Alert attivi per le partite preferite');
  } else {
    state.alertsEnabled = false;
    localStorage.setItem('vantaggio:alerts', 'false');
    toast('Alert disattivati');
  }
  updateNotificationControl();
}

function notifyLive(match) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${match.home.name} – ${match.away.name} è iniziata`, { body: `Segui il live score su VANTAGGIO · ${match.league.label}`, icon: match.home.logo || '/favicon.svg' });
  }
}

function setupEvents() {
  document.addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    if (view) { event.preventDefault(); return goTo(view.dataset.view); }
    const fav = event.target.closest('[data-favorite]');
    if (fav) { event.preventDefault(); event.stopPropagation(); return toggleFavorite(fav.dataset.favorite); }
    const dna = event.target.closest('[data-team-dna]');
    if (dna) { event.preventDefault(); event.stopPropagation(); closeSearch(); return openTeamDna(dna.dataset.teamDna, dna.dataset.teamName, dna.dataset.teamLogo, dna.dataset.teamLeague); }
    const roomTab = event.target.closest('[data-room-tab]');
    if (roomTab) { event.preventDefault(); return activateMatchRoomTab(roomTab.dataset.roomEvent, roomTab.dataset.roomTab); }
    const match = event.target.closest('[data-match]');
    if (match) return openMatch(match.dataset.match);
    const dashLeague = event.target.closest('[data-dashboard-league]');
    if (dashLeague) { state.dashboardLeague = dashLeague.dataset.dashboardLeague; return render(); }
    const newsSource = event.target.closest('[data-news-source]');
    if (newsSource) { state.newsSource = newsSource.dataset.newsSource; return render(); }
    const date = event.target.closest('[data-date]');
    if (date) { state.selectedDate = date.dataset.date; return render(); }
    const news = event.target.closest('[data-news-url]');
    if (news) { const url = safeUrl(news.dataset.newsUrl); if (url) window.open(url, '_blank', 'noopener,noreferrer'); return; }
    const leagueShortcut = event.target.closest('[data-league]');
    if (leagueShortcut) { state.matchLeague = leagueShortcut.dataset.league; state.selectedDate = 'all'; return goTo('matches'); }
    const searchMatch = event.target.closest('[data-search-match]');
    if (searchMatch) { closeSearch(); return openMatch(searchMatch.dataset.searchMatch); }
    const searchLeague = event.target.closest('[data-search-league]');
    if (searchLeague) { state.matchLeague = searchLeague.dataset.searchLeague; state.selectedDate = 'all'; closeSearch(); return goTo('matches'); }
    const searchNews = event.target.closest('[data-search-news-url]');
    if (searchNews) { const url = safeUrl(searchNews.dataset.searchNewsUrl); closeSearch(); if (url) window.open(url, '_blank', 'noopener,noreferrer'); return; }
    if (event.target.closest('[data-close-team-dna]')) return closeTeamDna();
    if (event.target.closest('[data-close-modal]')) return closeModal();
    if (event.target.closest('[data-close-search]')) return closeSearch();
    if (event.target.closest('[data-read-changes]')) { state.changeLog = state.changeLog.map(item => ({ ...item, seen: true })); localStorage.setItem('vantaggio:changeLog', JSON.stringify(state.changeLog)); return render(); }
    if (event.target.closest('#viewRefresh')) return refreshAll(true);
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'matchLeagueSelect') { state.matchLeague = event.target.value; render(); }
    if (event.target.id === 'standingsLeagueSelect') { state.standingsLeague = event.target.value; render(); loadStandings(event.target.value); }
  });

  $('#searchTrigger').addEventListener('click', openSearch);
  $('#globalSearch').addEventListener('input', event => renderSearchResults(event.target.value));
  $('#refreshButton').addEventListener('click', () => refreshAll(true));
  $('#notificationButton').addEventListener('click', toggleNotifications);
  $('#sourceInfoButton').addEventListener('click', openInfo);
  $('#themeButton').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('vantaggio:theme', next);
    toast(next === 'dark' ? 'Tema scuro attivo' : 'Tema chiaro attivo');
  });

  document.addEventListener('keydown', event => {
    const roomTab = event.target.closest?.('[data-room-tab]');
    if (roomTab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      const tabs = $$('[data-room-tab]', roomTab.closest('[role="tablist"]'));
      const current = tabs.indexOf(roomTab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
      event.preventDefault();
      return activateMatchRoomTab(roomTab.dataset.roomEvent, tabs[next].dataset.roomTab, true);
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') { if (!$('#teamDnaLayer').hidden) closeTeamDna(); else if (!$('#searchLayer').hidden) closeSearch(); else if (!$('#modalLayer').hidden) closeModal(); }
    if (!$('#searchLayer').hidden && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      const results = $$('.search-result', $('#searchResults'));
      if (results.length) {
        event.preventDefault();
        const current = results.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? (current + 1) % results.length : (current <= 0 ? results.length - 1 : current - 1);
        results[next].focus();
      }
    }
    if (['Enter', ' '].includes(event.key) && event.target.matches('[data-match][role="button"]')) { event.preventDefault(); openMatch(event.target.dataset.match); }
    if (event.key === 'Enter' && event.target.matches('.news-card, .intel-news, .newsroom-side-story, .lead-story')) event.target.click();
  });

  window.addEventListener('hashchange', () => {
    const next = (location.hash || '#dashboard').slice(1);
    if (next !== state.currentView) goTo(next);
  });
}

function init() {
  const theme = localStorage.getItem('vantaggio:theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  updateNotificationControl();
  setupEvents();
  loadInitial();
  state.refreshTimer = setInterval(() => refreshAll(false), 90_000);
  setInterval(updateSyncStatus, 30_000);
}

init();
