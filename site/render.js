// 資料模型 → 整個站的檔案清單 [{ path, content }]。純函式（樣式與腳本由呼叫端傳入）。
const { escapeHtml: e } = require('./escape');
const { renderMarkdown, renderInline } = require('./md');
const { layout, copyBox, kitHref, packHref, TYPE_ORDER } = require('./shell');
const { buildSearchIndex, searchScript } = require('./search');

function ways(pack, copy) {
  return `<div class="ways">
    <div class="way">
      <h3>${e(copy.ways.commandTitle)}</h3>
      <p>${e(copy.ways.commandText)}</p>
      ${copyBox(pack.addCommand, copy)}
    </div>
    <div class="way">
      <h3>${e(copy.ways.aiTitle)}</h3>
      <p>${e(copy.ways.aiText)}</p>
      ${copyBox(pack.prompt, copy, { wrap: true })}
    </div>
  </div>`;
}

function packCard(pack, root, copy) {
  const chips = pack.members.map((m) => `<span class="chip">${e(m.name)}</span>`).join('');
  return `<a class="pack-card" href="${packHref(root, pack)}">
      <h3>${e(pack.name)}</h3>
      <p>${e(pack.solves)}</p>
      <div class="chips">${chips}</div>
      <span class="more">${e(copy.home.packLink)} →</span>
    </a>`;
}

function pendingRow(pack, root, copy) {
  const members = pack.members.map((m) => `<a class="chip" href="${kitHref(root, m)}">${e(m.name)}</a>`).join('');
  const missing = pack.missing.length
    ? `<p class="missing">${e(copy.home.pendingMissing)}：${pack.missing.map((m) => e(m.name)).join('、')}</p>`
    : '';
  return `<li>
      <h4>${e(pack.name)}</h4>
      <p>${e(pack.solves)}</p>
      <div class="chips">${members}</div>
      ${missing}
    </li>`;
}

function kitRow(kit, root, packsById, copy) {
  const tags = [
    kit.hasSkill ? `<span class="tag">${e(copy.kit.hasSkill)}</span>` : '',
    ...kit.packs.map((id) => `<span class="tag plain">${e(packsById.get(id).name)}</span>`),
  ].join('');
  return `<li>
        <a class="kname" href="${kitHref(root, kit)}">${e(kit.name)}</a>
        <span class="kcovers">${e(kit.covers)}</span>
        <span class="ktags">${tags}</span>
      </li>`;
}

function kitGroups(model, root, copy) {
  const packsById = new Map(model.packs.map((p) => [p.id, p]));
  return TYPE_ORDER.map((type) => {
    const kits = model.kits.filter((k) => k.type === type);
    if (!kits.length) return '';
    return `<h3 class="group">${e(copy.types[type])} <small>${kits.length}</small></h3>
    <ul class="kitlist">
      ${kits.map((k) => kitRow(k, root, packsById, copy)).join('\n      ')}
    </ul>`;
  }).join('\n    ');
}

function homePage(model, copy) {
  const root = '';
  const shown = model.packs.filter((p) => p.members.length);
  const ready = shown.filter((p) => p.ready);
  const pending = shown.filter((p) => !p.ready);
  const lead = ready[0];
  const body = `  <header class="home-hero">
    <p class="eyebrow">${e(copy.home.eyebrow)}</p>
    <h1>${e(copy.home.title)}</h1>
    <p class="lede">${e(copy.home.lede)}</p>
    ${lead ? `<div class="hero-cmd">${copyBox(lead.addCommand, copy)}</div>` : ''}
    <div class="cta"><a class="btn primary" href="#packs">${e(copy.home.ctaPacks)}</a><a class="btn ghost" href="#kits">${e(copy.nav.kits)}</a></div>
    <div class="facts">
      <div class="fact"><b>${model.stats.readyPacks}</b><span>${e(copy.home.factPacks)}</span></div>
      <div class="fact"><b>${model.stats.kits}</b><span>${e(copy.home.factKits)}</span></div>
      <div class="fact"><b>${model.stats.withSkill}</b><span>${e(copy.home.factSkill)}</span></div>
    </div>
  </header>

  <section id="packs">
    <div class="sec-head"><h2>${e(copy.home.packsTitle)}</h2><p>${e(copy.home.packsLede)}</p></div>
    <div class="pack-grid">
    ${ready.map((p) => packCard(p, root, copy)).join('\n    ')}
    </div>
    ${pending.length ? `<div class="pending">
      <h3>${e(copy.home.pendingTitle)}</h3>
      <p class="note">${e(copy.home.pendingLede)}</p>
      <ul>
    ${pending.map((p) => pendingRow(p, root, copy)).join('\n    ')}
      </ul>
    </div>` : ''}
  </section>
${lead ? `
  <section id="how">
    <div class="sec-head"><h2>${e(copy.home.howTitle)}</h2><p>${e(copy.home.howLede.replace('{pack}', lead.name))}</p></div>
    ${ways(lead, copy)}
  </section>
` : ''}
  <section id="kits">
    <div class="sec-head"><h2>${e(copy.home.kitsTitle)}</h2><p>${e(copy.home.kitsLede)}</p></div>
    ${kitGroups(model, root, copy)}
  </section>`;
  return layout({ root, title: `${copy.site.name} — ${copy.home.title}`, description: copy.site.description, body }, model, copy);
}

function packPage(pack, model, copy) {
  const root = '../../';
  const members = pack.members.map((m) => `<a class="member" href="${kitHref(root, m)}">
        <span class="mname">${e(m.name)}</span>
        <span class="role">${e(m.role)}</span>
        <span class="covers">${e(m.covers)}</span>
      </a>`).join('\n      ');
  const steps = pack.steps.length ? `
  <h2 id="kk-steps">${e(copy.pack.stepsTitle)}</h2>
  <p class="sec-lede">${e(copy.pack.stepsLede)}</p>
  <ol class="flow">
    ${pack.steps.map((s) => `<li><span>${renderInline(s)}</span></li>`).join('\n    ')}
  </ol>` : '';
  const outline = [
    { id: 'kk-members', label: copy.pack.membersTitle, level: 2 },
    ...(pack.steps.length ? [{ id: 'kk-steps', label: copy.pack.stepsTitle, level: 2 }] : []),
    { id: 'kk-ways', label: copy.pack.waysTitle, level: 2 },
  ];
  const body = `<article class="doc">
  <p class="crumb"><a href="${root}index.html#packs">${e(copy.pack.back)}</a> / ${e(copy.pack.eyebrow)}</p>
  <h1>${e(pack.name)}</h1>
  <p class="lede">${e(pack.solves)}</p>
  <div class="doc-cmd">${copyBox(pack.addCommand, copy)}</div>

  <h2 id="kk-members">${e(copy.pack.membersTitle)}</h2>
  <div class="members">
      ${members}
  </div>
${steps}

  <h2 id="kk-ways">${e(copy.pack.waysTitle)}</h2>
  ${ways(pack, copy)}
</article>`;
  return layout({ root, title: `${pack.name}套組 — ${copy.site.name}`, description: pack.solves, body, current: `pack:${pack.id}`, outline }, model, copy);
}

// README 的第一個大標題跟頁面標題重複，拿掉
function dropTitle(md) {
  const lines = String(md).split(/\r?\n/);
  const i = lines.findIndex((l) => /^#\s+/.test(l) || /^\s*(```|~~~)/.test(l));
  if (i < 0 || !/^#\s+/.test(lines[i])) return md;
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
}

// 轉好的 README 裡的 h2、h3 → 本頁目錄。標籤裡的標記（<code> 之類）拿掉，只留字。
function readmeOutline(html) {
  return [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: Number(m[1]),
    id: unescapeHtml(m[2]),
    label: unescapeHtml(m[3].replace(/<[^>]+>/g, '')),
  }));
}

function unescapeHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function kitPage(kit, model, copy, blockedUrls) {
  const root = '../../';
  const blob = `${kit.repo}/blob/${kit.branch}`;
  const raw = `https://raw.githubusercontent.com/${model.owner}/${kit.name}/${kit.branch}`;
  const packLinks = kit.packs.map((id) => model.packs.find((p) => p.id === id)).map((p) => (p.ready
    ? `<a class="chip" href="${packHref(root, p)}">${e(p.name)}</a>`
    : `<span class="chip dim">${e(p.name)}</span>`)).join('');
  const readme = renderMarkdown(dropTitle(kit.readme), { repoUrl: blob, rawUrl: raw, blockedUrls });
  const outline = [
    { id: 'kk-install', label: copy.kit.installTitle, level: 2 },
    { id: 'kk-readme', label: copy.kit.readmeTitle, level: 2 },
    ...readmeOutline(readme).map((t) => ({ ...t, level: 3 })),
  ];
  const body = `<article class="doc">
  <p class="crumb"><a href="${root}index.html#kits">${e(copy.kit.back)}</a> / ${e(copy.types[kit.type] || kit.type)}</p>
  <div class="kit-title">
    <h1>${e(kit.name)}</h1>
    ${kit.logo ? `<img class="logo" src="${root}assets/logos/${kit.slug}.svg" alt="" width="56" height="56">` : ''}
  </div>
  <p class="lede">${e(kit.covers)}</p>
  ${packLinks ? `<div class="meta"><span class="label">${e(copy.kit.inPacks)}</span><div class="chips">${packLinks}</div></div>` : ''}
  <div class="cta">
    <a class="btn primary" href="${e(kit.repo)}">${e(copy.kit.repo)}</a>
    ${kit.hasSkill ? `<a class="btn ghost" href="${blob}/SKILL.md">${e(copy.kit.skillLink)}</a>` : ''}
  </div>

  <h2 id="kk-install">${e(copy.kit.installTitle)}</h2>
  ${copyBox(kit.install, copy)}

  <h2 id="kk-readme">${e(copy.kit.readmeTitle)}</h2>
  <div class="prose">${readme || `<p>${e(copy.kit.noReadme)}</p>`}</div>
</article>`;
  return layout({ root, title: `${kit.name} — ${copy.site.name}`, description: kit.covers, body, current: `kit:${kit.slug}`, outline }, model, copy);
}

function renderSite(model, copy, assets) {
  const pages = [
    { path: 'index.html', content: homePage(model, copy) },
    ...model.packs.filter((p) => p.ready).map((p) => ({ path: `packs/${p.id}/index.html`, content: packPage(p, model, copy) })),
    ...model.kits.map((k) => ({ path: `kits/${k.slug}/index.html`, content: kitPage(k, model, copy, assets.blockedUrls || []) })),
  ];
  const logos = model.kits.filter((k) => k.logo).map((k) => ({ path: `assets/logos/${k.slug}.svg`, content: k.logo }));
  return [
    ...pages,
    { path: 'assets/style.css', content: assets.css },
    { path: 'assets/app.js', content: assets.js },
    { path: 'assets/search.js', content: searchScript(buildSearchIndex(model, copy), assets.search || '') },
    ...logos,
  ];
}

module.exports = { renderSite };
