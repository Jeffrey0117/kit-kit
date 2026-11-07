// kit-kit audit — kit 更新之後,自動找出用到它的專案,檢查有沒有過時或違反 kit 的規則。
//
// 規則放在每個 kit 自己的 repo:kit-checks.json(跟 SKILL.md 一起演化),格式:
//   { "checks": [ { "id", "rule", "fix", "pattern", "files", "severity" } ] }
//   pattern = 找到就算違反的正規表示式;files = 只掃路徑符合這個正規表示式的檔案
//
// 只讀不改:不切分支、不動任何專案的檔案,不呼叫任何付費服務。
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', 'out', 'vendor', '.svelte-kit', 'cache', 'data'])
const SOURCE_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|vue|svelte|html)$/
// 部署用的分身資料夾(slot 切換、影子建置、封存)不算獨立的專案
const SHADOW_DIR = /\.(slot[A-Z]|shadow|husk|bak)|-bak\b|husk-bak|--bot\d+$/i
const MAX_FILES = 4000
const MAX_DEPTH = 7

function defaultRoots() {
  const code = path.resolve(__dirname, '..')
  return [code, path.join(code, 'workhub'), path.join(code, 'cloudpipe', 'projects')]
}

// 全部專案(有 package.json 的資料夾),同一個實體目錄只算一次
function listAllProjects(roots = defaultRoots(), kitNames = []) {
  const kitSet = new Set(kitNames.map((n) => n.toLowerCase()))
  const seen = new Set()
  const out = []
  for (const root of roots) {
    let names
    try {
      names = fs.readdirSync(root)
    } catch {
      continue
    }
    for (const name of names) {
      if (SHADOW_DIR.test(name) || kitSet.has(name.toLowerCase()) || name === 'kit-kit') continue
      const dir = path.join(root, name)
      let real
      try {
        if (!fs.statSync(dir).isDirectory() || !fs.existsSync(path.join(dir, 'package.json'))) continue
        // native 才會把 Windows 的目錄連結(junction)解到真身,同一個專案不會算好幾次
        real = fs.realpathSync.native(dir).toLowerCase()
      } catch {
        continue
      }
      if (seen.has(real)) continue
      seen.add(real)
      out.push({ name, dir })
    }
  }
  return out
}

function walkSources(dir, onFile) {
  let count = 0
  function walk(d, depth) {
    if (depth > MAX_DEPTH || count >= MAX_FILES) return
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (count >= MAX_FILES) return
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(full, depth + 1)
      } else if (SOURCE_EXT.test(e.name)) {
        count += 1
        onFile(full)
      }
    }
  }
  walk(dir, 0)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// 裝套件時鎖在哪個 commit(package-lock 的 resolved 尾巴 #sha)
function pinnedCommit(dir, kitName) {
  const lock = readJson(path.join(dir, 'package-lock.json'))
  const entry = lock && lock.packages && lock.packages[`node_modules/${kitName}`]
  const m = entry && /#([0-9a-f]{7,40})$/.exec(entry.resolved || '')
  if (m) return m[1]
  try {
    const pnpm = fs.readFileSync(path.join(dir, 'pnpm-lock.yaml'), 'utf8')
    const p = new RegExp(`${kitName}[^\\n]*?(?:#|/tar/|commit/)([0-9a-f]{7,40})`).exec(pnpm)
    if (p) return p[1]
  } catch {
    /* 沒有 pnpm lock */
  }
  return null
}

// 這個專案怎麼用到這個 kit:裝套件 / 檔頭註明是從 kit 複製來的 / 整包 kit 資料夾放在專案裡
function howUsed(project, kitName, owner) {
  const how = []
  const pkg = readJson(path.join(project.dir, 'package.json')) || {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
  const depValue = deps[kitName]
  if (depValue || Object.values(deps).some((v) => String(v).includes(`${owner}/${kitName}`))) how.push('dep')
  const vendored = path.join(project.dir, kitName, 'package.json')
  if ((readJson(vendored) || {}).name === kitName) how.push('vendored')
  if (!how.length) {
    const marker = new RegExp(`(?://|\\*|#|<!--).{0,80}\\b${kitName.replace(/-/g, '\\-')}\\b`)
    let found = false
    walkSources(project.dir, (file) => {
      if (found) return
      try {
        if (marker.test(fs.readFileSync(file, 'utf8').slice(0, 600))) found = true
      } catch {
        /* 讀不到就略過 */
      }
    })
    if (found) how.push('embedded')
  }
  return how
}

function kitHead(kitName, owner) {
  try {
    const out = execFileSync('git', ['ls-remote', `https://github.com/${owner}/${kitName}.git`, 'HEAD'], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true
    })
    return (out.split(/\s/)[0] || '').trim() || null
  } catch {
    return null
  }
}

// 規則清單:優先讀本機的 kit clone(剛改完還沒推也看得到),沒有再抓 GitHub
async function loadChecks(kitName, owner) {
  const local = readJson(path.join(path.resolve(__dirname, '..'), kitName, 'kit-checks.json'))
  if (local) return local.checks || []
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${kitName}/HEAD/kit-checks.json`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    return ((await res.json()).checks || [])
  } catch {
    return []
  }
}

// skip = 不檢查的子資料夾(例如整包複製進來的 kit 本身,那是 kit 的範本不是專案的畫面)
function runChecks(dir, checks, skip = []) {
  const compiled = checks.map((c) => ({ ...c, re: new RegExp(c.pattern), only: c.files ? new RegExp(c.files) : null, hits: [] }))
  if (!compiled.length) return []
  walkSources(dir, (file) => {
    const rel = path.relative(dir, file).split(path.sep).join('/')
    if (skip.some((prefix) => rel.startsWith(prefix + '/'))) return
    const targets = compiled.filter((c) => !c.only || c.only.test(rel))
    if (!targets.length) return
    let lines
    try {
      lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    } catch {
      return
    }
    for (const c of targets) {
      lines.forEach((line, i) => {
        if (c.hits.length < 5 && c.re.test(line)) c.hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) })
      })
    }
  })
  return compiled
    .filter((c) => c.hits.length)
    .map(({ id, rule, fix, severity, hits }) => ({ id, rule, fix, severity: severity || 'warn', hits }))
}

async function auditKit(kitName, { owner = 'Jeffrey0117', roots, kitNames = [] } = {}) {
  const head = kitHead(kitName, owner)
  const checks = await loadChecks(kitName, owner)
  const rows = []
  for (const project of listAllProjects(roots, kitNames)) {
    const how = howUsed(project, kitName, owner)
    if (!how.length) continue
    const pinned = how.includes('dep') ? pinnedCommit(project.dir, kitName) : null
    const outdated = Boolean(head && pinned && !head.startsWith(pinned) && !pinned.startsWith(head.slice(0, pinned.length)))
    rows.push({ project: project.name, dir: project.dir, how, pinned, outdated, violations: runChecks(project.dir, checks, [kitName]) })
  }
  return { kit: kitName, head, checks: checks.length, rows }
}

function formatReport(result) {
  const lines = [`🧰 ${result.kit}  最新 ${result.head ? result.head.slice(0, 7) : '?'}  ·  檢查項 ${result.checks} 條  ·  用到的專案 ${result.rows.length} 個`]
  const label = { dep: '裝套件', vendored: '整包複製', embedded: '程式複製' }
  for (const row of result.rows) {
    const flags = []
    if (row.outdated) flags.push(`版本落後(鎖在 ${row.pinned.slice(0, 7)})`)
    if (row.how.includes('vendored') || row.how.includes('embedded')) flags.push('複製版,kit 更新不會自動帶到')
    if (row.violations.length) flags.push(`違反 ${row.violations.length} 條規則`)
    // 同名專案可能有好幾份實體拷貝(code\、workhub\、cloudpipe\projects\),印出位置才分得清
    const where = path.relative(path.resolve(__dirname, '..'), row.dir).split(path.sep).join('/')
    lines.push('', `${flags.length ? '⚠️' : '✅'} ${where}  (${row.how.map((h) => label[h] || h).join('+')})${flags.length ? '  ' + flags.join(' / ') : ''}`)
    for (const v of row.violations) {
      lines.push(`   • ${v.rule}`)
      for (const h of v.hits.slice(0, 2)) lines.push(`     ${h.file}:${h.line}  ${h.text}`)
      if (v.fix) lines.push(`     → ${v.fix}`)
    }
  }
  return lines.join('\n')
}

function needsAttention(result) {
  return result.rows.some((r) => r.outdated || r.violations.length || !r.how.includes('dep'))
}

module.exports = { defaultRoots, listAllProjects, howUsed, pinnedCommit, kitHead, loadChecks, runChecks, auditKit, formatReport, needsAttention }
