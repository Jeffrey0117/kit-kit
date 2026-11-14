// 介紹站的瀏覽器端行為：複製、深淺色、手機側欄、搜尋、本頁目錄跟著捲動。
// 沒有這支腳本，頁面照樣能讀、連結照樣能點。
(function () {
  var RESET_MS = 1600;
  var THEME_KEY = 'kk-theme';
  var doc = document.documentElement;
  var root = doc.dataset.root || '';

  // ── 複製 ──
  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }

  function selectCode(button) {
    var code = button.parentElement.querySelector('code');
    if (!code) return;
    var range = document.createRange();
    range.selectNodeContents(code);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function onCopyClick(button) {
    var label = button.dataset.label || button.textContent;
    button.dataset.label = label;
    var text = button.dataset.copy !== undefined ? button.dataset.copy : button.parentElement.querySelector('code').textContent;
    copyText(text).then(function () {
      button.textContent = button.dataset.done;
      button.classList.add('done');
      setTimeout(function () {
        button.textContent = label;
        button.classList.remove('done');
      }, RESET_MS);
    }).catch(function () {
      // 複製不了就把文字選起來，讓人自己按 Ctrl+C
      selectCode(button);
    });
  }

  // README 裡的程式碼區塊也補上複製鈕
  function addCodeCopyButtons() {
    var label = document.body.dataset.copyLabel;
    var done = document.body.dataset.copyDone;
    if (!label) return;
    Array.prototype.forEach.call(document.querySelectorAll('.prose pre'), function (pre) {
      var box = document.createElement('div');
      box.className = 'copybox';
      pre.parentNode.insertBefore(box, pre);
      box.appendChild(pre);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy';
      button.setAttribute('data-code-copy', '');
      button.dataset.done = done;
      button.textContent = label;
      box.appendChild(button);
    });
  }

  // ── 深淺色 ──
  function currentTheme() {
    if (doc.dataset.theme) return doc.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    doc.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* 存不了就只管這一頁 */ }
  }

  // ── 手機側欄 ──
  function setNav(open) {
    doc.classList.toggle('nav-open', open);
    var toggle = document.querySelector('[data-nav-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var backdrop = document.querySelector('.nav-backdrop');
    if (open && !backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'nav-backdrop';
      backdrop.setAttribute('data-nav-close', '');
      backdrop.setAttribute('aria-label', toggle ? toggle.getAttribute('aria-label') : '');
      document.body.appendChild(backdrop);
    }
  }

  // ── 搜尋 ──
  var dialog = document.getElementById('kk-search');
  var input = document.getElementById('kk-search-input');
  var list = document.getElementById('kk-search-results');
  var active = 0;

  function resultItem(entry, isActive) {
    var item = document.createElement('li');
    var link = document.createElement('a');
    link.href = root + entry.u;
    if (isActive) link.className = 'active';
    [['rt', entry.t], ['rk', entry.k], ['rd', entry.d]].forEach(function (part) {
      var span = document.createElement('span');
      span.className = part[0];
      span.textContent = part[1];
      link.appendChild(span);
    });
    item.appendChild(link);
    return item;
  }

  function renderResults() {
    var rank = window.kitkitRank;
    var query = input.value;
    var found = rank ? rank(window.KITKIT_INDEX || [], query) : [];
    active = Math.max(0, Math.min(active, found.length - 1));
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!found.length && query.trim()) {
      var none = document.createElement('li');
      none.className = 'none';
      none.textContent = list.dataset.empty;
      list.appendChild(none);
      return;
    }
    found.forEach(function (entry, i) { list.appendChild(resultItem(entry, i === active)); });
    var current = list.querySelector('a.active');
    if (current) current.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    if (!dialog || typeof dialog.showModal !== 'function' || dialog.open) return;
    setNav(false);
    dialog.showModal();
    input.value = '';
    active = 0;
    renderResults();
    input.focus();
  }

  function onSearchKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active += event.key === 'ArrowDown' ? 1 : -1;
      renderResults();
    } else if (event.key === 'Enter') {
      var current = list.querySelector('a.active');
      if (current) { event.preventDefault(); window.location.href = current.href; }
    }
  }

  if (dialog && input) {
    input.addEventListener('input', function () { active = 0; renderResults(); });
    input.addEventListener('keydown', onSearchKey);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  }

  function isTyping(target) {
    return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  }

  // ── 本頁目錄跟著捲動 ──
  function watchOutline() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (link) { byId[decodeURIComponent(link.hash.slice(1))] = link; });
    var headings = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      var first = headings.filter(function (h) { return visible[h.id]; })[0];
      if (!first) return;
      links.forEach(function (link) { link.classList.toggle('active', link === byId[first.id]); });
    }, { rootMargin: '-64px 0px -60% 0px' });
    headings.forEach(function (h) { observer.observe(h); });
  }

  // ── 事件 ──
  document.addEventListener('click', function (event) {
    var target = event.target;
    var copyButton = target.closest('button[data-copy], button[data-code-copy]');
    if (copyButton) return onCopyClick(copyButton);
    if (target.closest('[data-search-open]')) return openSearch();
    if (target.closest('[data-theme-toggle]')) return toggleTheme();
    if (target.closest('[data-nav-toggle]')) return setNav(!doc.classList.contains('nav-open'));
    if (target.closest('[data-nav-close]') || target.closest('.sidebar a')) return setNav(false);
    return undefined;
  });

  document.addEventListener('keydown', function (event) {
    var wantsSearch = ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
      || (event.key === '/' && !isTyping(event.target));
    if (wantsSearch) { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') setNav(false);
  });

  addCodeCopyButtons();
  watchOutline();
})();
