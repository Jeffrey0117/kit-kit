const test = require('node:test');
const assert = require('node:assert');
const packsLib = require('../packs');
const registry = require('../registry.json');

const OWNER = 'Jeffrey0117';
const pack = (over = {}) => ({
  id: 'billing', name: '收費', solves: '收錢。',
  kits: [{ name: 'a-kit', role: '甲' }, { name: 'b-kit', role: '乙' }],
  steps: ['先做甲', '再做乙'],
  ...over,
});
const info = (over = {}) => ({
  'a-kit': { public: true, skill: true },
  'b-kit': { public: true, skill: true },
  ...over,
});

test('findPack matches id or Chinese name, case-insensitive', () => {
  const packs = [pack(), pack({ id: 'auth', name: '會員與防護' })];
  assert.strictEqual(packsLib.findPack(packs, 'billing').id, 'billing');
  assert.strictEqual(packsLib.findPack(packs, '收費').id, 'billing');
  assert.strictEqual(packsLib.findPack(packs, 'BILLING').id, 'billing');
  assert.strictEqual(packsLib.findPack(packs, 'nope'), null);
});

test('packStatus is ready when every member is public and has a skill', () => {
  assert.deepStrictEqual(packsLib.packStatus(pack(), info()), { ready: true, missing: [] });
});

test('packStatus reports why a member blocks the pack', () => {
  const reason = (i) => packsLib.packStatus(pack(), i).missing;
  assert.deepStrictEqual(reason(info({ 'b-kit': { public: true, skill: false } })), [{ name: 'b-kit', reason: 'no-skill' }]);
  assert.deepStrictEqual(reason(info({ 'b-kit': { public: false, skill: true } })), [{ name: 'b-kit', reason: 'private' }]);
  assert.deepStrictEqual(reason({ 'a-kit': { public: true, skill: true } }), [{ name: 'b-kit', reason: 'unknown' }]);
  assert.strictEqual(packsLib.packStatus(pack(), {}).ready, false);
});

test('registryKitInfo reads public and skill flags from the registry', () => {
  const got = packsLib.registryKitInfo({ kits: [{ name: 'x', skill: true }, { name: 'y', private: true }] });
  assert.deepStrictEqual(got, { x: { public: true, skill: true }, y: { public: false, skill: false } });
});

test('installCommand lists installable members in pack order', () => {
  const kits = [{ name: 'b-kit', type: 'component' }, { name: 'a-kit' }];
  assert.strictEqual(packsLib.installCommand(pack(), kits, OWNER), 'npm i github:Jeffrey0117/a-kit github:Jeffrey0117/b-kit');
});

test('installCommand is null when no member is an npm dependency', () => {
  const kits = [{ name: 'a-kit', type: 'service' }, { name: 'b-kit', type: 'template' }];
  assert.strictEqual(packsLib.installCommand(pack(), kits, OWNER), null);
});

test('composePackSkill writes a header, the steps, and each member body without its frontmatter', () => {
  const md = packsLib.composePackSkill(pack(), {
    'a-kit': '---\nname: a-kit\ndescription: 甲的觸發語\n---\n\n# a-kit 打法\n\n甲的正文',
    'b-kit': '# b-kit 打法\n\n乙的正文',
  }, OWNER);
  assert.ok(md.startsWith('---\nname: billing-pack\n'));
  assert.ok(md.includes('1. 先做甲'));
  assert.ok(md.includes('2. 再做乙'));
  assert.ok(md.includes('甲的正文'));
  assert.ok(md.includes('乙的正文'));
  assert.ok(!md.includes('甲的觸發語'));
  assert.strictEqual(md.match(/^name: /gm).length, 1);
});

test('composePackSkill refuses to write a pack with a missing member skill', () => {
  assert.throws(() => packsLib.composePackSkill(pack(), { 'a-kit': '# a' }, OWNER), /b-kit/);
});

test('aiPrompt names the pack, the add command, the skill file and every step', () => {
  const p = packsLib.aiPrompt(pack(), OWNER);
  assert.ok(p.includes('收費'));
  assert.ok(p.includes('npx github:Jeffrey0117/kit-kit add billing'));
  assert.ok(p.includes('.claude/skills/billing-pack/SKILL.md'));
  assert.ok(p.includes('先做甲') && p.includes('再做乙'));
});

test('packs.json has the six packs in home-page order and only registered members', () => {
  const packs = packsLib.loadPacks();
  assert.deepStrictEqual(packs.map((p) => p.id), ['billing', 'auth', 'video', 'growth', 'upload', 'electron']);
  const known = new Set(registry.kits.map((k) => k.name));
  for (const p of packs) for (const m of p.kits) assert.ok(known.has(m.name), `${p.id}: ${m.name} is not in the registry`);
});

test('no pack lists a kit the registry marks private', () => {
  const kitInfo = packsLib.registryKitInfo(registry);
  for (const p of packsLib.loadPacks()) {
    for (const m of p.kits) assert.strictEqual(kitInfo[m.name].public, true, `${p.id}: ${m.name} is private`);
  }
});
