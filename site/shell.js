// 每一頁共用的外框：頁首（搜尋、深淺色）、側欄、本頁目錄、搜尋視窗、頁尾。純函式。
const { escapeHtml: e } = require('./escape');

const TYPE_ORDER = ['kit', 'component', 'template', 'service'];
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
// 畫面出來之前就套上記住的深淺色，避免閃一下
const THEME_BOOT = "(function(){try{var t=localStorage.getItem('kk-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}})()";

const icon = (paths) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  search: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  menu: icon('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  theme: icon('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
};

const kitHref = (root, kit) => `${root}kits/${kit.slug}/index.html`;
const packHref = (root, pack) => `${root}packs/${pack.id}/index.html`;

function copyBox(text, copy, { wrap = false } = {}) {
  return `<div class="copybox">
  <pre${wrap ? ' class="wrap"' : ''}><code>${e(text)}</code></pre>
  <button type="button" class="copy" data-copy="${e(text)}" data-done="${e(copy.copy.done)}">${e(copy.copy.button)}</button>
</div>`;
}

function header({ root, model, copy, hasSidebar }) {
  const github = `https://github.com/${model.owner}/kit-kit`;
  const menu = hasSidebar
    ? `<button type="button" class="icon-btn menu-btn" data-nav-toggle aria-controls="kk-sidebar" aria-expanded="false" aria-label="${e(copy.nav.menu)}">${ICONS.menu}</button>`
    : '';
  return `<header class="site-header">
  <div class="bar">
    ${menu}
    <a class="brand" href="${root}index.html">${e(copy.nav.home)}</a>
    <button type="button" class="search-btn" data-search-open>${ICONS.search}<span>${e(copy.nav.search)}</span><kbd>Ctrl K</kbd></button>
    <nav class="links" aria-label="${e(copy.nav.label)}">
      <a href="${root}index.html#packs">${e(copy.nav.packs)}</a>
      <a href="${root}index.html#kits">${e(copy.nav.kits)}</a>
      <a href="${github}">${e(copy.nav.github)}</a>
    </nav>
    <button type="button" class="icon-btn" data-theme-toggle aria-label="${e(copy.nav.theme)}">${ICONS.theme}</button>
  </div>
</header>`;
}

function sideLink(href, label, isCurrent, mono) {
  return `<li><a${mono ? ' class="mono"' : ''} href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${e(label)}</a></li>`;
}

// current: 'pack:<id>' 或 'kit:<slug>'
function sidebar({ root, model, copy, current }) {
  const packs = model.packs.filter((p) => p.ready);
  const groups = [
    packs.length ? `<p class="side-title">${e(copy.nav.packs)}</p>
    <ul>${packs.map((p) => sideLink(packHref(root, p), p.name, current === `pack:${p.id}`, false)).join('')}</ul>` : '',
    ...TYPE_ORDER.map((type) => {
      const kits = model.kits.filter((k) => k.type === type);
      if (!kits.length) return '';
      return `<p class="side-title">${e(copy.types[type])}</p>
    <ul>${kits.map((k) => sideLink(kitHref(root, k), k.name, current === `kit:${k.slug}`, true)).join('')}</ul>`;
    }),
  ].filter(Boolean);
  return `<aside class="sidebar" id="kk-sidebar">
  <nav aria-label="${e(copy.sidebar.label)}">
    ${groups.join('\n    ')}
  </nav>
</aside>`;
}

// entries: [{ id, label, level }]，level 2 或 3
function toc(entries, copy) {
  if (!entries.length) return '';
  const items = entries.map((t) => `<li class="l${t.level}"><a href="#${e(t.id)}">${e(t.label)}</a></li>`).join('');
  return `<aside class="toc" aria-label="${e(copy.toc.title)}">
  <p class="toc-title">${e(copy.toc.title)}</p>
  <ul>${items}</ul>
</aside>`;
}

function searchDialog(copy) {
  return `<dialog class="search" id="kk-search" aria-label="${e(copy.nav.search)}">
  <div class="search-field">${ICONS.search}<input type="search" id="kk-search-input" placeholder="${e(copy.search.placeholder)}" autocomplete="off" spellcheck="false" aria-controls="kk-search-results"></div>
  <ul class="results" id="kk-search-results" data-empty="${e(copy.search.empty)}"></ul>
  <p class="search-hint">${e(copy.search.hint)}</p>
</dialog>`;
}

function footer(model, copy) {
  const github = `https://github.com/${model.owner}/kit-kit`;
  return `<footer class="site-footer">
  <span>${e(copy.footer.source)} · ${e(copy.home.asOf)} ${e(model.asOf)}</span>
  <span><a href="${github}">${e(model.owner)}/kit-kit</a> · ${e(copy.footer.license)}</span>
</footer>`;
}

// page: { root, title, description, body, current?, outline? }。有 current 的是文件頁（三欄），沒有的是首頁。
function layout(page, model, copy) {
  const { root, title, description, body } = page;
  const isDoc = !!page.current;
  const main = isDoc
    ? `<div class="shell docs">
${sidebar({ root, model, copy, current: page.current })}
<main class="content">
${body}
${footer(model, copy)}
</main>
${toc(page.outline || [], copy)}
</div>`
    : `<div class="shell home">
<main>
${body}
</main>
${footer(model, copy)}
</div>`;
  return `<!doctype html>
<html lang="zh-Hant" data-root="${root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<script>${THEME_BOOT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body data-copy-label="${e(copy.copy.button)}" data-copy-done="${e(copy.copy.done)}">
${header({ root, model, copy, hasSidebar: isDoc })}
${main}
${searchDialog(copy)}
<script src="${root}assets/search.js" defer></script>
<script src="${root}assets/app.js" defer></script>
</body>
</html>
`;
}

module.exports = { layout, copyBox, kitHref, packHref, TYPE_ORDER };
