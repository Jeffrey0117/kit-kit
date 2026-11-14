// kit 相關的三種頁面：全部 kit 總覽、單一 kit 的說明頁、它的範例頁。純函式。
const { escapeHtml: e } = require('./escape');
const { renderMarkdown } = require('./md');
const { highlight } = require('./highlight');
const { layout, copyBox, packHref, TYPE_ORDER } = require('./shell');

const KEYWORD_LIMIT = 6;

// README 的第一個大標題跟頁面標題重複，拿掉
function dropTitle(md) {
  const lines = String(md).split(/\r?\n/);
  const i = lines.findIndex((l) => /^#\s+/.test(l) || /^\s*(```|~~~)/.test(l));
  if (i < 0 || !/^#\s+/.test(lines[i])) return md;
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
}

function unescapeHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// 轉好的 README 裡的 h2、h3 → 本頁目錄。標籤裡的標記（<code> 之類）拿掉，只留字。
function readmeOutline(html) {
  return [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: 3,
    id: unescapeHtml(m[2]),
    label: unescapeHtml(m[3].replace(/<[^>]+>/g, '')),
  }));
}

function facts(kit, copy) {
  return [
    kit.version ? `${e(copy.kit.version)} v${e(kit.version)}` : '',
    kit.updated ? `${e(copy.kit.updated)} ${e(kit.updated)}` : '',
  ].filter(Boolean).join(' · ');
}

function packChips(kit, model, root) {
  return kit.packs.map((id) => model.packs.find((p) => p.id === id)).map((p) => (p.ready
    ? `<a class="chip" href="${packHref(root, p)}">${e(p.name)}</a>`
    : `<span class="chip dim">${e(p.name)}</span>`)).join('');
}

// 說明頁與範例頁共用的頁首。tab: 'readme' 或 'example'；hrefs 是兩個分頁各自的相對網址
function kitHead(kit, model, copy, root, tab) {
  const blob = `${kit.repo}/blob/${kit.branch}`;
  const chips = packChips(kit, model, root);
  const line = facts(kit, copy);
  const here = ' aria-current="page"';
  const tabs = kit.example ? `<nav class="tabs" aria-label="${e(kit.name)}">
    <a href="${tab === 'readme' ? 'index.html' : '../index.html'}"${tab === 'readme' ? here : ''}>${e(copy.kit.tabReadme)}</a>
    <a href="${tab === 'readme' ? 'example/index.html' : 'index.html'}"${tab === 'example' ? here : ''}>${e(copy.kit.tabExample)}</a>
  </nav>` : '';
  return `<p class="crumb"><a href="${root}kits/index.html">${e(copy.kit.back)}</a> / ${e(copy.types[kit.type] || kit.type)}</p>
  <div class="kit-title">
    <h1>${e(kit.name)}</h1>
    ${kit.logo ? `<img class="logo" src="${root}assets/logos/${kit.slug}.svg" alt="" width="56" height="56">` : ''}
  </div>
  <p class="lede">${e(kit.covers)}</p>
  ${line ? `<p class="kfacts">${line}</p>` : ''}
  ${chips ? `<div class="meta"><span class="label">${e(copy.kit.inPacks)}</span><div class="chips">${chips}</div></div>` : ''}
  <div class="cta">
    <a class="btn primary" href="${e(kit.repo)}">${e(copy.kit.repo)}</a>
    ${kit.hasSkill ? `<a class="btn ghost" href="${blob}/SKILL.md">${e(copy.kit.skillLink)}</a>` : ''}
  </div>
  ${tabs}`;
}

function kitPage(kit, model, copy, blockedUrls) {
  const root = '../../';
  const blob = `${kit.repo}/blob/${kit.branch}`;
  const raw = `https://raw.githubusercontent.com/${model.owner}/${kit.name}/${kit.branch}`;
  const readme = renderMarkdown(dropTitle(kit.readme), { repoUrl: blob, rawUrl: raw, blockedUrls });
  const outline = [
    { id: 'kk-install', label: copy.kit.installTitle, level: 2 },
    { id: 'kk-readme', label: copy.kit.readmeTitle, level: 2 },
    ...readmeOutline(readme),
  ];
  const body = `<article class="doc">
  ${kitHead(kit, model, copy, root, 'readme')}

  <h2 id="kk-install">${e(copy.kit.installTitle)}</h2>
  ${copyBox(kit.install, copy)}

  <h2 id="kk-readme">${e(copy.kit.readmeTitle)}</h2>
  <div class="prose">${readme || `<p>${e(copy.kit.noReadme)}</p>`}</div>
</article>`;
  return layout({ root, title: `${kit.name} — ${copy.site.name}`, description: kit.covers, body, current: `kit:${kit.slug}`, outline }, model, copy);
}

function examplePage(kit, model, copy) {
  const root = '../../../';
  const source = `${kit.repo}/blob/${kit.branch}/example.js`;
  const body = `<article class="doc">
  ${kitHead(kit, model, copy, root, 'example')}

  <h2 id="kk-example">${e(copy.kit.exampleTitle)}</h2>
  <p class="sec-lede">${e(copy.kit.exampleLede)} <a href="${e(source)}">${e(copy.kit.exampleSource)}</a></p>
  <div class="copybox code">
    <pre data-lang="js"><code class="language-js">${highlight(kit.example, 'js')}</code></pre>
    <button type="button" class="copy" data-code-copy data-done="${e(copy.copy.done)}">${e(copy.copy.button)}</button>
  </div>
</article>`;
  return layout({
    root,
    title: `${kit.name} ${copy.kit.tabExample} — ${copy.site.name}`,
    description: kit.covers,
    body,
    current: `kit:${kit.slug}`,
    outline: [],
  }, model, copy);
}

function kitCard(kit, model, copy, root) {
  const line = facts(kit, copy);
  const keywords = kit.keywords.slice(0, KEYWORD_LIMIT).map((k) => `<span class="kw">${e(k)}</span>`).join('');
  const tags = [
    kit.hasSkill ? `<span class="tag">${e(copy.kit.hasSkill)}</span>` : '',
    kit.example ? `<span class="tag plain">${e(copy.kit.hasExample)}</span>` : '',
  ].join('');
  const chips = packChips(kit, model, root);
  return `<div class="kit-card">
      <div class="kc-head">
        ${kit.logo ? `<img src="${root}assets/logos/${kit.slug}.svg" alt="" width="32" height="32">` : ''}
        <a class="kname" href="${kit.slug}/index.html">${e(kit.name)}</a>
        <span class="ktags">${tags}</span>
      </div>
      <p class="kc-covers">${e(kit.covers)}</p>
      ${kit.intro && kit.intro !== kit.covers ? `<p class="kc-intro">${e(kit.intro)}</p>` : ''}
      ${keywords ? `<div class="kws">${keywords}</div>` : ''}
      ${chips || line ? `<div class="kc-foot"><div class="chips">${chips}</div><span class="kfacts">${line}</span></div>` : ''}
    </div>`;
}

function kitsIndexPage(model, copy) {
  const root = '../';
  const groups = TYPE_ORDER.map((type) => ({ type, kits: model.kits.filter((k) => k.type === type) })).filter((g) => g.kits.length);
  const sections = groups.map((g) => `
  <h2 id="kk-type-${g.type}">${e(copy.types[g.type])} <small>${g.kits.length}</small></h2>
  <div class="kit-cards">
    ${g.kits.map((k) => kitCard(k, model, copy, root)).join('\n    ')}
  </div>`).join('\n');
  const body = `<article class="doc">
  <h1>${e(copy.kits.title)}</h1>
  <p class="lede">${e(copy.kits.lede)}</p>
${sections}
</article>`;
  const outline = groups.map((g) => ({ id: `kk-type-${g.type}`, label: copy.types[g.type], level: 2 }));
  return layout({ root, title: `${copy.kits.title} — ${copy.site.name}`, description: copy.kits.lede, body, current: 'kits', outline }, model, copy);
}

module.exports = { kitPage, examplePage, kitsIndexPage };
