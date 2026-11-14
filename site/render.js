// 資料模型 → 整個站的檔案清單 [{ path, content }]。純函式（樣式與腳本由呼叫端傳入）。
const { escapeHtml: e } = require('./escape');
const { renderInline } = require('./md');
const { layout, copyBox, kitHref, packHref, TYPE_ORDER } = require('./shell');
const { buildSearchIndex, searchScript } = require('./search');
const { kitPage, examplePage, kitsIndexPage } = require('./kit-pages');

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
    <div class="sec-head"><h2>${e(copy.home.kitsTitle)}</h2><p>${e(copy.home.kitsLede)} <a href="kits/index.html">${e(copy.home.kitsMore)} →</a></p></div>
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

function renderSite(model, copy, assets) {
  const pages = [
    { path: 'index.html', content: homePage(model, copy) },
    ...model.packs.filter((p) => p.ready).map((p) => ({ path: `packs/${p.id}/index.html`, content: packPage(p, model, copy) })),
    { path: 'kits/index.html', content: kitsIndexPage(model, copy) },
    ...model.kits.map((k) => ({ path: `kits/${k.slug}/index.html`, content: kitPage(k, model, copy, assets.blockedUrls || []) })),
    ...model.kits.filter((k) => k.example).map((k) => ({ path: `kits/${k.slug}/example/index.html`, content: examplePage(k, model, copy) })),
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
