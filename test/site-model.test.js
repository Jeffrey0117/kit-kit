const test = require('node:test');
const assert = require('node:assert');
const { buildModel } = require('../site/model');

const registry = {
  owner: 'Jeffrey0117',
  kits: [
    { name: 'a-kit', covers: '甲功能', repo: 'https://github.com/Jeffrey0117/a-kit', install: 'npm i github:Jeffrey0117/a-kit' },
    { name: 'B-Kit', type: 'component', covers: '乙元件', repo: 'https://github.com/Jeffrey0117/B-Kit', install: 'npm i github:Jeffrey0117/B-Kit' },
    { name: 'secret-kit', covers: '不公開的東西', repo: 'https://github.com/Jeffrey0117/secret-kit', install: 'x' },
    { name: 'gone-kit', covers: '抓不到的東西', repo: 'https://github.com/Jeffrey0117/gone-kit', install: 'x' },
    { name: 'svc', type: 'service', covers: '一個服務', repo: 'https://github.com/Jeffrey0117/svc', install: 'x' },
  ],
};
const repo = (over = {}) => ({ public: true, branch: 'master', readme: '# r', hasSkill: true, logo: null, ...over });
const repos = {
  'a-kit': repo({ logo: '<svg/>' }),
  'B-Kit': repo({ branch: 'main' }),
  'secret-kit': repo({ public: false, readme: '機密內容' }),
  svc: repo({ hasSkill: false }),
};
const packs = [
  { id: 'one', name: '一號', solves: '做一號。', kits: [{ name: 'a-kit', role: '甲' }, { name: 'B-Kit', role: '乙' }], steps: ['步驟'] },
  { id: 'two', name: '二號', solves: '做二號。', kits: [{ name: 'a-kit', role: '甲' }, { name: 'svc', role: '服務' }], steps: [] },
  { id: 'three', name: '三號', solves: '做三號。', kits: [{ name: 'a-kit', role: '甲' }, { name: 'secret-kit', role: '密' }], steps: [] },
];
const model = () => buildModel({ registry, packs, repos, asOf: '2026-11-14' });

test('only public, fetched repos become kits', () => {
  assert.deepStrictEqual(model().kits.map((k) => k.name), ['a-kit', 'B-Kit', 'svc']);
});

test('nothing about a private or unfetched kit reaches the model', () => {
  const json = JSON.stringify(model());
  for (const leak of ['secret-kit', '不公開的東西', '機密內容', 'gone-kit', '抓不到的東西']) {
    assert.ok(!json.includes(leak), `model leaks ${leak}`);
  }
});

test('kits carry what the pages need', () => {
  const [a, b] = model().kits;
  assert.strictEqual(a.slug, 'a-kit');
  assert.strictEqual(b.slug, 'b-kit');
  assert.strictEqual(a.type, 'kit');
  assert.strictEqual(b.type, 'component');
  assert.strictEqual(b.branch, 'main');
  assert.strictEqual(a.hasSkill, true);
  assert.strictEqual(a.logo, '<svg/>');
  assert.deepStrictEqual(a.packs, ['one', 'two', 'three']);
  assert.deepStrictEqual(b.packs, ['one']);
});

test('a pack is ready only when every member is public and has a skill', () => {
  const [one, two, three] = model().packs;
  assert.strictEqual(one.ready, true);
  assert.deepStrictEqual(one.missing, []);
  assert.strictEqual(two.ready, false);
  assert.deepStrictEqual(two.missing, [{ name: 'svc', reason: 'no-skill' }]);
  assert.strictEqual(three.ready, false);
});

test('a pack with a hidden member shows a count, never the name', () => {
  const three = model().packs[2];
  assert.deepStrictEqual(three.members.map((m) => m.name), ['a-kit']);
  assert.strictEqual(three.hidden, 1);
  assert.deepStrictEqual(three.missing, []);
});

test('ready packs carry the install command and the AI prompt', () => {
  const one = model().packs[0];
  assert.strictEqual(one.addCommand, 'npx github:Jeffrey0117/kit-kit add one');
  assert.ok(one.prompt.includes('npx github:Jeffrey0117/kit-kit add one'));
  assert.deepStrictEqual(one.members.map((m) => [m.name, m.role]), [['a-kit', '甲'], ['B-Kit', '乙']]);
});

test('stats count what is on the site', () => {
  assert.deepStrictEqual(model().stats, { kits: 3, readyPacks: 1, withSkill: 2 });
  assert.strictEqual(model().asOf, '2026-11-14');
});

test('a kit the registry marks private is left out even if GitHub reports it public', () => {
  const reg = { ...registry, kits: registry.kits.map((k) => (k.name === 'a-kit' ? { ...k, private: true } : k)) };
  const m = buildModel({ registry: reg, packs, repos, asOf: '2026-11-14' });
  assert.ok(!m.kits.some((k) => k.name === 'a-kit'));
});
