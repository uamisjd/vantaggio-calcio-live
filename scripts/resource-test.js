'use strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function json(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function probe(url, kind) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', range: 'bytes=0-2047' }
    });
    const type = response.headers.get('content-type') || '';
    await response.body?.cancel().catch(() => {});
    if ([401, 403, 429].includes(response.status)) return { state: 'protected', status: response.status, type, finalUrl: response.url };
    if (response.status < 200 || response.status >= 400) return { state: 'broken', status: response.status, type, finalUrl: response.url };
    if (kind === 'image' && type && !type.startsWith('image/') && !type.includes('octet-stream')) return { state: 'broken', status: response.status, type, finalUrl: response.url, reason: 'content-type non immagine' };
    return { state: 'ok', status: response.status, type, finalUrl: response.url };
  } catch (error) {
    return { state: 'unverified', status: 0, type: '', finalUrl: url, reason: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

(async () => {
  const status = await json('/api/status');
  const from = addDays(status.today, -1);
  const to = addDays(status.today, 13);
  const [matchesPayload, newsPayload] = await Promise.all([
    json(`/api/matches?league=all&from=${from}&to=${to}`),
    json('/api/news')
  ]);
  const resources = new Map();
  const add = (url, kind, context) => {
    if (!url) return;
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error(`URL non valido (${context}): ${url}`); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Protocollo non sicuro (${context}): ${url}`);
    const key = `${kind}:${parsed.href}`;
    const existing = resources.get(key) || { url: parsed.href, kind, contexts: [] };
    existing.contexts.push(context);
    resources.set(key, existing);
  };

  matchesPayload.data.matches.forEach(match => {
    add(match.home?.logo, 'image', `logo ${match.home?.name}`);
    add(match.away?.logo, 'image', `logo ${match.away?.name}`);
  });
  newsPayload.data.articles.forEach(article => {
    add(article.link, 'link', `news ${article.source}`);
    add(article.image, 'image', `immagine news ${article.source}`);
  });

  const standingsResults = await Promise.allSettled(status.standingsLeagues.map(league => json(`/api/standings?league=${encodeURIComponent(league.id)}`)));
  standingsResults.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    result.value.data.table.forEach(row => add(row.logo, 'image', `classifica ${status.standingsLeagues[index].id}`));
  });

  const sample = matchesPayload.data.matches.find(match => match.state === 'pre' && new Date(match.date) > new Date());
  if (sample) {
    const intelligence = await json(`/api/intelligence?event=${encodeURIComponent(sample.id)}&league=${encodeURIComponent(sample.league.id)}`);
    (intelligence.data.news?.articles || []).forEach(article => add(article.link, 'link', `dossier ${sample.id}`));
    (intelligence.data.availability?.teams || []).flatMap(team => team.signals || []).forEach(article => add(article.link, 'link', `availability ${sample.id}`));
  }

  const list = [...resources.values()];
  const results = await mapLimit(list, 16, async item => ({ ...item, result: await probe(item.url, item.kind) }));
  const counts = results.reduce((summary, item) => {
    summary[item.result.state] = (summary[item.result.state] || 0) + 1;
    return summary;
  }, { ok: 0, protected: 0, broken: 0, unverified: 0 });
  const problematic = results.filter(item => item.result.state !== 'ok');
  console.log(`Risorse dinamiche: ${results.length} URL unici · ${counts.ok} OK · ${counts.protected} protetti · ${counts.broken} rotti · ${counts.unverified} non verificabili`);
  problematic.slice(0, 30).forEach(item => console.log(`- ${item.result.state.toUpperCase()} ${item.result.status || ''} ${item.kind} ${item.url} (${item.result.reason || item.result.type || item.contexts[0]})`));
  if (standingsResults.some(result => result.status !== 'fulfilled')) throw new Error(`${standingsResults.filter(result => result.status !== 'fulfilled').length} classifiche non interrogabili`);
  if (counts.broken) throw new Error(`${counts.broken} risorse esterne realmente rotte`);
  process.exitCode = counts.unverified ? 2 : 0;
})().catch(error => {
  console.error('Resource test fallito:', error.message);
  process.exit(1);
});
