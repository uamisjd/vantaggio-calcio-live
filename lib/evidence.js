'use strict';

const crypto = require('crypto');
const sourceManifest = require('../data/source-manifest.v1.json');
const evidenceContract = require('../data/evidence-contract.v1.json');
const registryPolicy = require('../data/entity-registry.v1.json');

const EVIDENCE_SCHEMA_VERSION = evidenceContract['x-contractVersion'];
const EVIDENCE_REGISTRY_VERSION = registryPolicy.registryVersion;
const EVIDENCE_MANIFEST_VERSION = sourceManifest.manifestVersion;

const FACT_TYPES = Object.freeze([
  'event.identity', 'event.competition_context', 'event.kickoff', 'event.venue', 'event.state', 'event.result',
  'team.recent_result', 'team.schedule_event', 'team.rest_days', 'team.strength_baseline', 'team.tactical_metric',
  'player.availability', 'player.suspension', 'player.return',
  'lineup.probable', 'lineup.official', 'lineup.formation', 'lineup.omission',
  'availability.coverage', 'model.forecast', 'market.price', 'market.consensus', 'match.statistics',
  'news.article', 'news.claim', 'coach.statement'
]);
const FACT_TYPE_SET = new Set(FACT_TYPES);
const SOURCE_BY_ID = new Map(sourceManifest.sources.map(source => [source.sourceId, source]));
const EVIDENCE_STATES = new Set(['observed', 'confirmed', 'expected', 'conflicted', 'superseded', 'expired', 'rejected']);
const DECISION_IMPACTS = new Set(['essential', 'supporting', 'optional']);

function validateFoundationArtifacts() {
  const errors = [];
  if (!EVIDENCE_SCHEMA_VERSION) errors.push('Versione Evidence Contract mancante');
  if (!EVIDENCE_REGISTRY_VERSION) errors.push('Versione Entity Registry mancante');
  if (!EVIDENCE_MANIFEST_VERSION) errors.push('Versione Source Manifest mancante');
  if (SOURCE_BY_ID.size !== sourceManifest.sources.length) errors.push('Source ID duplicati');
  sourceManifest.sources.forEach(source => {
    if (!source.sourceId || !source.label || !Number.isInteger(source.defaultTier) || source.defaultTier < 1 || source.defaultTier > 4) errors.push(`Fonte non valida: ${source.sourceId || 'senza-id'}`);
    (source.factTypes || []).forEach(factType => { if (!FACT_TYPE_SET.has(factType)) errors.push(`${source.sourceId}: factType sconosciuto ${factType}`); });
    Object.entries(source.defaultTierByFact || {}).forEach(([factType, tier]) => {
      if (!(source.factTypes || []).includes(factType) || !Number.isInteger(tier) || tier < 1 || tier > 4) errors.push(`${source.sourceId}: tier specifico non valido per ${factType}`);
    });
  });
  const contractFactTypes = evidenceContract.properties?.factType?.enum || [];
  if (stableSetKey(contractFactTypes) !== stableSetKey(FACT_TYPES)) errors.push('Taxonomy factType non allineata al contratto');
  const registryStates = new Set(registryPolicy.resolutionStates || []);
  ['confirmed', 'candidate', 'conflict', 'retired', 'redirect'].forEach(state => { if (!registryStates.has(state)) errors.push(`Entity state mancante: ${state}`); });
  return { valid: errors.length === 0, errors };
}

function stableSetKey(values) {
  return [...new Set(values || [])].sort().join('|');
}

const FOUNDATION_ARTIFACT_VALIDATION = validateFoundationArtifacts();
if (!FOUNDATION_ARTIFACT_VALIDATION.valid) throw new Error(`Evidence Foundation artifacts invalidi: ${FOUNDATION_ARTIFACT_VALIDATION.errors.join('; ')}`);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function isJsonSafe(value) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) return Object.values(value).every(isJsonSafe);
  return false;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function shortHash(value, length = 18) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, length);
}

function isoOrNull(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireIso(value, field) {
  const normalized = isoOrNull(value);
  if (!normalized) throw new Error(`${field} non è un timestamp ISO valido`);
  return normalized;
}

function optionalIso(value, field) {
  if (value == null || value === '') return null;
  return requireIso(value, field);
}

function normalizedName(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactId(value = '') {
  return String(value).trim().replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function canonicalCompetitionRef(leagueId, league = {}) {
  const rawProviderId = String(leagueId || league.id || '').trim();
  const provider = compactId(league.provider || 'espn') || 'unknown';
  const providerId = rawProviderId ? `${provider}:${compactId(rawProviderId)}` : `context:${shortHash({ name: normalizedName(league.label), country: normalizedName(league.country) }, 14)}`;
  return {
    entityId: `vantaggio:competition:${providerId}`,
    entityType: 'competition',
    canonicalName: league.label || leagueId || 'Competizione non catalogata',
    country: league.country || '',
    providerRefs: rawProviderId ? [{ provider, id: rawProviderId, state: 'confirmed' }] : [],
    resolution: { state: rawProviderId ? 'confirmed' : 'candidate', method: rawProviderId ? 'provider-competition-id' : 'context-hash-needs-review', registryVersion: EVIDENCE_REGISTRY_VERSION }
  };
}

function canonicalTeamRef(team = {}, context = {}) {
  const providerId = String(team.id || '').trim();
  const provider = compactId(team.provider || 'espn') || 'unknown';
  const contextualSeed = { name: normalizedName(team.name), competition: context.competitionId || context.leagueId || '', season: context.season || '' };
  const stableId = providerId ? `${provider}:${compactId(providerId)}` : `context:${shortHash(contextualSeed, 14)}`;
  return {
    entityId: `vantaggio:team:${stableId}`,
    entityType: 'team',
    canonicalName: team.name || 'Squadra non identificata',
    providerRefs: providerId ? [{ provider, id: providerId, state: 'confirmed' }] : [],
    aliases: team.name ? [{ value: team.name, normalized: normalizedName(team.name), source: 'current-event', state: providerId ? 'confirmed' : 'candidate' }] : [],
    context: { competitionId: context.competitionId || null, season: context.season || null },
    resolution: {
      state: providerId ? 'confirmed' : 'candidate',
      method: providerId ? 'provider-team-id' : 'context-hash-needs-review',
      locked: Boolean(providerId),
      registryVersion: EVIDENCE_REGISTRY_VERSION
    }
  };
}

function canonicalEventRef(event = {}, competitionRef, teamRefs = []) {
  const providerId = String(event.id || '').trim();
  const provider = compactId(event.provider || 'espn') || 'unknown';
  const fallbackSeed = {
    competition: competitionRef?.entityId || event.leagueId || '',
    teams: teamRefs.map(team => team.entityId).sort(),
    date: isoOrNull(event.date)
  };
  const stableId = providerId ? `${provider}:${compactId(providerId)}` : `context:${shortHash(fallbackSeed, 16)}`;
  return {
    entityId: `vantaggio:event:${stableId}`,
    entityType: 'event',
    competitionId: competitionRef?.entityId || null,
    scheduledAt: isoOrNull(event.date),
    homeTeamId: teamRefs[0]?.entityId || null,
    awayTeamId: teamRefs[1]?.entityId || null,
    providerRefs: providerId ? [{ provider, id: providerId, state: 'confirmed' }] : [],
    resolution: {
      state: providerId && teamRefs.every(team => team.resolution.state === 'confirmed') ? 'confirmed' : 'candidate',
      method: providerId ? 'provider-event-id-plus-participants' : 'context-hash-needs-review',
      registryVersion: EVIDENCE_REGISTRY_VERSION
    }
  };
}

function canonicalPlayerRef(player = {}, teamRef = null, season = '') {
  const providerId = String(player.id || '').trim();
  const provider = compactId(player.provider || 'espn') || 'unknown';
  const seed = { name: normalizedName(player.name || player.player), team: teamRef?.entityId || '', season };
  const stableId = providerId ? `${provider}:${compactId(providerId)}` : `context:${shortHash(seed, 16)}`;
  return {
    entityId: `vantaggio:player:${stableId}`,
    entityType: 'player',
    canonicalName: player.name || player.player || 'Giocatore non identificato',
    teamId: teamRef?.entityId || null,
    context: { teamId: teamRef?.entityId || null, season: season || null },
    providerRefs: providerId ? [{ provider, id: providerId, state: 'confirmed' }] : [],
    resolution: {
      state: providerId ? 'confirmed' : 'candidate',
      method: providerId ? 'provider-player-id' : 'team-season-context-hash',
      registryVersion: EVIDENCE_REGISTRY_VERSION
    }
  };
}

function buildEntityRegistry(event = {}, league = {}) {
  const competition = canonicalCompetitionRef(event.leagueId || league.id, league);
  const eventDate = event.date ? new Date(event.date) : null;
  const season = eventDate && Number.isFinite(eventDate.getTime()) ? String(eventDate.getUTCFullYear()) : '';
  const context = { leagueId: event.leagueId || league.id, competitionId: competition.entityId, season };
  const home = canonicalTeamRef(event.home, context);
  const away = canonicalTeamRef(event.away, context);
  const canonicalEvent = canonicalEventRef(event, competition, [home, away]);
  return {
    schemaVersion: registryPolicy.schemaVersion,
    registryVersion: EVIDENCE_REGISTRY_VERSION,
    competition,
    event: canonicalEvent,
    teams: { home, away },
    resolutionState: [competition, canonicalEvent, home, away].every(item => item.resolution.state === 'confirmed') ? 'confirmed' : 'candidate'
  };
}

function sourceTier(source, factType) {
  return clamp(source.defaultTierByFact?.[factType] || source.defaultTier || 4, 1, 4);
}

function validateEvidenceRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return { valid: false, errors: ['Evidence non è un oggetto'] };
  if (record.schemaVersion !== EVIDENCE_SCHEMA_VERSION) errors.push('schemaVersion non supportata');
  if (typeof record.evidenceId !== 'string' || record.evidenceId.length < 8) errors.push('evidenceId non valido');
  if (!FACT_TYPE_SET.has(record.factType)) errors.push('factType non supportato');
  if (!record.subject?.entityId || !['competition', 'event', 'team', 'player'].includes(record.subject?.entityType)) errors.push('subject non valido');
  if (!Object.prototype.hasOwnProperty.call(record, 'value') || !isJsonSafe(record.value)) errors.push('value mancante o non serializzabile');
  if (!record.scope || typeof record.scope !== 'object' || Array.isArray(record.scope)) errors.push('scope non valido');
  const source = SOURCE_BY_ID.get(record.source?.sourceId);
  if (!source || !source.factTypes.includes(record.factType)) errors.push('fonte non autorizzata per il factType');
  if (!Number.isInteger(record.source?.tier) || record.source.tier < 1 || record.source.tier > 4) errors.push('source tier non valido');
  if (source && record.source?.tier !== sourceTier(source, record.factType)) errors.push('source tier non coerente con il manifest');
  if (source && record.source?.class !== source.class) errors.push('source class non coerente con il manifest');
  if (!record.source?.label) errors.push('source label mancante');
  else if (source && record.source.label !== source.label) errors.push('source label non coerente con il manifest');
  if (!record.time?.observedAt || !isoOrNull(record.time.observedAt)) errors.push('observedAt non valido');
  ['validFrom', 'validTo', 'publishedAt', 'observedAt', 'expiresAt'].forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(record.time || {}, field)) errors.push(`${field} mancante`);
    else if (record.time[field] != null && !isoOrNull(record.time[field])) errors.push(`${field} non valido`);
  });
  if (record.time?.validFrom && record.time?.validTo && new Date(record.time.validTo) < new Date(record.time.validFrom)) errors.push('valid time invertito');
  if (record.time?.publishedAt && record.time?.observedAt && new Date(record.time.publishedAt).getTime() > new Date(record.time.observedAt).getTime() + 5 * 60_000) errors.push('publishedAt successivo a observedAt');
  ['provenance', 'coverage', 'freshness'].forEach(field => {
    const value = record.quality?.[field];
    if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`quality.${field} non valida`);
  });
  if (!EVIDENCE_STATES.has(record.state)) errors.push('state non valido');
  if (!DECISION_IMPACTS.has(record.decisionImpact)) errors.push('decisionImpact non valido');
  if (!Object.prototype.hasOwnProperty.call(record.provenance || {}, 'locator')) errors.push('provenance.locator mancante');
  if (!/^sha256:[a-f0-9]{64}$/.test(record.provenance?.rawHash || '') || !record.provenance?.transform) errors.push('provenance hash/transform non validi');
  if (!Array.isArray(record.provenance?.derivedFrom) || !record.provenance.derivedFrom.every(item => typeof item === 'string') || !Array.isArray(record.provenance?.warnings) || !record.provenance.warnings.every(item => typeof item === 'string')) errors.push('relazioni/warnings di provenance non validi');
  if (!Array.isArray(record.supersedes) || !record.supersedes.every(item => typeof item === 'string') || !Array.isArray(record.conflictsWith) || !record.conflictsWith.every(item => typeof item === 'string')) errors.push('relazioni evidence non valide');
  return { valid: errors.length === 0, errors };
}

function makeEvidence(input = {}) {
  if (!FACT_TYPE_SET.has(input.factType)) throw new Error(`Fact type non supportato: ${input.factType || 'vuoto'}`);
  if (!input.subject?.entityType || !input.subject?.entityId || !isJsonSafe(input.subject)) throw new Error('Subject evidence incompleto');
  if (!['competition', 'event', 'team', 'player'].includes(input.subject.entityType)) throw new Error(`Entity type non supportato: ${input.subject.entityType}`);
  if (!Object.prototype.hasOwnProperty.call(input, 'value') || !isJsonSafe(input.value)) throw new Error('Value evidence mancante o non serializzabile');
  if (input.scope != null && (!isJsonSafe(input.scope) || Array.isArray(input.scope) || typeof input.scope !== 'object')) throw new Error('Scope evidence non valido');
  const source = SOURCE_BY_ID.get(input.sourceId);
  if (!source) throw new Error(`Fonte non registrata: ${input.sourceId || 'vuota'}`);
  if (!source.factTypes.includes(input.factType)) throw new Error(`${source.sourceId} non è autorizzata per ${input.factType}`);
  let state = input.state || 'observed';
  if (!EVIDENCE_STATES.has(state)) throw new Error(`Stato evidence non valido: ${state}`);
  const decisionImpact = input.decisionImpact || 'supporting';
  if (!DECISION_IMPACTS.has(decisionImpact)) throw new Error(`Impatto evidence non valido: ${decisionImpact}`);
  const observedAt = requireIso(input.observedAt || new Date().toISOString(), 'observedAt');
  const candidatePublishedAt = optionalIso(input.publishedAt, 'publishedAt');
  const publicationInFuture = candidatePublishedAt && new Date(candidatePublishedAt).getTime() > new Date(observedAt).getTime() + 5 * 60_000;
  const publishedAt = publicationInFuture ? null : candidatePublishedAt;
  const validFrom = optionalIso(input.validFrom, 'validFrom');
  const validTo = optionalIso(input.validTo, 'validTo');
  const expiresAt = optionalIso(input.expiresAt, 'expiresAt');
  if (validFrom && validTo && new Date(validTo) < new Date(validFrom)) throw new Error('Intervallo valid time invertito');
  if (expiresAt && new Date(expiresAt) <= new Date(observedAt) && !['rejected', 'superseded'].includes(state)) state = 'expired';
  const locator = input.locator || null;
  const rawHash = input.rawHash || `sha256:${shortHash({ factType: input.factType, value: input.value, locator }, 64)}`;
  const identity = {
    factType: input.factType, subject: input.subject, value: input.value, sourceId: source.sourceId, observedAt, state, locator, rawHash,
    supersedes: [...new Set(input.supersedes || [])], derivedFrom: [...new Set(input.derivedFrom || [])]
  };
  ['provenance', 'coverage', 'freshness'].forEach(field => {
    if (input[field] != null && (typeof input[field] !== 'number' || !Number.isFinite(input[field]))) throw new Error(`${field} evidence non valido`);
  });
  const freshness = input.freshness == null ? 100 : clamp(input.freshness);
  const record = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    evidenceId: input.evidenceId || `ev:${compactId(input.factType)}:${shortHash(identity)}`,
    factType: input.factType,
    subject: canonicalize(input.subject),
    value: canonicalize(input.value),
    source: { sourceId: source.sourceId, label: source.label, tier: sourceTier(source, input.factType), class: source.class },
    time: { validFrom, validTo, publishedAt, observedAt, expiresAt },
    scope: canonicalize(input.scope || {}),
    provenance: {
      locator,
      rawHash,
      transform: input.transform || 'identity@1.0',
      derivedFrom: [...new Set(input.derivedFrom || [])],
      warnings: publicationInFuture ? ['FUTURE_PUBLISHED_AT_REJECTED'] : []
    },
    quality: {
      provenance: clamp(input.provenance == null ? source.provenanceScore : input.provenance),
      coverage: clamp(input.coverage == null ? 100 : input.coverage),
      freshness
    },
    state,
    supersedes: [...new Set(input.supersedes || [])],
    conflictsWith: [...new Set(input.conflictsWith || [])],
    decisionImpact
  };
  const validation = validateEvidenceRecord(record);
  if (!validation.valid) throw new Error(`Evidence Contract V1 violato: ${validation.errors.join('; ')}`);
  return record;
}

function evidenceStateAt(evidence, referenceTime = new Date().toISOString()) {
  if (['rejected', 'superseded', 'expired'].includes(evidence.state)) return evidence.state;
  const expires = evidence.time?.expiresAt ? new Date(evidence.time.expiresAt).getTime() : null;
  const validFrom = evidence.time?.validFrom ? new Date(evidence.time.validFrom).getTime() : null;
  const validTo = evidence.time?.validTo ? new Date(evidence.time.validTo).getTime() : null;
  const reference = new Date(referenceTime).getTime();
  if ((expires && expires <= reference) || (validTo && validTo <= reference)) return 'expired';
  if (validFrom && validFrom > reference && ['confirmed', 'observed'].includes(evidence.state)) return 'expected';
  return evidence.state;
}

function stateRank(state) {
  return ({ confirmed: 5, observed: 4, expected: 3, conflicted: 2, expired: 1, superseded: 0, rejected: 0 })[state] ?? 0;
}

function conflictSeverity(factType, impact) {
  if (impact === 'essential' && ['event.identity', 'event.kickoff', 'lineup.official', 'event.result'].includes(factType)) return 'critical';
  return impact === 'essential' ? 'material' : 'informational';
}

function evidenceSubjectKey(evidence) {
  return `${evidence.subject?.entityId || ''}|${evidence.subject?.teamId || ''}|${evidence.subject?.claimId || ''}`;
}

function resolveEvidence(factType, evidences, options = {}) {
  if (!FACT_TYPE_SET.has(factType)) throw new Error(`Fact type non supportato: ${factType}`);
  const referenceTime = requireIso(options.referenceTime || new Date().toISOString(), 'referenceTime');
  const factEvidence = (evidences || []).filter(item => item.factType === factType);
  const subjectKeys = new Set(factEvidence.map(evidenceSubjectKey));
  if (!options.subjectKey && subjectKeys.size > 1) throw new Error(`subjectKey obbligatorio per riconciliare ${factType} su più soggetti`);
  const sameFact = factEvidence.filter(item => !options.subjectKey || evidenceSubjectKey(item) === options.subjectKey).sort((a, b) => {
    const observedDifference = new Date(a.time.observedAt) - new Date(b.time.observedAt);
    return observedDifference || a.evidenceId.localeCompare(b.evidenceId);
  });
  if (!sameFact.length) return { resolvedFact: null, conflict: null };

  const validSuperseders = sameFact.filter(item => evidenceStateAt(item, referenceTime) !== 'rejected');
  const explicitlySuperseded = new Set(validSuperseders.flatMap(item => item.supersedes || []));
  const effectiveState = item => explicitlySuperseded.has(item.evidenceId) ? 'superseded' : evidenceStateAt(item, referenceTime);
  const latestBySource = new Map();
  sameFact.forEach(item => {
    const previous = latestBySource.get(item.source.sourceId);
    const newer = previous ? new Date(item.time.observedAt) - new Date(previous.time.observedAt) : 1;
    if (!previous || newer > 0 || (newer === 0 && item.evidenceId > previous.evidenceId)) latestBySource.set(item.source.sourceId, item);
  });
  const current = [...latestBySource.values()].sort((a, b) => {
    const stateDifference = stateRank(effectiveState(b)) - stateRank(effectiveState(a));
    if (stateDifference) return stateDifference;
    if (a.source.tier !== b.source.tier) return a.source.tier - b.source.tier;
    const observedDifference = new Date(b.time.observedAt) - new Date(a.time.observedAt);
    if (observedDifference) return observedDifference;
    const sourceDifference = a.source.sourceId.localeCompare(b.source.sourceId);
    return sourceDifference || a.evidenceId.localeCompare(b.evidenceId);
  });
  const usable = current.filter(item => !['rejected', 'superseded', 'expired'].includes(effectiveState(item)));
  const candidates = usable.length ? usable : current;
  const chosen = candidates[0];
  const chosenState = effectiveState(chosen);
  const comparable = usable.filter(item => ['confirmed', 'observed'].includes(effectiveState(item)));
  const values = new Map();
  comparable.forEach(item => values.set(stableStringify(item.value), item.value));
  const isConflict = values.size > 1;
  const severity = conflictSeverity(factType, chosen.decisionImpact);
  const conflict = isConflict ? {
    conflictId: `conflict:${compactId(factType)}:${shortHash(comparable.map(item => ({ id: item.evidenceId, value: item.value })))}`,
    factType,
    subjectId: chosen.subject.entityId,
    severity,
    state: 'open',
    evidenceIds: comparable.map(item => item.evidenceId),
    values: comparable.map(item => ({ value: item.value, sourceId: item.source.sourceId, observedAt: item.time.observedAt })),
    decisionImpact: severity === 'critical' ? 'hold-near-kickoff' : 'review-required',
    nextCheck: options.nextCheck || 'Ricontrollo della fonte più autorevole'
  } : null;
  const resolutionState = isConflict ? 'conflicted' : chosenState;
  const resolvedFact = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    resolvedFactId: `rf:${compactId(factType)}:${shortHash({ chosen: chosen.evidenceId, state: resolutionState, at: referenceTime })}`,
    factType,
    subjectId: chosen.subject.entityId,
    subject: chosen.subject,
    value: chosen.value,
    state: resolutionState,
    chosenEvidenceId: chosen.evidenceId,
    evidenceIds: sameFact.map(item => item.evidenceId),
    candidateEvidenceIds: candidates.map(item => item.evidenceId),
    alternatives: candidates.slice(1).map(item => ({ evidenceId: item.evidenceId, sourceId: item.source.sourceId, value: item.value, state: effectiveState(item) })),
    history: sameFact.filter(item => item.evidenceId !== chosen.evidenceId).map(item => ({ evidenceId: item.evidenceId, sourceId: item.source.sourceId, observedAt: item.time.observedAt, state: effectiveState(item) })),
    resolution: {
      policy: options.policy || `${compactId(factType)}-v1`,
      supersededEvidenceIds: [...explicitlySuperseded],
      reason: isConflict ? `${values.size} valori correnti incompatibili: il conflitto resta aperto.` : usable.length ? `Evidenza corrente più forte per stato, tier e tempo di osservazione.` : 'Nessuna evidenza corrente: viene esposta l’ultima versione scaduta.',
      resolvedAt: referenceTime
    },
    quality: { ...chosen.quality, freshness: chosenState === 'expired' ? 0 : chosen.quality.freshness },
    decisionImpact: chosen.decisionImpact,
    criticality: chosen.decisionImpact
  };
  return { resolvedFact, conflict };
}

function resolveAllEvidence(evidences, options = {}) {
  const groups = new Map();
  (evidences || []).forEach(item => {
    const key = `${item.factType}::${evidenceSubjectKey(item)}`;
    if (!groups.has(key)) groups.set(key, { key, factType: item.factType, subjectKey: evidenceSubjectKey(item) });
  });
  const resolvedFacts = [];
  const conflicts = [];
  [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).forEach(group => {
    const resolution = resolveEvidence(group.factType, evidences, { ...options, subjectKey: group.subjectKey });
    if (resolution.resolvedFact) resolvedFacts.push(resolution.resolvedFact);
    if (resolution.conflict) conflicts.push(resolution.conflict);
  });
  return { resolvedFacts, conflicts };
}

function buildEvidenceSummary(evidences, referenceTime = new Date().toISOString(), conflicts = [], resolvedFacts = []) {
  const states = { confirmed: 0, observed: 0, expected: 0, conflicted: 0, superseded: 0, expired: 0, rejected: 0 };
  (evidences || []).forEach(item => { states[evidenceStateAt(item, referenceTime)] += 1; });
  const openConflicts = (conflicts || []).filter(item => item.state === 'open');
  const factTypes = [...new Set((evidences || []).map(item => item.factType))].sort();
  const sources = [...new Set((evidences || []).map(item => item.source.sourceId))].sort();
  const essential = (evidences || []).filter(item => item.decisionImpact === 'essential');
  const resolvedStates = (resolvedFacts || []).reduce((result, item) => {
    result[item.state] = (result[item.state] || 0) + 1;
    return result;
  }, {});
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    total: (evidences || []).length,
    states,
    conflicts: { open: openConflicts.length, critical: openConflicts.filter(item => item.severity === 'critical').length, ids: openConflicts.map(item => item.conflictId) },
    factTypes,
    sources,
    resolved: { total: (resolvedFacts || []).length, byState: resolvedStates, unavailableEssential: (resolvedFacts || []).filter(item => item.decisionImpact === 'essential' && (['expired', 'rejected', 'conflicted'].includes(item.state) || (['confirmed', 'observed'].includes(item.state) && item.quality?.coverage === 0))).map(item => item.resolvedFactId) },
    essential: {
      total: essential.length,
      current: essential.filter(item => ['confirmed', 'observed'].includes(evidenceStateAt(item, referenceTime))).length,
      expected: essential.filter(item => evidenceStateAt(item, referenceTime) === 'expected').length,
      expired: essential.filter(item => evidenceStateAt(item, referenceTime) === 'expired').length
    },
    rule: 'Il conteggio descrive le prove registrate; non consente a evidenze opzionali di compensare domini essenziali mancanti.'
  };
}

function combineDecisionTrace(modelDecision = {}, dataReadiness = {}, resolvedFacts = [], conflicts = [], generatedAt = new Date().toISOString()) {
  const rank = { hold: 0, caution: 1, ready: 2 };
  const modelState = rank[modelDecision.state] == null ? 'caution' : modelDecision.state;
  let evidenceState = rank[dataReadiness.state] == null ? 'caution' : dataReadiness.state;
  const openConflicts = (conflicts || []).filter(item => item.state === 'open');
  const unavailableEssential = (resolvedFacts || []).filter(item => item.decisionImpact === 'essential' && (['expired', 'rejected'].includes(item.state) || (['confirmed', 'observed'].includes(item.state) && item.quality?.coverage === 0)));
  const conflictedEssential = (resolvedFacts || []).filter(item => item.decisionImpact === 'essential' && item.state === 'conflicted');
  if (openConflicts.some(item => item.severity === 'critical') || unavailableEssential.length) evidenceState = 'hold';
  else if ((openConflicts.some(item => item.severity === 'material') || conflictedEssential.length) && evidenceState === 'ready') evidenceState = 'caution';
  const effectiveState = rank[modelState] <= rank[evidenceState] ? modelState : evidenceState;
  const reasons = [modelDecision.reason, dataReadiness.summary]
    .concat(openConflicts.map(item => `Conflitto ${item.severity}: ${item.factType}.`))
    .concat(unavailableEssential.map(item => item.quality?.coverage === 0 && !['expired', 'rejected'].includes(item.state) ? `Evidenza essenziale a copertura zero: ${item.factType}.` : `Evidenza essenziale ${item.state}: ${item.factType}.`))
    .concat(conflictedEssential.filter(item => !openConflicts.some(conflict => conflict.factType === item.factType && conflict.subjectId === item.subjectId)).map(item => `Evidenza essenziale in conflitto: ${item.factType}.`))
    .filter(Boolean);
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: requireIso(generatedAt, 'generatedAt'),
    modelGate: { state: modelState, label: modelDecision.label || modelState.toUpperCase() },
    evidenceGate: { state: evidenceState, label: evidenceState.toUpperCase() },
    effectiveGate: { state: effectiveState, label: effectiveState.toUpperCase() },
    reasons: [...new Set(reasons)],
    resolvedFactIds: (resolvedFacts || []).filter(Boolean).map(item => item.resolvedFactId),
    criticalConflictIds: (conflicts || []).filter(item => item.severity === 'critical' && item.state === 'open').map(item => item.conflictId),
    rule: 'Il Decision Passport usa sempre lo stato più prudente fra Model Gate ed Evidence Gate.'
  };
}

function publicFoundationManifest() {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    registryVersion: EVIDENCE_REGISTRY_VERSION,
    sourceManifestVersion: EVIDENCE_MANIFEST_VERSION,
    factTypes: FACT_TYPES,
    sourceManifest,
    registryPolicy,
    evidenceContract
  };
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_REGISTRY_VERSION,
  EVIDENCE_MANIFEST_VERSION,
  FACT_TYPES,
  sourceManifest,
  evidenceContract,
  registryPolicy,
  validateFoundationArtifacts,
  stableStringify,
  shortHash,
  normalizedName,
  canonicalCompetitionRef,
  canonicalTeamRef,
  canonicalEventRef,
  canonicalPlayerRef,
  buildEntityRegistry,
  validateEvidenceRecord,
  makeEvidence,
  evidenceStateAt,
  evidenceSubjectKey,
  resolveEvidence,
  resolveAllEvidence,
  buildEvidenceSummary,
  combineDecisionTrace,
  publicFoundationManifest
};
