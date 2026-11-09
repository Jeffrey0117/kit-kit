const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const audit = require('../audit')

// 建一個假的 kit clone:兩個 commit,外加一個 origin/HEAD。
// codeBase() 認 KIT_CODE_DIR,所以 codeChangedSince 會來這裡找。
function kitClone() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitoutdated-'))
  const dir = path.join(root, 'demo-kit')
  fs.mkdirSync(dir)
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const commit = (msg) => {
    git('add', '-A')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', msg)
    return git('rev-parse', 'HEAD')
  }
  const write = (rel, content) => fs.writeFileSync(path.join(dir, rel), content)

  git('init', '-q')
  write('index.js', 'module.exports = 1\n')
  write('package.json', JSON.stringify({ name: 'demo-kit', version: '1.0.0', main: 'index.js' }, null, 2))
  const a = commit('初版')

  // 發一版:只動文件 + bump 版本號(這就是釘版本慣例每次發版的樣子)
  write('SKILL.md', '# 打法\n')
  write('package.json', JSON.stringify({ name: 'demo-kit', version: '1.0.1', main: 'index.js' }, null, 2))
  const b = commit('docs + bump')
  git('update-ref', 'refs/remotes/origin/HEAD', b)

  return { root, dir, git, commit, write, a, b }
}

test('只動文件並 bump package.json 版本號 → 不算程式落後', () => {
  const k = kitClone()
  const prev = process.env.KIT_CODE_DIR
  process.env.KIT_CODE_DIR = k.root
  try {
    assert.equal(audit.codeChangedSince('demo-kit', k.a), false)
  } finally {
    if (prev === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prev
  }
})

test('package.json 動到版本號以外的欄位(例如新增依賴) → 算落後', () => {
  const k = kitClone()
  k.write('package.json', JSON.stringify({ name: 'demo-kit', version: '1.0.2', main: 'index.js', dependencies: { jose: '^5' } }, null, 2))
  const c = k.commit('加依賴')
  k.git('update-ref', 'refs/remotes/origin/HEAD', c)

  const prev = process.env.KIT_CODE_DIR
  process.env.KIT_CODE_DIR = k.root
  try {
    assert.equal(audit.codeChangedSince('demo-kit', k.a), true)
  } finally {
    if (prev === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prev
  }
})

test('真的改到程式 → 算落後', () => {
  const k = kitClone()
  k.write('index.js', 'module.exports = 2\n')
  const c = k.commit('改行為')
  k.git('update-ref', 'refs/remotes/origin/HEAD', c)

  const prev = process.env.KIT_CODE_DIR
  process.env.KIT_CODE_DIR = k.root
  try {
    assert.equal(audit.codeChangedSince('demo-kit', k.a), true)
  } finally {
    if (prev === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prev
  }
})

test('查不到那個 commit 時保守地當作有改', () => {
  const k = kitClone()
  const prev = process.env.KIT_CODE_DIR
  process.env.KIT_CODE_DIR = k.root
  try {
    assert.equal(audit.codeChangedSince('demo-kit', '0000000000000000000000000000000000000000'), true)
  } finally {
    if (prev === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prev
  }
})
