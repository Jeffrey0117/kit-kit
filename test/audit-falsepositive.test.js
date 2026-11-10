const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const audit = require('../audit')

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kitfp-'))
}
function write(dir, rel, content) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), content)
}

async function auditIn(roots, kitRoot) {
  const prevDir = process.env.KIT_CODE_DIR
  const prevPrompt = process.env.GIT_TERMINAL_PROMPT
  process.env.KIT_CODE_DIR = kitRoot
  process.env.GIT_TERMINAL_PROMPT = '0'
  try {
    return await audit.auditKit('demo-kit', { owner: 'Owner', roots })
  } finally {
    if (prevDir === undefined) delete process.env.KIT_CODE_DIR
    else process.env.KIT_CODE_DIR = prevDir
    if (prevPrompt === undefined) delete process.env.GIT_TERMINAL_PROMPT
    else process.env.GIT_TERMINAL_PROMPT = prevPrompt
  }
}

// ── 1. 子目錄本身就是獨立受稽核的專案時,它的碼不該算到母專案頭上 ──────────
// cloudpipe 底下的 projects/ 放著其他專案(plottr 的真身就在那裡,不是連結)。
// 稽核把 projects/plottr 的檔案算成 cloudpipe 的 → 同一份碼被算兩次,
// cloudpipe 被誤報成「chunked-upload-kit 的程式複製版」,而唯一證據是
// plottr 的檔案,plottr 自己那一列又是 ✅。
// 這也是為什麼 jwks-verify-kit 的每條規則都得寫 ^(?!projects/) 來繞開。
//
// 注意:monorepo 的子套件不適用這條 —— 那種沒有被單獨列成專案,算進母專案才對。
test('子目錄是獨立受稽核的專案時,不要把它的碼算給母專案', async () => {
  const root = tmp()
  const host = path.join(root, 'host')
  write(host, 'package.json', '{"name":"host"}')
  write(host, 'src/own.js', 'module.exports = 2\n')
  // 真目錄,而且它自己也會被列成專案(第二個 root)
  write(path.join(host, 'projects/nested'), 'package.json', '{"name":"nested"}')
  write(path.join(host, 'projects/nested'), 'src/uses.js', '// copied from demo-kit v1.2.0\nmodule.exports = 1\n')
  // 讓 loadChecks 讀本機、不打網路
  write(path.join(root, 'demo-kit'), 'package.json', '{"name":"demo-kit","version":"1.0.0"}')
  write(path.join(root, 'demo-kit'), 'kit-checks.json', JSON.stringify({ checks: [{ id: 'x', rule: 'r', fix: 'f', pattern: 'copied from demo-kit' }] }))

  const result = await auditIn([root, path.join(host, 'projects')], root)
  const byName = Object.fromEntries(result.rows.map((r) => [r.project, r]))

  assert.ok(!byName.host, 'host 不該因為子專案的碼而出現在報告裡')
  assert.ok(byName.nested, '子專案自己還是要被稽核')
  assert.deepEqual(byName.nested.how, ['embedded'])
})

test('monorepo 的子套件(沒被單獨列成專案)還是算母專案的碼', async () => {
  const root = tmp()
  const mono = path.join(root, 'mono')
  write(mono, 'package.json', '{"name":"mono"}')
  write(path.join(mono, 'packages/web'), 'package.json', '{"name":"web"}')
  write(path.join(mono, 'packages/web'), 'src/uses.js', '// copied from demo-kit v1.2.0\nmodule.exports = 1\n')
  write(path.join(root, 'demo-kit'), 'package.json', '{"name":"demo-kit","version":"1.0.0"}')
  write(path.join(root, 'demo-kit'), 'kit-checks.json', JSON.stringify({ checks: [] }))

  const result = await auditIn([root], root)
  const mono_ = result.rows.find((r) => r.project === 'mono')
  assert.ok(mono_, 'monorepo 母專案要出現')
  assert.deepEqual(mono_.how, ['embedded'], '子套件的複製版要算給 monorepo 母專案')
})

// ── 2. 「別用我、改用 X」的指路註解不是複製 ──────────────────────────────
// auth-kit 的檔頭特地寫「不要拿它去驗別人家 IdP,那個情境請用 jwks-verify-kit」,
// 結果被判成 jwks-verify-kit 的程式複製版,還連帶命中 HS256 那條規則。
// 以下是真實檔頭節錄(auth-kit/index.js,kit 名稱換成 demo-kit):
const POINTER_HEADER = `// ============================================================================
// auth-kit — 無函式庫的驗證原語（PBKDF2 密碼雜湊 + HMAC-SHA256 JWT）
// ----------------------------------------------------------------------------
// ⛔ 守備範圍：這個 kit 是給「**自己**發 session」用的 —— 你是簽發者也是驗證
//    者,secret 兩邊都是你。
//
//    **不要拿它去驗別人家 IdP（LetMeUse / Auth0 / Clerk…）發的 token。**
//    那個情境請用:
//        github:Owner/demo-kit   （ES256 + JWKS 公鑰,驗證方零 secret）
module.exports = 1
`

test('指路註解（別用我、改用 X）不算程式複製', () => {
  const dir = tmp()
  write(dir, 'package.json', '{"name":"auth-kit"}')
  write(dir, 'index.js', POINTER_HEADER)
  assert.deepEqual(audit.howUsed({ name: 'auth-kit', dir }, 'demo-kit', 'Owner'), [])
})

test('真的是複製來的（檔頭寫 copied from / 複製自 / 版本號）還是要抓到', () => {
  for (const header of [
    '// copied from demo-kit v1.2.0\n',
    '// 複製自 demo-kit,改了錯誤訊息\n',
    '/* vendored: demo-kit */\n',
    '// demo-kit v0.3.1\n'
  ]) {
    const dir = tmp()
    write(dir, 'package.json', '{"name":"someapp"}')
    write(dir, 'src/gate.js', header + 'module.exports = 1\n')
    assert.deepEqual(
      audit.howUsed({ name: 'someapp', dir }, 'demo-kit', 'Owner'),
      ['embedded'],
      '這個檔頭應該被當成複製版: ' + header.trim()
    )
  }
})
