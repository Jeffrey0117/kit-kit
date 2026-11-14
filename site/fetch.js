// 從 GitHub 抓介紹站需要的東西：哪些 repo 是公開的、預設分支、README、有沒有 SKILL.md、logo。
// 只碰公開 repo：私有 repo 連檔案網址都不會去要。
const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const CLIENT = 'kit-kit-site';

async function listRepos(owner, { fetchImpl, token }) {
  const headers = {
    'User-Agent': CLIENT,
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchImpl(`${API}/users/${owner}/repos?per_page=${PAGE_SIZE}&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub repo list failed: HTTP ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

const RETRY_DELAY_MS = 1500;
// logo 會原樣放到站上；直接開那個檔案時，裡面的腳本會在這個網域執行，所以帶腳本的一律不收
const UNSAFE_SVG = /<script|<foreignObject|\son\w+\s*=|javascript:/i;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tryRaw(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': CLIENT } });
    if (res.status === 404) return { found: false };
    if (res.ok) return { found: true, text: await res.text() };
    return { error: `HTTP ${res.status}` };
  } catch (err) {
    return { error: err.message };
  }
}

// 只有 404 算「沒有這個檔」。其他錯誤（限流、伺服器錯誤、斷線）重試一次，還是不行就讓 build 失敗：
// 把暫時抓不到當成檔案不存在，會讓套組無聲無息地從站上消失；build 失敗的話上一版還留著。
async function rawFile(url, fetchImpl, retryDelayMs) {
  let result = await tryRaw(url, fetchImpl);
  if (result.error) {
    await wait(retryDelayMs);
    result = await tryRaw(url, fetchImpl);
  }
  if (result.error) throw new Error(`下載失敗 ${url}: ${result.error}`);
  return result.found ? result.text : null;
}

async function fetchRepo(owner, meta, fetchImpl, retryDelayMs) {
  const base = `${RAW}/${owner}/${meta.name}/${meta.default_branch}`;
  const [readme, skill, logo] = await Promise.all(
    ['README.md', 'SKILL.md', 'logo.svg'].map((file) => rawFile(`${base}/${file}`, fetchImpl, retryDelayMs)),
  );
  const safeLogo = logo && logo.includes('<svg') && !UNSAFE_SVG.test(logo);
  return {
    public: true,
    branch: meta.default_branch,
    readme: readme || '',
    hasSkill: skill !== null,
    logo: safeLogo ? logo : null,
  };
}

async function fetchRepos(owner, names, { fetchImpl = fetch, token, retryDelayMs = RETRY_DELAY_MS } = {}) {
  const wanted = new Set(names);
  const list = await listRepos(owner, { fetchImpl, token });
  const open = list.filter((r) => wanted.has(r.name) && r.private === false);
  const entries = await Promise.all(open.map(async (meta) => [meta.name, await fetchRepo(owner, meta, fetchImpl, retryDelayMs)]));
  return Object.fromEntries(entries);
}

module.exports = { fetchRepos };
