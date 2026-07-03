// ============================================================================
// kit-kit — 抽 kit 的 kit（別的專案跑它，維護你的 kit 生態系）
// ----------------------------------------------------------------------------
// 遞迴的一環：把「抽 kit 這件事」做成工具。核心規則——
//   找到一塊可複用的東西 → 查現有 kit：
//     有涵蓋的 kit → 去強化/補充/整合它（別重造）
//     沒有          → 抽一個新 kit（用統一 scaffold）
//
// 零依賴（node 內建 + 選用的 git/gh 外部指令）。既是 lib 也是 CLI（見 cli.js）。
// ============================================================================
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// ── 讀取 kit 登錄表（現有有哪些 kit）──
function loadRegistry(registryPath) {
  const p = registryPath || path.join(__dirname, 'registry.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── 用 gh 從 GitHub 即時撈（best-effort，撈不到就回 null，退回 registry.json）──
function syncFromGitHub(owner) {
  try {
    const out = cp.execSync(`gh repo list ${owner} --limit 200 --json name,description,url`, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const repos = JSON.parse(out);
    // 慣例：名字含 "kit" 或 "gate" 視為 kit（可自行擴充）
    return repos.filter((r) => /(-kit$|kit$|gate$)/i.test(r.name));
  } catch (e) { return null; }
}

// ── 核心：查一段描述/關鍵字跟現有 kit 的重疊度 ──
// 回 [{ kit, score, why }]，分數高=已有 kit 涵蓋（去強化），全低=該抽新的。
function checkOverlap(query, kits) {
  const q = String(query).toLowerCase();
  const terms = q.split(/[\s,、，/]+/).filter(Boolean);
  return kits.map((k) => {
    const hay = (k.name + ' ' + k.covers + ' ' + (k.keywords || []).join(' ')).toLowerCase();
    let score = 0;
    const hits = [];
    for (const kw of (k.keywords || [])) {
      if (q.includes(String(kw).toLowerCase())) { score += 2; hits.push(kw); }
    }
    for (const t of terms) {
      if (t.length >= 2 && hay.includes(t)) { score += 1; if (!hits.includes(t)) hits.push(t); }
    }
    return { kit: k, score, why: hits };
  }).sort((a, b) => b.score - a.score);
}

// ── 建議：強化現有 or 抽新 ──
function recommend(query, kits, threshold = 2) {
  const ranked = checkOverlap(query, kits);
  const top = ranked[0];
  if (top && top.score >= threshold) {
    return { action: 'reuse', kit: top.kit, score: top.score, why: top.why, ranked };
  }
  return { action: 'extract', kit: null, score: top ? top.score : 0, ranked };
}

// ── scaffold：產一個標準 kit 骨架 ──
function scaffold(name, targetDir, meta = {}) {
  const dir = targetDir || path.join(process.cwd(), name);
  fs.mkdirSync(dir, { recursive: true });
  const desc = meta.description || `<一句話說明 ${name} 幹嘛的>`;
  const files = {
    'index.js': tplIndex(name, desc),
    'example.js': tplExample(name),
    'README.md': tplReadme(name, desc),
    'package.json': tplPackage(name, desc, meta.author || 'Jeffrey0117'),
    'LICENSE': tplLicense(meta.author || 'Jeffrey0117'),
    '.gitignore': 'node_modules/\n*.log\n',
  };
  const written = [];
  for (const [f, content] of Object.entries(files)) {
    const fp = path.join(dir, f);
    if (fs.existsSync(fp) && !meta.force) continue; // 不覆蓋既有
    fs.writeFileSync(fp, content);
    written.push(f);
  }
  return { dir, written };
}

// ── 選用：git init + gh 建 public repo + push ──
function publish(dir, name, description, owner = 'Jeffrey0117') {
  const run = (c) => cp.execSync(c, { cwd: dir, encoding: 'utf8' });
  run('git init -q');
  run('git add -A');
  run(`git commit -q -m "feat: ${name} v0.1"`);
  const desc = (description || '').replace(/"/g, "'");
  return run(`gh repo create ${owner}/${name} --public --source=. --remote=origin --push --description "${desc}"`);
}

// ── 補/更新現有 kit：clone（或 pull）下來讓 agent 補強/修/加功能 → 改完 commit + push 回去 ──
// 這就是「神遞迴」的閉環：不只抽新的，還能持續升級舊的，全體專案跟著變強。
function pullKit(name, targetDir, owner = 'Jeffrey0117') {
  const dir = targetDir || path.join(process.cwd(), name);
  if (fs.existsSync(path.join(dir, '.git'))) {
    cp.execSync('git pull -q', { cwd: dir, stdio: 'inherit' });
  } else {
    cp.execSync(`gh repo clone ${owner}/${name} "${dir}"`, { stdio: 'inherit' });
  }
  return dir;
}

// ── 把新 kit 加進 registry ──
function addToRegistry(registryPath, entry) {
  const p = registryPath || path.join(__dirname, 'registry.json');
  const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!reg.kits.find((k) => k.name === entry.name)) reg.kits.push(entry);
  fs.writeFileSync(p, JSON.stringify(reg, null, 2) + '\n');
  return reg;
}

// ── templates ──
function tplIndex(name, desc) {
  return `// ============================================================================
// ${name} — ${desc}
// ----------------------------------------------------------------------------
// 零依賴（node 內建）。factory pattern。
// ============================================================================

module.exports = function create(opts = {}) {
  // TODO: 實作。把 app-specific 的東西用 opts 注入，只留通用核心。
  return {};
};
`;
}
function tplExample(name) {
  return `// 最小範例：node example.js
const create = require('./index');
const x = create({});
console.log('${name} ready:', x);
`;
}
function tplReadme(name, desc) {
  return `# ${name}

**${desc}** 零依賴、框架無關。

## 安裝

\`\`\`bash
npm i github:Jeffrey0117/${name}   # 或直接複製 index.js
\`\`\`

## 用法

\`\`\`js
const create = require('${name}');
const x = create({ /* opts */ });
\`\`\`

## API

TODO

## License

MIT © Jeffrey0117
`;
}
function tplPackage(name, desc, author) {
  return JSON.stringify({
    name, version: '0.1.0', description: desc, main: 'index.js',
    scripts: { example: 'node example.js' }, keywords: [], author, license: 'MIT',
  }, null, 2) + '\n';
}
function tplLicense(author) {
  return `MIT License

Copyright (c) 2026 ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

module.exports = {
  loadRegistry, syncFromGitHub, checkOverlap, recommend,
  scaffold, publish, addToRegistry, pullKit,
};
