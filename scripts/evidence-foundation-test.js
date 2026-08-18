'use strict';

const assert = require('assert/strict');
const {
  EVIDENCE_SCHEMA_VERSION,
  FACT_TYPES,
  sourceManifest,
  evidenceContract,
  registryPolicy,
  validateFoundationArtifacts,
  canonicalCompetitionRef,
  canonicalTeamRef,
  canonicalEventRef,
  validateEvidenceRecord,
  makeEvidence,
  evidenceStateAt,
  resolveEvidence,
  resolveAllEvidence,
  buildEvidenceSummary,
  combineDecisionTrace,
  publicFoundationManifest
} = require('../lib/evidence');
const { buildCurrentEvidenceFoundation } = require('../server');

const T0 = '2026-08-17T10:00:00.000Z';
const T1 = '2026-08-17T10:05:00.000Z';
const T2 = '2026-08-17T10:10:00.000Z';
const EXPIRES = '2026-08-17T11:00:00.000Z';
const SUBJECT_A = { entityType: 'player', entityId: 'vantaggio:player:a', teamId: 'vantaggio:team:home' };
const SUBJECT_B = { entityType: 'player', entityId: 'vantaggio:player:b', teamId: 'vantaggio:team:away' };

function evidence(overrides = {}) {
  return makeEvidence({
    factType: 'player.availability',
    subject: SUBJECT_A,
    sourceId: 'espn-injuries',
    observedAt: T0,
    expiresAt: EXPIRES,
    value: { category: 'dubbio', chance: 50 },
    state: 'observed',
    decisionImpact: 'supporting',
    ...overrides
  });
}

function testArtifacts() {
  assert.deepEqual(validateFoundationArtifacts(), { valid: true, errors: [] });
  assert.equal(sourceManifest.schemaVersion, '1.0');
  assert.equal(evidenceContract.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(evidenceContract['x-contractVersion'], EVIDENCE_SCHEMA_VERSION);
  assert.equal(registryPolicy.schemaVersion, '1.0');
  assert.ok(Array.isArray(sourceManifest.sources) && sourceManifest.sources.length >= 6);
  assert.equal(new Set(sourceManifest.sources.map(source => source.sourceId)).size, sourceManifest.sources.length);
  sourceManifest.sources.forEach(source => {
    assert.equal(source.cost, 'zero');
    assert.ok(source.factTypes.length > 0);
    source.factTypes.forEach(factType => assert.ok(FACT_TYPES.includes(factType), `${source.sourceId}: fact type non registrato ${factType}`));
    Object.entries(source.defaultTierByFact || {}).forEach(([factType, tier]) => {
      assert.ok(source.factTypes.includes(factType));
      assert.ok(Number.isInteger(tier) && tier >= 1 && tier <= 4);
    });
  });
  const manifest = publicFoundationManifest();
  assert.equal(manifest.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(manifest.sourceManifestVersion, sourceManifest.manifestVersion);
  assert.ok(manifest.factTypes.includes('event.kickoff'));
}

function testIdentityStability() {
  const competition = canonicalCompetitionRef('ita.1', { id: 'ita.1', label: 'Serie A', country: 'Italia' });
  const unknownCompetition = canonicalCompetitionRef('', { label: 'Coppa regionale', country: 'Italia' });
  assert.equal(unknownCompetition.resolution.state, 'candidate');
  assert.equal(unknownCompetition.providerRefs.length, 0);
  const teamA = canonicalTeamRef({ id: '123', name: 'Messina' }, { competitionId: competition.entityId, season: '2026' });
  const teamARenamed = canonicalTeamRef({ id: '123', name: 'ACR Messina' }, { competitionId: competition.entityId, season: '2026' });
  assert.equal(teamA.entityId, teamARenamed.entityId, 'Il provider ID deve prevalere sulla variante del nome');
  assert.equal(teamA.resolution.state, 'confirmed');
  const otherProviderSameOpaqueId = canonicalTeamRef({ id: '123', name: 'Messina', provider: 'alt' }, { competitionId: competition.entityId, season: '2026' });
  assert.notEqual(teamA.entityId, otherProviderSameOpaqueId.entityId, 'ID opachi uguali di provider diversi non devono collidere');

  const candidate1 = canonicalTeamRef({ name: 'San Luca' }, { competitionId: competition.entityId, season: '2026' });
  const candidate2 = canonicalTeamRef({ name: '  SAN  Luca ' }, { competitionId: competition.entityId, season: '2026' });
  assert.equal(candidate1.entityId, candidate2.entityId, 'Il fallback contestuale deve essere deterministico');
  assert.equal(candidate1.resolution.state, 'candidate', 'Un hash contestuale non deve auto-confermare un merge ambiguo');

  const event1 = canonicalEventRef({ date: '2026-08-20T18:45:00Z' }, competition, [teamA, candidate1]);
  const event2 = canonicalEventRef({ date: '2026-08-20T18:45:00Z' }, competition, [teamA, candidate1]);
  assert.equal(event1.entityId, event2.entityId);
  assert.equal(event1.resolution.state, 'candidate');
}

function testEvidenceContractAndTime() {
  const first = evidence();
  const duplicate = evidence();
  assert.equal(first.evidenceId, duplicate.evidenceId, 'L’identità evidence deve essere deterministica');
  assert.equal(first.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(first.source.tier, 2);
  assert.deepEqual(validateEvidenceRecord(first), { valid: true, errors: [] });
  assert.equal(validateEvidenceRecord({ ...first, quality: { ...first.quality, coverage: 120 } }).valid, false);
  assert.equal(validateEvidenceRecord({ ...first, source: { ...first.source, tier: 4 } }).valid, false);
  assert.throws(() => evidence({ coverage: 'alta' }), /coverage evidence non valido/);
  assert.throws(() => evidence({ rawHash: 'sha256:abc' }), /Evidence Contract V1 violato/);
  assert.throws(() => evidence({ value: { chance: Number.NaN } }), /non serializzabile/);

  assert.throws(() => evidence({ observedAt: 'non-iso' }), /ISO/);
  const alreadyStale = evidence({ expiresAt: '2026-08-17T09:59:59.000Z' });
  assert.equal(alreadyStale.state, 'expired', 'Una prova già oltre TTL deve essere ingestita come scaduta, non come corrente');
  assert.throws(() => evidence({ validFrom: T2, validTo: T0 }), /Intervallo valid time invertito/);
  assert.throws(() => evidence({ factType: 'event.kickoff' }), /non è autorizzata/);
  assert.throws(() => evidence({ sourceId: 'fonte-inesistente' }), /Fonte non registrata/);
  assert.throws(() => makeEvidence({ factType: 'news.claim', subject: { entityType: 'team', entityId: 'vantaggio:team:test' }, sourceId: 'google-news-rss', observedAt: T0 }), /Value evidence mancante/);
  assert.throws(() => evidence({ subject: { entityType: 'unknown', entityId: 'vantaggio:unknown:test' } }), /Entity type non supportato/);

  const futurePublication = evidence({ publishedAt: '2026-08-19T10:00:00.000Z' });
  assert.equal(futurePublication.time.publishedAt, null, 'Una data di ritorno futura non deve diventare publishedAt');
  assert.ok(futurePublication.provenance.warnings.includes('FUTURE_PUBLISHED_AT_REJECTED'));
  assert.throws(() => evidence({ validFrom: 'non-iso' }), /validFrom non è un timestamp ISO valido/);

  assert.equal(evidenceStateAt(first, T1), 'observed');
  assert.equal(evidenceStateAt(evidence({ validFrom: T2 }), T1), 'expected');
  assert.equal(evidenceStateAt(first, '2026-08-17T11:00:01.000Z'), 'expired');
}

function testPrecedenceSupersessionAndExpiry() {
  const lowerTierNewer = evidence({ sourceId: 'google-news-rss', observedAt: T2, value: { category: 'out', chance: 0 }, state: 'confirmed' });
  assert.equal(lowerTierNewer.source.tier, 4, 'Il tier deve appartenere alla coppia fonte-fatto');
  const higherTierOlder = evidence({ sourceId: 'espn-injuries', observedAt: T0, value: { category: 'dubbio', chance: 50 }, state: 'confirmed' });
  const tierResolution = resolveEvidence('player.availability', [lowerTierNewer, higherTierOlder], { referenceTime: T1 });
  assert.equal(tierResolution.resolvedFact.chosenEvidenceId, higherTierOlder.evidenceId, 'A parità di stato deve prevalere il tier più forte');

  const supersededNewer = evidence({ sourceId: 'espn-injuries', observedAt: T2, value: { category: 'out', chance: 0 }, state: 'superseded' });
  const currentOlder = evidence({ sourceId: 'fantasy-premier-league', observedAt: T0, value: { category: 'available', chance: 100 }, state: 'confirmed' });
  const supersession = resolveEvidence('player.availability', [supersededNewer, currentOlder], { referenceTime: T1 });
  assert.equal(supersession.resolvedFact.chosenEvidenceId, currentOlder.evidenceId, 'Una correzione superseded non deve tornare corrente');

  const prior = evidence({ sourceId: 'espn-injuries', value: { category: 'out', chance: 0 }, state: 'confirmed' });
  const correction = evidence({ sourceId: 'google-news-rss', observedAt: T1, value: { category: 'available', chance: 100 }, state: 'observed', supersedes: [prior.evidenceId] });
  const explicitSupersession = resolveEvidence('player.availability', [prior, correction], { referenceTime: T2 });
  assert.equal(explicitSupersession.resolvedFact.chosenEvidenceId, correction.evidenceId, 'Una correzione esplicita deve ritirare la versione indicata senza cancellarla dalla storia');
  assert.ok(explicitSupersession.resolvedFact.resolution.supersededEvidenceIds.includes(prior.evidenceId));
  assert.ok(explicitSupersession.resolvedFact.evidenceIds.includes(prior.evidenceId));
  assert.equal(explicitSupersession.resolvedFact.history.find(item => item.evidenceId === prior.evidenceId)?.state, 'superseded');
  const afterCorrectionExpiry = resolveEvidence('player.availability', [prior, correction], { referenceTime: '2026-08-17T11:00:01.000Z' });
  assert.equal(afterCorrectionExpiry.resolvedFact.state, 'expired', 'La scadenza di una correzione non deve far rivivere la versione ritirata');
  assert.equal(afterCorrectionExpiry.resolvedFact.chosenEvidenceId, correction.evidenceId);

  const expired = evidence({ state: 'confirmed', expiresAt: '2026-08-17T10:01:00.000Z', decisionImpact: 'essential' });
  const expiredResolution = resolveEvidence('player.availability', [expired], { referenceTime: T2 });
  assert.equal(expiredResolution.resolvedFact.state, 'expired', 'L’ultima prova scaduta deve restare visibile, non sparire');
  const trace = combineDecisionTrace({ state: 'ready', label: 'READY' }, { state: 'ready', summary: 'Fonti pronte.' }, [expiredResolution.resolvedFact], [], T2);
  assert.equal(trace.effectiveGate.state, 'hold', 'Un’evidenza essenziale scaduta deve produrre HOLD');
  const missingKickoff = makeEvidence({ factType: 'event.kickoff', subject: { entityType: 'event', entityId: 'vantaggio:event:espn:test' }, sourceId: 'espn-event-summary', observedAt: T0, value: { scheduledAt: null }, state: 'observed', coverage: 0, decisionImpact: 'essential' });
  const missingKickoffResolution = resolveEvidence('event.kickoff', [missingKickoff], { referenceTime: T1 });
  const missingTrace = combineDecisionTrace({ state: 'ready' }, { state: 'ready' }, [missingKickoffResolution.resolvedFact], [], T1);
  assert.equal(missingTrace.effectiveGate.state, 'hold', 'Copertura zero su un fatto essenziale non deve risultare READY');
}

function testSubjectIsolationAndConflicts() {
  const playerA = evidence({ subject: SUBJECT_A, sourceId: 'espn-injuries', value: { category: 'out', chance: 0 }, state: 'confirmed' });
  const playerB = evidence({ subject: SUBJECT_B, sourceId: 'espn-injuries', value: { category: 'available', chance: 100 }, state: 'confirmed' });
  assert.throws(() => resolveEvidence('player.availability', [playerA, playerB], { referenceTime: T1 }), /subjectKey obbligatorio/);
  const all = resolveAllEvidence([playerA, playerB], { referenceTime: T1 });
  assert.equal(all.resolvedFacts.length, 2, 'I fatti di soggetti diversi non devono essere riconciliati insieme');
  assert.equal(all.conflicts.length, 0);
  assert.deepEqual(new Set(all.resolvedFacts.map(fact => fact.subjectId)), new Set([SUBJECT_A.entityId, SUBJECT_B.entityId]));

  const espn = evidence({ sourceId: 'espn-injuries', value: { category: 'out', chance: 0 }, state: 'confirmed', decisionImpact: 'essential' });
  const fpl = evidence({ sourceId: 'fantasy-premier-league', observedAt: T1, value: { category: 'available', chance: 100 }, state: 'confirmed', decisionImpact: 'essential' });
  const conflictResolution = resolveAllEvidence([espn, fpl], { referenceTime: T2 });
  assert.equal(conflictResolution.conflicts.length, 1);
  assert.equal(conflictResolution.resolvedFacts[0].state, 'conflicted');
  assert.equal(conflictResolution.conflicts[0].state, 'open');
  const reversedConflict = resolveAllEvidence([fpl, espn], { referenceTime: T2 });
  assert.equal(reversedConflict.conflicts[0].conflictId, conflictResolution.conflicts[0].conflictId, 'La riconciliazione non deve dipendere dall’ordine di input');
  assert.equal(reversedConflict.resolvedFacts[0].chosenEvidenceId, conflictResolution.resolvedFacts[0].chosenEvidenceId);
  const summary = buildEvidenceSummary([espn, fpl], T2, conflictResolution.conflicts, conflictResolution.resolvedFacts);
  assert.equal(summary.conflicts.open, 1);
  assert.equal(summary.resolved.byState.conflicted, 1);
}

function testFoundationTwoMapping() {
  const analysis = {
    event: {
      id: '401-test', leagueId: 'ita.1', date: '2026-08-17T12:00:00.000Z', state: 'pre', completed: false, status: 'Pre-partita',
      home: { id: 'team-home', name: 'Messina', score: '0' }, away: { id: 'team-away', name: 'Reggina', score: '0' }
    },
    context: { phase: 'Regular Season', isTwoLeg: false, leg: null, aggregate: null, venue: { name: 'Stadio San Filippo', city: 'Messina', country: 'Italia' } },
    lineups: {
      official: true,
      teams: [
        { teamId: 'team-home', formation: '4-3-3', starters: Array.from({ length: 11 }, (_, index) => ({ id: `h-${index}`, name: `Casa ${index + 1}`, jersey: String(index + 1), position: index ? 'G' : 'P' })) },
        { teamId: 'team-away', formation: '3-5-2', starters: Array.from({ length: 11 }, (_, index) => ({ id: `a-${index}`, name: `Ospite ${index + 1}`, jersey: String(index + 1), position: index ? 'G' : 'P' })) }
      ]
    },
    decision: { state: 'ready', label: 'READY', reason: 'Campione sufficiente.' }
  };
  const availability = {
    status: 'documentata', score: 82, structuredCount: 1, signalCount: 0, message: 'Copertura strutturata disponibile.',
    teams: [
      { teamId: 'team-home', structured: [{ id: 'h-4', player: 'Casa 5', category: 'dubbio', detail: 'Valutazione in corso', chance: 50, source: 'Fantasy Premier League', updatedAt: T0 }], lineupOverrides: [], signals: [] },
      { teamId: 'team-away', structured: [], lineupOverrides: [], signals: [] }
    ]
  };
  const reliability = {
    generatedAt: T0, minutesToKickoff: 120, readiness: { state: 'ready', label: 'READY', summary: 'Prove operative sufficienti.' },
    items: [{ id: 'availability', dimensions: { provenance: 88 } }, { id: 'lineups', status: 'solid' }]
  };
  const foundation = buildCurrentEvidenceFoundation(analysis, availability, reliability, T0);
  assert.equal(foundation.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(foundation.entityRefs.event.entityId, 'vantaggio:event:espn:401-test');
  assert.equal(foundation.entityRefs.players.length, 23, 'ID opachi di provider diversi non devono essere auto-uniti anche se hanno lo stesso valore');
  assert.ok(foundation.entityRefs.players.some(player => player.entityId === 'vantaggio:player:fpl:h-4'));
  assert.equal(foundation.entityRefs.identityCandidates.length, 1, 'La similarità può proporre candidati ma non deve fondere i namespace provider');
  ['event.identity', 'event.kickoff', 'event.venue', 'event.state', 'lineup.official', 'player.availability', 'availability.coverage'].forEach(factType => {
    assert.ok(foundation.evidenceLedger.some(item => item.factType === factType), `Manca la evidence Foundation 2 ${factType}`);
  });
  assert.ok(foundation.resolvedFacts.length >= 8);
  assert.equal(foundation.conflicts.length, 0);
  assert.equal(foundation.decisionTrace.applicable, true, 'Il gate decisionale deve restare applicabile prima del kickoff');
  assert.equal(foundation.decisionTrace.phase, 'pre');
  assert.equal(foundation.decisionTrace.effectiveGate.state, 'ready');
  assert.ok(foundation.evidenceLedger.every(item => item.time.observedAt === T0));

  const historicalAnalysis = JSON.parse(JSON.stringify(analysis));
  historicalAnalysis.event.date = '2025-05-01T18:45:00.000Z';
  historicalAnalysis.event.state = 'post';
  historicalAnalysis.event.completed = true;
  historicalAnalysis.event.home.score = '2';
  historicalAnalysis.event.away.score = '1';
  const historical = buildCurrentEvidenceFoundation(historicalAnalysis, availability, { ...reliability, minutesToKickoff: -680000 }, T0);
  const historicalAvailability = historical.evidenceLedger.find(item => item.factType === 'availability.coverage');
  assert.equal(historicalAvailability.state, 'rejected', 'Una fonte corrente non deve ricostruire retroattivamente l’availability di una vecchia gara');
  assert.equal(historicalAvailability.quality.coverage, 0);
  assert.equal(historical.decisionTrace.applicable, false, 'Una review conclusa non deve esporre un gate decisionale applicabile');
  assert.equal(historical.decisionTrace.phase, 'post');
  assert.equal(historical.decisionTrace.modelGate.state, 'hold', 'Il precedente READY del modello deve essere chiuso dopo il risultato');
  assert.equal(historical.decisionTrace.modelGate.label, 'CLOSED');
  assert.equal(historical.decisionTrace.effectiveGate.state, 'hold');
  assert.ok(historical.decisionTrace.rule.includes('Dopo il kickoff'));
  assert.ok(historical.evidenceLedger.some(item => item.factType === 'event.result' && item.state === 'confirmed'));

  const stalePrematchAnalysis = JSON.parse(JSON.stringify(analysis));
  stalePrematchAnalysis.event.date = '2026-08-17T09:00:00.000Z';
  stalePrematchAnalysis.event.state = 'pre';
  stalePrematchAnalysis.event.completed = false;
  const stalePrematch = buildCurrentEvidenceFoundation(stalePrematchAnalysis, availability, { ...reliability, minutesToKickoff: -60 }, T0);
  assert.equal(stalePrematch.decisionTrace.applicable, false, 'Uno stato provider prematch dopo il kickoff non deve riaprire la decisione');
  assert.equal(stalePrematch.decisionTrace.phase, 'closed');
  assert.equal(stalePrematch.decisionTrace.modelGate.state, 'hold');

  const incompleteLineupAnalysis = JSON.parse(JSON.stringify(analysis));
  incompleteLineupAnalysis.lineups.teams = incompleteLineupAnalysis.lineups.teams.slice(0, 1);
  const incompleteLineup = buildCurrentEvidenceFoundation(incompleteLineupAnalysis, availability, reliability, T0);
  assert.ok(incompleteLineup.evidenceLedger.some(item => item.factType === 'lineup.official' && item.state === 'rejected'));
  assert.equal(incompleteLineup.decisionTrace.effectiveGate.state, 'hold', 'Un roster dichiarato ufficiale ma incompleto deve chiudere il gate');
}

try {
  testArtifacts();
  testIdentityStability();
  testEvidenceContractAndTime();
  testPrecedenceSupersessionAndExpiry();
  testSubjectIsolationAndConflicts();
  testFoundationTwoMapping();
  console.log('✓ Evidence Foundation 1: artefatti, identità, contratto, tempo e autorizzazione validi');
  console.log('✓ Evidence Foundation 1: precedenza, supersessione, expiry, isolamento e conflitti validi');
  console.log('✓ Evidence Foundation 2: kickoff, venue, stato, XI e availability mappati senza cambiare i campi esistenti');
} catch (error) {
  console.error('Evidence Foundation test fallito:', error.message);
  process.exit(1);
}
