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
// 前後不能緊接數字或「.數字」（那是版本號的一部分）；句尾的句點不算
const IPV4 = /(?<!\d)(?<!\d\.)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\d)(?!\.\d)/g;
const PRIVATE_KEY = /PRIVATE KEY/;

// 不公開的字詞名單（私人網域之類）。名單本身不能進 repo，所以從環境變數 KITSITE_DENY 讀，逗號分隔。
function parseDenyList(value) {
  return String(value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// registry 裡有、但沒上站的 repo（私有或抓不到）：README 裡連過去的連結要拿掉，不然訪客點了是 404
function blockedRepoUrls(registry, repos) {
  return registry.kits.filter((k) => !repos[k.name]).map((k) => k.repo);
}

// 正式發布（KITSITE_REQUIRE_DENY=1）時名單一定要有：寧可不發，也不要沒檢查就發。
function requireDenyList(denyList, required) {
  if (required === '1' && !denyList.length) {
    throw new Error('KITSITE_DENY 沒有設定，正式發布不能沒有不公開字詞的檢查');
  }
}

// README 提到名單裡的字詞 → 整份不上站（kit 頁改顯示「請看原始碼」），並回報是哪幾個 kit。
function withholdReadmes(repos, denyList) {
  const hit = (text) => denyList.some((term) => String(text).toLowerCase().includes(term));
  const withheld = Object.keys(repos).filter((name) => hit(repos[name].readme));
  if (!withheld.length) return { repos, withheld };
  const cleaned = Object.fromEntries(Object.entries(repos).map(([name, repo]) => (
    [name, withheld.includes(name) ? { ...repo, readme: '' } : repo]
  )));
  return { repos: cleaned, withheld };
}

// 對外頁面不該出現的東西：名單裡的字詞（任何檔案）、IP 位址與私鑰（頁面）。
// 上色之類的標記會把一串字切成好幾段，所以每個檔案看兩次：原樣，以及去掉標籤後讀者實際看到的字。
function scanLeaks(files, denyList = []) {
  const views = files.map((file) => ({ path: file.path, texts: [file.content, file.content.replace(/<[^>]*>/g, '')] }));
  const denied = views
    .filter((view) => denyList.some((term) => view.texts.some((text) => text.toLowerCase().includes(term))))
    .map((view) => ({ path: view.path, match: '（不公開名單中的字詞）' }));
  const exposed = views.filter((view) => view.path.endsWith('.html')).flatMap((view) => {
    const addresses = view.texts.flatMap((text) => [...text.matchAll(IPV4)])
      .filter((m) => m.slice(1, 5).every((part) => Number(part) <= 255) && !SAFE_IPS.has(m[0]))
      .map((m) => m[0]);
    const keys = view.texts.some((text) => PRIVATE_KEY.test(text)) ? ['PRIVATE KEY'] : [];
    return [...new Set([...addresses, ...keys])].map((match) => ({ path: view.path, match }));
  });
  return [...denied, ...exposed];
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
    search: fs.readFileSync(path.join(__dirname, 'search-client.js'), 'utf8'),
  };
  const denyList = parseDenyList(process.env.KITSITE_DENY);
  requireDenyList(denyList, process.env.KITSITE_REQUIRE_DENY);
  const fetched = await fetchRepos(registry.owner, registry.kits.map((k) => k.name), { token: process.env.GITHUB_TOKEN });
  const { repos, withheld } = withholdReadmes(fetched, denyList);
  const model = buildModel({ registry, packs: loadPacks(), repos, asOf: today() });
  if (!model.kits.length) throw new Error('沒有抓到任何公開 kit，不產生空的站');

  const files = renderSite(model, copy, { ...assets, blockedUrls: blockedRepoUrls(registry, repos) });
  const leaks = scanLeaks(files, denyList);
  if (leaks.length) {
    throw new Error(`頁面裡有不該對外的內容，停止產生：\n${leaks.map((l) => `  ${l.path}: ${l.match}`).join('\n')}`);
  }
  writeSite(files, OUT);
  return { model, files, withheld, guarded: denyList.length > 0 };
}

if (require.main === module) {
  build().then(({ model, files, withheld, guarded }) => {
    const pending = model.packs.filter((p) => !p.ready).map((p) => p.id).join(', ') || '無';
    process.stdout.write(`_site/ 已產生：${files.length} 個檔案，${model.stats.kits} 個 kit，${model.stats.readyPacks} 個套組可用（整理中：${pending}）\n`);
    if (withheld.length) process.stdout.write(`README 含不公開字詞，沒有上站：${withheld.join(', ')}（去那個 repo 把 README 改掉就會恢復）\n`);
    if (!guarded) process.stdout.write('注意：沒有設 KITSITE_DENY，這次沒有檢查不公開字詞。\n');
  }).catch((err) => {
    process.stderr.write(`build 失敗：${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { build, scanLeaks, withholdReadmes, parseDenyList, requireDenyList, blockedRepoUrls };
