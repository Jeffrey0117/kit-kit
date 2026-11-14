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

// 抓不到（404 之類）回 null，不 throw：少一份 README 不該讓整個站 build 失敗
async function rawFile(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': CLIENT } });
    return res.ok ? await res.text() : null;
  } catch (err) {
    return null;
  }
}

async function fetchRepo(owner, meta, fetchImpl) {
  const base = `${RAW}/${owner}/${meta.name}/${meta.default_branch}`;
  const [readme, skill, logo] = await Promise.all(
    ['README.md', 'SKILL.md', 'logo.svg'].map((file) => rawFile(`${base}/${file}`, fetchImpl)),
  );
  return {
    public: true,
    branch: meta.default_branch,
    readme: readme || '',
    hasSkill: skill !== null,
    logo: logo && logo.includes('<svg') ? logo : null,
  };
}

async function fetchRepos(owner, names, { fetchImpl = fetch, token } = {}) {
  const wanted = new Set(names);
  const list = await listRepos(owner, { fetchImpl, token });
  const open = list.filter((r) => wanted.has(r.name) && r.private === false);
  const entries = await Promise.all(open.map(async (meta) => [meta.name, await fetchRepo(owner, meta, fetchImpl)]));
  return Object.fromEntries(entries);
}

module.exports = { fetchRepos };
