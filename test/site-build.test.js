const test = require('node:test');
const assert = require('node:assert');
const { fetchRepos } = require('../site/fetch');
const { scanLeaks, withholdReadmes, parseDenyList, requireDenyList } = require('../site/build');

// 假的 GitHub：記下被要了哪些網址
function fakeGitHub({ repoList, files }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} });
    if (url.startsWith('https://api.github.com/users/')) {
      const page = Number(new URL(url).searchParams.get('page') || 1);
      const body = page === 1 ? repoList : [];
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    }
    const body = files[url];
    return body === undefined
      ? { ok: false, status: 404, text: async () => 'Not Found' }
      : { ok: true, status: 200, text: async () => body };
  };
  return { calls, fetchImpl };
}

const RAW = 'https://raw.githubusercontent.com/me';
const repoList = [
  { name: 'open-kit', private: false, default_branch: 'master' },
  { name: 'main-kit', private: false, default_branch: 'main' },
  { name: 'closed-kit', private: true, default_branch: 'master' },
  { name: 'unrelated', private: false, default_branch: 'master' },
];
const files = {
  [`${RAW}/open-kit/master/README.md`]: '# open',
  [`${RAW}/open-kit/master/SKILL.md`]: '# skill',
  [`${RAW}/open-kit/master/logo.svg`]: '<svg/>',
  [`${RAW}/main-kit/main/README.md`]: '# main',
  [`${RAW}/closed-kit/master/README.md`]: '機密',
};
const NAMES = ['open-kit', 'main-kit', 'closed-kit', 'missing-kit'];

test('fetchRepos returns public repos with README, skill flag and logo', async () => {
  const { fetchImpl } = fakeGitHub({ repoList, files });
  const repos = await fetchRepos('me', NAMES, { fetchImpl });
  assert.deepStrictEqual(repos['open-kit'], { public: true, branch: 'master', readme: '# open', hasSkill: true, logo: '<svg/>' });
});

test('fetchRepos uses each repo default branch and tolerates missing files', async () => {
  const { fetchImpl } = fakeGitHub({ repoList, files });
  const repos = await fetchRepos('me', NAMES, { fetchImpl });
  assert.deepStrictEqual(repos['main-kit'], { public: true, branch: 'main', readme: '# main', hasSkill: false, logo: null });
});

test('fetchRepos never requests a file from a private repo and does not return it', async () => {
  const { fetchImpl, calls } = fakeGitHub({ repoList, files });
  const repos = await fetchRepos('me', NAMES, { fetchImpl });
  assert.strictEqual(repos['closed-kit'], undefined);
  assert.deepStrictEqual(calls.filter((c) => c.url.includes('closed-kit')), []);
});

test('fetchRepos skips repos that do not exist and repos nobody asked for', async () => {
  const { fetchImpl, calls } = fakeGitHub({ repoList, files });
  const repos = await fetchRepos('me', NAMES, { fetchImpl });
  assert.deepStrictEqual(Object.keys(repos).sort(), ['main-kit', 'open-kit']);
  assert.deepStrictEqual(calls.filter((c) => c.url.includes('unrelated')), []);
});

test('fetchRepos sends the token to the API only, never to the raw file host', async () => {
  const { fetchImpl, calls } = fakeGitHub({ repoList, files });
  await fetchRepos('me', NAMES, { fetchImpl, token: 'tok' });
  const api = calls.filter((c) => c.url.startsWith('https://api.github.com/'));
  const raw = calls.filter((c) => c.url.startsWith('https://raw.githubusercontent.com/'));
  assert.ok(api.length > 0 && api.every((c) => c.headers.Authorization === 'Bearer tok'));
  assert.ok(raw.length > 0 && raw.every((c) => !c.headers.Authorization));
});

test('fetchRepos fails loudly when the repo list cannot be read', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, text: async () => 'rate limited' });
  await assert.rejects(fetchRepos('me', NAMES, { fetchImpl }), /403/);
});

test('scanLeaks flags private-looking IPv4 addresses and private keys', () => {
  const leaks = scanLeaks([
    { path: 'a.html', content: '連到 10.1.2.3 就好' },
    { path: 'b.html', content: ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ') },
    { path: 'c.html', content: '乾淨的內容' },
  ]);
  assert.deepStrictEqual(leaks.map((l) => l.path), ['a.html', 'b.html']);
  assert.strictEqual(leaks[0].match, '10.1.2.3');
});

test('withholdReadmes blanks a README that mentions a denied term and reports which kit', () => {
  const repos = {
    'clean-kit': { public: true, branch: 'master', readme: '# 乾淨', hasSkill: true, logo: null },
    'leaky-kit': { public: true, branch: 'master', readme: '示範站：https://demo.Private-Host.example/x', hasSkill: true, logo: null },
  };
  const out = withholdReadmes(repos, ['private-host.example']);
  assert.deepStrictEqual(out.withheld, ['leaky-kit']);
  assert.strictEqual(out.repos['leaky-kit'].readme, '');
  assert.strictEqual(out.repos['leaky-kit'].hasSkill, true);
  assert.strictEqual(out.repos['clean-kit'].readme, '# 乾淨');
  assert.strictEqual(repos['leaky-kit'].readme.includes('Private-Host'), true, 'input must not be mutated');
});

test('withholdReadmes with no denied terms changes nothing', () => {
  const repos = { a: { public: true, branch: 'master', readme: 'x', hasSkill: false, logo: null } };
  assert.deepStrictEqual(withholdReadmes(repos, []), { repos, withheld: [] });
});

test('parseDenyList splits, trims and drops empty entries', () => {
  assert.deepStrictEqual(parseDenyList(' a.example , ,B.example,'), ['a.example', 'b.example']);
  assert.deepStrictEqual(parseDenyList(undefined), []);
});

test('requireDenyList refuses to publish unguarded when the guard is required', () => {
  assert.throws(() => requireDenyList([], '1'), /KITSITE_DENY/);
  assert.doesNotThrow(() => requireDenyList(['a.example'], '1'));
  assert.doesNotThrow(() => requireDenyList([], undefined));
});

test('scanLeaks flags a denied term in any generated file, not only pages', () => {
  const leaks = scanLeaks([{ path: 'assets/logos/x.svg', content: '<svg><!-- Private-Host.example --></svg>' }], ['private-host.example']);
  assert.deepStrictEqual(leaks.map((l) => l.path), ['assets/logos/x.svg']);
});

test('scanLeaks lets loopback addresses and version numbers through', () => {
  const files2 = [{ path: 'a.html', content: 'listen on 127.0.0.1 or 0.0.0.0, version 1.2.3 and v0.4.5, 版本 22.16.0' }];
  assert.deepStrictEqual(scanLeaks(files2), []);
});
