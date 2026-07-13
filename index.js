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
    'SKILL.md': tplSkill(name, desc),
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

// ── kit ↔ skill 綁定：抓 kit repo 裡的 SKILL.md（打法/文案/模式）──
// kit 是能力（code），skill 是判斷（何時用、怎麼接、文案怎麼寫）。兩者同 repo 同版本演化。
function fetchSkill(name, owner = 'Jeffrey0117') {
  const get = (branch) => {
    try {
      return cp.execSync(
        `curl -fsSL https://raw.githubusercontent.com/${owner}/${name}/${branch}/SKILL.md`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
    } catch (e) { return null; }
  };
  return get('master') || get('main');
}

// ── 把新 kit 加進 registry ──
function addToRegistry(registryPath, entry) {
  const p = registryPath || path.join(__dirname, 'registry.json');
  const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!reg.kits.find((k) => k.name === entry.name)) reg.kits.push(entry);
  fs.writeFileSync(p, JSON.stringify(reg, null, 2) + '\n');
  return reg;
}

// ── map：掃專案，看哪個專案宣告採用了哪些 kit（application 層的採用地圖）──
function listProjectDirs(baseDir) {
  try {
    return fs.readdirSync(baseDir)
      .map((n) => path.join(baseDir, n))
      .filter((d) => { try { return fs.statSync(d).isDirectory() && fs.existsSync(path.join(d, 'package.json')); } catch (e) { return false; } });
  } catch (e) { return []; }
}
// 偵測「內嵌 copy」：多數專案是把 kit 的碼複製進來(檔頭留 kit 名的註解)，不走 npm dep。
// 掃專案源碼(深度<=2、限 600 檔)，找註解裡出現 kit 名 → 視為已內嵌採用。
function detectEmbedded(dir, kitNames) {
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', 'out', 'vendor']);
  const EXT = new Set(['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.vue', '.svelte']);
  const alt = kitNames.map((n) => n.replace(/[-]/g, '\\-')).join('|');
  const re = new RegExp('(?://|\\*|#).{0,80}\\b(' + alt + ')\\b');
  const found = new Set();
  let checked = 0;
  function walk(d, depth) {
    if (depth > 2 || checked > 600 || found.size === kitNames.length) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (checked > 600 || found.size === kitNames.length) return;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name), depth + 1); }
      else if (EXT.has(path.extname(e.name))) {
        checked++;
        let head; try { head = fs.readFileSync(path.join(d, e.name), 'utf8').slice(0, 500); } catch (er) { continue; }
        const rx = new RegExp(re, 'g'); let m;
        while ((m = rx.exec(head))) found.add(m[1]);
      }
    }
  }
  walk(dir, 0);
  return found;
}

function scanAdoption(projectDirs, kits, owner = 'Jeffrey0117') {
  const kitNames = kits.map((k) => k.name);
  const rows = [];
  for (const dir of projectDirs) {
    let deps = {};
    try { const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); deps = Object.assign({}, pkg.dependencies, pkg.devDependencies, pkg.peerDependencies); } catch (e) {}
    const blob = Object.entries(deps).map(([k, v]) => k + ' ' + v).join(' ');
    const self = path.basename(dir).toLowerCase();
    const dep = kits.filter((k) => (deps[k.name] || blob.includes(`${owner}/${k.name}`)) && k.name.toLowerCase() !== self).map((k) => k.name);
    const embedded = Array.from(detectEmbedded(dir, kitNames)).filter((n) => !dep.includes(n) && n.toLowerCase() !== self);
    rows.push({ project: path.basename(dir), dep, embedded, used: dep.concat(embedded) });
  }
  return rows;
}

// ── init：勾選 kit → 產一個已組好的專案骨架 ──
function camelCase(s) { return String(s).replace(/[-_](.)/g, (_, c) => c.toUpperCase()); }
function initProject(name, targetDir, selectedNames, allKits, owner = 'Jeffrey0117') {
  const dir = targetDir || path.join(process.cwd(), name);
  fs.mkdirSync(dir, { recursive: true });
  const picked = selectedNames.map((n) => allKits.find((k) => k.name === n)).filter(Boolean);
  const deps = {};
  for (const k of picked) {
    const t = k.type || 'kit';
    if (t === 'kit' || t === 'component') deps[k.name] = `github:${owner}/${k.name}`; // service/template 不當 npm dep
  }
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '0.1.0', private: true, main: 'index.js', scripts: { start: 'node index.js' }, dependencies: deps }, null, 2) + '\n');
  const md = `# ${name} — 組進來的 kit\n\n` + picked.map((k) =>
    `## ${k.name}　${k.covers}\n- ${k.repo}\n- \`${k.install}\`\n`).join('\n');
  fs.writeFileSync(path.join(dir, 'KITS.md'), md);
  const nodeKits = picked.filter((k) => (k.type || 'kit') === 'kit');
  const stub = '// 由 kit-kit init 產生。組進來的 kit（wiring 看各自 README）：\n' +
    nodeKits.map((k) => `const ${camelCase(k.name)} = require('${k.name}'); // ${k.covers}`).join('\n') +
    '\n\n// TODO: 用這些 kit 把 app 組起來\n';
  fs.writeFileSync(path.join(dir, 'index.js'), stub);
  return { dir, picked: picked.map((k) => k.name), deps };
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
function tplSkill(name, desc) {
  return `---
name: ${name}
description: <觸發語：使用者說「…」或要做 X 功能時。一句話講守備範圍，給 agent 判斷要不要載入>
---

# ${name} — 打法

**${desc}**

## 何時觸發

<哪種需求/哪句話出現時直接套這個 kit，不要重造>

## 接線（照抄能跑）

1. \`npm i github:Jeffrey0117/${name}\`（或內嵌 copy）
2. <真實 wiring 步驟 + 程式碼片段>

## 模式與文案

<這個領域打磨過的軟知識：元件組合順序、文案句型、定價/佈局原則…
kit 的 code 解決「能不能」，這一節解決「該怎麼寫才對」>

## 地雷

<踩過的坑>
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
  scaffold, publish, addToRegistry, pullKit, initProject,
  listProjectDirs, scanAdoption, fetchSkill,
};
