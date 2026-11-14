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

// 一個假的 kit「遠端」,依序五個 commit:程式 → 只有文件和 logo → 只 bump 版號 → 改程式 → 加一張程式會用到的圖
function kitRemote() {
  const { execFileSync } = require('node:child_process')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitremote-'))
  const remote = path.join(root, 'remote')
  fs.mkdirSync(remote)
  const git = (dir, ...args) =>
    execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  const commit = (files) => {
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(remote, rel)), { recursive: true })
      fs.writeFileSync(path.join(remote, rel), content)
    }
    git(remote, 'add', '-A')
    git(remote, 'commit', '-q', '-m', 'step')
    return git(remote, 'rev-parse', 'HEAD')
  }
  git(remote, 'init', '-q')
  const code = commit({ 'index.js': 'module.exports = 1\n', 'package.json': JSON.stringify({ name: 'demo-kit', version: '1.0.0' }) })
  // 在只有第一個 commit 的時候 clone 一份 —— 之後就是「沒更新過的本機 clone」
  const stale = path.join(root, 'stale')
  execFileSync('git', ['clone', '-q', remote, stale], { stdio: 'ignore' })
  const docs = commit({ 'README.md': '# demo\n', 'logo.svg': '<svg/>', 'docs/shot.png': 'x', '.repo': 'name: demo-kit\n' })
  const bump = commit({ 'package.json': JSON.stringify({ name: 'demo-kit', version: '1.0.1' }) })
  const changed = commit({ 'index.js': 'module.exports = 2\n' })
  const asset = commit({ 'icons/arrow.svg': '<svg/>' })
  const opts = { remote, cacheDir: path.join(root, 'cache'), clone: path.join(root, 'no-such-clone') }
  return { root, remote, stale, git, opts, sha: { code, docs, bump, changed, asset } }
}

test('落後判斷:只加文件和 logo、只 bump 版號都不算;改到程式才算 —— 本機沒有 clone 也判斷得出來', () => {
  const kit = kitRemote()
  const since = (pinned, head) => audit.codeChangedSince('demo-kit', pinned, { ...kit.opts, head })
  assert.equal(since(kit.sha.code, kit.sha.docs), false)
  assert.equal(since(kit.sha.code, kit.sha.bump), false)
  assert.equal(since(kit.sha.code.slice(0, 7), kit.sha.bump), false)
  assert.equal(since(kit.sha.code, kit.sha.changed), true)
  assert.equal(since(kit.sha.bump, kit.sha.changed), true)
  // 不在根目錄的圖可能是程式用的素材,算改動
  assert.equal(since(kit.sha.changed, kit.sha.asset), true)
})

test('落後判斷:本機 clone 太舊就改用自己的快取,不去動那份 clone;快取舊了會自己更新', () => {
  const kit = kitRemote()
  const opts = { ...kit.opts, clone: kit.stale }
  const before = kit.git(kit.stale, 'for-each-ref')
  assert.equal(audit.codeChangedSince('demo-kit', kit.sha.code, { ...opts, head: kit.sha.docs }), false)
  assert.equal(kit.git(kit.stale, 'for-each-ref'), before)
  // 遠端又多一個改程式的 commit:快取裡還沒有,要自己去抓
  fs.writeFileSync(path.join(kit.remote, 'index.js'), 'module.exports = 3\n')
  kit.git(kit.remote, 'commit', '-q', '-am', 'later')
  const later = kit.git(kit.remote, 'rev-parse', 'HEAD')
  assert.equal(audit.codeChangedSince('demo-kit', kit.sha.asset, { ...opts, head: later }), true)
  assert.equal(audit.codeChangedSince('demo-kit', later, { ...opts, head: later }), false)
})

test('落後判斷:查不到那個 commit 就保守地當作有改', () => {
  const kit = kitRemote()
  const unknown = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  assert.equal(audit.codeChangedSince('demo-kit', unknown, { ...kit.opts, head: kit.sha.docs }), true)
  assert.equal(audit.codeChangedSince('demo-kit', kit.sha.code, { ...kit.opts, head: kit.sha.docs, remote: path.join(kit.root, 'gone') , cacheDir: path.join(kit.root, 'cache2') }), true)
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
  // 位置是相對於這台機器放專案的資料夾，前面可能帶路徑（CI 上是 ../../work/…/a），只比對結尾的專案名
  assert.match(report, /⚠️ (?:\S*\/)?a {2}.*版本落後\(鎖在 abc1234\)/)
  assert.match(report, /⚠️ (?:\S*\/)?b {2}.*複製版/)
  assert.match(report, /✅ (?:\S*\/)?c {2}/)
})
