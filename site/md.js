// markdown → HTML，只做各 kit README 用得到的語法。零依賴。
// 安全原則：所有文字先跳脫；原始 HTML 區塊整塊丟掉；連結只放行 http(s)、相對路徑、#錨點。

const { escapeHtml } = require('./escape');
const { highlight } = require('./highlight');

const RE = {
  fence: /^\s*(```|~~~)/,
  heading: /^(#{1,6})\s+(.+?)\s*#*\s*$/,
  rule: /^\s*(-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^\s*>\s?/,
  listItem: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
  html: /^\s*<\/?[a-zA-Z!]/,
  tableDivider: /^[\s|:-]+$/,
};

// 已跳脫的網址 → 可以放進 href/src 的網址；不放行的回 null
// 不該連過去的網址（例如沒公開的 repo）：完全相同，或是它底下的路徑
function isBlocked(url, blocked) {
  const u = url.toLowerCase();
  return blocked.some((b) => {
    const prefix = b.toLowerCase();
    return u === prefix || ['/', '#', '?'].some((sep) => u.startsWith(prefix + sep));
  });
}

function resolveUrl(url, base, blocked = []) {
  if (isBlocked(url, blocked)) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('#')) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null;
  return base ? `${base}/${url.replace(/^\.?\//, '')}` : null;
}

function inline(text, ctx) {
  const codes = [];
  const held = String(text).replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  return escapeHtml(held)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt, url) => {
      const src = resolveUrl(url, ctx.rawUrl, ctx.blockedUrls);
      return src ? `<img src="${src}" alt="${alt}" loading="lazy">` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, label, url) => {
      const href = resolveUrl(url, ctx.repoUrl, ctx.blockedUrls);
      return href ? `<a href="${href}">${label}</a>` : label;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

function splitRow(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
  return cells.map((c) => c.trim().replace(/\\\|/g, '|'));
}

function isTableStart(lines, i) {
  const next = lines[i + 1];
  return lines[i].includes('|') && next !== undefined
    && RE.tableDivider.test(next) && next.includes('-') && next.includes('|');
}

function startsBlock(lines, i) {
  const line = lines[i];
  return RE.fence.test(line) || RE.heading.test(line) || RE.rule.test(line) || RE.quote.test(line)
    || RE.listItem.test(line) || RE.html.test(line) || isTableStart(lines, i);
}

function readFence(lines, start) {
  const marker = lines[start].match(RE.fence)[1];
  const info = lines[start].trim().slice(marker.length).trim().split(/\s+/)[0].toLowerCase();
  const lang = /^[a-z0-9+-]+$/.test(info) ? info : '';
  const body = [];
  let i = start + 1;
  while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
  const code = body.join('\n');
  const html = lang
    ? `<pre data-lang="${lang}"><code class="language-${lang}">${highlight(code, lang)}</code></pre>`
    : `<pre><code>${escapeHtml(code)}</code></pre>`;
  return { html, next: i + 1 };
}

// 標題文字 → 可以當錨點的 id（本頁目錄要連過來）。同一頁重複的標題加上 -2、-3。
function slugify(text) {
  return String(text)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function headingId(text, used) {
  const base = slugify(text) || 'section';
  const count = (used.get(base) || 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function readTable(lines, start, ctx) {
  const head = splitRow(lines[start]);
  const rows = [];
  let i = start + 2;
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
  const th = head.map((c) => `<th>${inline(c, ctx)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join('')}</tr>`).join('');
  return { html: `<div class="table-scroll"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`, next: i };
}

function readQuote(lines, start, ctx) {
  const body = [];
  let i = start;
  while (i < lines.length && RE.quote.test(lines[i])) body.push(lines[i++].replace(RE.quote, ''));
  return { html: `<blockquote>${blocks(body, ctx)}</blockquote>`, next: i };
}

// 清單：同層的標記開新項目；縮排的內容接在目前項目後面（巢狀清單、程式碼交給遞迴處理）
function readList(lines, start, ctx) {
  const first = lines[start].match(RE.listItem);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(RE.listItem);
    const indent = line.match(/^\s*/)[0].length;
    if (!line.trim()) {
      const ahead = lines.slice(i + 1).find((l) => l.trim());
      const continues = ahead !== undefined && (ahead.match(/^\s*/)[0].length > baseIndent
        || (RE.listItem.test(ahead) && ahead.match(/^\s*/)[0].length === baseIndent));
      if (!continues) break;
      if (items.length && items[items.length - 1].children.length) items[items.length - 1].children.push('');
      i++;
    } else if (m && indent <= baseIndent + 1) {
      if (indent < baseIndent) break;
      items.push({ text: [m[3]], children: [] });
      i++;
    } else if (indent > baseIndent && items.length) {
      const item = items[items.length - 1];
      const nested = m || RE.fence.test(line) || item.children.length;
      if (nested) item.children.push(line.slice(Math.min(indent, baseIndent + 2)));
      else item.text.push(line.trim());
      i++;
    } else {
      break;
    }
  }
  const tag = ordered ? 'ol' : 'ul';
  const html = items.map((it) => {
    const nested = it.children.length ? blocks(it.children, ctx) : '';
    return `<li>${inline(it.text.join(' '), ctx)}${nested}</li>`;
  }).join('');
  return { html: `<${tag}>${html}</${tag}>`, next: i };
}

function readParagraph(lines, start, ctx) {
  const body = [lines[start]];
  let i = start + 1;
  while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) body.push(lines[i++]);
  return { html: `<p>${inline(body.map((l) => l.trim()).join('\n'), ctx)}</p>`, next: i };
}

function skipHtml(lines, start) {
  let i = start;
  while (i < lines.length && lines[i].trim()) i++;
  return { html: '', next: i };
}

function readBlock(lines, i, ctx) {
  const line = lines[i];
  if (RE.fence.test(line)) return readFence(lines, i);
  if (RE.html.test(line)) return skipHtml(lines, i);
  const h = line.match(RE.heading);
  if (h) {
    const level = Math.min(h[1].length + (ctx.headingOffset || 0), 6);
    const id = headingId(h[2], ctx.usedIds);
    return { html: `<h${level} id="${escapeHtml(id)}">${inline(h[2], ctx)}</h${level}>`, next: i + 1 };
  }
  if (RE.rule.test(line)) return { html: '<hr>', next: i + 1 };
  if (isTableStart(lines, i)) return readTable(lines, i, ctx);
  if (RE.quote.test(line)) return readQuote(lines, i, ctx);
  if (RE.listItem.test(line)) return readList(lines, i, ctx);
  return readParagraph(lines, i, ctx);
}

function blocks(lines, ctx) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const block = readBlock(lines, i, ctx);
    if (block.html) out.push(block.html);
    i = block.next;
  }
  return out.join('\n');
}

function renderMarkdown(md, ctx = {}) {
  if (!md) return '';
  // HTML 註解在 GitHub 上看不到，作者會當成私下的備註，所以整段拿掉（沒收尾的拿到檔尾）
  const visible = String(md).replace(/<!--[\s\S]*?(-->|$)/g, '');
  // usedIds 只活在這一次轉換裡，用來記這一頁已經發過哪些標題 id
  return blocks(visible.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), { ...ctx, usedIds: new Map() });
}

// 單行文字裡的 `code`、**粗體**、連結（接線步驟這種短句用）
function renderInline(text, ctx = {}) {
  return inline(String(text || ''), ctx);
}

module.exports = { renderMarkdown, renderInline, escapeHtml };
