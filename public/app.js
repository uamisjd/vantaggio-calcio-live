'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  currentView: (location.hash || '#dashboard').slice(1),
  leagues: [],
  today: '',
  matches: [],
  news: [],
  tables: {},
  analyses: {},
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
  favorites: new Set(JSON.parse(localStorage.getItem('vantaggio:favorites') || '[]')),
  favoriteSnapshots: JSON.parse(localStorage.getItem('vantaggio:favoriteSnapshots') || '{}'),
  alertsEnabled: localStorage.getItem('vantaggio:alerts') === 'true',
  lastStates: {},
  refreshTimer: null
};

const fmtTime = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short' });
const fmtLongDay = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' });

function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function safeUrl(value = '') {
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : '';
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

function formScore(form = '') {
  const values = String(form).toUpperCase().replace(/[^VPSWDL]/g, '').replaceAll('W', 'V').replaceAll('D', 'P').replaceAll('L', 'S').slice(-5).split('');
  if (!values.length) return 50;
  return Math.round(values.reduce((sum, item) => sum + (item === 'V' ? 100 : item === 'P' ? 48 : 0), 0) / values.length);
}

function teamLogo(team, className = 'team-logo') {
  const initials = escapeHtml((team.abbreviation || team.name || 'FC').slice(0, 3).toUpperCase());
  const src = safeUrl(team.logo);
  if (!src) return `<span class="logo-fallback ${className === 'team-logo' ? '' : className}">${initials}</span>`;
  return `<img class="${className}" src="${src}" alt="${escapeHtml(team.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="logo-fallback" style="display:none">${initials}</span>`;
}

function formMarkup(form = '') {
  if (!form) return '';
  return `<span class="team-form" aria-label="Forma ${escapeHtml(form)}">${form.split('').map(item => `<i class="form-dot ${item.toLowerCase()}">${item}</i>`).join('')}</span>`;
}

function getLeague(id) {
  return state.leagues.find(league => league.id === id) || { id, label: id, accent: '#c8ff52', country: '' };
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
    state.today = status.today;
  } catch (error) {
    state.today = localDateKey(new Date());
    state.errors.status = error.message;
  }
  const from = addDays(state.today, -1);
  const to = addDays(state.today, 13);
  const [matches, news] = await Promise.allSettled([
    api(`/api/matches?league=all&from=${from}&to=${to}`),
    api('/api/news')
  ]);
  if (matches.status === 'fulfilled') applyMatches(matches.value);
  else state.errors.matches = matches.reason.message;
  if (news.status === 'fulfilled') applyNews(news.value);
  else state.errors.news = news.reason.message;
  state.loading = false;
  updateSyncStatus();
  updateBadges();
  render();
  loadStandings(state.standingsLeague, false);
  loadPowerPicks();
}

function applyMatches(payload) {
  const previous = Object.fromEntries(state.matches.map(match => [match.id, match.state]));
  state.matches = payload.data?.matches || [];
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
  const suffix = manual ? '&fresh=1' : '';
  const from = addDays(state.today, -1);
  const to = addDays(state.today, 13);
  const [matches, news] = await Promise.allSettled([
    api(`/api/matches?league=all&from=${from}&to=${to}${suffix}`),
    api(`/api/news?auto=1${manual ? '&fresh=1' : ''}`)
  ]);
  if (matches.status === 'fulfilled') applyMatches(matches.value);
  else state.errors.matches = matches.reason.message;
  if (news.status === 'fulfilled') applyNews(news.value);
  else state.errors.news = news.reason.message;
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
    .filter(isUpcoming)
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
  return `<article class="power-pick" data-match="${escapeHtml(item.match.id)}"><span class="radar-rank">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(item.match.home.name)} — ${escapeHtml(item.match.away.name)}</strong><small>${escapeHtml(signal.label)} · qualità ${item.analysis.engine.quality}/100</small></div><b>${signal.probability}<small>%</small></b></article>`;
}

function renderDashboard() {
  const upcoming = filteredDashboardMatches();
  const radar = radarMatches(6);
  const todayFeatured = state.matches.filter(match => isUpcoming(match) && localDateKey(match.date) === state.today).sort((a, b) => b.opportunity - a.opportunity);
  const featured = todayFeatured[0] || radar[0] || upcoming[0];
  const live = state.matches.filter(match => match.state === 'in').length;
  const todayMatches = state.matches.filter(match => localDateKey(match.date) === state.today).length;
  const in48h = state.matches.filter(match => {
    const hours = (new Date(match.date).getTime() - Date.now()) / 3600000;
    return hours >= 0 && hours <= 48;
  }).length;
  const coveredCompetitions = state.coverage.competitions || new Set(state.matches.map(match => match.league.id)).size;
  return `<div class="view dashboard-view">
    ${renderHero(featured)}
    <section class="metric-grid" aria-label="Indicatori principali">
      ${metric('ball', live, 'Partite live', 'red')}
      ${metric('clock', todayMatches, 'Partite disponibili oggi', 'accent')}
      ${metric('radar', in48h, 'Nelle prossime 48h', 'blue')}
      ${metric('shield', coveredCompetitions, 'Competizioni coperte', '')}
    </section>
    <div class="dashboard-grid">
      <section class="section-card matches-card">
        <header class="section-head"><div><h2>Oggi sul campo</h2><p>${todayMatches} partite oggi · poi i prossimi appuntamenti</p></div><button class="section-link" data-view="matches">Calendario ${icon('chevron')}</button></header>
        ${leagueFilters(state.dashboardLeague, 'dashboard-league')}
        ${state.errors.matches && !state.matches.length ? errorBlock(state.errors.matches, true) : (upcoming.length ? `<div class="match-list">${upcoming.slice(0, 7).map(matchRow).join('')}</div>` : emptyInline('Nessuna partita nel periodo selezionato'))}
      </section>
      <section class="section-card radar-card">
        <header class="section-head"><div><h2>Power Picks</h2><p>Segnali calcolati su dati profondi</p></div><button class="section-link" data-view="radar">Radar ${icon('chevron')}</button></header>
        <div class="radar-list">${state.powerPicks.length ? state.powerPicks.map(powerPickItem).join('') : state.powerLoading ? `<div class="power-picks-loading"><i></i><i></i><i></i></div>` : (radar.length ? radar.slice(0, 5).map((match, index) => radarItem(match, index)).join('') : emptyInline('In attesa delle prossime partite'))}</div>
        <div class="radar-disclaimer">${icon('info')}<span>Le percentuali sono stime del modello sui dati disponibili, non garanzie. Apri una partita per verificare campione e rischio.</span></div>
      </section>
    </div>
    <section class="news-section">
      <header class="plain-section-head"><div><h2>Ultime dal calcio</h2><p>Notizie aggregate dalle fonti disponibili</p></div><button class="section-link" data-view="news">Tutte le notizie ${icon('arrow')}</button></header>
      ${state.errors.news && !state.news.length ? errorBlock(state.errors.news, true) : `<div class="news-row">${state.news.slice(0, 3).map(newsCard).join('')}</div>`}
    </section>
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
    <div class="hero-copy"><span class="hero-kicker"><i></i>POWER MODEL 2.0 · DATI LIVE</span><h1>Il calcio,<br><em>letto a fondo.</em></h1><p>Forma reale, medie gol, precedenti, probabilità 1-X-2, Over/Under, entrambe a segno e qualità del campione. Apri una partita per l’analisi completa.</p><button class="hero-button" data-match="${escapeHtml(match.id)}">Analisi potente ${icon('arrow')}</button></div>
    <button class="hero-feature" data-match="${escapeHtml(match.id)}" aria-label="Analizza ${escapeHtml(match.home.name)} contro ${escapeHtml(match.away.name)}">
      <div class="hero-feature-top"><span class="hero-feature-label">IN EVIDENZA · ${escapeHtml(match.league.label)}</span><span class="score-ring" style="--score:${match.opportunity}"><span>${match.opportunity}</span></span></div>
      <div class="hero-fixture"><div class="hero-team">${teamLogo(match.home, 'hero-logo')}<strong>${escapeHtml(match.home.name)}</strong></div><div class="hero-vs"><strong>${escapeHtml(status.main)}</strong><span>${match.state === 'pre' ? escapeHtml(displayDate(match.date)) : escapeHtml(status.sub)}</span></div><div class="hero-team">${teamLogo(match.away, 'hero-logo')}<strong>${escapeHtml(match.away.name)}</strong></div></div>
      <div class="hero-insight">${icon('radar')}<div><strong>${powerSignal ? `${escapeHtml(powerSignal.label)} · ${powerSignal.probability}%` : escapeHtml(match.insight.label)}</strong><span>${powerSignal ? `Power Model · qualità dati ${power.engine.quality}/100 · apri per tutti i dettagli` : escapeHtml(match.insight.text)}</span></div></div>
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
  return `<article class="match-row" data-match="${escapeHtml(match.id)}">
    <div class="match-meta"><span class="match-league"><i style="--league:${escapeHtml(match.league.accent)}"></i>${escapeHtml(match.league.label)}<b class="power-mini">POWER</b></span><span class="match-date">${escapeHtml(displayDate(match.date))}</span></div>
    <div class="match-team home">${teamLogo(match.home)}<div><strong>${escapeHtml(match.home.name)}</strong>${formMarkup(match.home.form)}</div></div>
    <div class="match-center ${status.className}"><span class="match-time ${match.state === 'in' ? 'live-pill' : ''}">${escapeHtml(status.main)}</span><span class="match-status">${escapeHtml(status.sub)}</span></div>
    <div class="match-team away">${teamLogo(match.away)}<div><strong>${escapeHtml(match.away.name)}</strong>${formMarkup(match.away.form)}</div></div>
    <div class="opportunity-cell"><strong>${match.opportunity}/100</strong><span>${escapeHtml(match.insight.label)}</span></div>
    <button class="favorite-button ${favorite ? 'active' : ''}" data-favorite="${escapeHtml(match.id)}" aria-label="${favorite ? 'Rimuovi dai' : 'Aggiungi ai'} preferiti">${icon('star')}</button>
  </article>`;
}

function radarItem(match, index) {
  return `<article class="radar-item" data-match="${escapeHtml(match.id)}"><span class="radar-rank">${String(index + 1).padStart(2, '0')}</span><div class="radar-names"><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.insight.label)} · ${escapeHtml(displayDate(match.date))}</span></div><div class="radar-score"><strong>${match.opportunity}</strong><span>indice</span></div></article>`;
}

function newsCard(article) {
  const image = safeUrl(article.image);
  const style = image ? ` style="background-image:url('${image.replaceAll("'", '%27')}')"` : '';
  return `<article class="news-card ${image ? 'has-image' : ''}" data-news-url="${safeUrl(article.link)}"${style} tabindex="0">
    <span class="news-source"><i></i>${escapeHtml(article.source)}</span>
    <h3>${escapeHtml(article.title)}</h3>
    ${article.description ? `<p>${escapeHtml(article.description)}</p>` : ''}
    <div class="news-meta"><span>${article.published ? escapeHtml(relativeTime(article.published)) : 'Ultimo aggiornamento'}</span>${icon('external')}</div>
  </article>`;
}

function renderMatchesView() {
  const dates = Array.from({ length: 11 }, (_, index) => addDays(state.today, index));
  const matches = state.matches
    .filter(match => state.matchLeague === 'all' || match.league.id === state.matchLeague)
    .filter(match => state.selectedDate === 'all' || localDateKey(match.date) === state.selectedDate)
    .filter(match => state.selectedDate !== 'all' || isUpcoming(match))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const groups = Object.groupBy ? Object.groupBy(matches, match => localDateKey(match.date)) : matches.reduce((acc, match) => ((acc[localDateKey(match.date)] ||= []).push(match), acc), {});
  const availableLeagues = [...new Map([...state.leagues, ...state.matches.map(match => match.league)].map(league => [league.id, league])).values()].sort((a, b) => a.label.localeCompare(b.label, 'it'));
  const leagueOptions = [`<option value="all">Tutte le competizioni</option>`, ...availableLeagues.map(league => `<option value="${league.id}" ${state.matchLeague === league.id ? 'selected' : ''}>${escapeHtml(league.label)}</option>`)].join('');
  return `<div class="view matches-view">
    ${viewHeader('CALENDARIO', 'Tutte le partite', 'Live score, orari italiani e calendario dei principali campionati europei.', `<button class="button" id="viewRefresh">${icon('refresh')} Aggiorna</button>`)}
    <section class="controls-card"><div class="date-strip"><button class="date-button ${state.selectedDate === 'all' ? 'active' : ''}" data-date="all"><span>Vista</span><strong>Tutte</strong></button>${dates.map(date => `<button class="date-button ${state.selectedDate === date ? 'active' : ''}" data-date="${date}"><span>${escapeHtml(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)))}</span><strong>${date.slice(8)}</strong></button>`).join('')}</div><select class="select-control" id="matchLeagueSelect" aria-label="Filtra competizione">${leagueOptions}</select></section>
    ${state.errors.matches && !state.matches.length ? errorBlock(state.errors.matches) : (matches.length ? Object.entries(groups).map(([date, items]) => `<section class="day-group"><header class="day-heading"><strong>${escapeHtml(date === state.today ? `Oggi · ${displayDate(`${date}T12:00:00Z`, true)}` : displayDate(`${date}T12:00:00Z`, true))}</strong><span>${items.length} ${items.length === 1 ? 'partita' : 'partite'}</span></header><div class="match-list">${items.map(matchRow).join('')}</div></section>`).join('') : emptyState('ball', 'Nessuna partita trovata', 'Prova una data o una competizione diversa. Il calendario si aggiorna automaticamente quando le fonti pubblicano nuovi incontri.'))}
  </div>`;
}

function renderRadarView() {
  const matches = radarMatches(30);
  return `<div class="view radar-view">
    ${viewHeader('POWER MODEL 2.0', 'Match Radar', 'Le partite più interessanti, con analisi avanzata su forma, gol, precedenti, probabilità e qualità dei dati.')}
    <section class="radar-hero"><div><h2>Dal calendario a una lettura completa.</h2><p>L’indice ordina gli incontri da analizzare. Aprendo ogni partita il Power Model calcola 1-X-2, gol attesi, Over/Under, Goal/No Goal, segnali protetti, precedenti e rischio. Il risultato resta informativo e non garantisce alcun esito.</p></div><div class="radar-hero-visual">${icon('radar')}</div></section>
    ${matches.length ? `<section class="radar-table"><header class="radar-table-head"><span>#</span><span>Partita</span><span>Lettura</span><span>Rischio</span><span>Indice</span><span></span></header>${matches.map((match, index) => `<article class="radar-table-row" data-match="${escapeHtml(match.id)}"><span class="radar-position">${index + 1}</span><div class="radar-match-main"><strong>${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}</strong><span>${escapeHtml(match.league.label)} · ${escapeHtml(displayDate(match.date))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</span></div><span class="insight-badge">${escapeHtml(match.insight.label)}</span><span class="risk-badge ${match.insight.risk === 'Alto' ? 'high' : match.insight.risk === 'Basso' ? 'low' : ''}"><i></i>${escapeHtml(match.insight.risk)}</span><span class="radar-value">${match.opportunity}<small>/100</small></span>${icon('chevron')}</article>`).join('')}</section>` : emptyState('radar', 'Radar in attesa', 'Nessun incontro futuro disponibile nel periodo monitorato.')}
  </div>`;
}

function renderNewsView() {
  const sources = [...new Set(state.news.map(article => article.source))];
  const articles = state.newsSource === 'all' ? state.news : state.news.filter(article => article.source === state.newsSource);
  const updated = state.dataMeta.news?.fetchedAt;
  return `<div class="view news-view">
    ${viewHeader('EDITORIA', 'Notizie', 'Il meglio dell’informazione calcistica aggregato da fonti gratuite e consultabile alla fonte originale.', `<button class="button" id="viewRefresh">${icon('refresh')} Aggiorna</button>`)}
    <section class="news-toolbar"><div class="filter-row"><button class="filter-chip ${state.newsSource === 'all' ? 'active' : ''}" data-news-source="all">Tutte</button>${sources.map(source => `<button class="filter-chip ${state.newsSource === source ? 'active' : ''}" data-news-source="${escapeHtml(source)}">${escapeHtml(source)}</button>`).join('')}</div><span class="news-updated">${updated ? `Aggiornate ${escapeHtml(relativeTime(updated))}` : ''}</span></section>
    ${state.errors.news && !state.news.length ? errorBlock(state.errors.news) : (articles.length ? `<section class="news-grid">${articles.map(newsCard).join('')}</section>` : emptyState('news', 'Nessuna notizia', 'Non ci sono articoli per questa fonte. Seleziona “Tutte”.'))}
  </div>`;
}

function renderStandingsView() {
  const data = state.tables[state.standingsLeague];
  const options = state.leagues.filter(league => !league.id.startsWith('uefa.')).map(league => `<option value="${league.id}" ${state.standingsLeague === league.id ? 'selected' : ''}>${escapeHtml(league.label)}</option>`).join('');
  const actions = `<select class="select-control" id="standingsLeagueSelect" aria-label="Scegli classifica">${options}</select>`;
  let content;
  if (!data && state.errors.standings) content = errorBlock(state.errors.standings);
  else if (!data) content = `<section class="standings-card"><div class="skeleton sk-list"></div></section>`;
  else if (!data.table?.length) content = emptyState('table', 'Classifica non ancora disponibile', 'La nuova stagione potrebbe non essere iniziata. La tabella apparirà appena pubblicata dalla fonte.');
  else content = `<div class="standings-layout"><section class="standings-card"><div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Squadra</th><th>PG</th><th>V</th><th>P</th><th>S</th><th>GF</th><th>GS</th><th>DR</th><th>PT</th></tr></thead><tbody>${data.table.map((row, index) => `<tr class="${index < 4 ? 'zone-ucl' : index >= data.table.length - 3 ? 'zone-drop' : ''}"><td>${row.rank}</td><td class="standings-team">${teamLogo({ ...row.team, abbreviation: row.team.name.slice(0, 3) })}<strong>${escapeHtml(row.team.name)}</strong></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.difference > 0 ? '+' : ''}${row.difference}</td><td class="points">${row.points}</td></tr>`).join('')}</tbody></table></div></section><aside class="legend-card"><h3>Legenda</h3><div class="legend-item"><i></i>Zona competizioni europee</div><div class="legend-item"><i class="red"></i>Zona retrocessione</div><div class="legend-note">Posizioni evidenziate a scopo visivo. I criteri ufficiali possono cambiare in base alla competizione e alla stagione.</div></aside></div>`;
  return `<div class="view standings-view">${viewHeader('CAMPIONATI', 'Classifiche', 'Posizioni, rendimento e differenza reti delle principali competizioni.', actions)}${content}</div>`;
}

function renderFavoritesView() {
  const matches = [...state.favorites].map(id => state.matches.find(match => match.id === id) || state.favoriteSnapshots[id]).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));
  return `<div class="view favorites-view">
    ${viewHeader('LA TUA WATCHLIST', 'Preferiti', 'Salvati solo su questo dispositivo, senza account e senza raccogliere dati personali.')}
    ${matches.length ? `<section class="section-card"><header class="section-head"><div><h2>Partite salvate</h2><p>${matches.length} ${matches.length === 1 ? 'incontro' : 'incontri'} nella watchlist</p></div></header><div class="match-list">${matches.map(matchRow).join('')}</div></section>` : emptyState('star', 'Nessun preferito', 'Tocca la stella accanto a una partita per aggiungerla qui e ritrovarla rapidamente.', '<button class="button primary" data-view="matches">Scopri le partite</button>')}
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
    <header class="modal-hero"><span class="modal-competition"><i></i>${escapeHtml(match.league.label)} ${match.round ? `· ${escapeHtml(match.round)}` : ''}</span><div class="modal-fixture"><div class="modal-team">${teamLogo(match.home, 'modal-logo')}<strong>${escapeHtml(match.home.name)}</strong></div><div class="modal-score"><strong>${escapeHtml(status.main)}</strong><span>${escapeHtml(status.sub)}</span></div><div class="modal-team">${teamLogo(match.away, 'modal-logo')}<strong>${escapeHtml(match.away.name)}</strong></div></div></header>
    <div class="modal-body"><div class="modal-meta-grid"><div class="modal-meta"><span>Data e ora</span><strong>${escapeHtml(displayDate(match.date, true))} · ${escapeHtml(fmtTime.format(new Date(match.date)))}</strong></div><div class="modal-meta"><span>Stadio</span><strong title="${escapeHtml(match.venue)}">${escapeHtml(match.venue)}</strong></div><div class="modal-meta"><span>Indice interesse</span><strong>${match.opportunity}/100</strong></div></div>
      <div id="advancedAnalysis">${analysisLoading()}</div>
      <div class="modal-actions"><button class="button ${favorite ? '' : 'primary'}" data-favorite="${escapeHtml(match.id)}">${icon('star')} ${favorite ? 'Rimuovi dai salvati' : 'Salva partita'}</button><button class="button" data-close-modal>Chiudi</button></div>
    </div>`;
  $('#modalLayer').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('.modal-close', modal)?.focus(), 20);
  loadAnalysis(match);
}

function analysisLoading() {
  return `<section class="power-loading"><div class="power-loading-head"><span class="power-mark">POWER</span><strong>Sto costruendo l’analisi completa…</strong></div><div class="power-skeleton"><i></i><i></i><i></i></div><p>Forma, precedenti, distribuzione gol e consenso 1-X-2.</p></section>`;
}

async function loadAnalysis(match, force = false) {
  const key = `${match.league.id}:${match.id}`;
  const root = $('#advancedAnalysis');
  if (!root) return;
  if (state.analyses[key] && !force) {
    root.innerHTML = renderPowerAnalysis(state.analyses[key]);
    return;
  }
  try {
    const payload = await api(`/api/analysis?event=${encodeURIComponent(match.id)}&league=${encodeURIComponent(match.league.id)}${force ? '&fresh=1' : ''}`);
    state.analyses[key] = payload.data;
    if ($('#matchModal')?.dataset.eventId === match.id && $('#advancedAnalysis')) $('#advancedAnalysis').innerHTML = renderPowerAnalysis(payload.data);
  } catch (error) {
    if ($('#matchModal')?.dataset.eventId === match.id && $('#advancedAnalysis')) {
      $('#advancedAnalysis').innerHTML = `<section class="power-error">${icon('info')}<div><strong>Analisi avanzata non disponibile</strong><p>${escapeHtml(error.message)}. Restano validi calendario, forma sintetica e dati live.</p></div></section>`;
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
  const signals = data.signals || [];
  const primary = signals[0];
  const marketOutcome = data.market?.outcome ? {
    home: Math.round(data.market.outcome.home * 100), draw: Math.round(data.market.outcome.draw * 100), away: Math.round(data.market.outcome.away * 100)
  } : null;
  const h2hRows = (data.h2h?.events || []).slice(0, 5).map(event => `<div class="h2h-row"><span>${escapeHtml(displayDate(event.date))}</span><div><strong>${escapeHtml(event.home.name)}</strong><b>${event.home.score}–${event.away.score}</b><strong>${escapeHtml(event.away.name)}</strong></div></div>`).join('');
  return `<section class="power-analysis">
    <header class="power-title"><div><span class="power-mark">POWER MODEL 2.0</span><h3>Analisi quantitativa</h3></div><div class="quality-score" style="--quality:${quality}"><span><b>${quality}</b><small>qualità ${qualityLabel(quality)}</small></span></div></header>
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

function openInfo() {
  const modal = $('#matchModal');
  delete modal.dataset.eventId;
  modal.style.removeProperty('--league-color');
  modal.innerHTML = `<button class="modal-close" data-close-modal aria-label="Chiudi">${icon('x')}</button><header class="modal-hero"><span class="modal-competition"><i></i>TRASPARENZA</span><div style="position:relative;z-index:1;margin-top:24px"><h2 style="margin:0 0 8px;font-size:26px">Dati gratuiti, metodo chiaro.</h2><p style="margin:0;color:rgba(255,255,255,.65);font-size:11px;line-height:1.5">Nessun abbonamento e nessuna chiave API a pagamento.</p></div></header><div class="modal-body"><section class="analysis-box"><div class="analysis-box-head"><span>Fonti attive</span><strong>Feed pubblici</strong></div><p>Partite, forma, precedenti e classifiche: feed pubblico ESPN. Notizie: ANSA Calcio, Football Italia ed ESPN. Ogni articolo apre la fonte originale.</p></section><section class="form-comparison"><h3>Come si aggiorna</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Le partite vengono ricontrollate ogni 90 secondi mentre il sito è aperto; le notizie ogni pochi minuti. In caso di errore temporaneo, viene mantenuta l’ultima risposta valida in cache.</p><h3 style="margin-top:18px">Come funziona il Power Model 2.0</h3><p style="color:var(--muted);font-size:10px;line-height:1.6">Combina distribuzione di Poisson sui gol recenti, forma, precedenti, fattore campo e consenso di mercato senza margine quando presente. Se la nuova classifica non è significativa, il sistema lo segnala e pesa maggiormente gli altri dati. Nessun esito è garantito.</p></section><div class="modal-note">${icon('shield')}<span>Preferiti, tema e alert sono salvati localmente nel browser. Il sito non richiede account e non invia dati personali.</span></div><div class="modal-actions"><button class="button primary" data-close-modal>Ho capito</button></div></div>`;
  $('#modalLayer').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modalLayer').hidden = true;
  document.body.style.overflow = '';
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
  if ($('#modalLayer').hidden) document.body.style.overflow = '';
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
  const teams = [...teamMap.values()].filter(item => !needle || item.team.name.toLocaleLowerCase('it').includes(needle)).slice(0, 8);
  const leagues = state.leagues.filter(league => needle && league.label.toLocaleLowerCase('it').includes(needle)).slice(0, 3);
  const results = [
    ...leagues.map(league => `<button class="search-result" data-search-league="${league.id}"><span class="search-result-icon">${icon('table')}</span><span><strong>${escapeHtml(league.label)}</strong><span>${escapeHtml(league.country)} · calendario e classifica</span></span>${icon('chevron')}</button>`),
    ...teams.map(item => `<button class="search-result" data-search-match="${escapeHtml(item.matches[0].id)}">${teamLogo(item.team, 'search-logo')}<span><strong>${escapeHtml(item.team.name)}</strong><span>${item.matches.length} ${item.matches.length === 1 ? 'partita disponibile' : 'partite disponibili'}</span></span>${icon('chevron')}</button>`)
  ];
  root.innerHTML = results.length ? results.join('') : `<div class="search-empty">Nessun risultato per “${escapeHtml(query)}”</div>`;
}

function toast(message, error = false) {
  const root = $('#toastRegion');
  const el = document.createElement('div');
  el.className = `toast ${error ? 'error' : ''}`;
  el.innerHTML = `<i></i><span>${escapeHtml(message)}</span>`;
  root.append(el);
  setTimeout(() => el.remove(), 3500);
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
  $('#notificationButton')?.classList.toggle('enabled', state.alertsEnabled);
}

function notifyLive(match) {
  if (Notification.permission === 'granted') {
    new Notification(`${match.home.name} – ${match.away.name} è iniziata`, { body: `Segui il live score su VANTAGGIO · ${match.league.label}`, icon: match.home.logo || '/favicon.svg' });
  }
}

function setupEvents() {
  document.addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    if (view) { event.preventDefault(); return goTo(view.dataset.view); }
    const fav = event.target.closest('[data-favorite]');
    if (fav) { event.preventDefault(); event.stopPropagation(); return toggleFavorite(fav.dataset.favorite); }
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
    if (event.target.closest('[data-close-modal]')) return closeModal();
    if (event.target.closest('[data-close-search]')) return closeSearch();
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
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') { if (!$('#searchLayer').hidden) closeSearch(); else if (!$('#modalLayer').hidden) closeModal(); }
    if (event.key === 'Enter' && event.target.matches('.news-card')) event.target.click();
  });

  window.addEventListener('hashchange', () => {
    const next = (location.hash || '#dashboard').slice(1);
    if (next !== state.currentView) goTo(next);
  });
}

function init() {
  const theme = localStorage.getItem('vantaggio:theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  $('#notificationButton').classList.toggle('enabled', state.alertsEnabled);
  setupEvents();
  loadInitial();
  state.refreshTimer = setInterval(() => refreshAll(false), 90_000);
  setInterval(updateSyncStatus, 30_000);
}

init();
