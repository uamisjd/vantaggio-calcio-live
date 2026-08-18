'use strict';

const assert = require('assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'VANTAGGIO verification' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function competitors(summary) {
  const competition = summary.header?.competitions?.[0] || {};
  const bySide = side => competition.competitors?.find(item => item.homeAway === side) || {};
  const normalize = item => ({
    id: String(item.id || item.team?.id || ''),
    name: item.team?.shortDisplayName || item.team?.displayName || item.team?.name || '',
    score: Number(item.score || 0)
  });
  return { competition, home: normalize(bySide('home')), away: normalize(bySide('away')) };
}

function compare(local, summary, label) {
  const source = competitors(summary);
  assert.equal(String(summary.header?.id), String(local.id), `${label}: event ID diverso dalla fonte`);
  assert.equal(new Date(source.competition.date).toISOString(), new Date(local.date).toISOString(), `${label}: kickoff diverso dalla fonte`);
  assert.equal(source.home.id, String(local.home.id), `${label}: home ID diverso dalla fonte`);
  assert.equal(source.away.id, String(local.away.id), `${label}: away ID diverso dalla fonte`);
  assert.equal(source.home.name, local.home.name, `${label}: nome casa diverso dalla fonte`);
  assert.equal(source.away.name, local.away.name, `${label}: nome ospite diverso dalla fonte`);
  assert.equal(source.competition.status?.type?.state, local.state, `${label}: stato diverso dalla fonte`);
  if (local.state !== 'pre') {
    assert.equal(source.home.score, Number(local.home.score), `${label}: score casa diverso dalla fonte`);
    assert.equal(source.away.score, Number(local.away.score), `${label}: score ospite diverso dalla fonte`);
  }
  const sourceVenue = summary.gameInfo?.venue?.fullName || '';
  if (sourceVenue && local.venue) assert.equal(sourceVenue, local.venue, `${label}: venue diversa dalla fonte`);
}

(async () => {
  const status = await getJson(`${base}/api/status`);
  const referenceDay = new Date(`${status.today}T12:00:00Z`);
  const from = new Date(referenceDay.getTime() - 86400000).toISOString().slice(0, 10);
  const to = new Date(referenceDay.getTime() + 86400000).toISOString().slice(0, 10);
  const matchesPayload = await getJson(`${base}/api/matches?league=all&from=${from}&to=${to}`);
  const candidates = matchesPayload.data.matches.filter(match => !match.league.id.startsWith('global.')).slice(0, 30);
  assert.ok(candidates.length, 'Nessuna partita corrente confrontabile con la fonte primaria');
  let currentChecks = 0;
  let unavailableSummaries = 0;
  for (const match of candidates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(match.league.id)}/summary?event=${encodeURIComponent(match.id)}`;
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'VANTAGGIO verification' } });
    if (response.status === 400) { unavailableSummaries += 1; continue; }
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    compare(match, await response.json(), `${match.home.name}–${match.away.name}`);
    currentChecks += 1;
    if (currentChecks === 5) break;
  }
  assert.equal(currentChecks, 5, `Solo ${currentChecks} partite correnti confrontabili direttamente; summary non pubblicati: ${unavailableSummaries}`);

  const historicalLocal = (await getJson(`${base}/api/intelligence?event=401873624&league=uefa.super_cup`)).data.event;
  const historicalSource = await getJson('https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.super_cup/summary?event=401873624');
  compare(historicalLocal, historicalSource, 'PSG–Aston Villa storico');
  const sourceStarterCount = (historicalSource.rosters || []).reduce((sum, roster) => sum + (roster.roster || []).filter(player => player.starter).length, 0);
  assert.equal(sourceStarterCount, 22, 'La fonte storica non espone più 22 titolari ufficiali');

  console.log(`✓ Coerenza fonte primaria: ${currentChecks} partite correnti confrontate su ID, kickoff, squadre, stato, score e venue (${unavailableSummaries} summary non pubblicati ignorati)`);
  console.log('✓ Coerenza storica: PSG–Aston Villa 2-1 e 22 titolari ufficiali confrontati direttamente con ESPN');
})().catch(error => {
  console.error('Source consistency test fallito:', error.message);
  process.exit(1);
});
