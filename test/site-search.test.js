const test = require('node:test');
const assert = require('node:assert');
const { buildSearchIndex, searchScript } = require('../site/search');
const { rank } = require('../site/search-client');
const { buildModel } = require('../site/model');
const copy = require('../site/copy.json');

const registry = {
  owner: 'me',
  kits: [
    { name: 'pay-kit', covers: '藍新付款', repo: 'r', install: 'i', keywords: ['金流', 'newebpay'] },
    { name: 'wall-kit', covers: '方案與付費牆', repo: 'r', install: 'i', keywords: ['paywall'] },
    { name: 'up-kit', type: 'component', covers: '分片上傳', repo: 'r', install: 'i', keywords: ['upload'] },
    { name: 'hidden-kit', covers: '機密金流', repo: 'r', install: 'i', keywords: ['金流'] },
  ],
};
const repo = (over = {}) => ({ public: true, branch: 'master', readme: '', hasSkill: true, logo: null, ...over });
const repos = { 'pay-kit': repo(), 'wall-kit': repo(), 'up-kit': repo({ hasSkill: false }), 'hidden-kit': repo({ public: false }) };
const packs = [
  { id: 'billing', name: '收費', solves: '讓人付錢。', kits: [{ name: 'wall-kit', role: '牆' }, { name: 'pay-kit', role: '付款' }], steps: ['a'] },
  { id: 'upload', name: '上傳', solves: '傳大檔。', kits: [{ name: 'up-kit', role: '傳' }], steps: [] },
];
const model = buildModel({ registry, packs, repos, asOf: '2026-11-14' });
const index = buildSearchIndex(model, copy);
const titles = (q) => rank(index, q).map((r) => r.t);

test('the search index lists ready packs and public kits with site-relative links', () => {
  assert.deepStrictEqual(index.map((r) => r.u), [
    'packs/billing/index.html',
    'kits/pay-kit/index.html',
    'kits/wall-kit/index.html',
    'kits/up-kit/index.html',
  ]);
});

test('the search index never carries a private kit', () => {
  assert.ok(!JSON.stringify(index).includes('hidden-kit'));
  assert.ok(!JSON.stringify(index).includes('機密'));
});

test('rank finds a kit by a registry keyword that is not in its name or description', () => {
  assert.deepStrictEqual(titles('newebpay'), ['收費', 'pay-kit']);
  assert.deepStrictEqual(titles('金流'), ['收費', 'pay-kit'], 'a pack is found by what its members cover');
  assert.deepStrictEqual(titles('UPLOAD'), ['up-kit']);
});

test('rank finds a pack by its Chinese name and puts a title match first', () => {
  assert.strictEqual(titles('收費')[0], '收費');
  assert.strictEqual(titles('wall')[0], 'wall-kit');
});

test('rank finds the members of a pack when the pack name is typed', () => {
  assert.deepStrictEqual(titles('收費').sort(), ['pay-kit', 'wall-kit', '收費'].sort());
});

test('rank needs every word to match and returns nothing for a blank query', () => {
  assert.deepStrictEqual(titles('付款 藍新'), ['pay-kit']);
  assert.deepStrictEqual(titles('付款 上傳'), []);
  assert.deepStrictEqual(titles('   '), []);
});

test('searchScript cannot be closed early by text in the index', () => {
  const js = searchScript([{ t: '</script><b>', d: '', u: 'x', k: '', x: '' }], '/* client */');
  assert.ok(!js.includes('</script>'));
  assert.ok(js.includes('/* client */'));
});
