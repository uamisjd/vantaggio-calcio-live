'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { validateFoundationArtifacts } = require('../lib/evidence');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/index.html');
const app = read('public/app.js');
const css = read('public/styles.css');
const server = read('server.js');
const pkg = JSON.parse(read('package.json'));
const webManifest = JSON.parse(read('public/manifest.webmanifest'));

function contrast(foreground, background) {
  const luminance = hex => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function functionNames(source) {
  return [...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match => match[1]);
}

const requiredFiles = [
  'server.js', 'package.json', 'render.yaml', 'README.md', 'DEPLOY-RENDER.md',
  'public/index.html', 'public/app.js', 'public/styles.css', 'public/favicon.svg', 'public/manifest.webmanifest',
  'lib/evidence.js', 'data/source-manifest.v1.json', 'data/evidence-contract.v1.json', 'data/entity-registry.v1.json'
];
requiredFiles.forEach(file => assert.ok(fs.existsSync(path.join(root, file)), `File richiesto mancante: ${file}`));

const localAssets = [...html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]+)(?:\?[^"#]*)?"/g)].map(match => match[1]);
localAssets.forEach(asset => assert.ok(fs.existsSync(path.join(root, 'public', asset.replace(/^\//, ''))), `Asset locale mancante: ${asset}`));
assert.ok(!/@import\s+url\((?!['"]?data:)/i.test(css), 'Il CSS dipende da un import esterno');
assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html), 'La shell dipende da asset esterni');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'ID HTML duplicati nella shell');
assert.equal(html.match(/<html\s+lang="it"/i)?.length, 1, 'Lingua italiana non dichiarata');
assert.ok(html.includes('<main id="mainContent"') && html.includes('<nav class="primary-nav"') && html.includes('<footer class="footer"'), 'Landmark semantici incompleti');
assert.ok((html.match(/role="dialog"/g) || []).length === 3 && (html.match(/aria-modal="true"/g) || []).length === 3, 'Dialog statici non dichiarati correttamente');
assert.ok(html.includes('id="globalSearch"') && /id="globalSearch"[^>]+aria-label=/.test(html), 'Campo ricerca senza nome accessibile');
assert.ok(/data-close-search[^>]+aria-label="Chiudi ricerca"/.test(html), 'Controllo chiusura ricerca senza nome accessibile');
assert.ok(!/<svg(?![^>]*class="svg-sprite")[^>]*(?<!aria-hidden="true")>/i.test(html.replace(/<svg aria-hidden="true"/g, '<svg aria-hidden="true"')), 'Icona SVG statica non marcata decorativa');

for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
  const attributes = match[1];
  const visibleText = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.ok(visibleText || /aria-label=|title=/.test(attributes), `Pulsante statico senza nome: ${match[0].slice(0, 90)}`);
}
for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
  assert.ok(/aria-label=|aria-labelledby=/.test(match[1]), `Input senza label: ${match[0]}`);
}

const forbidden = /\b(?:TODO|FIXME|HACK|XXX|lorem ipsum|coming soon|work in progress)\b/i;
for (const [file, source] of [['index.html', html], ['app.js', app], ['styles.css', css], ['server.js', server], ['README.md', read('README.md')]]) {
  assert.ok(!forbidden.test(source), `Contenuto incompleto o marcatore di lavoro in ${file}`);
}
assert.ok(!/font-size:\s*(?:[0-9](?:\.[0-9]+)?|10(?:\.0+)?)px/g.test(`${css}\n${app}`), 'Microtesto sotto 11px rilevato');
assert.ok(app.includes('role="link"') && app.includes('aria-label="Apri alla fonte:'), 'News interattive senza ruolo/nome accessibile');
assert.ok(app.includes('alt="${escapeHtml(team.name)}"') && app.includes("onerror=\"this.style.display='none'"), 'Logo squadra senza alt o fallback di errore');
assert.ok(app.includes('trapDialogFocus') && app.includes('restoreFocus') && app.includes('syncBackgroundInert'), 'Gestione focus/inert dei dialog incompleta');
assert.ok(app.includes("['ArrowRight', 'ArrowLeft', 'Home', 'End']") && app.includes("event.key === 'Escape'"), 'Navigazione tastiera incompleta');
assert.ok(app.includes("setAttribute('aria-current', 'page')"), 'Stato navigazione corrente non esposto');

for (const marker of [
  ':focus-visible', '.command-input:focus-within', '@media (max-width: 980px)', '@media (max-width: 720px)',
  '@media (max-width: 420px)', '@media (pointer: coarse)', '@media (prefers-reduced-motion: reduce)',
  'grid-template-columns: repeat(2,minmax(0,1fr))', 'min-width: var(--tap-target)', 'env(safe-area-inset-bottom)'
]) assert.ok(css.includes(marker), `Protezione UX/responsive mancante: ${marker}`);

const contrastPairs = [
  ['#f3f7f4', '#111c17', 'testo dark'], ['#8f9f96', '#111c17', 'muted dark'], ['#9aaba1', '#111c17', 'muted-2 dark'],
  ['#c8ff52', '#111c17', 'accent dark'], ['#102018', '#ffffff', 'testo light'], ['#69766f', '#ffffff', 'muted light'],
  ['#5f6d65', '#ffffff', 'muted-2 light'], ['#527c00', '#ffffff', 'accent light'], ['#3455c5', '#ffffff', 'blue light'],
  ['#b42335', '#ffffff', 'red light'], ['#8a4e00', '#ffffff', 'amber light'], ['#087a55', '#ffffff', 'green light']
];
contrastPairs.forEach(([foreground, background, label]) => assert.ok(contrast(foreground, background) >= 4.5, `${label}: contrasto inferiore a 4.5:1`));

for (const source of [app, server, read('lib/evidence.js')]) {
  const names = functionNames(source);
  assert.equal(new Set(names).size, names.length, 'Funzioni duplicate nello stesso modulo');
  names.forEach(name => {
    const occurrences = (source.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
    assert.ok(occurrences > 1, `Funzione apparentemente inutilizzata: ${name}`);
  });
}
for (const file of ['server.js', 'lib/evidence.js', ...fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.js')).map(name => `scripts/${name}`)]) {
  const source = read(file);
  for (const match of source.matchAll(/require\(['"](\.{1,2}\/[^'"]+)['"]\)/g)) {
    const target = path.resolve(path.dirname(path.join(root, file)), match[1]);
    assert.ok(fs.existsSync(target) || fs.existsSync(`${target}.js`) || fs.existsSync(`${target}.json`), `${file}: import locale rotto ${match[1]}`);
  }
}

assert.deepEqual(validateFoundationArtifacts(), { valid: true, errors: [] });
assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'Dipendenze runtime inattese');
assert.equal(Object.keys(pkg.devDependencies || {}).length, 0, 'Dipendenze build inattese');
assert.ok(pkg.scripts.start && pkg.scripts.check && pkg.scripts.test && pkg.scripts.audit && pkg.scripts.build && pkg.scripts.quality, 'Script di verifica/build incompleti');
assert.ok(html.includes(`/app.js?v=${pkg.version}`) && html.includes(`/styles.css?v=${pkg.version}`), 'Versione asset diversa dal package');
assert.equal(webManifest.start_url, '/#dashboard');
assert.equal(webManifest.display, 'standalone');
assert.ok(read('render.yaml').includes('startCommand: npm start'), 'Comando Render non allineato');
assert.equal(fs.readdirSync(root).filter(name => /\.(?:ts|tsx)$/.test(name)).length, 0, 'File TypeScript inattesi senza toolchain');

for (const marker of ['loading-view', 'errorBlock', 'emptyState', 'Promise.allSettled', 'safeUrl', 'preserveMonotonicMatchState']) {
  assert.ok(`${html}\n${app}`.includes(marker), `Gestione stato/caso limite mancante: ${marker}`);
}
for (const endpoint of ['/api/status', '/api/matches', '/api/news', '/api/standings', '/api/analysis', '/api/intelligence', '/api/team-dna', '/api/health', '/api/evidence-foundation']) {
  assert.ok(server.includes(endpoint), `Endpoint non implementato: ${endpoint}`);
}

console.log(`✓ Qualità statica: ${requiredFiles.length} file essenziali e ${localAssets.length} riferimenti asset validi`);
console.log(`✓ Accessibilità statica: ${ids.length} ID univoci, controlli nominati, focus dialog, tastiera e landmark validi`);
console.log('✓ Responsive/UX: breakpoint 980/720/420, touch 44px, safe area, reduced motion e tab 2×2 presenti');
console.log(`✓ Contrasto: ${contrastPairs.length} coppie token principali conformi alla soglia 4.5:1`);
console.log('✓ Codice: import locali, funzioni duplicate/inutilizzate, marker incompleti e artefatti Evidence controllati');
