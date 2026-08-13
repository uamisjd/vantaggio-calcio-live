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
  signalLifecycle: readLocalJson('vantaggio:signalLifecycle:v1', {}),
  prematchVault: readLocalJson('vantaggio:prematchVault:v1', {}),
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
  const prematchToday = state.matches.filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now() && localDateKey(match.date) === state.today).length;
  const prematchBadge = $('#prematchNavBadge');
  const favBadge = $('#favoriteBadge');
  if (prematchBadge) { prematchBadge.textContent = prematchToday; prematchBadge.dataset.count = prematchToday; prematchBadge.title = 'Prematch disponibili oggi'; }
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
    if (old.state !== match.state && match.state === 'post') {
      addChange('final', 'Risultato finale', `${match.home.name} ${match.home.score}–${match.away.score} ${match.away.name}.`, match, `${match.home.score}-${match.away.score}`);
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
    if (completed.length) { reconcileModelSnapshots(completed); reconcileSignalLifecycles(completed); if (state.currentView === 'dashboard') render(); }
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

function persistSignalLifecycle() {
  const entries = Object.entries(state.signalLifecycle).sort((a, b) => new Date(b[1].updatedAt || b[1].kickoff || 0) - new Date(a[1].updatedAt || a[1].kickoff || 0)).slice(0, 80);
  state.signalLifecycle = Object.fromEntries(entries);
  localStorage.setItem('vantaggio:signalLifecycle:v1', JSON.stringify(state.signalLifecycle));
}

function persistPrematchVault(limit = 24) {
  const entries = Object.entries(state.prematchVault).sort((a, b) => new Date(b[1].capturedAt || 0) - new Date(a[1].capturedAt || 0)).slice(0, limit);
  state.prematchVault = Object.fromEntries(entries);
  try {
    localStorage.setItem('vantaggio:prematchVault:v1', JSON.stringify(state.prematchVault));
  } catch {
    if (limit > 10) persistPrematchVault(10);
  }
}

function capturePrematchVault(match) {
  if (!match || match.state !== 'pre') return false;
  const kickoffMs = new Date(match.date).getTime();
  if (!Number.isFinite(kickoffMs) || Date.now() >= kickoffMs) return false;
  const key = `${match.league.id}:${match.id}`;
  const intelligence = state.intelligence[key];
  const analysis = state.analyses[key];
  if (!intelligence && !analysis) return false;
  if (intelligence?.event?.state && intelligence.event.state !== 'pre') return false;
  if (analysis?.event?.state && analysis.event.state !== 'pre') return false;
  const existing = state.prematchVault[match.id] || {};
  state.prematchVault[match.id] = {
    ...existing,
    eventId: match.id, leagueId: match.league.id, leagueLabel: match.league.label,
    home: match.home.name, away: match.away.name, kickoff: new Date(kickoffMs).toISOString(),
    capturedAt: new Date().toISOString(),
    intelligence: intelligence || existing.intelligence || null,
    analysis: analysis || existing.analysis || null
  };
  persistPrematchVault();
  return true;
}

function archivedPrematchData(match) {
  const vault = state.prematchVault[match.id];
  if (!vault) return null;
  const intelligence = vault.intelligence ? {
    ...vault.intelligence,
    archiveMode: 'prematch-live', archiveSnapshotAt: vault.capturedAt,
    event: { ...vault.intelligence.event, state: 'pre', completed: false }
  } : null;
  const analysis = vault.analysis ? { ...vault.analysis, archiveMode: 'prematch-live', archiveSnapshotAt: vault.capturedAt, event: { ...vault.analysis.event, state: 'pre', completed: false } } : null;
  return { ...vault, intelligence, analysis };
}

function renderPrematchVault(archive) {
  if (archive?.intelligence) {
    return `<section class="prematch-vault-banner">${icon('shield')}<div><span>PRE-MATCH VAULT · SOLA LETTURA</span><strong>Il dossier trovato prima del kickoff resta disponibile</strong><p>Fotografia del ${escapeHtml(displayNewsDate(archive.capturedAt))} alle ${escapeHtml(fmtTime.format(new Date(archive.capturedAt)))}. È una copia in sola lettura: nessun dato è ricalcolato con punteggio o andamento della gara.</p></div></section><div id="matchIntelligence">${renderIntelligence(archive.intelligence)}</div>`;
  }
  if (archive?.analysis) {
    return `<section class="prematch-vault-banner partial">${icon('shield')}<div><span>PRE-MATCH VAULT · COPERTURA PARZIALE</span><strong>È stata osservata soltanto la fotografia quantitativa</strong><p>Snapshot del ${escapeHtml(displayNewsDate(archive.capturedAt))} alle ${escapeHtml(fmtTime.format(new Date(archive.capturedAt)))}. Il dossier editoriale non era stato aperto prima del kickoff; il modello resta congelato e non viene ricalcolato.</p></div></section>${renderPowerAnalysis(archive.analysis)}`;
  }
  return `<section class="prematch-vault-empty">${icon('info')}<div><strong>Nessuna fotografia prematch salvata</strong><p>VANTAGGIO conserva solo ciò che è stato realmente osservato su questo dispositivo prima del kickoff. Non ricostruisce a posteriori un dossier che non esisteva.</p></div></section>`;
}

function captureSignalLifecycle(match, requestedStage = 'AUTO') {
  if (!match) return false;
  const key = `${match.league.id}:${match.id}`;
  const analysis = state.analyses[key];
  const intelligence = state.intelligence[key];
  if (!analysis?.probabilities || !intelligence) return false;
  const now = new Date();
  const kickoffDates = [match.date, analysis.event?.date, intelligence.event?.date].map(value => new Date(value).getTime()).filter(Number.isFinite);
  const kickoffMs = kickoffDates.length ? Math.min(...kickoffDates) : NaN;
  if (match.state !== 'pre' || analysis.event?.state !== 'pre' || intelligence.event?.state !== 'pre' || !Number.isFinite(kickoffMs) || now.getTime() >= kickoffMs) return false;
  const existing = state.signalLifecycle[match.id] || { eventId: match.id, leagueId: match.league.id, leagueLabel: match.league.label, home: match.home.name, away: match.away.name, kickoff: new Date(kickoffMs).toISOString(), snapshots: [] };
  const readiness = readinessAssessment(intelligence);
  const topSignal = analysis.signals?.[0] || null;
  const signature = JSON.stringify({
    readiness: readiness.tone, maturity: readiness.maturity,
    probabilities: analysis.probabilities, lineup: intelligence.lineups?.official,
    availability: intelligence.availability?.score, availabilityCount: intelligence.availability?.structuredCount,
    reliability: intelligence.reliability?.overall, topSignal: topSignal ? [topSignal.code, topSignal.probability] : null
  });
  const previous = existing.snapshots[existing.snapshots.length - 1];
  const normalizedStage = ['T-60', 'T-30', 'T-10'].includes(requestedStage) ? requestedStage : existing.snapshots.length ? 'UPDATE' : 'FIRST';
  if (existing.snapshots.some(snapshot => snapshot.stage === normalizedStage && normalizedStage.startsWith('T-'))) return false;
  if (previous?.signature === signature && normalizedStage === 'UPDATE') return false;
  const snapshot = {
    id: `${match.id}:${normalizedStage}:${now.toISOString()}`,
    stage: normalizedStage, first: existing.snapshots.length === 0,
    capturedAt: now.toISOString(), minutesToKickoff: Math.max(0, Math.round((kickoffMs - now.getTime()) / 60000)),
    readiness: readiness.tone, readinessLabel: readiness.title, maturity: readiness.maturity,
    probabilities: { home: Number(analysis.probabilities.home), draw: Number(analysis.probabilities.draw), away: Number(analysis.probabilities.away) },
    topSignal: topSignal ? { code: topSignal.code, label: topSignal.label, probability: Number(topSignal.probability) } : null,
    lineupsOfficial: Boolean(intelligence.lineups?.official),
    availabilityScore: Number(intelligence.availability?.score || 0),
    availabilityCount: Number(intelligence.availability?.structuredCount || 0),
    reliability: Number(intelligence.reliability?.overall || 0),
    technicalSample: Number((intelligence.tactical?.home?.observedGames || 0) + (intelligence.tactical?.away?.observedGames || 0)),
    signature
  };
  existing.kickoff = new Date(kickoffMs).toISOString();
  existing.updatedAt = now.toISOString();
  existing.snapshots = [...existing.snapshots, snapshot].slice(-8);
  state.signalLifecycle[match.id] = existing;
  persistSignalLifecycle();
  return true;
}

function reconcileSignalLifecycles(matches) {
  let changed = false;
  matches.filter(match => match.state === 'post').forEach(match => {
    const lifecycle = state.signalLifecycle[match.id];
    if (!lifecycle || lifecycle.result) return;
    const homeScore = Number(match.home.score); const awayScore = Number(match.away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
    lifecycle.result = { homeScore, awayScore, settledAt: new Date().toISOString() };
    lifecycle.updatedAt = lifecycle.result.settledAt;
    changed = true;
  });
  if (changed) persistSignalLifecycle();
}

function applyMatches(payload) {
  const incoming = payload.data?.matches || [];
  trackFixtureChanges(incoming);
  state.matches = incoming;
  reconcileModelSnapshots(state.matches);
  reconcileSignalLifecycles(state.matches);
  void reconcilePendingModels();
  state.coverage = payload.data?.coverage || { competitions: new Set(state.matches.map(match => match.league.id)).size, globalCalendar: false };
  state.dataMeta.matches = payload.meta || null;
  delete state.errors.matches;
  state.matches.forEach(match => {
    if (state.favorites.has(match.id)) state.favoriteSnapshots[match.id] = match;
    state.lastStates[match.id] = match.state;
  });
  saveFavorites();
  void runKickoffWatch();
}

async function runKickoffWatch() {
  if (state.kickoffRunning || !state.favorites.size) return;
  const candidates = state.matches.filter(match => {
    const minutes = (new Date(match.date).getTime() - Date.now()) / 60000;
    return state.favorites.has(match.id) && match.state === 'pre' && minutes > 0 && minutes <= 65;
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
        capturePrematchVault(match);
        if (captureSignalLifecycle(match, `T-${threshold}`)) refreshMatchRoom(match);
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
    .filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now())
    .filter(match => state.dashboardLeague === 'all' || match.league.id === state.dashboardLeague)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
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
    if (state.analyses[key]) { capturePrematchVault(match); return Promise.resolve({ match, analysis: state.analyses[key] }); }
    return api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}`).then(payload => {
      state.analyses[key] = payload.data;
      archivePreKickoffModel(match, payload.data);
      capturePrematchVault(match);
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
  return ({ new: 'star', time: 'clock', venue: 'ball', final: 'shield', lineup: 'table', news: 'news', kickoff: 'bell' })[kind] || 'info';
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
  const allPrematch = state.matches.filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const todayPrematch = allPrematch.filter(match => localDateKey(match.date) === state.today);
  const todayFeatured = todayPrematch.slice().sort((a, b) => b.opportunity - a.opportunity);
  const featured = todayFeatured[0] || radar[0] || upcoming[0];
  const nextPrematch = allPrematch[0];
  const in48h = allPrematch.filter(match => (new Date(match.date).getTime() - Date.now()) / 3600000 <= 48);
  const coveredCompetitions = state.coverage.competitions || new Set(state.matches.map(match => match.league.id)).size;
  const [busyLeague, busyCount] = competitionPulse(todayPrematch);
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
        <article class="briefing-card prematch-brief"><span>PRE-MATCH WINDOW</span><strong>${nextPrematch ? `${nextPrematch.home.name}–${nextPrematch.away.name}` : 'Nessun kickoff imminente'}</strong><p>${nextPrematch ? `${displayDate(nextPrematch.date)} alle ${fmtTime.format(new Date(nextPrematch.date))}: apri il dossier totale prima del via.` : 'Il calendario si aggiorna quando le fonti pubblicano nuovi eventi.'}</p></article>
        <article class="briefing-card"><span>AGENDA PRE-MATCH</span><strong>${todayPrematch.length} da studiare oggi · ${in48h.length} entro 48h</strong><p>${busyCount ? `${busyLeague} è la competizione più presente con ${busyCount} incontri futuri.` : 'Il calendario prematch si amplia automaticamente.'}</p></article>
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
        <header class="section-head"><div><span class="section-code">PRE-MATCH CONTROL</span><h2>Partite da studiare</h2><p>${todayPrematch.length} prematch oggi · poi i prossimi appuntamenti</p></div><button class="section-link" data-view="matches">Apri regia ${icon('chevron')}</button></header>
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
    <div class="hero-copy"><span class="hero-kicker"><i></i>PRE-MATCH TOTAL INTELLIGENCE</span><h1>Il calcio,<br><em>letto a fondo.</em></h1><p>Contesto, forma, calendario, rose, tattica, numeri e fonti. Apri una partita per capire cosa conta davvero prima del calcio d’inizio.</p><button class="hero-button" data-match="${escapeHtml(match.id)}">Analisi potente ${icon('arrow')}</button></div>
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
  const inProgress = match.state === 'in';
  const preWindowClosed = match.state === 'pre' && new Date(match.date).getTime() <= Date.now();
  const scoreOnly = inProgress || preWindowClosed;
  const completed = match.state === 'post';
  const dossier = state.intelligence[`${match.league.id}:${match.id}`];
  return `<article class="match-row ${scoreOnly ? 'score-only-row' : ''}">
    <button class="match-open-button" data-match="${escapeHtml(match.id)}" aria-label="${scoreOnly ? 'Apri lo stato essenziale' : completed ? 'Apri la review' : 'Apri l’analisi'} di ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}"></button>
    <div class="match-meta"><span class="match-league"><i style="--league:${escapeHtml(match.league.accent)}"></i>${escapeHtml(match.league.label)}${scoreOnly ? '' : `<b class="power-mini">${completed ? 'REVIEW' : 'DEEP'}</b>`}</span><span class="match-date">${escapeHtml(displayDate(match.date))}</span></div>
    <div class="match-team home">${teamLogo(match.home)}<div><strong>${escapeHtml(match.home.name)}</strong>${scoreOnly ? '' : formMarkup(match.home.form)}</div></div>
    <div class="match-center ${status.className}"><span class="match-time ${inProgress ? 'live-pill' : ''}">${escapeHtml(status.main)}</span><span class="match-status">${escapeHtml(status.sub)}</span></div>
    <div class="match-team away">${teamLogo(match.away)}<div><strong>${escapeHtml(match.away.name)}</strong>${scoreOnly ? '' : formMarkup(match.away.form)}</div></div>
    ${scoreOnly ? '<div class="opportunity-cell" aria-hidden="true"></div>' : completed ? '<div class="opportunity-cell"><strong>REVIEW</strong><span>Archivio partita</span></div>' : `<div class="opportunity-cell"><strong>${match.opportunity}/100</strong><span>${dossier ? 'Analisi pronta' : 'Analisi profonda'}</span></div>`}
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
  const prematch = matches.filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now());
  const next = prematch[0];
  const uniqueCompetitions = new Set(matches.map(match => match.league.id)).size;
  const [busyLeague, busyCount] = competitionPulse(matches);
  return `<div class="view matches-view v4-matchday">
    ${viewHeader('PRE-MATCH COMMAND', 'Tutte le partite', 'Ricerca prima del kickoff, calendario ordinato e score essenziale per gli incontri già iniziati.', `<button class="button" id="viewRefresh">${icon('refresh')} Sincronizza</button>`)}
    <section class="matchday-console">
      <article class="console-clock"><span>ORA UFFICIALE</span><strong>${escapeHtml(fmtTime.format(new Date()))}</strong><small>Europe/Rome</small></article>
      <article class="console-live prematch-console"><span><i></i>DOSSIER PRE-MATCH</span><strong>${prematch.length} da analizzare</strong><small>Il live resta limitato a punteggio e stato essenziale</small></article>
      <article class="console-next"><span>PROSSIMO KICK-OFF</span>${next ? `<div>${teamLogo(next.home, 'console-logo')}<strong>${escapeHtml(next.home.name)}<i>vs</i>${escapeHtml(next.away.name)}</strong>${teamLogo(next.away, 'console-logo')}</div><small>${escapeHtml(displayDate(next.date))} · ${escapeHtml(fmtTime.format(new Date(next.date)))}</small>` : '<strong>Nessun evento</strong>'}</article>
      <article class="console-density"><span>PROGRAMMA</span><strong>${matches.length} gare · ${uniqueCompetitions} tornei</strong><small>${busyCount ? `${escapeHtml(busyLeague)} guida con ${busyCount}` : 'Filtro senza eventi'}</small></article>
    </section>
    <section class="controls-card command-controls"><div class="date-strip"><button class="date-button ${state.selectedDate === 'all' ? 'active' : ''}" data-date="all"><span>Regia</span><strong>Tutte</strong></button>${dates.map(date => `<button class="date-button ${state.selectedDate === date ? 'active' : ''}" data-date="${date}"><span>${escapeHtml(date === addDays(state.today, -1) ? 'Ieri' : date === state.today ? 'Oggi' : new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)))}</span><strong>${date.slice(8)}</strong><i>${state.matches.filter(match => localDateKey(match.date) === date).length}</i></button>`).join('')}</div><select class="select-control" id="matchLeagueSelect" aria-label="Filtra competizione">${leagueOptions}</select></section>
    ${state.errors.matches && !state.matches.length ? errorBlock(state.errors.matches) : (matches.length ? `<div class="matchday-days">${Object.entries(groups).map(([date, items], dayIndex) => { const preDay = items.filter(item => item.state === 'pre' && new Date(item.date).getTime() > Date.now()).length; const dayCompetitions = new Set(items.map(item => item.league.id)).size; return `<section class="day-group command-day"><header class="day-heading"><div><span>${String(dayIndex + 1).padStart(2, '0')}</span><strong>${escapeHtml(date === state.today ? `Oggi · ${displayDate(`${date}T12:00:00Z`, true)}` : displayDate(`${date}T12:00:00Z`, true))}</strong></div><p>${preDay ? `<b>${preDay} PRE</b>` : ''}<span>${items.length} gare · ${dayCompetitions} competizioni</span></p></header><div class="match-list">${items.map(matchRow).join('')}</div></section>`; }).join('')}</div>` : emptyState('ball', 'Nessuna partita trovata', 'Prova una data o una competizione diversa. Il calendario si aggiorna automaticamente quando le fonti pubblicano nuovi incontri.'))}
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
    <section class="newsroom-status"><div><span class="broadcast-label"><i></i>NEWS DESK AGGIORNATO</span><strong>${articles.length} articoli disponibili</strong></div><div class="source-ticker">${sourceCounts.map(item => `<span><b>${item.count}</b>${escapeHtml(item.source)}</span>`).join('')}</div><small>${updated ? `Ultimo desk ${escapeHtml(relativeTime(updated))}` : 'Sincronizzazione in corso'}</small></section>
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
    content = `<section class="league-pulse"><header><div><span class="broadcast-label"><i></i>LEAGUE PULSE</span><h2>${escapeHtml(data.league.label)}</h2><p>${escapeHtml(data.season || 'Stagione corrente')}</p></div><strong>${started ? `${leader.played} giornate lette` : 'Pre-season · dati non competitivi'}</strong></header>${pulse}</section><div class="standings-layout intelligence-table-layout"><section class="standings-card"><header class="table-broadcast-head"><span>${started ? 'CLASSIFICA AGGIORNATA' : 'ELENCO SQUADRE · PRE-SEASON'}</span><small>PG partite · DR differenza reti · PPG punti per gara</small></header><div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>P</th><th>S</th><th>GF</th><th>GS</th><th>DR</th><th>PPG</th><th>PT</th></tr></thead><tbody>${tableRows}</tbody></table></div></section><aside class="league-intelligence"><span class="section-code">TABLE INTELLIGENCE</span><h3>Come leggere la corsa</h3>${tableReading}</aside></div>`;
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
  const next = matches.find(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now());
  const prematch = matches.filter(match => match.state === 'pre' && new Date(match.date).getTime() > Date.now()).length;
  const analysed = matches.filter(match => state.analyses[`${match.league.id}:${match.id}`]).length;
  const competitions = new Set(matches.map(match => match.league.id)).size;
  return `<div class="view favorites-view v4-watchroom">
    ${viewHeader('MY MATCHROOM', 'Preferiti', 'La tua sala personale: prossimi appuntamenti, dossier già aperti e alert locali senza account.')}
    ${matches.length ? `<section class="watchroom-hero"><div class="watchroom-copy"><span class="broadcast-label"><i></i>PRIVATE WATCHLIST</span><h2>La tua agenda.<br><em>Senza rumore.</em></h2><p>${matches.length} partite salvate in ${competitions} competizioni. Tutto resta esclusivamente su questo dispositivo.</p><div class="watchroom-kpis"><span><b>${prematch}</b>prematch</span><span><b>${analysed}</b>dossier aperti</span><span><b>${state.alertsEnabled ? 'ON' : 'OFF'}</b>alert</span></div></div>${next ? `<button class="next-watch" data-match="${escapeHtml(next.id)}"><header><span>NEXT ON YOUR RADAR</span><b>${escapeHtml(countdownText(next))}</b></header><div><span>${teamLogo(next.home, 'watch-logo')}<strong>${escapeHtml(next.home.name)}</strong></span><i>VS</i><span>${teamLogo(next.away, 'watch-logo')}<strong>${escapeHtml(next.away.name)}</strong></span></div><footer>${escapeHtml(next.league.label)} · ${escapeHtml(displayDate(next.date))} · ${escapeHtml(fmtTime.format(new Date(next.date)))}</footer></button>` : ''}</section><div class="watchroom-layout"><section class="section-card watchlist-card"><header class="section-head"><div><span class="section-code">SAVED FIXTURES</span><h2>Partite sotto osservazione</h2><p>Apri una riga per aggiornare il dossier completo</p></div></header><div class="match-list">${matches.map(matchRow).join('')}</div></section><aside class="watchroom-assistant"><span class="section-code">WATCH ASSISTANT</span><h3>Stato della stanza</h3><article>${icon('bell')}<div><strong>${state.alertsEnabled ? 'Alert locali attivi' : 'Alert locali disattivati'}</strong><p>${state.alertsEnabled ? 'Kickoff Watch ricontrolla dossier e formazioni a 60, 30 e 10 minuti; gli alert funzionano mentre il sito è aperto.' : 'Attivali dalla campanella in alto per seguire i cambi di stato.'}</p></div></article><article>${icon('radar')}<div><strong>${analysed}/${matches.length} dossier consultati</strong><p>Le analisi vengono ricalcolate quando apri la partita e rispettano la cache dati.</p></div></article><article>${icon('shield')}<div><strong>Privacy reale</strong><p>Nessun profilo, cookie pubblicitario o sincronizzazione esterna della watchlist.</p></div></article></aside></div>` : emptyState('star', 'La Matchroom è vuota', 'Tocca la stella accanto a una partita: qui nascerà una watchlist personale con countdown, dossier e alert.', '<button class="button primary" data-view="matches">Costruisci la Matchroom</button>')}
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
  const preWindowClosed = match.state === 'pre' && new Date(match.date).getTime() <= Date.now();
  if (match.state === 'in' || preWindowClosed) {
    const archive = archivedPrematchData(match);
    const key = `${match.league.id}:${match.id}`;
    if (archive?.analysis) state.analyses[key] = archive.analysis;
    if (archive?.intelligence) state.intelligence[key] = archive.intelligence;
    const archiveBody = renderPrematchVault(archive);
    modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button><header class="modal-hero"><span class="modal-competition"><i></i>${escapeHtml(match.league.label)}</span><div class="modal-fixture"><div class="modal-team">${teamLogo(match.home, 'modal-logo')}<strong>${escapeHtml(match.home.name)}</strong></div><div class="modal-score"><strong>${escapeHtml(status.main)}</strong><span>${escapeHtml(status.sub)}</span></div><div class="modal-team">${teamLogo(match.away, 'modal-logo')}<strong>${escapeHtml(match.away.name)}</strong></div></div></header><div class="modal-body"><section class="score-only-live">${icon('ball')}<div><span>STATO GARA</span><h3>${preWindowClosed ? 'Finestra pre-match chiusa' : 'Analisi live disattivata'}</h3><p>${preWindowClosed ? 'Il feed non ha ancora confermato lo stato. Le informazioni prematch eventualmente salvate restano congelate.' : 'Il live mostra solo score, minuto e stato. Sotto resta la fotografia prematch, senza segnali o ricalcoli durante la gara.'}</p></div></section>${archiveBody}<div class="modal-actions"><button class="button primary" data-close-modal>Chiudi</button></div></div>`;
    $('#modalLayer').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.modal-close', modal)?.focus(), 20);
    return;
  }
  const dossierMarkup = `<div id="matchIntelligence"><section class="deep-first-loading"><span class="intel-mark">MATCH CONTROL ROOM</span><h3>Sto organizzando il dossier…</h3><p>Sintesi, squadre, numeri e verifiche in un’unica architettura adattiva.</p><i></i></section></div>`;
  modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button>
    <header class="modal-hero"><span class="modal-competition"><i></i>${escapeHtml(match.league.label)} ${match.round ? `· ${escapeHtml(match.round)}` : ''}</span><div class="modal-fixture"><div class="modal-team">${teamLogo(match.home, 'modal-logo')}<strong>${escapeHtml(match.home.name)}</strong><button class="dna-trigger" data-team-dna="${escapeHtml(match.home.id)}" data-team-name="${escapeHtml(match.home.name)}" data-team-logo="${escapeHtml(safeUrl(match.home.logo))}" data-team-league="${escapeHtml(match.league.id)}">TEAM DNA</button></div><div class="modal-score"><strong>${escapeHtml(status.main)}</strong><span>${escapeHtml(status.sub)}</span></div><div class="modal-team">${teamLogo(match.away, 'modal-logo')}<strong>${escapeHtml(match.away.name)}</strong><button class="dna-trigger" data-team-dna="${escapeHtml(match.away.id)}" data-team-name="${escapeHtml(match.away.name)}" data-team-logo="${escapeHtml(safeUrl(match.away.logo))}" data-team-league="${escapeHtml(match.league.id)}">TEAM DNA</button></div></div></header>
    <div class="modal-body"><div class="modal-meta-grid"><div class="modal-meta"><span>Data e ora</span><strong>${escapeHtml(displayDate(match.date, true))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</strong></div><div class="modal-meta"><span>Stadio</span><strong title="${escapeHtml(match.venue)}">${escapeHtml(match.venue)}</strong></div><div class="modal-meta"><span>${match.state === 'post' ? 'Stato dossier' : 'Indice interesse'}</span><strong>${match.state === 'post' ? 'REVIEW' : `${match.opportunity}/100`}</strong></div></div>
      ${dossierMarkup}
      <div class="modal-actions"><button class="button ${favorite ? '' : 'primary'}" data-favorite="${escapeHtml(match.id)}">${icon('star')} ${favorite ? 'Rimuovi dai salvati' : 'Salva partita'}</button><button class="button" data-close-modal>Chiudi</button></div>
    </div>`;
  $('#modalLayer').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('.modal-close', modal)?.focus(), 20);
  loadIntelligence(match).then(() => loadAnalysis(match));
}

function refreshMatchRoom(match) {
  const key = `${match.league.id}:${match.id}`;
  const root = $('#matchIntelligence');
  if (root && state.intelligence[key] && $('#matchModal')?.dataset.eventId === match.id) root.innerHTML = renderIntelligence(state.intelligence[key]);
}

function renderFallbackDeepAnalysis(match, analysis = null, error = '') {
  const homeRecent = analysis?.recent?.home;
  const awayRecent = analysis?.recent?.away;
  const signal = match.state === 'pre' && new Date(match.date).getTime() > Date.now() ? analysis?.signals?.[0] : null;
  return `<section class="deep-dive fallback"><header><div><span>DEEP RESEARCH · COPERTURA RIDOTTA</span><h3>${escapeHtml(match.home.name)}–${escapeHtml(match.away.name)}: ciò che possiamo confermare</h3><p>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date, true))} · ${escapeHtml(fmtTime.format(new Date(match.date)))} · ${escapeHtml(match.venue || 'sede non disponibile')}</p></div><b>PARZIALE</b></header><div class="deep-number-grid"><article><span>Stato</span><strong>${escapeHtml(statusMarkup(match).main)}</strong><small>${escapeHtml(statusMarkup(match).sub)}</small></article><article><span>Forma casa</span><strong>${escapeHtml(match.home.form || 'n/d')}</strong><small>${escapeHtml(match.home.name)}</small></article><article><span>Forma ospite</span><strong>${escapeHtml(match.away.form || 'n/d')}</strong><small>${escapeHtml(match.away.name)}</small></article>${signal ? `<article><span>Segnale modello</span><strong>${signal.probability}%</strong><small>${escapeHtml(signal.label)}</small></article>` : ''}${homeRecent ? `<article><span>Gol casa</span><strong>${homeRecent.avgGoalsFor ?? '–'}</strong><small>media recente</small></article>` : ''}${awayRecent ? `<article><span>Gol ospite</span><strong>${awayRecent.avgGoalsFor ?? '–'}</strong><small>media recente</small></article>` : ''}</div><div class="fallback-evidence"><article><span>FATTI DISPONIBILI</span><p>Data, competizione, sede, stato e forma sintetica provengono dal calendario globale.</p></article><article><span>PERCHÉ È PARZIALE</span><p>${escapeHtml(error || 'Il riepilogo tecnico completo non è stato pubblicato dalla fonte.')}</p></article><article><span>REGOLA DI QUALITÀ</span><p>Non trasformiamo dati mancanti in statistiche inventate. Il dossier si completa automaticamente quando la fonte pubblica boxscore e contesto.</p></article></div></section>`;
}

function analysisLoading() {
  return `<section class="power-loading"><div class="power-loading-head"><span class="power-mark">POWER</span><strong>Sto costruendo l’analisi completa…</strong></div><div class="power-skeleton"><i></i><i></i><i></i></div><p>Forma, precedenti, distribuzione gol e consenso 1-X-2.</p></section>`;
}

async function loadAnalysis(match, force = false) {
  if (match.state === 'in' || (match.state === 'pre' && new Date(match.date).getTime() <= Date.now())) return;
  const key = `${match.league.id}:${match.id}`;
  const activeModelRoot = () => $('#roomPowerMount') || $('#advancedAnalysis');
  if (state.analyses[key] && !force) {
    archivePreKickoffModel(match, state.analyses[key]);
    capturePrematchVault(match);
    captureSignalLifecycle(match);
    refreshMatchRoom(match);
    const root = activeModelRoot();
    if (root) root.innerHTML = renderPowerAnalysis(state.analyses[key]);
    return;
  }
  try {
    const payload = await api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}${force ? '&fresh=1' : ''}`);
    state.analyses[key] = payload.data;
    delete state.analysisErrors[key];
    archivePreKickoffModel(match, payload.data);
    capturePrematchVault(match);
    captureSignalLifecycle(match);
    refreshMatchRoom(match);
    if ($('#matchModal')?.dataset.eventId === match.id && activeModelRoot()) activeModelRoot().innerHTML = renderPowerAnalysis(payload.data);
    const intelRoot = $('#matchIntelligence');
    if ($('#matchModal')?.dataset.eventId === match.id && intelRoot?.dataset.fallback === '1') intelRoot.innerHTML = renderFallbackDeepAnalysis(match, payload.data, intelRoot.dataset.error || 'Riepilogo completo non disponibile');
  } catch (error) {
    state.analysisErrors[key] = error.message;
    refreshMatchRoom(match);
    const root = activeModelRoot();
    if ($('#matchModal')?.dataset.eventId === match.id && root) {
      root.innerHTML = `<section class="power-error">${icon('info')}<div><strong>Analisi avanzata non disponibile</strong><p>${escapeHtml(error.message)}. Restano validi calendario, forma sintetica e dati prematch già verificati.</p></div></section>`;
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
    return `<section class="power-analysis live-model-paused"><header class="power-title"><div><span class="power-mark">PRE-MATCH ONLY</span><h3>Analisi live disattivata</h3></div></header><div class="archive-rule">${icon('shield')}<span>Il Power Model è disponibile esclusivamente prima del kickoff. Durante la gara VANTAGGIO mostra soltanto il punteggio essenziale nel calendario.</span></div></section>`;
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
  if (match.state === 'in' || (match.state === 'pre' && new Date(match.date).getTime() <= Date.now())) return;
  const key = `${match.league.id}:${match.id}`;
  const root = $('#matchIntelligence');
  if (!root) return;
  if (state.intelligence[key] && !force) {
    capturePrematchVault(match);
    root.innerHTML = renderIntelligence(state.intelligence[key]);
    return;
  }
  try {
    const previous = state.intelligence[key];
    const payload = await api(`/api/intelligence?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}${force ? '&fresh=1' : ''}`);
    state.intelligence[key] = payload.data;
    capturePrematchVault(match);
    captureSignalLifecycle(match);
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

function availabilityDesk(availability, archiveMode = false) {
  if (!availability?.teams) return `<div class="availability-state">${icon('shield')}<div><strong>Availability Intelligence non disponibile</strong><p>Lo stato della rosa resta sconosciuto: il silenzio non viene interpretato come piena disponibilità.</p></div></div>`;
  const sourceState = value => ({ disponibile: 'disponibile', in_attesa: 'in attesa', non_applicabile: 'non applicabile', nessun_record_pubblicato: 'feed vuoto · non conclusivo', non_disponibile: 'non disponibile', nessun_segnale: 'nessun segnale' })[value] || value.replaceAll('_', ' ');
  const teams = availability.teams.map(team => `<article class="availability-team"><header><div><span>${escapeHtml(team.teamName)}</span><strong>${team.structured.length} registrati · ${(team.signals || []).length} segnali${team.lineupOverrides?.length ? ` · ${team.lineupOverrides.length} superati dall’XI` : ''}</strong></div></header><div class="availability-players">${team.structured.length ? team.structured.map(item => `<div class="availability-player"><span class="availability-kind ${escapeHtml(item.category)}">${escapeHtml(item.category)}</span><div><strong>${escapeHtml(item.player)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.source)} · livello ${item.tier}${item.updatedAt ? ` · ${escapeHtml(displayNewsDate(item.updatedAt))}` : ''}${item.chance != null ? ` · chance dataset ${item.chance}%` : ''}</small></div></div>`).join('') : `<p class="availability-unknown">Nessun record strutturato pubblicato per questa squadra. Non significa rosa al completo.</p>`}</div>${(team.signals || []).length ? `<div class="availability-signals">${team.signals.slice(0, 3).map(item => `<button data-news-url="${escapeHtml(safeUrl(item.link))}"><span>${item.corroboratedBy ? `RISCONTRO · ${item.corroboratedBy + 1} EDITORI` : item.reliability === 'forte' ? 'FONTE FORTE' : item.reliability === 'media' ? 'FONTE NOTA' : 'DA VERIFICARE'}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher)} · ${escapeHtml(displayNewsDate(item.published))}</small></button>`).join('')}</div>` : ''}</article>`).join('');
  return `<section class="availability-desk"><header><div><span>AVAILABILITY INTELLIGENCE</span><h4>Infortuni, squalifiche, dubbi e stato lineup</h4><p>${archiveMode ? 'Fotografia al salvataggio prematch · ' : ''}${escapeHtml(availability.message)}</p></div><b>${availability.score}/100 · ${escapeHtml(availability.level)}</b></header><div class="availability-teams">${teams}</div><div class="availability-sources">${(availability.sources || []).map(source => `<span><i class="tier-${source.tier}">T${source.tier}</i><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(sourceState(source.state))}${source.updatedAt ? archiveMode ? ` · fonte del ${escapeHtml(displayNewsDate(source.updatedAt))}` : ` · ${escapeHtml(relativeTime(source.updatedAt))}` : ''}</small></span>`).join('')}</div><footer>${icon('shield')}<span>${escapeHtml(availability.rule)}</span></footer></section>`;
}

function lineupTeamCard(team) {
  const score = (label, value, note) => `<span><small>${escapeHtml(label)}</small><strong>${value == null ? '–' : value}</strong><em>${escapeHtml(note)}</em></span>`;
  const modeLabel = team.mode === 'ufficiale' ? 'XI UFFICIALE' : team.mode === 'probabile' ? 'XI PROBABILE' : 'NON PUBBLICABILE';
  const selected = (team.selected || []).map(player => {
    const evidence = player.importanceEvidence?.[0] || '';
    const stateText = team.mode === 'ufficiale' ? player.position || '' : `${player.estimatedStart}% stima`;
    return `<p><b>${escapeHtml(player.jersey || player.position || '–')}</b><span>${escapeHtml(player.name)}${player.importance >= 62 ? `<i>${escapeHtml(player.importanceLabel)}</i>` : ''}</span><small title="${escapeHtml(evidence)}">${escapeHtml(`${stateText}${evidence ? ` · ${evidence}` : ''}`)}</small></p>`;
  }).join('');
  const important = (team.importantMissing || []).map(item => `<article><span class="lineup-impact-score">${item.importance || '–'}</span><div><strong>${escapeHtml(item.player)} · ${escapeHtml(item.importanceLabel)}</strong><p>${escapeHtml(item.category)}${item.chance != null ? ` · chance dataset ${item.chance}%` : ''}</p><small>${escapeHtml((item.evidence || []).join(' · ') || item.detail || item.source || '')}</small></div></article>`).join('');
  const omissions = (team.omissions || []).map(item => `<article class="omission"><span class="lineup-impact-score">${item.importance}</span><div><strong>${escapeHtml(item.player)} · ${escapeHtml(item.status)}</strong><p>${escapeHtml(item.detail)}</p>${item.evidence?.length ? `<small>${escapeHtml(item.evidence.join(' · '))}</small>` : ''}</div></article>`).join('');
  const returns = (team.returns || []).map(item => `<p>${icon('shield')}<span><strong>${escapeHtml(item.player)}</strong>: ${escapeHtml(item.detail)}</span></p>`).join('');
  return `<article class="xi-team-card"><header><div><strong>${escapeHtml(team.teamName)}</strong><small>${escapeHtml(team.formation || 'Modulo non verificato')}</small></div><b class="${escapeHtml(team.mode)}">${modeLabel}</b></header><div class="xi-scoreboard">${score('Affidabilità XI', team.confidence, team.mode === 'ufficiale' ? 'certezza' : 'stima')}${score('Forza disponibile', team.strength, 'vs nucleo')}${score('Continuità', team.continuity, 'vs ultimo XI')}</div>${selected ? `<details class="xi-list" open><summary><strong>${team.mode === 'ufficiale' ? 'Titolari confermati' : 'Probabile formazione automatica'}</strong><span>${team.selected.length}/11</span></summary><div>${selected}</div></details>` : `<div class="xi-unavailable">${icon('info')}<span>Campione insufficiente: nessun nome viene aggiunto per completare artificialmente l’undici.</span></div>`}${important ? `<section class="xi-impact"><header><span>DISPONIBILITÀ · NOMI IMPORTANTI</span><small>assente, dubbio o in panchina</small></header>${important}</section>` : `<div class="xi-clear">${icon('shield')}<span>Nessuna assenza importante dimostrabile con le fonti disponibili. Non equivale a rosa completa.</span></div>`}${omissions ? `<section class="xi-impact"><header><span>ESCLUSIONI DALL’XI</span><small>panchina o fuori distinta</small></header>${omissions}</section>` : ''}${returns ? `<div class="xi-returns">${returns}</div>` : ''}<footer><span>${escapeHtml((team.evidence || []).join(' · ') || 'Copertura ridotta')}</span><p>${escapeHtml(team.note || '')}</p></footer></article>`;
}

function lineupIntel(data, availability, intelligence, archiveMode = false) {
  const availabilityBox = availabilityDesk(availability, archiveMode);
  if (!intelligence?.teams?.length) {
    if (!data.official) return `<div class="lineup-pending">${icon('clock')}<div><strong>Formazioni non ancora ufficiali</strong><p>${escapeHtml(data.message)}</p><span>Il campione gratuito non permette ancora una probabile affidabile.</span></div></div>${availabilityBox}`;
    return `<div class="official-lineups">${data.teams.map(team => `<article><header><strong>${escapeHtml(team.teamName)}</strong><span>${escapeHtml(team.formation || 'Modulo n/d')}</span></header><div>${team.starters.map(player => `<p><b>${escapeHtml(player.jersey || '–')}</b><span>${escapeHtml(player.name)}</span><small>${escapeHtml(player.position)}</small></p>`).join('')}</div></article>`).join('')}</div>${availabilityBox}`;
  }
  return `<section class="xi-intelligence"><header><div><span>XI INTELLIGENCE</span><h4>Chi parte, chi manca e quanto è solido l’undici</h4><p>Affidabilità della previsione e forza disponibile sono due misure diverse: nessuna delle due è una probabilità di vittoria.</p></div><b>${intelligence.official ? 'UFFICIALI' : 'PREVISIONE'}</b></header><div class="xi-team-grid">${intelligence.teams.map(lineupTeamCard).join('')}</div><footer>${icon('shield')}<span>${escapeHtml(intelligence.rule || intelligence.methodology || '')}</span></footer></section>${availabilityBox}`;
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

function contextDateConflict(data) {
  const phase = String(data.context?.phase || '');
  const eventYear = new Date(data.event?.date).getUTCFullYear();
  const years = (phase.match(/\b20\d{2}\b/g) || []).map(Number);
  if (!Number.isFinite(eventYear) || !years.some(year => year < eventYear - 1 || year > eventYear + 1)) return '';
  return `Metadato contraddittorio: il contesto indica “${phase}”, ma il calendario colloca la partita nel ${eventYear}. La fase non viene trattata come verificata.`;
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
    contextDateConflict(data),
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

function readinessAssessment(data) {
  const eventState = data.event?.state || 'pre';
  if (eventState === 'post' || data.event?.completed) {
    return {
      mode: 'post', tone: 'closed', title: 'Decisione chiusa · review attiva', badge: 'ARCHIVIO', maturity: null,
      description: 'Nessun consiglio viene prodotto dopo il finale. Il dossier usa risultato e dati realmente accaduti.',
      checks: [
        { tone: 'good', label: 'Stato', value: 'Finale' },
        { tone: data.lineups?.official ? 'good' : 'warn', label: 'Lineup', value: data.lineups?.official ? 'Ufficiali' : 'Parziali' },
        { tone: data.reliability?.overall >= 65 ? 'good' : 'warn', label: 'Copertura', value: `${data.reliability?.overall ?? '–'}/100` }
      ]
    };
  }
  if (eventState === 'in') {
    return {
      mode: 'score-only', tone: 'closed', title: 'Analisi live disattivata', badge: 'SCORE ONLY', maturity: null,
      description: 'Durante la gara restano soltanto squadre, punteggio, minuto e stato essenziale.',
      checks: [{ tone: 'good', label: 'Stato', value: data.event?.status?.clock || 'In corso' }]
    };
  }
  const referenceTime = data.archiveMode ? new Date(data.archiveSnapshotAt || data.generatedAt).getTime() : Date.now();
  const kickoffTime = new Date(data.event?.date).getTime();
  const minutes = Number.isFinite(kickoffTime) ? (kickoffTime - referenceTime) / 60000 : Infinity;
  const sample = (data.tactical?.home?.observedGames || 0) + (data.tactical?.away?.observedGames || 0);
  const generatedTime = new Date(data.generatedAt || data.engine?.generatedAt || referenceTime).getTime();
  const ageMinutes = Number.isFinite(generatedTime) ? Math.max(0, (referenceTime - generatedTime) / 60000) : 999;
  const availabilityScore = Number(data.availability?.score || 0);
  const reliabilityScore = Number(data.reliability?.overall || 0);
  const lineupScore = data.lineups?.official ? 100 : minutes <= 75 ? 20 : 55;
  const sampleScore = Math.min(100, Math.round(sample / 6 * 100));
  const freshnessScore = ageMinutes <= 20 ? 100 : ageMinutes <= 60 ? 55 : 20;
  const checks = [
    { label: 'Formazioni', value: data.lineups?.official ? 'Ufficiali' : minutes <= 75 ? 'Mancano vicino al via' : 'In attesa', tone: data.lineups?.official ? 'good' : minutes <= 75 ? 'bad' : 'warn' },
    { label: 'Disponibilità', value: `${availabilityScore}/100`, tone: availabilityScore >= 65 ? 'good' : availabilityScore >= 45 ? 'warn' : 'bad' },
    { label: 'Affidabilità', value: `${reliabilityScore}/100`, tone: reliabilityScore >= 65 ? 'good' : reliabilityScore >= 45 ? 'warn' : 'bad' },
    { label: 'Campione', value: `${sample} boxscore`, tone: sample >= 4 ? 'good' : sample >= 2 ? 'warn' : 'bad' },
    { label: 'Freschezza', value: data.archiveMode ? ageMinutes < 2 ? 'Al salvataggio' : `${Math.round(ageMinutes)} min al salvataggio` : ageMinutes < 2 ? 'Adesso' : `${Math.round(ageMinutes)} min`, tone: ageMinutes <= 20 ? 'good' : ageMinutes <= 60 ? 'warn' : 'bad' }
  ];
  const bad = checks.filter(check => check.tone === 'bad').length;
  const warnings = checks.filter(check => check.tone === 'warn').length;
  const tone = bad >= 2 ? 'blocked' : bad || warnings >= 2 ? 'caution' : 'ready';
  const readinessTitle = tone === 'ready' ? 'Pronta per una decisione informata' : tone === 'caution' ? 'Decisione possibile, ma con riserve' : 'Non pronta: troppe prove mancanti';
  return {
    mode: data.archiveMode ? 'archive' : 'pre', tone,
    title: data.archiveMode ? `Fotografia prematch: ${readinessTitle.toLowerCase()}` : readinessTitle,
    badge: data.archiveMode ? 'CONGELATA' : tone === 'ready' ? 'PRONTA' : tone === 'caution' ? 'CAUTELA' : 'ATTENDI',
    description: data.archiveMode ? 'Valutazione registrata al momento del salvataggio: non descrive la situazione live e non viene aggiornata.' : 'Il gate misura se le evidenze sono mature; non promette il risultato e non sostituisce il controllo delle fonti.',
    maturity: Math.round((lineupScore + availabilityScore + reliabilityScore + sampleScore + freshnessScore) / 5),
    checks
  };
}

function readinessGate(data) {
  const assessment = readinessAssessment(data);
  const checkMarkup = check => `<span class="readiness-check ${check.tone}"><i></i><b>${escapeHtml(check.label)}</b><small>${escapeHtml(check.value)}</small></span>`;
  return `<section class="readiness-gate ${assessment.tone}"><header><div><span>MATCH READINESS GATE</span><h4>${escapeHtml(assessment.title)}</h4><p>${escapeHtml(assessment.description)}</p></div><b>${escapeHtml(assessment.badge)}</b></header><div>${assessment.checks.map(checkMarkup).join('')}</div></section>`;
}

function executiveBriefMarkup(data) {
  const deep = data.deepDive || {};
  const post = data.event?.state === 'post' || data.event?.completed;
  const label = post ? 'DEEP MATCH REVIEW' : 'DEEP RESEARCH BRIEF';
  const title = deep.title || `${data.event.home.name}–${data.event.away.name}`;
  const paragraphs = (deep.paragraphs || []).slice(0, 3);
  const moments = (deep.keyMoments || []).slice(0, 6);
  return `<section class="executive-brief ${post ? 'post' : 'pre'}"><header><div><span>${label}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(deep.dek || '')}</p></div><b>${post ? 'REVIEW' : 'BRIEF'}</b></header>${(deep.keyNumbers || []).length ? `<div class="brief-key-numbers">${deep.keyNumbers.slice(0, 4).map(item => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.note)}</small></article>`).join('')}</div>` : ''}${paragraphs.length ? `<div class="brief-story">${paragraphs.map(item => `<article class="${String(item.type || '').toLowerCase()}"><span>${escapeHtml(item.type)}</span><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div>` : ''}${moments.length ? `<div class="brief-moments"><span>MOMENTI CHIAVE</span>${moments.map(moment => `<article><b>${escapeHtml(moment.minute)}</b><strong>${escapeHtml(moment.player || moment.teamName)}</strong><small>${escapeHtml(moment.label)}</small></article>`).join('')}</div>` : ''}</section>`;
}

function summaryWatchMarkup(data) {
  const watch = data.deepDive?.watchlist || [];
  const alerts = data.alerts || [];
  if (!watch.length && !alerts.length) return '';
  return `<section class="summary-watch"><header><span class="section-code">DECISION WATCH</span><h4>${data.archiveMode ? 'Cosa poteva cambiare la lettura' : 'Cosa può cambiare la lettura'}</h4></header><div>${alerts.slice(0, 3).map(alert => `<article class="${escapeHtml(alert.level)}">${icon('info')}<div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.text)}</p></div></article>`).join('')}${watch.slice(0, 3).map(text => `<article>${icon('radar')}<div><strong>Da monitorare</strong><p>${escapeHtml(text)}</p></div></article>`).join('')}</div></section>`;
}

function lifecycleDelta(previous, current) {
  if (!previous) return ['Baseline registrata prima del kickoff.'];
  const changes = [];
  const maturityDelta = current.maturity - previous.maturity;
  if (maturityDelta) changes.push(`Maturità ${maturityDelta > 0 ? '+' : ''}${maturityDelta}`);
  if (!previous.lineupsOfficial && current.lineupsOfficial) changes.push('XI ufficiali pubblicati');
  const availabilityDelta = current.availabilityScore - previous.availabilityScore;
  if (availabilityDelta) changes.push(`Disponibilità ${availabilityDelta > 0 ? '+' : ''}${availabilityDelta}`);
  const reliabilityDelta = current.reliability - previous.reliability;
  if (reliabilityDelta) changes.push(`Affidabilità ${reliabilityDelta > 0 ? '+' : ''}${reliabilityDelta}`);
  if (current.topSignal?.code !== previous.topSignal?.code) changes.push(`Segnale: ${current.topSignal?.label || 'nessuno'}`);
  else if (current.topSignal && previous.topSignal && current.topSignal.probability !== previous.topSignal.probability) {
    const delta = current.topSignal.probability - previous.topSignal.probability;
    changes.push(`Segnale ${delta > 0 ? '+' : ''}${delta} pt`);
  }
  if (current.availabilityCount !== previous.availabilityCount) changes.push(`${current.availabilityCount} status rosa`);
  return changes.length ? changes.slice(0, 3) : ['Nessuna variazione materiale.'];
}

function signalLifecycleMarkup(data) {
  const lifecycle = state.signalLifecycle[String(data.event.id)];
  const snapshots = lifecycle?.snapshots || [];
  if (!snapshots.length) return `<section class="signal-lifecycle empty"><header><div><span class="section-code">SIGNAL LIFECYCLE</span><h4>Come cambia la lettura prima del via</h4></div><small>Archivio locale</small></header><div class="lifecycle-empty">${icon('clock')}<div><strong>${data.archiveMode ? 'Timeline non osservata prima del kickoff' : 'Prima fotografia in preparazione'}</strong><p>${data.archiveMode ? 'Il Vault non crea checkpoint retroattivi durante la gara.' : 'La timeline si attiva quando modello e Intelligence sono disponibili prima del kickoff. Nessun dato viene ricostruito a posteriori.'}</p></div></div></section>`;
  const stageLabel = snapshot => snapshot.first ? (snapshot.stage.startsWith('T-') ? `PRIMA · ${snapshot.stage}` : 'PRIMA LETTURA') : snapshot.stage === 'UPDATE' ? 'AGGIORNAMENTO' : snapshot.stage;
  const cards = snapshots.map((snapshot, index) => {
    const delta = lifecycleDelta(snapshots[index - 1], snapshot);
    const tone = snapshot.readiness === 'ready' ? 'good' : snapshot.readiness === 'caution' ? 'warn' : 'bad';
    return `<article class="lifecycle-card ${tone} ${index === snapshots.length - 1 ? 'latest' : ''}"><header><i></i><span>${escapeHtml(stageLabel(snapshot))}</span><small>T-${snapshot.minutesToKickoff}' · ${escapeHtml(fmtTime.format(new Date(snapshot.capturedAt)))}</small></header><div class="lifecycle-score"><strong>${snapshot.maturity}<small>/100</small></strong><span>${escapeHtml(snapshot.readinessLabel)}</span></div><div class="lifecycle-model"><span>1 ${snapshot.probabilities.home}%</span><span>X ${snapshot.probabilities.draw}%</span><span>2 ${snapshot.probabilities.away}%</span></div><ul>${delta.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul></article>`;
  }).join('');
  return `<section class="signal-lifecycle"><header><div><span class="section-code">SIGNAL LIFECYCLE</span><h4>Dal primo segnale al kickoff</h4></div><small>${snapshots.length} ${snapshots.length === 1 ? 'fotografia' : 'fotografie'} · solo pre-partita</small></header><div class="lifecycle-track">${cards}</div>${lifecycle.result ? `<footer>${icon('shield')}<span>Timeline chiusa: risultato finale ${lifecycle.home} ${lifecycle.result.homeScore}–${lifecycle.result.awayScore} ${lifecycle.away}. Gli snapshot non sono stati ricalcolati.</span></footer>` : `<footer>${icon('info')}<span>Snapshot locali e immutabili: prima lettura, aggiornamenti materiali e controlli Kickoff Watch T-60/T-30/T-10.</span></footer>`}</section>`;
}

function prematchTotalIntelligence(data) {
  if (data.event?.state !== 'pre') return '';
  const key = `${data.event.leagueId}:${data.event.id}`;
  const model = state.analyses[key];
  const modelError = state.analysisErrors[key];
  const evidence = collectEvidence(data);
  const sample = (data.tactical?.home?.observedGames || 0) + (data.tactical?.away?.observedGames || 0);
  const homeRecent = model?.recent?.home || data.deepDive?.teamCases?.[0]?.recent;
  const awayRecent = model?.recent?.away || data.deepDive?.teamCases?.[1]?.recent;
  const restKnown = [data.calendar?.home?.restDays, data.calendar?.away?.restDays].filter(value => value != null).length;
  const strongNews = (data.news?.articles || []).filter(article => article.reliability === 'forte').length;
  const contextConflict = contextDateConflict(data);
  const xiTeams = data.lineupIntelligence?.teams || [];
  const probableTeams = xiTeams.filter(team => team.mode === 'probabile').length;
  const importantStatuses = xiTeams.reduce((sum, team) => sum + (team.importantMissing || []).length, 0);
  const status = (tone, label) => ({ tone, label });
  const items = [
    {
      title: 'Contesto e motivazioni', tab: 'summary',
      state: contextConflict ? status('missing', 'Contraddittorio') : data.context?.phase && data.context?.venue?.name ? status('full', 'Completo') : status('partial', 'Parziale'),
      headline: contextConflict ? 'Fase e data non coincidono' : data.context?.phase || data.context?.scenario || 'Contesto da consolidare',
      detail: contextConflict || data.context?.keyQuestion || data.keyQuestion || data.context?.facts?.[0] || 'Posta in palio non documentata.'
    },
    {
      title: 'Forma, casa/trasferta e calendario', tab: 'teams',
      state: (homeRecent?.played >= 3 && awayRecent?.played >= 3 && restKnown === 2) ? status('full', 'Completo') : (homeRecent?.played || awayRecent?.played || restKnown) ? status('partial', 'Parziale') : status('missing', 'Non disponibile'),
      headline: `${data.event.home.name}: ${homeRecent?.played || 0} gare · ${data.event.away.name}: ${awayRecent?.played || 0} gare`,
      detail: `Riposo noto per ${restKnown}/2 squadre; split e risultati restano legati al campione visibile.`
    },
    {
      title: 'Incrocio tattico', tab: 'teams',
      state: sample >= 4 ? status('full', 'Solido') : sample ? status('partial', 'Campione ridotto') : status('missing', 'Non disponibile'),
      headline: `${sample} boxscore tecnici osservati`,
      detail: data.tactical?.matchup?.[0] || 'Nessun matchup tattico sufficientemente documentato.'
    },
    {
      title: 'Rosa, assenze e formazioni', tab: 'teams',
      state: data.lineups?.official && data.availability?.score >= 65 ? status('full', 'Verificato') : probableTeams === 2 || data.availability?.structuredCount || data.availability?.signalCount ? status('partial', 'Da aggiornare') : status('missing', 'Non documentato'),
      headline: data.lineups?.official ? `XI ufficiali · ${importantStatuses} nomi importanti segnalati` : probableTeams ? `${probableTeams}/2 probabili · ${importantStatuses} nomi importanti segnalati` : `${data.availability?.structuredCount || 0} status · ${data.availability?.signalCount || 0} segnali`,
      detail: xiTeams.length ? xiTeams.map(team => `${team.teamName}: XI ${team.confidence ?? '–'}/100 · forza ${team.strength ?? '–'}/100`).join(' · ') : data.availability?.message || 'Stato delle rose non documentato.'
    },
    {
      title: 'Modello, scenari e mercato', tab: 'numbers',
      state: model?.probabilities && model?.market?.outcome ? status('full', 'Modello + mercato') : model?.probabilities ? status('partial', 'Solo modello') : modelError || data.archiveMode ? status('missing', data.archiveMode ? 'Non osservato' : 'Non disponibile') : status('partial', 'In caricamento'),
      headline: model?.signals?.[0] ? `${model.signals[0].label} · ${model.signals[0].probability}%` : data.archiveMode ? 'Nessun modello salvato prima del via' : modelError ? 'Lettura quantitativa non raggiungibile' : 'Lettura quantitativa in preparazione',
      detail: model?.market?.outcome ? `Consenso mercato presente: ${model.market.provider}.` : data.archiveMode ? 'Il Vault non completa questa area dopo il kickoff.' : modelError ? `Errore dichiarato: ${modelError}.` : 'Mercato non pubblicato dal provider: nessuna quota viene inventata.'
    },
    {
      title: 'Fonti, news e punti oscuri', tab: 'verify',
      state: strongNews && evidence.unknown.length <= 2 ? status('full', 'Ben documentato') : (data.news?.articles?.length || evidence.facts.length) ? status('partial', 'Da verificare') : status('missing', 'Copertura debole'),
      headline: `${data.news?.articles?.length || 0} news · ${strongNews} fonti forti · ${evidence.unknown.length} punti aperti`,
      detail: evidence.unknown[0] || 'Nessun vuoto informativo prioritario dichiarato.'
    }
  ];
  const full = items.filter(item => item.state.tone === 'full').length;
  const partial = items.filter(item => item.state.tone === 'partial').length;
  const missing = items.filter(item => item.state.tone === 'missing').length;
  return `<section class="prematch-total-intelligence"><header><div><span class="section-code">PRE-MATCH TOTAL INTELLIGENCE</span><h4>Il quadro completo, senza nascondere i vuoti</h4><p>Sei domande fondamentali. Tocca una riga per aprire subito tutte le prove nella sezione corretta.</p></div><div><strong>${full}/6</strong><span>complete</span></div></header><div class="prematch-coverage-bar"><span class="full" style="--share:${full / 6 * 100}%"></span><span class="partial" style="--share:${partial / 6 * 100}%"></span><span class="missing" style="--share:${missing / 6 * 100}%"></span></div><div class="prematch-manifest">${items.map((item, index) => `<button data-prematch-jump="${item.tab}" data-room-event="${escapeHtml(data.event.id)}"><span class="manifest-index">${String(index + 1).padStart(2, '0')}</span><div><small>${escapeHtml(item.title)}</small><strong>${escapeHtml(item.headline)}</strong><p>${escapeHtml(item.detail)}</p></div><em class="${item.state.tone}"><i></i>${escapeHtml(item.state.label)}</em>${icon('chevron')}</button>`).join('')}</div><footer>${icon('shield')}<span>${full} aree complete, ${partial} parziali, ${missing} non documentate. “Non disponibile” resta un’informazione, non viene coperto da una stima.</span></footer></section>`;
}

function matchRoomSummary(data) {
  return `<div class="match-room-pane summary-pane">${readinessGate(data)}${executiveBriefMarkup(data)}${prematchTotalIntelligence(data)}${signalLifecycleMarkup(data)}${summaryWatchMarkup(data)}</div>`;
}

function matchRoomTeams(data) {
  const deep = data.deepDive || {};
  return `<div class="match-room-pane teams-pane"><section class="room-group"><header><span class="section-code">TEAM PICTURE</span><h3>Identità e forma, nello stesso posto</h3><p>Season Vault, forma recente e profilo tecnico non sono più separati nel dossier.</p></header><div class="deep-team-grid">${(deep.teamCases || []).map(deepTeamCase).join('') || '<div class="intel-empty">Profili squadra non disponibili.</div>'}</div></section><section class="room-group"><header><span class="section-code">TACTICAL MATCHUP</span><h3>Stili e incrocio tecnico</h3></header><div class="tactical-grid">${tacticalCard(data.tactical.home, data.event.home)}${tacticalCard(data.tactical.away, data.event.away)}</div><div class="matchup-box"><span>INCROCIO DI STILI</span>${(data.tactical.matchup || []).map(text => `<p>${escapeHtml(text)}</p>`).join('')}</div></section><section class="room-group"><header><span class="section-code">SCHEDULE & AVAILABILITY</span><h3>Calendario, undici e disponibilità</h3></header><div class="calendar-intel-grid">${calendarIntelCard(data.calendar.home, data.event.home)}${calendarIntelCard(data.calendar.away, data.event.away)}</div>${lineupIntel(data.lineups, data.availability, data.lineupIntelligence, data.archiveMode)}</section></div>`;
}

function matchRoomNumbers(data) {
  const key = `${data.event.leagueId}:${data.event.id}`;
  const model = state.analyses[key];
  const modelError = state.analysisErrors[key];
  const modelContent = model ? renderPowerAnalysis(model) : modelError ? `<section class="power-error">${icon('info')}<div><strong>Analisi avanzata non disponibile</strong><p>${escapeHtml(modelError)}. Restano validi calendario, forma e dati prematch già verificati.</p></div></section>` : data.archiveMode ? `<section class="power-error neutral">${icon('info')}<div><strong>Modello non osservato prima del kickoff</strong><p>Il Vault non ricostruisce probabilità a partita iniziata.</p></div></section>` : analysisLoading();
  const tournamentMarkup = (data.tournamentStats || []).length ? `<div class="tournament-intel"><span class="section-overline">NUMERI NEL TORNEO</span><div>${data.tournamentStats.map(team => `<article>${teamLogo(team, 'intel-team-logo')}<strong>${escapeHtml(team.name)}</strong><span><b>${team.goals ?? '–'}</b>gol</span><span><b>${team.conceded ?? '–'}</b>subiti</span><span><b>${team.goalDifference == null ? '–' : team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</b>diff.</span></article>`).join('')}</div></div>` : '';
  return `<div class="match-room-pane numbers-pane"><section class="room-group model-room-group"><header><span class="section-code">POWER MODEL 2.1</span><h3>Modello, probabilità e campione</h3><p>Il modello vive qui soltanto: è valutabile prima del kickoff e dopo il finale resta solo come fotografia storica non ricalcolata.</p></header><div id="roomPowerMount">${modelContent}</div></section><section class="room-group"><header><span class="section-code">TOURNAMENT DATA</span><h3>Numeri e giocatori della competizione</h3></header>${tournamentMarkup}<div class="leaders-intel-grid">${(data.leaders || []).map(leaderIntelCard).join('') || '<div class="intel-empty">Leader del torneo non disponibili nel feed.</div>'}</div></section></div>`;
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
  if (data.event?.state === 'in') return `<section class="score-only-live inline">${icon('ball')}<div><span>SCORE ESSENZIALE</span><h3>${escapeHtml(data.event.home.name)} ${data.event.home.score}–${data.event.away.score} ${escapeHtml(data.event.away.name)}</h3><p>Analisi live disattivata: il dossier VANTAGGIO è progettato per la ricerca completa prima del kickoff.</p></div></section>`;
  const evidence = collectEvidence(data);
  const eventId = String(data.event.id);
  const active = state.matchRoomTabs[eventId] || 'summary';
  const stateMode = data.archiveMode ? 'archive' : data.event.state === 'post' || data.event.completed ? 'post' : 'pre';
  const tabs = [
    { id: 'summary', label: 'Sintesi', meta: stateMode === 'post' ? 'Review' : stateMode === 'archive' ? 'Congelata' : 'Decisione' },
    { id: 'teams', label: 'Squadre', meta: data.lineups?.official ? 'XI ufficiali' : data.lineupIntelligence?.teams?.some(team => team.mode === 'probabile') ? 'XI probabili' : `${data.availability?.structuredCount || 0} status` },
    { id: 'numbers', label: 'Numeri', meta: `fonti ${data.reliability?.overall ?? '–'}/100` },
    { id: 'verify', label: 'Verifiche', meta: `${evidence.unknown.length} aperte` }
  ];
  const panes = { summary: matchRoomSummary, teams: matchRoomTeams, numbers: matchRoomNumbers, verify: matchRoomVerify };
  return `<section class="match-control-room ${stateMode}"><header class="control-room-head"><div><span class="intel-mark">MATCH CONTROL ROOM</span><h3>${stateMode === 'post' ? 'Review organizzata' : stateMode === 'archive' ? 'Dossier prematch congelato' : 'Decisione, prove, dettagli'}</h3><p>Quattro aree, una sola posizione per ogni informazione.</p></div><div class="intel-live"><i></i>AFFIDABILITÀ ${data.reliability?.overall ?? '–'}/100</div></header><div class="match-room-tabs" role="tablist" aria-label="Aree del dossier">${tabs.map(tab => `<button id="room-tab-${tab.id}-${eventId}" role="tab" aria-selected="${active === tab.id}" aria-controls="room-panel-${eventId}" tabindex="${active === tab.id ? '0' : '-1'}" class="${active === tab.id ? 'active' : ''}" data-room-tab="${tab.id}" data-room-event="${eventId}"><span>${escapeHtml(tab.label)}</span><small>${escapeHtml(tab.meta)}</small></button>`).join('')}</div><section id="room-panel-${eventId}" class="match-room-panel" role="tabpanel" aria-labelledby="room-tab-${active}-${eventId}">${(panes[active] || panes.summary)(data)}</section></section>`;
}

function openInfo() {
  const modal = $('#matchModal');
  delete modal.dataset.eventId;
  modal.style.removeProperty('--league-color');
  modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button><header class="modal-hero"><span class="modal-competition"><i></i>TRASPARENZA</span><div style="position:relative;z-index:1;margin-top:24px"><h2 style="margin:0 0 8px;font-size:26px">Dati gratuiti, metodo chiaro.</h2><p style="margin:0;color:rgba(255,255,255,.65);font-size:11px;line-height:1.5">Nessun abbonamento e nessuna chiave API a pagamento.</p></div></header><div class="modal-body"><section class="analysis-box"><div class="analysis-box-head"><span>Fonti attive</span><strong>Feed pubblici</strong></div><p>Partite, contesto, statistiche, calendari, classifiche, lineup e injury route: feed pubblici ESPN. Fantasy Premier League ufficiale aggiunge status e aggiornamenti per la sola Premier League. Google News fornisce titoli datati e link; ANSA, Football Italia ed ESPN alimentano la Newsroom.</p></section><section class="form-comparison"><h3>Come si aggiorna</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Le partite vengono ricontrollate ogni 90 secondi mentre il sito è aperto; le notizie ogni pochi minuti. A mezzanotte il calendario avanza automaticamente sul nuovo giorno nel fuso Europe/Rome. In caso di errore temporaneo, viene mantenuta l’ultima risposta valida in cache.</p><h3 style="margin-top:18px">Power Model 2.1 + Match Intelligence</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Il Power Model combina distribuzione di Poisson, forma, precedenti, fattore campo e consenso di mercato senza margine quando presente. Match Intelligence aggiunge fase e aggregato, riposo, carico gare, campioni tecnici recenti, giocatori chiave, formazioni ufficiali e news pertinenti. Ogni elemento è marcato come fatto, lettura derivata o dato da verificare. Nessun esito è garantito.</p><h3 style="margin-top:18px">XI Intelligence + Pre-Match Vault V4.8</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Le probabili derivano da XI recenti pesati, ruoli e disponibilità; le ufficiali soltanto dagli starter pubblicati per l’evento. Affidabilità XI, Forza disponibile e Continuità sono misure distinte, mai probabilità di vittoria. Durante il live score e stato sono correnti, mentre il dossier già osservato prima del kickoff resta locale, congelato, timestampato e in sola lettura: nessuna ricalcolazione post-hoc.</p><h3 style="margin-top:18px">Pre-Match Total Intelligence V4.7</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Il manifesto in Sintesi dichiara complete, parziali o non disponibili sei aree indispensabili e porta direttamente alle prove. Il dossier prematch congelato non produce segnali o consigli live.</p><h3 style="margin-top:18px">Signal Lifecycle V4.6</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Dentro la Sintesi, Signal Lifecycle conserva soltanto fotografie realmente pre-kickoff: prima lettura, aggiornamenti materiali e controlli T-60, T-30 e T-10 del Kickoff Watch. Mostra variazioni di readiness, probabilità, lineup, disponibilità e affidabilità; dopo il finale aggiunge il risultato senza ricalcolare il passato.</p></section><div class="modal-note">${icon('shield')}<span>Preferiti, tema e alert sono salvati localmente nel browser. Il sito non richiede account e non invia dati personali.</span></div><div class="modal-actions"><button class="button primary" data-close-modal>Ho capito</button></div></div>`;
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
  if (matchResults.length) sections.push(`<div class="search-section-label">PARTITE</div>${matchResults.map(match => `<button class="search-result search-match-result" data-search-match="${escapeHtml(match.id)}"><span class="search-result-score">${match.state === 'pre' && new Date(match.date).getTime() > Date.now() ? match.opportunity : match.state === 'pre' ? '–' : `${match.home.score}-${match.away.score}`}</span><span><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.league.label)} · ${escapeHtml(match.state === 'pre' && new Date(match.date).getTime() > Date.now() ? displayDate(match.date) : match.state === 'pre' ? 'Stato da aggiornare' : statusMarkup(match).sub)}</span></span>${icon('chevron')}</button>`).join('')}`);
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
    const prematchJump = event.target.closest('[data-prematch-jump]');
    if (prematchJump) { event.preventDefault(); return activateMatchRoomTab(prematchJump.dataset.roomEvent, prematchJump.dataset.prematchJump, true); }
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
