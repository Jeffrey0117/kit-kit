const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { addPack } = require('../packs');

const OWNER = 'Jeffrey0117';
const PACK = {
  id: 'billing', name: '收費', solves: '收錢。',
  kits: [{ name: 'a-kit', role: '甲' }, { name: 'b-kit', role: '乙' }],
  steps: ['先做甲'],
};
const KITS = [{ name: 'a-kit' }, { name: 'b-kit' }];
const READY = { 'a-kit': { public: true, skill: true }, 'b-kit': { public: true, skill: true } };

function setup(t, { withPackageJson = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitkit-add-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (withPackageJson) fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  const runs = [];
  const base = {
    dir, owner: OWNER, kits: KITS, kitInfo: READY,
    fetchSkill: (name) => `# ${name} 打法`,
    run: (command, cwd) => runs.push({ command, cwd }),
  };
  return { dir, runs, base };
}

test('addPack writes the combined skill into the project and installs the members', (t) => {
  const { dir, runs, base } = setup(t);
  const out = addPack(PACK, base);
  const expected = path.join(dir, '.claude', 'skills', 'billing-pack', 'SKILL.md');
  assert.strictEqual(out.skillPath, expected);
  const written = fs.readFileSync(expected, 'utf8');
  assert.ok(written.includes('# a-kit 打法') && written.includes('# b-kit 打法'));
  assert.deepStrictEqual(runs, [{ command: 'npm i github:Jeffrey0117/a-kit github:Jeffrey0117/b-kit', cwd: dir }]);
  assert.strictEqual(out.installed, true);
});

test('addPack does not run npm in a folder without package.json', (t) => {
  const { runs, base } = setup(t, { withPackageJson: false });
  const out = addPack(PACK, base);
  assert.deepStrictEqual(runs, []);
  assert.strictEqual(out.installed, false);
  assert.strictEqual(out.command, 'npm i github:Jeffrey0117/a-kit github:Jeffrey0117/b-kit');
});

test('addPack with install:false writes the skill but leaves dependencies alone', (t) => {
  const { runs, base } = setup(t);
  const out = addPack(PACK, { ...base, install: false });
  assert.deepStrictEqual(runs, []);
  assert.strictEqual(out.installed, false);
  assert.ok(fs.existsSync(out.skillPath));
});

test('addPack honours a custom skills directory', (t) => {
  const { dir, base } = setup(t);
  const out = addPack(PACK, { ...base, skillsDir: path.join('.cursor', 'rules') });
  assert.strictEqual(out.skillPath, path.join(dir, '.cursor', 'rules', 'billing-pack', 'SKILL.md'));
});

test('addPack writes nothing when one member skill cannot be fetched', (t) => {
  const { dir, runs, base } = setup(t);
  const fetchSkill = (name) => (name === 'b-kit' ? null : '# ok');
  assert.throws(() => addPack(PACK, { ...base, fetchSkill }), /b-kit/);
  assert.strictEqual(fs.existsSync(path.join(dir, '.claude')), false);
  assert.deepStrictEqual(runs, []);
});

test('addPack refuses a pack that is not ready and touches nothing', (t) => {
  const { dir, runs, base } = setup(t);
  const kitInfo = { ...READY, 'b-kit': { public: true, skill: false } };
  assert.throws(() => addPack(PACK, { ...base, kitInfo }), /整理中.*b-kit/);
  assert.strictEqual(fs.existsSync(path.join(dir, '.claude')), false);
  assert.deepStrictEqual(runs, []);
});
