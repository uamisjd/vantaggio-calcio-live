'use strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function get(path, type = 'json') {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return type === 'json' ? response.json() : response.text();
}

(async () => {
  const html = await get('/', 'text');
  if (!html.includes('VANTAGGIO') || !html.includes('V4.9') || !html.includes('/app.js?v=4.9.1') || !html.includes('/styles.css?v=4.9.1')) throw new Error('Homepage o asset V4.9.1 non validi');
  const [appJs, styles] = await Promise.all([get('/app.js?v=4.9.1', 'text'), get('/styles.css?v=4.9.1', 'text')]);
  const v4Modules = ['DAILY BRIEFING', 'PRE-MATCH COMMAND', 'SIGNAL STUDIO', 'VANTAGGIO NEWSROOM', 'TABLE LAB', 'MY MATCHROOM', 'SCOUT SEARCH', 'WHAT CHANGED DESK', 'KICKOFF WATCH', 'TEAM DNA', 'RELIABILITY LEDGER', 'MATCH ARCHIVE', 'MODEL TRACK RECORD', 'SOURCE HEALTH CENTER', 'AVAILABILITY INTELLIGENCE'];
  const dossierFirst = ['MATCH CONTROL ROOM', 'PRE-MATCH TOTAL INTELLIGENCE', 'prematchTotalIntelligence', 'renderFallbackDeepAnalysis', 'readinessGate', 'EVIDENCE MAP', 'SIGNAL LIFECYCLE', 'captureSignalLifecycle', 'COPERTURA RIDOTTA', 'XI INTELLIGENCE', 'PRE-MATCH VAULT', 'capturePrematchVault'];
  const ledgerV2 = ['DATA RELIABILITY LEDGER', 'DATA READINESS', 'reliability-dimensions', 'PRIORITÀ PRIMA DEL KICKOFF', 'Prova mancante', 'gate evidenze'];
  if (!v4Modules.every(module => appJs.includes(module)) || !dossierFirst.every(module => appJs.includes(module)) || !ledgerV2.every(module => appJs.includes(module)) || !styles.includes('V4.8 · XI Intelligence + Pre-Match Vault') || !styles.includes('V4.9.1 · Reliability Ledger') || !styles.includes('.reliability-row.status-critical') || !styles.includes('.prematch-total-intelligence') || !styles.includes('.xi-intelligence') || !styles.includes('.prematch-vault-banner') || !styles.includes('.deep-dive.fallback')) throw new Error('Moduli esperienza V4.9.1 incompleti');
  if (appJs.includes('class="broadcast-strip"') || appJs.includes('function newsroomPreview') || appJs.includes('SIGNAL LEDGER') || styles.includes('.broadcast-strip') || styles.includes('.signal-ledger')) throw new Error('Componenti ridondanti ancora attivi');
  const modalSource = appJs.slice(appJs.indexOf('function openMatch'), appJs.indexOf('function renderFallbackDeepAnalysis'));
  const summarySource = appJs.slice(appJs.indexOf('function matchRoomSummary'), appJs.indexOf('function matchRoomTeams'));
  const intelligenceSource = appJs.slice(appJs.indexOf('function renderIntelligence'), appJs.indexOf('function openInfo'));
  if (!modalSource.includes('id="matchIntelligence"') || modalSource.includes('model-drawer') || !modalSource.includes('Promise.allSettled([loadIntelligence(match), loadAnalysis(match)])')) throw new Error('Control Room o caricamento dossier non validi');
  const decisionIndex = summarySource.indexOf('summaryDecisionPassport(data)');
  const readinessIndex = summarySource.indexOf('readinessGate(data)');
  const briefIndex = summarySource.indexOf('executiveBriefMarkup(data)');
  const totalIndex = summarySource.indexOf('prematchTotalIntelligence(data)');
  const lifecycleIndex = summarySource.indexOf('signalLifecycleMarkup(data)');
  if (decisionIndex < 0 || readinessIndex < decisionIndex || briefIndex < readinessIndex || totalIndex < briefIndex || lifecycleIndex < totalIndex || !['summary', 'teams', 'numbers', 'verify'].every(tab => intelligenceSource.includes(`id: '${tab}'`))) throw new Error('Gerarchia Match Control Room non valida');
  const liveVaultIndex = modalSource.indexOf("if (match.state === 'in' || preWindowClosed)");
  if (liveVaultIndex < 0 || liveVaultIndex > modalSource.indexOf('loadIntelligence(match)') || !modalSource.includes('archivedPrematchData(match)') || !modalSource.includes('renderPrematchVault(') || appJs.includes('function notifyLive') || appJs.includes("addChange('live'")) throw new Error('Politica Pre-Match Vault per le partite in corso non valida');

  const status = await get('/api/status');
  if (!status.ok || status.timezone !== 'Europe/Rome' || status.leagues.length < 5 || !Array.isArray(status.standingsLeagues) || status.standingsLeagues.length < 12 || !Array.isArray(status.globalCompetitions) || status.globalCompetitions.length < 40) throw new Error('Status API o catalogo globale non valido');

  const from = new Date(new Date(status.today + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const to = new Date(new Date(status.today + 'T12:00:00Z').getTime() + 13 * 86400000).toISOString().slice(0, 10);
  const matches = await get(`/api/matches?league=all&from=${from}&to=${to}`);
  if (!matches.ok || !Array.isArray(matches.data.matches) || !Array.isArray(matches.data.sources)) throw new Error('Matches API non valida');

  const news = await get('/api/news');
  if (!news.ok || !Array.isArray(news.data.articles) || !news.data.articles.length) throw new Error('News API non valida');

  const standings = await get('/api/standings?league=ita.1');
  if (!standings.ok || !Array.isArray(standings.data.table)) throw new Error('Standings API non valida');
  const expandedStandings = await get('/api/standings?league=por.1');
  if (!expandedStandings.ok || expandedStandings.data.league?.id !== 'por.1' || expandedStandings.data.table.length < 16) throw new Error('Classifiche estese non valide');

  const analyzable = matches.data.matches.find(item => item.state === 'pre' && new Date(item.date).getTime() > Date.now());
  if (!analyzable) throw new Error('Nessuna partita analizzabile');
  const analysis = await get(`/api/analysis?event=${encodeURIComponent(analyzable.id)}&league=${encodeURIComponent(analyzable.league.id)}`);
  const power = analysis.data;
  if (!analysis.ok || power.engine?.version !== '3.0' || !power.probabilities || !Array.isArray(power.signals)) throw new Error('Power Analysis API non valida');
  if (!['ready', 'caution', 'hold'].includes(power.decision?.state) || !power.engine?.diagnostics || power.engine.diagnostics.recencyHalfLifeDays !== 120 || power.ensemble?.modelWeight + power.ensemble?.marketWeight !== 100) throw new Error('Decision Gate o Model Passport non validi');
  if (!power.context || !Array.isArray(power.context.facts) || !power.context.venue || !power.lineups || !Array.isArray(power.tournamentStats) || !Array.isArray(power.leaders)) throw new Error('Contesto Power Analysis incompleto');

  const intelligence = await get(`/api/intelligence?event=${encodeURIComponent(analyzable.id)}&league=${encodeURIComponent(analyzable.league.id)}`);
  const intel = intelligence.data;
  if (!intelligence.ok || intel.engine?.version !== '1.4' || !intel.event || !intel.context || !intel.calendar || !intel.tactical || !intel.reliability || !intel.deepDive || !Array.isArray(intel.deepDive.paragraphs) || !intel.deepDive.paragraphs.length) throw new Error('Match Intelligence API non valida');
  const xi = intel.lineupIntelligence;
  if (!xi || !['ufficiale', 'probabili_parziali', 'non_disponibile'].includes(xi.status) || !Array.isArray(xi.teams) || xi.teams.length !== 2 || !xi.rule?.includes('Non sono probabilità di vittoria')) throw new Error('XI Intelligence non valida');
  if (!xi.teams.every(team => ['ufficiale', 'probabile', 'non_disponibile'].includes(team.mode) && Array.isArray(team.selected) && Array.isArray(team.importantMissing) && Array.isArray(team.omissions) && (team.mode === 'non_disponibile' ? team.confidence === null && team.strength === null : Number.isFinite(team.confidence) && Number.isFinite(team.strength)))) throw new Error('Punteggi o classificazioni XI non validi');
  if (!xi.teams.every(team => team.mode === 'non_disponibile' || team.selected.length === 11)) throw new Error('XI pubblicata senza undici selezioni');
  if (!Array.isArray(intel.critical) || !intel.critical.every(item => ['Fatto', 'Lettura', 'Verifica'].includes(item.type))) throw new Error('Separazione fatto/lettura/verifica non valida');
  if (!Array.isArray(intel.script) || !intel.script.length || !Array.isArray(intel.alerts) || !intel.lineups || !intel.availability || !Array.isArray(intel.news?.articles)) throw new Error('Match Intelligence incompleta');
  if (!Number.isFinite(intel.availability.score) || !Array.isArray(intel.availability.teams) || intel.availability.teams.length !== 2 || !Array.isArray(intel.availability.sources) || !intel.availability.rule?.includes('silenzio')) throw new Error('Availability Intelligence non valida');
  if (typeof intel.tactical.home?.observedGames !== 'number' || typeof intel.tactical.away?.observedGames !== 'number') throw new Error('Campione tattico non dichiarato');
  if (!Number.isFinite(intel.reliability.overall) || !Array.isArray(intel.reliability.items) || intel.reliability.items.length < 5) throw new Error('Reliability Ledger non valido');
  const ledger = intel.reliability;
  if (ledger.schemaVersion !== '2.0' || !['ready', 'caution', 'hold'].includes(ledger.readiness?.state) || !['Solida', 'Discreta', 'Parziale', 'Insufficiente'].includes(ledger.level) || !ledger.scoreMeaning?.includes('provenienza')) throw new Error('Reliability Ledger V2 o Data Readiness non validi');
  if (!ledger.items.every(item => Number.isFinite(item.score) && Number.isFinite(item.dimensions?.provenance) && Number.isFinite(item.dimensions?.coverage) && Number.isFinite(item.dimensions?.freshness) && Array.isArray(item.missingEvidence) && item.impact && item.decisionImpact && item.nextCheck)) throw new Error('Dimensioni, vuoti o impatto del Reliability Ledger incompleti');
  const lineupReliability = ledger.items.find(item => item.id === 'lineups');
  const availabilityReliability = ledger.items.find(item => item.id === 'availability');
  if (!lineupReliability || !availabilityReliability || availabilityReliability.label !== 'Copertura disponibilità rosa') throw new Error('Moduli critici del Reliability Ledger non validi');
  if (!intel.lineups.official && ((ledger.minutesToKickoff <= 75 && lineupReliability.status !== 'critical') || (ledger.minutesToKickoff > 75 && lineupReliability.status !== 'expected'))) throw new Error('Critical Evidence Gate temporale delle formazioni non valido');
  if (ledger.items.some(item => item.critical) && ledger.readiness.state === 'ready') throw new Error('Le prove opzionali compensano impropriamente un vuoto critico');

  const premierMatch = matches.data.matches.find(item => item.league.id === 'eng.1' && item.state === 'pre' && new Date(item.date).getTime() > Date.now());
  let premierAvailability = null;
  if (premierMatch) {
    const premierIntel = await get(`/api/intelligence?event=${encodeURIComponent(premierMatch.id)}&league=eng.1`);
    premierAvailability = premierIntel.data?.availability;
    const fplSource = premierAvailability?.sources?.find(source => source.id === 'fpl');
    if (!fplSource || fplSource.state !== 'disponibile' || !premierAvailability.teams?.every(team => Array.isArray(team.structured) && Array.isArray(team.signals))) throw new Error('Integrazione availability Premier League non valida');
  }

  const teamDna = await get(`/api/team-dna?team=${encodeURIComponent(analyzable.home.id)}&league=${encodeURIComponent(analyzable.league.id)}&name=${encodeURIComponent(analyzable.home.name)}`);
  const dna = teamDna.data;
  if (!teamDna.ok || dna.engine?.name !== 'VANTAGGIO Team DNA' || !dna.team || !dna.profile || !Array.isArray(dna.fingerprint) || dna.fingerprint.length < 5) throw new Error('Team DNA API non valida');
  if (!dna.reliability || !Number.isFinite(dna.reliability.overall) || !Array.isArray(dna.recentEvents) || !dna.splits?.home || !dna.splits?.away) throw new Error('Team DNA incompleto');

  const review = await get('/api/intelligence?event=401873624&league=uefa.super_cup');
  if (review.data.deepDive?.mode !== 'post' || review.data.event.home.score !== 2 || review.data.event.away.score !== 1 || !review.data.deepDive.paragraphs?.length) throw new Error('Deep Match Review non valida');
  if (!review.data.deepDive.paragraphs.some(item => item.title === 'Season Vault') || !review.data.deepDive.teamCases.every(item => item.season?.played > 0) || !review.data.deepDive.unavailable.some(item => item.includes('xG'))) throw new Error('Season Vault o trasparenza dati incompleti');
  const officialXi = review.data.lineupIntelligence;
  if (officialXi?.status !== 'ufficiale' || !officialXi.teams?.every(team => team.mode === 'ufficiale' && team.confidence === 100 && team.selected.length === 11)) throw new Error('Scoring delle formazioni ufficiali non valido');
  if (!officialXi.teams.flatMap(team => team.omissions || []).every(item => ['in panchina', 'non a referto', 'infortunio', 'indisponibile', 'squalifica', 'dubbio'].includes(item.status))) throw new Error('Classificazione delle omissioni ufficiali non valida');

  const health = await get('/api/health');
  if (!Array.isArray(health.sources) || !health.sources.some(source => source.calls > 0 && source.lastSuccessAt) || !health.rule || health.resilience?.staleFallback !== 'bounded' || health.resilience?.circuitFailureThreshold !== 4) throw new Error('Source Health Center non valido');

  console.log(`✓ Homepage V4.9.1 e asset cache serviti`);
  console.log(`✓ Dossier-first, fallback trasparente e componenti ridondanti rimossi`);
  console.log(`✓ ${matches.data.matches.length} partite in ${matches.data.coverage?.competitions || 0} competizioni`);
  console.log(`✓ Power Model 3.0 operativo su ${analyzable.home.name}–${analyzable.away.name}`);
  console.log(`✓ Match Intelligence: ${intel.critical.length} evidenze, ${intel.alerts.length} alert, affidabilità ${intel.reliability.overall}/100`);
  console.log(`✓ XI Intelligence: ${xi.status}, ${xi.teams.map(team => `${team.teamName} ${team.mode} ${team.confidence == null ? 'n/d' : `${team.confidence}/100`}`).join(' · ')}`);
  console.log(`✓ Availability Intelligence: ${intel.availability.structuredCount} record, ${intel.availability.signalCount} segnali, copertura ${intel.availability.score}/100`);
  if (premierAvailability) console.log(`✓ Premier League availability: FPL ufficiale, ${premierAvailability.structuredCount} status strutturati`);
  console.log(`✓ Source Health Center: ${health.sources.filter(source => source.calls).length} fonti osservate`);
  console.log(`✓ Team DNA ${dna.team.name}: ${dna.profile.observedGames} boxscore, affidabilità ${dna.reliability.overall}/100`);
  console.log(`✓ Deep Match Review PSG–Aston Villa: 2-1, ${review.data.deepDive.paragraphs.length} blocchi editoriali verificati`);
  console.log(`✓ XI ufficiali storici: 22 titolari, affidabilità 100/100 e omissioni classificate`);
  console.log(`✓ ${news.data.articles.length} notizie da ${news.data.sources.filter(item => item.ok).length} fonti`);
  console.log(`✓ ${standings.data.table.length} righe classifica Serie A`);
  console.log('Smoke test completato senza errori.');
})().catch(error => {
  console.error('Smoke test fallito:', error.message);
  process.exit(1);
});
