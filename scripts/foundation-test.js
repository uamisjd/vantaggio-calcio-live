'use strict';

const http = require('http');
const {
  fetchText,
  cached,
  sourceHealthSnapshot,
  statisticalModel,
  memoryCache,
  sourceCircuits
} = require('../server');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recentFixture(days = [3, 12, 28, 48], venue = 'Casa') {
  const scores = [[2, 0], [1, 1], [0, 1], [3, 1]];
  const events = days.map((age, index) => ({
    id: `m-${age}-${index}`,
    date: new Date(Date.now() - age * 86400_000).toISOString(),
    venue: index % 2 ? (venue === 'Casa' ? 'Trasferta' : 'Casa') : venue,
    goalsFor: scores[index][0],
    goalsAgainst: scores[index][1]
  }));
  return { played: events.length, events };
}

(async () => {
  const freshHome = recentFixture([3, 12, 28, 48], 'Casa');
  const freshAway = recentFixture([5, 17, 35, 64], 'Trasferta');
  const model = statisticalModel(freshHome, freshAway);
  const outcomeSum = model.outcome.home + model.outcome.draw + model.outcome.away;
  if (Math.abs(outcomeSum - 1) > 0.000001) throw new Error('Il modello non normalizza le probabilità 1-X-2');
  if (model.diagnostics.recencyHalfLifeDays !== 120 || model.diagnostics.priorWeight !== 3) throw new Error('Recency o shrinkage non dichiarati');
  if (model.diagnostics.lowScoreCorrection.method !== 'Dixon-Coles conservativa') throw new Error('Correzione low-score non attivata sul campione minimo');
  if (!Object.values(model.outcome).every(value => value > 0 && value < 1)) throw new Error('Il modello produce probabilità estreme non valide');

  const oldModel = statisticalModel(recentFixture([240, 280, 320, 360], 'Casa'), recentFixture([250, 290, 330, 370], 'Trasferta'));
  if (!(oldModel.diagnostics.effectiveSample < model.diagnostics.effectiveSample)) throw new Error('Il decadimento temporale non riduce il campione effettivo vecchio');

  let upstreamCalls = 0;
  const upstream = http.createServer((req, res) => {
    upstreamCalls += 1;
    if (upstreamCalls <= 4) {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end('temporarily unavailable');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('recovered');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();
  const url = `http://127.0.0.1:${address.port}/feed`;
  try {
    for (let request = 0; request < 2; request += 1) {
      try { await fetchText(url, 800); } catch {}
    }
    const beforeShortCircuit = upstreamCalls;
    let shortCircuited = false;
    try { await fetchText(url, 800); } catch (error) { shortCircuited = /Circuito fonte aperto/.test(error.message); }
    if (!shortCircuited || upstreamCalls !== beforeShortCircuit) throw new Error('Il circuit breaker non interrompe le chiamate dopo la soglia');
    const openSource = sourceHealthSnapshot().sources.find(source => source.host === '127.0.0.1');
    if (openSource?.state !== 'circuito_aperto' || !openSource.circuit?.retryAt) throw new Error('Lo stato circuito aperto non è osservabile');

    sourceCircuits.get('127.0.0.1').openUntil = Date.now() - 1;
    const recovered = await fetchText(url, 800);
    if (recovered !== 'recovered' || sourceCircuits.has('127.0.0.1')) throw new Error('Il circuito non rientra dopo una risposta valida');
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }

  const cacheKey = `foundation:${Date.now()}`;
  const first = await cached(cacheKey, 5, async () => ({ value: 1 }), false, 80);
  if (first.cache !== 'miss' || first.stale) throw new Error('Primo riempimento cache non valido');
  await sleep(12);
  const fallback = await cached(cacheKey, 5, async () => { throw new Error('upstream down'); }, false, 80);
  if (!fallback.stale || fallback.cache !== 'stale' || !Number.isFinite(fallback.staleAgeMs)) throw new Error('Fallback last-known-good non etichettato');
  const entry = memoryCache.get(cacheKey);
  entry.fetchedAt = new Date(Date.now() - 500).toISOString();
  entry.expires = Date.now() - 1;
  let bounded = false;
  try { await cached(cacheKey, 5, async () => { throw new Error('upstream down'); }, false, 80); } catch { bounded = true; }
  if (!bounded) throw new Error('Una cache oltre il limite stale è stata servita');

  console.log('✓ Modello 3.0: recency, shrinkage, normalizzazione e low-score correction validi');
  console.log('✓ Resilienza: retry limitato, circuit breaker, recovery e stale bounded validi');
})().catch(error => {
  console.error('Foundation test fallito:', error.message);
  process.exit(1);
});
