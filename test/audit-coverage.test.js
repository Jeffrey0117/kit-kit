const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const audit = require('../audit')

// registry 裡有些條目其實是「產品」而不是可複用的 kit(Pokkit / PayGate / LaunchKit)。
// 這些產品同時也是別的 kit 的真實消費端。
//
// 原本的接線是:cli 把整個 registry 的名稱當排除名單傳進 listAllProjects,
// 於是這些產品對每一次稽核都是隱形的 —— 不是報錯,是整個不出現在報告裡。
// 比假警報危險得多:永遠不會被檢查,也不會有人發現它沒被檢查。
// (真實案例:jwks-verify-kit 的 12 個消費端報告裡沒有 pokkit,而 pokkit 確實
//  釘著這個 kit 並且在 src/auth.ts 用它驗 token。)
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kitcoverage-'))
  const make = (name, pkg, extra = {}) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg))
    for (const [rel, content] of Object.entries(extra)) fs.writeFileSync(path.join(dir, rel), content)
  }
  // 名字跟 registry 條目撞號,但它是 demo-kit 的消費端
  make('pokkit', { name: 'pokkit', dependencies: { 'demo-kit': 'github:Owner/demo-kit#v1.0.0' } })
  // 被稽核的那個 kit 自己的 repo —— 只有這個該跳過
  make('demo-kit', { name: 'demo-kit', version: '1.0.0' }, { 'kit-checks.json': JSON.stringify({ checks: [] }) })
  make('kit-kit', { name: 'kit-kit' })
  make('plain-app', { name: 'plain-app', dependencies: { 'demo-kit': 'github:Owner/demo-kit#v1.0.0' } })
  return root
}

async function auditIn(root, kitNames) {
  const prevDir = process.env.KIT_CODE_DIR
  const prevPrompt = process.env.GIT_TERMINAL_PROMPT
  // KIT_CODE_DIR 讓 loadChecks 讀到本機的 kit-checks.json(不打網路);
  // GIT_TERMINAL_PROMPT=0 讓 kitHead 的 ls-remote 直接失敗回 null,不會卡在問密碼。
  process.env.KIT_CODE_DIR = root
  process.env.GIT_TERMINAL_PROMPT = '0'
  try {
    return await audit.auditKit('demo-kit', { owner: 'Owner', roots: [root], kitNames })
  } finally {
    if (prevDir === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prevDir
    if (prevPrompt === undefined) delete process.env.GIT_TERMINAL_PROMPT
    else process.env.GIT_TERMINAL_PROMPT = prevPrompt
  }
}

test('名字跟 registry 條目撞號的產品,還是要進稽核報告', async () => {
  const root = fixture()
  const result = await auditIn(root, ['demo-kit', 'Pokkit', 'PayGate', 'LaunchKit'])
  const names = result.rows.map((r) => r.project).sort()
  assert.deepEqual(names, ['plain-app', 'pokkit'])
})

test('被稽核的 kit 自己的 repo 與 kit-kit 不算消費端', async () => {
  const root = fixture()
  const result = await auditIn(root, ['demo-kit'])
  const names = result.rows.map((r) => r.project)
  assert.ok(!names.includes('demo-kit'), 'kit 自己的 repo 不該被當成消費端')
  assert.ok(!names.includes('kit-kit'), 'kit-kit 不該被當成消費端')
})
