// registry + packs.json + 從 GitHub 抓到的 repo 資料 → 頁面要用的資料。純函式。
// 不公開或抓不到的 repo 在這裡就被濾掉：名字、說明、README 都不會往下傳。
const packsLib = require('../packs');

function toKit(entry, repo, packIds) {
  return {
    name: entry.name,
    slug: entry.name.toLowerCase(),
    covers: entry.covers || '',
    type: entry.type || 'kit',
    keywords: entry.keywords || [],
    repo: entry.repo,
    install: entry.install,
    branch: repo.branch,
    readme: repo.readme || '',
    hasSkill: !!repo.hasSkill,
    logo: repo.logo || null,
    packs: packIds,
  };
}

function toPack(pack, kitsByName, owner) {
  const visible = pack.kits.filter((m) => kitsByName.has(m.name));
  const hidden = pack.kits.length - visible.length;
  const members = visible.map((m) => ({ ...kitsByName.get(m.name), role: m.role }));
  const missing = members.filter((m) => !m.hasSkill).map((m) => ({ name: m.name, reason: 'no-skill' }));
  return {
    ...pack,
    kits: visible,
    members,
    hidden,
    missing,
    ready: hidden === 0 && missing.length === 0,
    addCommand: packsLib.addCommand(pack, owner),
    installCommand: packsLib.installCommand({ ...pack, kits: visible }, members, owner),
    prompt: packsLib.aiPrompt({ ...pack, kits: visible }, owner),
  };
}

function buildModel({ registry, packs, repos, asOf }) {
  const owner = registry.owner;
  // 兩邊都要說公開才算：GitHub 回報公開，而且 registry 沒標 private
  const flaggedPrivate = new Set(registry.kits.filter((k) => k.private).map((k) => k.name));
  const isPublic = (name) => !flaggedPrivate.has(name) && !!repos[name] && repos[name].public === true;
  const packIdsOf = (name) => packs.filter((p) => p.kits.some((m) => m.name === name)).map((p) => p.id);

  const kits = registry.kits
    .filter((entry) => isPublic(entry.name))
    .map((entry) => toKit(entry, repos[entry.name], packIdsOf(entry.name)));
  const kitsByName = new Map(kits.map((k) => [k.name, k]));
  const sitePacks = packs.map((p) => toPack(p, kitsByName, owner));

  return {
    owner,
    asOf,
    kits,
    packs: sitePacks,
    stats: {
      kits: kits.length,
      readyPacks: sitePacks.filter((p) => p.ready).length,
      withSkill: kits.filter((k) => k.hasSkill).length,
    },
  };
}

module.exports = { buildModel };
