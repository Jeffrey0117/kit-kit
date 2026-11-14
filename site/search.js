// 資料模型 → 搜尋資料。只會有 model 裡的東西，所以沒公開的 kit 進不來。
function buildSearchIndex(model, copy) {
  const packName = new Map(model.packs.map((p) => [p.id, p.name]));
  const packs = model.packs.filter((p) => p.ready).map((p) => ({
    t: p.name,
    d: p.solves,
    u: `packs/${p.id}/index.html`,
    k: copy.search.kindPack,
    x: [p.id, ...p.members.flatMap((m) => [m.name, ...m.keywords])].join(' '),
  }));
  const kits = model.kits.map((k) => ({
    t: k.name,
    d: k.covers,
    u: `kits/${k.slug}/index.html`,
    k: copy.types[k.type] || k.type,
    x: [...k.keywords, ...k.packs.map((id) => packName.get(id))].join(' '),
  }));
  return [...packs, ...kits];
}

// 一個檔案：搜尋資料 + 比對函式。「<」寫成跳脫碼，資料裡的字就不可能提早結束 script。
function searchScript(entries, clientSource) {
  const data = JSON.stringify(entries).replace(/</g, '\\u003c');
  return `window.KITKIT_INDEX = ${data};\n${clientSource}`;
}

module.exports = { buildSearchIndex, searchScript };
