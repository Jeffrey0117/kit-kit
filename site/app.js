// 複製按鈕：data-copy 是要複製的文字，data-done 是成功後暫時顯示的字。
(function () {
  var RESET_MS = 1600;

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

  document.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-copy]');
    if (!button) return;
    var label = button.dataset.label || button.textContent;
    button.dataset.label = label;
    copyText(button.dataset.copy).then(function () {
      button.textContent = button.dataset.done;
      button.classList.add('done');
      setTimeout(function () {
        button.textContent = label;
        button.classList.remove('done');
      }, RESET_MS);
    }).catch(function () {
      // 複製不了就把文字選起來，讓人自己按 Ctrl+C
      var code = button.parentElement.querySelector('code');
      if (!code) return;
      var range = document.createRange();
      range.selectNodeContents(code);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  });
})();
