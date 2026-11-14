// 資料模型 → 整個站的檔案清單 [{ path, content }]。純函式（樣式與腳本由呼叫端傳入）。
const { escapeHtml: e, renderMarkdown, renderInline } = require('./md');

const TYPE_ORDER = ['kit', 'component', 'template', 'service'];
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700;900&display=swap';

const kitHref = (root, kit) => `${root}kits/${kit.slug}/index.html`;
const packHref = (root, pack) => `${root}packs/${pack.id}/index.html`;
const pad2 = (n) => String(n).padStart(2, '0');

function layout({ root, title, description, body, model, copy }) {
  const github = `https://github.com/${model.owner}/kit-kit`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body>
<div class="wrap">
  <nav class="topbar" aria-label="網站">
    <a class="brand" href="${root}index.html">${e(copy.nav.home)}</a>
    <div class="links">
      <a href="${root}index.html#packs">${e(copy.nav.packs)}</a>
      <a href="${root}index.html#kits">${e(copy.nav.kits)}</a>
      <a href="${github}">${e(copy.nav.github)}</a>
    </div>
  </nav>
${body}
  <footer>
    <span>${e(copy.footer.source)} · ${e(copy.home.asOf)} ${e(model.asOf)}</span>
    <span><a href="${github}">${e(model.owner)}/kit-kit</a> · ${e(copy.footer.license)}</span>
  </footer>
</div>
<script src="${root}assets/app.js" defer></script>
</body>
</html>
`;
}

function copyBox(text, copy, { wrap = false } = {}) {
  return `<div class="copybox">
  <pre${wrap ? ' class="wrap"' : ''}><code>${e(text)}</code></pre>
  <button type="button" class="copy" data-copy="${e(text)}" data-done="${e(copy.copy.done)}">${e(copy.copy.button)}</button>
</div>`;
}

// 主視覺物件：這一包的裝箱單
function slip(pack, copy) {
  const items = pack.members.map((m, i) => `
      <li><span class="no">${pad2(i + 1)}</span><span class="k">${e(m.name)}</span><span class="r">${e(m.role)}</span></li>`).join('');
  return `<div class="slip">
    <div class="head"><span class="title">${e(copy.slip.title)}</span><span class="code">PACK / ${e(pack.id)}</span></div>
    <div class="name">${e(pack.name)}</div>
    <hr>
    <ol class="items">${items}
    </ol>
    <hr>
    <div class="row"><span>${e(copy.slip.skills)}</span><span>${pack.members.length} ${e(copy.slip.skillsUnit)}</span></div>
    <div class="row"><span>${e(copy.slip.steps)}</span><span>${pack.steps.length} ${e(copy.slip.stepsUnit)}</span></div>
    <hr>
    <div class="cmd">$ ${e(pack.addCommand)}</div>
  </div>`;
}

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
  const body = `  <header class="hero">
    <div>
      <p class="eyebrow">${e(copy.home.eyebrow)}</p>
      <h1>${e(copy.home.title)}</h1>
      <p class="lede">${e(copy.home.lede)}</p>
      <div class="facts">
        <div class="fact"><b>${model.stats.readyPacks}</b><span>${e(copy.home.factPacks)}</span></div>
        <div class="fact"><b>${model.stats.kits}</b><span>${e(copy.home.factKits)}</span></div>
        <div class="fact"><b>${model.stats.withSkill}</b><span>${e(copy.home.factSkill)}</span></div>
      </div>
      <p class="asof">${e(copy.home.asOf)} ${e(model.asOf)}</p>
      <div class="cta"><a class="btn primary" href="#packs">${e(copy.home.ctaPacks)}</a><a class="btn ghost" href="#kits">${e(copy.nav.kits)}</a></div>
    </div>
    ${lead ? `<div class="object-col">${slip(lead, copy)}</div>` : ''}
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
  return layout({ root, title: `${copy.site.name} — ${copy.home.title}`, description: copy.site.description, body, model, copy });
}

function packPage(pack, model, copy) {
  const root = '../../';
  const steps = pack.steps.map((s) => `<li><span>${renderInline(s)}</span></li>`).join('\n      ');
  const members = pack.members.map((m) => `<a class="member" href="${kitHref(root, m)}">
        <h3>${e(m.name)}</h3>
        <p class="role">${e(m.role)}</p>
        <p>${e(m.covers)}</p>
      </a>`).join('\n      ');
  const body = `  <header class="hero">
    <div>
      <p class="eyebrow"><a href="${root}index.html#packs">${e(copy.pack.back)}</a> / ${e(copy.pack.eyebrow)}</p>
      <h1>${e(pack.name)}</h1>
      <p class="lede">${e(pack.solves)}</p>
      <div class="hero-copy">${copyBox(pack.addCommand, copy)}</div>
    </div>
    <div class="object-col">${slip(pack, copy)}</div>
  </header>

  <section>
    <div class="sec-head"><h2>${e(copy.pack.stepsTitle)}</h2><p>${e(copy.pack.stepsLede)}</p></div>
    <ol class="flow">
      ${steps}
    </ol>
  </section>

  <section>
    <div class="sec-head"><h2>${e(copy.pack.waysTitle)}</h2></div>
    ${ways(pack, copy)}
  </section>

  <section>
    <div class="sec-head"><h2>${e(copy.pack.membersTitle)}</h2></div>
    <div class="members">
      ${members}
    </div>
  </section>`;
  return layout({ root, title: `${pack.name}套組 — ${copy.site.name}`, description: pack.solves, body, model, copy });
}

// README 的第一個大標題跟頁面標題重複，拿掉
function dropTitle(md) {
  const lines = String(md).split(/\r?\n/);
  const i = lines.findIndex((l) => /^#\s+/.test(l) || /^\s*(```|~~~)/.test(l));
  if (i < 0 || !/^#\s+/.test(lines[i])) return md;
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
}

function kitPage(kit, model, copy) {
  const root = '../../';
  const blob = `${kit.repo}/blob/${kit.branch}`;
  const raw = `https://raw.githubusercontent.com/${model.owner}/${kit.name}/${kit.branch}`;
  const packLinks = kit.packs.map((id) => model.packs.find((p) => p.id === id)).map((p) => (p.ready
    ? `<a class="chip" href="${packHref(root, p)}">${e(p.name)}</a>`
    : `<span class="chip dim">${e(p.name)}</span>`)).join('');
  const readme = renderMarkdown(dropTitle(kit.readme), { repoUrl: blob, rawUrl: raw });
  const body = `  <header class="kit-head">
    <div>
      <p class="eyebrow"><a href="${root}index.html#kits">${e(copy.kit.back)}</a> / ${e(copy.types[kit.type] || kit.type)}</p>
      <h1>${e(kit.name)}</h1>
      <p class="lede">${e(kit.covers)}</p>
      ${packLinks ? `<div class="meta"><span class="label">${e(copy.kit.inPacks)}</span><div class="chips">${packLinks}</div></div>` : ''}
      <div class="cta">
        <a class="btn primary" href="${e(kit.repo)}">${e(copy.kit.repo)}</a>
        ${kit.hasSkill ? `<a class="btn ghost" href="${blob}/SKILL.md">${e(copy.kit.skillLink)}</a>` : ''}
      </div>
    </div>
    ${kit.logo ? `<img class="logo" src="${root}assets/logos/${kit.slug}.svg" alt="" width="120" height="120">` : ''}
  </header>

  <section>
    <div class="sec-head"><h2>${e(copy.kit.installTitle)}</h2></div>
    ${copyBox(kit.install, copy)}
  </section>

  <section>
    <div class="sec-head"><h2>${e(copy.kit.readmeTitle)}</h2></div>
    <div class="prose">${readme || `<p>${e(copy.kit.noReadme)}</p>`}</div>
  </section>`;
  return layout({ root, title: `${kit.name} — ${copy.site.name}`, description: kit.covers, body, model, copy });
}

function renderSite(model, copy, assets) {
  const pages = [
    { path: 'index.html', content: homePage(model, copy) },
    ...model.packs.filter((p) => p.ready).map((p) => ({ path: `packs/${p.id}/index.html`, content: packPage(p, model, copy) })),
    ...model.kits.map((k) => ({ path: `kits/${k.slug}/index.html`, content: kitPage(k, model, copy) })),
  ];
  const logos = model.kits.filter((k) => k.logo).map((k) => ({ path: `assets/logos/${k.slug}.svg`, content: k.logo }));
  return [
    ...pages,
    { path: 'assets/style.css', content: assets.css },
    { path: 'assets/app.js', content: assets.js },
    ...logos,
  ];
}

module.exports = { renderSite };
