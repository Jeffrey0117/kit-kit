const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { renderSite } = require('../site/render');
const { buildModel } = require('../site/model');
const { escapeHtml } = require('../site/md');
const copy = require('../site/copy.json');

const registry = {
  owner: 'Jeffrey0117',
  kits: [
    { name: 'a-kit', covers: '甲功能 <b>粗</b>', repo: 'https://github.com/Jeffrey0117/a-kit', install: 'npm i github:Jeffrey0117/a-kit' },
    { name: 'B-Kit', type: 'component', covers: '乙元件', repo: 'https://github.com/Jeffrey0117/B-Kit', install: 'npm i github:Jeffrey0117/B-Kit' },
    { name: 'svc', type: 'service', covers: '一個服務', repo: 'https://github.com/Jeffrey0117/svc', install: 'x' },
    { name: 'secret-kit', covers: '不公開', repo: 'https://github.com/Jeffrey0117/secret-kit', install: 'x' },
  ],
};
const repos = {
  'a-kit': { public: true, branch: 'master', readme: '# a-kit 標題\n\n甲的說明 `code`\n\n[文件](docs/x.md)', hasSkill: true, logo: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
  'B-Kit': { public: true, branch: 'main', readme: '', hasSkill: true, logo: null },
  svc: { public: true, branch: 'master', readme: '# svc', hasSkill: false, logo: null },
  'secret-kit': { public: false, branch: 'master', readme: '機密', hasSkill: true, logo: null },
};
const packs = [
  { id: 'one', name: '一號', solves: '做一號。', kits: [{ name: 'a-kit', role: '甲角色' }, { name: 'B-Kit', role: '乙角色' }], steps: ['先 `a()` 再說', '第二步 <i>'] },
  { id: 'two', name: '二號', solves: '做二號。', kits: [{ name: 'a-kit', role: '甲' }, { name: 'svc', role: '服務' }], steps: [] },
  { id: 'three', name: '三號', solves: '做三號。', kits: [{ name: 'secret-kit', role: '密' }], steps: [] },
];
const model = buildModel({ registry, packs, repos, asOf: '2026-11-14' });
const files = renderSite(model, copy, { css: 'body{}', js: '/* js */', search: '/* search client */' });
const byPath = new Map(files.map((f) => [f.path, f.content]));
const html = (p) => byPath.get(p);
const pages = files.filter((f) => f.path.endsWith('.html'));

test('the site has a home page, one page per ready pack, one per public kit, and its assets', () => {
  assert.deepStrictEqual([...byPath.keys()].sort(), [
    'assets/app.js',
    'assets/logos/a-kit.svg',
    'assets/search.js',
    'assets/style.css',
    'index.html',
    'kits/a-kit/index.html',
    'kits/b-kit/index.html',
    'kits/svc/index.html',
    'packs/one/index.html',
  ]);
});

test('every internal link and asset reference resolves to a generated file', () => {
  for (const page of pages) {
    const refs = [...page.content.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (/^(https?:|#|mailto:)/.test(ref)) continue;
      assert.ok(!ref.startsWith('/'), `${page.path}: ${ref} is root-absolute; the site lives under a sub-path`);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page.path), ref.split('#')[0]));
      assert.ok(byPath.has(target), `${page.path}: broken link ${ref} → ${target}`);
    }
  }
});

test('every page is a Traditional Chinese document with exactly one h1', () => {
  for (const page of pages) {
    assert.ok(page.content.startsWith('<!doctype html>'), page.path);
    assert.ok(page.content.includes('<html lang="zh-Hant" '), page.path);
    assert.strictEqual((page.content.match(/<h1[\s>]/g) || []).length, 1, `${page.path} h1 count`);
  }
});

test('the home page shows ready packs as links and pending packs with what is missing', () => {
  const home = html('index.html');
  assert.ok(home.includes(copy.home.title));
  assert.ok(home.includes('href="packs/one/index.html"'));
  assert.ok(home.includes('二號'));
  assert.ok(home.includes('svc'));
  assert.ok(!home.includes('packs/two/'));
});

test('nothing private appears anywhere on the site', () => {
  for (const f of files) {
    assert.ok(!f.content.includes('secret-kit'), `${f.path} names a private kit`);
    assert.ok(!f.content.includes('機密'), `${f.path} carries private content`);
  }
});

test('a pack page carries the command, the AI prompt, the steps and its members', () => {
  const page = html('packs/one/index.html');
  const pack = model.packs[0];
  assert.ok(page.includes(escapeHtml(pack.addCommand)));
  assert.ok(page.includes(`data-copy="${escapeHtml(pack.prompt)}"`));
  assert.ok(page.includes('先 <code>a()</code> 再說'));
  assert.ok(page.includes('第二步 &lt;i&gt;'));
  assert.ok(page.includes('甲角色') && page.includes('乙角色'));
  assert.ok(page.includes('href="../../kits/a-kit/index.html"'));
});

test('a kit page shows its install line, packs, skill link and README without the duplicate title', () => {
  const page = html('kits/a-kit/index.html');
  assert.ok(page.includes('npm i github:Jeffrey0117/a-kit'));
  assert.ok(page.includes('href="../../packs/one/index.html"'));
  assert.ok(page.includes('href="https://github.com/Jeffrey0117/a-kit/blob/master/SKILL.md"'));
  assert.ok(page.includes('甲的說明 <code>code</code>'));
  assert.ok(!page.includes('a-kit 標題'));
  assert.ok(page.includes('href="https://github.com/Jeffrey0117/a-kit/blob/master/docs/x.md"'));
  assert.ok(page.includes('src="../../assets/logos/a-kit.svg"'));
});

test('a kit without a skill does not link to one', () => {
  assert.ok(!html('kits/svc/index.html').includes('SKILL.md'));
});

test('registry text is escaped wherever it is printed', () => {
  for (const p of ['index.html', 'kits/a-kit/index.html', 'packs/one/index.html']) {
    assert.ok(html(p).includes('甲功能 &lt;b&gt;粗&lt;/b&gt;'), p);
    assert.ok(!html(p).includes('<b>粗</b>'), p);
  }
});

test('a kit with an empty README still gets a page', () => {
  assert.ok(html('kits/b-kit/index.html').includes('乙元件'));
});

const sidebarOf = (page) => (page.match(/<aside class="sidebar"[\s\S]*?<\/aside>/) || [''])[0];
const tocOf = (page) => (page.match(/<aside class="toc"[\s\S]*?<\/aside>/) || [''])[0];

test('pack and kit pages carry a sidebar of every ready pack and public kit, marking the current page', () => {
  for (const p of ['packs/one/index.html', 'kits/a-kit/index.html', 'kits/svc/index.html']) {
    const side = sidebarOf(html(p));
    assert.ok(side.includes('href="../../packs/one/index.html"'), p);
    assert.ok(!side.includes('packs/two/'), `${p}: a pack that is not ready has no page to link to`);
    for (const slug of ['a-kit', 'b-kit', 'svc']) assert.ok(side.includes(`href="../../kits/${slug}/index.html"`), `${p} → ${slug}`);
    assert.strictEqual((side.match(/aria-current="page"/g) || []).length, 1, p);
  }
  assert.ok(sidebarOf(html('kits/svc/index.html')).includes('href="../../kits/svc/index.html" aria-current="page"'));
  assert.ok(sidebarOf(html('packs/one/index.html')).includes('href="../../packs/one/index.html" aria-current="page"'));
});

test('the home page has no sidebar and no page outline', () => {
  assert.strictEqual(sidebarOf(html('index.html')), '');
  assert.strictEqual(tocOf(html('index.html')), '');
});

test('every outline entry points at a heading that exists on that page', () => {
  for (const page of pages) {
    const anchors = [...tocOf(page.content).matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    for (const id of anchors) assert.ok(page.content.includes(`id="${id}"`), `${page.path}: #${id}`);
  }
  assert.ok(tocOf(html('packs/one/index.html')).includes(copy.pack.stepsTitle));
});

test('a kit page outline lists the README headings, with markup stripped from the labels', () => {
  const r2 = { ...repos, 'a-kit': { ...repos['a-kit'], readme: '# a-kit\n\n## 接線 `create()`\n\n### 細節\n\n#### 太深' } };
  const m2 = buildModel({ registry, packs, repos: r2, asOf: '2026-11-14' });
  const page = renderSite(m2, copy, { css: '', js: '', search: '' }).find((f) => f.path === 'kits/a-kit/index.html').content;
  const toc = tocOf(page);
  assert.ok(toc.includes('href="#接線-create"') && toc.includes('>接線 create()</a>'));
  assert.ok(toc.includes('href="#細節"'));
  assert.ok(!toc.includes('太深'));
  assert.ok(!toc.includes('<code>'));
});

test('every page can open the search and switch the theme, and loads the search data', () => {
  for (const page of pages) {
    assert.ok(page.content.includes('data-search-open'), page.path);
    assert.ok(page.content.includes('data-theme-toggle'), page.path);
    assert.ok(/<html lang="zh-Hant" data-root="(\.\.\/\.\.\/)?">/.test(page.content), page.path);
    assert.ok(/src="(\.\.\/\.\.\/)?assets\/search\.js"/.test(page.content), page.path);
  }
});

test('the search data file carries the index and the client code', () => {
  const js = html('assets/search.js');
  assert.ok(js.includes('kits/a-kit/index.html') && js.includes('packs/one/index.html'));
  assert.ok(js.includes('/* search client */'));
});

test('a README link to a blocked repo is rendered without the link', () => {
  const r2 = { ...repos, 'a-kit': { ...repos['a-kit'], readme: '搭配 [另一個](https://github.com/Jeffrey0117/Other-Thing) 使用' } };
  const m2 = buildModel({ registry, packs, repos: r2, asOf: '2026-11-14' });
  const out = renderSite(m2, copy, { css: '', js: '', blockedUrls: ['https://github.com/Jeffrey0117/Other-Thing'] });
  const page = out.find((f) => f.path === 'kits/a-kit/index.html').content;
  assert.ok(page.includes('另一個'));
  assert.ok(!page.includes('github.com/Jeffrey0117/Other-Thing'));
});
