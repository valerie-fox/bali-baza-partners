import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'the partner hub script must be present');
const generalAnchor = html.match(/<[^>]+id="general"[^>]*>/)?.[0] ?? '';
assert.ok(generalAnchor && !generalAnchor.includes('ru-only') && !generalAnchor.includes('en-only'), 'general materials anchor must remain available in every language');
assert.equal(/<aside\b[^>]*class="[^"]*workspace-rail/.test(html), false, 'the partner hub must not render a sidebar');
assert.equal(/<div\b[^>]*class="[^"]*footer\b/.test(html), false, 'the partner hub must not render the removed footer');
assert.equal([...html.matchAll(/<div class="[^"]*\bproject-card-unified\b[^"]*"/g)].length, 5, 'all five residential projects must use the same card component');

const heightsCard = html.match(/<div class="[^"]*project-card-unified[^"]*" id="heights">([\s\S]*?)(?=<div class="[^"]*project-card-unified|<div class="bottom-row")/)?.[1] ?? '';
assert.match(heightsCard, /от \$143 000/, 'The Heights Russian entry price must be $143k');
assert.match(heightsCard, /from \$143,000/, 'The Heights English entry price must be $143k');
assert.match(heightsCard, /Q2 2027/, 'The Heights completion must be Q2 2027');
assert.equal((html.match(/id="btn-(?:ru|en)"/g) || []).length, 2, 'the visible RU/EN switch must remain in the page header');
assert.equal((html.match(/class="pc-stats mini-stats"/g) || []).length, 2, 'delivered projects must use the same structured metric treatment as active projects');
assert.match(html, /<span class="stat-val">2<\/span>[\s\S]*?<span class="[^"]*stat-val[^"]*">\$99k<\/span>/, 'Gate 11 must surface the remaining inventory and entry price as metrics');
assert.match(html, /<span class="stat-val">2BR<\/span>[\s\S]*?<span class="[^"]*stat-val[^"]*">\$130k<\/span>[\s\S]*?<span class="[^"]*stat-val[^"]*">\$5k<\/span>/, 'Sunset must surface format, entry price and agent commission as metrics');
assert.match(html, /@media\(max-width:1280px\) and \(min-width:901px\)[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'mid-size desktop cards must reduce metrics to three columns before values become cramped');

const heroTag = html.match(/<div class="[^"]*hero[^"]*">/)?.[0] ?? '';
assert.match(heroTag, /\bcompact-hero\b/, 'the page header must use the compact hero treatment so project cards enter the first viewport');
const moneyValues = [...html.matchAll(/<span class="([^"]*stat-val[^"]*)">([^<]*\$[^<]*)<\/span>/g)];
assert.ok(moneyValues.length >= 9, 'all visible project prices and commissions must be represented as metric values');
assert.ok(moneyValues.every(match => match[1].split(/\s+/).includes('money-value')), 'every monetary metric must opt into the non-wrapping amount style');
assert.match(html, /\.money-value\{[^}]*white-space:nowrap!important/, 'monetary metrics must never wrap across lines');
assert.match(html, /@media\(max-width:620px\)\{[\s\S]*?\.project-card-unified \.pc-stats:not\(\.mini-stats\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}[\s\S]*?\.project-card-unified \.pc-stats:not\(\.mini-stats\) \.stat:nth-child\(5\)\{grid-column:1\/-1\}/, 'mobile active-project metrics must return to two columns and give the final metric the full row');

function makeElement(className = '', tagName = 'DIV') {
  const attrs = new Map();
  return {
    className,
    tagName,
    style: {},
    textContent: '',
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
  };
}

const ruButton = makeElement();
const enButton = makeElement();
const ruCopy = makeElement('ru-only');
const enCopy = makeElement('en-only');
const enKicker = makeElement('hero-kicker en-only');
const stored = new Map([['partner_lang', 'en']]);

const document = {
  documentElement: makeElement('', 'HTML'),
  getElementById(id) { return id === 'btn-ru' ? ruButton : enButton; },
  querySelectorAll(selector) { return selector === '.ru-only' ? [ruCopy] : [enCopy, enKicker]; },
  addEventListener() {},
};

const context = {
  URL,
  URLSearchParams,
  document,
  navigator: { userAgent: 'test' },
  window: { location: { search: '', hostname: 'localhost' } },
  fetch: async () => ({}),
  getComputedStyle: () => ({ display: 'block' }),
  localStorage: {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { stored.set(key, String(value)); },
  },
};

vm.createContext(context);
vm.runInContext(script, context);

assert.equal(document.documentElement.getAttribute('lang'), 'en', 'saved language must be restored on the next visit');
assert.equal(ruButton.getAttribute('aria-pressed'), 'false', 'inactive language button must be announced as inactive');
assert.equal(enButton.getAttribute('aria-pressed'), 'true', 'active language button must be announced as active');
assert.equal(stored.get('partner_lang'), 'en', 'language choice must persist between visits');
assert.equal(ruCopy.style.display, 'none', 'Russian copy must be hidden in English mode');
assert.equal(enCopy.style.display, 'block', 'English copy must be visible in English mode');
assert.equal(enKicker.style.display, 'flex', 'layout components must retain their intended display mode after switching language');

console.log('site behavior tests passed');
