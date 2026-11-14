// 搜尋比對。瀏覽器（掛在 window.kitkitRank）與測試（require）共用同一份。
// entries: [{ t 標題, d 說明, u 網址, k 種類, x 其他可搜尋的字 }]
(function (scope) {
  var LIMIT = 12;

  function score(entry, query, terms) {
    var title = entry.t.toLowerCase();
    if (title === query) return 0;
    if (title.indexOf(query) === 0) return 1;
    if (terms.some(function (term) { return title.indexOf(term) !== -1; })) return 2;
    return 3;
  }

  function rank(entries, rawQuery) {
    var query = String(rawQuery || '').trim().toLowerCase();
    var terms = query.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries
      .map(function (entry, order) {
        var hay = (entry.t + ' ' + entry.d + ' ' + entry.x).toLowerCase();
        var hit = terms.every(function (term) { return hay.indexOf(term) !== -1; });
        return hit ? { entry: entry, order: order, score: score(entry, query, terms) } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return a.score - b.score || a.order - b.order; })
      .slice(0, LIMIT)
      .map(function (found) { return found.entry; });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { rank: rank };
  else scope.kitkitRank = rank;
})(typeof window !== 'undefined' ? window : this);
