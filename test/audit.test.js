const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const audit = require('../audit')

// 假的專案資料夾:一個裝套件、一個複製、一個沒用到、一個部署分身
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitaudit-'))
  const make = (name, files) => {
    const dir = path.join(root, name)
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
      fs.writeFileSync(path.join(dir, rel), content)
    }
  }
  make('uses-dep', {
    'package.json': JSON.stringify({ dependencies: { 'demo-kit': 'github:Owner/demo-kit' } }),
    'package-lock.json': JSON.stringify({ packages: { 'node_modules/demo-kit': { resolved: 'git+ssh://git@github.com/Owner/demo-kit.git#abc1234def' } } }),
    'public/app.js': "const TEXT = { proOnly: 'PRO' }\n"
  })
  make('uses-copy', { 'package.json': '{}', 'src/gate.js': '// copied from demo-kit v1\nmodule.exports = {}\n' })
  make('unrelated', { 'package.json': '{}', 'src/index.js': 'console.log(1)\n' })
  make('uses-dep.slotA', { 'package.json': JSON.stringify({ dependencies: { 'demo-kit': '1' } }) })
  return root
}

test('找出用到 kit 的專案:裝套件、程式複製都算;部署分身不算', () => {
  const root = fixture()
  const projects = audit.listAllProjects([root])
  assert.deepEqual(projects.map((p) => p.name).sort(), ['unrelated', 'uses-copy', 'uses-dep'])
  const byName = Object.fromEntries(projects.map((p) => [p.name, audit.howUsed(p, 'demo-kit', 'Owner')]))
  assert.deepEqual(byName, { 'uses-dep': ['dep'], 'uses-copy': ['embedded'], unrelated: [] })
  assert.equal(audit.pinnedCommit(path.join(root, 'uses-dep'), 'demo-kit'), 'abc1234def')
})

test('檢查項:符合 pattern 的地方回報檔案與行號;files 限定範圍外的不掃;skip 的資料夾不掃', () => {
  const root = fixture()
  const checks = [{ id: 'badge', rule: '不要 PRO 標籤', fix: '拿掉', pattern: '\\bproOnly\\b\\s*:', files: '^public/' }]
  const hits = audit.runChecks(path.join(root, 'uses-dep'), checks)
  assert.equal(hits.length, 1)
  assert.deepEqual(hits[0].hits, [{ file: 'public/app.js', line: 1, text: "const TEXT = { proOnly: 'PRO' }" }])
  assert.deepEqual(audit.runChecks(path.join(root, 'uses-dep'), checks, ['public']), [])
  assert.deepEqual(audit.runChecks(path.join(root, 'uses-copy'), checks), [])
})

test('報告:落後、複製版、違規都標出來;全部正常的打勾', () => {
  const report = audit.formatReport({
    kit: 'demo-kit',
    head: 'fff0000aaaa',
    checks: 1,
    rows: [
      { project: 'a', dir: path.join(__dirname, '..', '..', 'a'), how: ['dep'], pinned: 'abc1234', outdated: true, violations: [] },
      { project: 'b', dir: path.join(__dirname, '..', '..', 'b'), how: ['embedded'], pinned: null, outdated: false, violations: [] },
      { project: 'c', dir: path.join(__dirname, '..', '..', 'c'), how: ['dep'], pinned: 'fff0000', outdated: false, violations: [] }
    ]
  })
  assert.match(report, /⚠️ a .*版本落後\(鎖在 abc1234\)/)
  assert.match(report, /⚠️ b .*複製版/)
  assert.match(report, /✅ c /)
})
