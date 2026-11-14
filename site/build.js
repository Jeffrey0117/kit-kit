#!/usr/bin/env node
// 產生介紹站：抓 GitHub → 組資料 → 產頁 → 檢查 → 寫到 _site/
//   node site/build.js          （GITHUB_TOKEN 有設就帶，沒有也能跑）
const fs = require('fs');
const path = require('path');
const { fetchRepos } = require('./fetch');
const { buildModel } = require('./model');
const { renderSite } = require('./render');
const { loadPacks } = require('../packs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const SAFE_IPS = new Set(['127.0.0.1', '0.0.0.0']);
const IPV4 = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g;
const PRIVATE_KEY = /PRIVATE KEY/;

// 對外頁面不該出現的東西：IP 位址、私鑰。私人網域由各 kit push 時的守門員擋。
function scanLeaks(files) {
  const leaks = [];
  for (const file of files.filter((f) => f.path.endsWith('.html'))) {
    for (const m of file.content.matchAll(IPV4)) {
      const isAddress = m.slice(1, 5).every((part) => Number(part) <= 255);
      if (isAddress && !SAFE_IPS.has(m[0])) leaks.push({ path: file.path, match: m[0] });
    }
    const key = file.content.match(PRIVATE_KEY);
    if (key) leaks.push({ path: file.path, match: key[0] });
  }
  return leaks;
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
}

function writeSite(files, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const file of files) {
    const target = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
}

async function build() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
  const copy = JSON.parse(fs.readFileSync(path.join(__dirname, 'copy.json'), 'utf8'));
  const assets = {
    css: fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8'),
    js: fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'),
  };
  const repos = await fetchRepos(registry.owner, registry.kits.map((k) => k.name), { token: process.env.GITHUB_TOKEN });
  const model = buildModel({ registry, packs: loadPacks(), repos, asOf: today() });
  if (!model.kits.length) throw new Error('沒有抓到任何公開 kit，不產生空的站');

  const files = renderSite(model, copy, assets);
  const leaks = scanLeaks(files);
  if (leaks.length) {
    throw new Error(`頁面裡有不該對外的內容，停止產生：\n${leaks.map((l) => `  ${l.path}: ${l.match}`).join('\n')}`);
  }
  writeSite(files, OUT);
  return { model, files };
}

if (require.main === module) {
  build().then(({ model, files }) => {
    const pending = model.packs.filter((p) => !p.ready).map((p) => p.id).join(', ') || '無';
    process.stdout.write(`_site/ 已產生：${files.length} 個檔案，${model.stats.kits} 個 kit，${model.stats.readyPacks} 個套組可用（整理中：${pending}）\n`);
  }).catch((err) => {
    process.stderr.write(`build 失敗：${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { build, scanLeaks };
