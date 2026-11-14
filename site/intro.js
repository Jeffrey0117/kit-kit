// README → 開頭那一段介紹，純文字（kit 總覽頁的卡片用）。
// 只看第一個小節之前：標題、徽章圖、原始 HTML、分隔線、程式碼都跳過。
const MAX = 180;
const FENCE = /^\s*(```|~~~)/;

function plain(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function skipFence(lines, start) {
  const marker = lines[start].match(FENCE)[1];
  let i = start + 1;
  while (i < lines.length && !lines[i].trim().startsWith(marker)) i++;
  return i + 1;
}

function skipToBlank(lines, start) {
  let i = start;
  while (i < lines.length && lines[i].trim()) i++;
  return i;
}

function readParagraph(lines, start) {
  const body = [];
  let i = start;
  while (i < lines.length && lines[i].trim() && !/^#{1,6}\s/.test(lines[i]) && !FENCE.test(lines[i])) {
    body.push(lines[i].replace(/^\s*>\s?/, ''));
    i++;
  }
  return { text: plain(body.join(' ')), next: i };
}

function readmeIntro(md) {
  const lines = String(md || '').replace(/<!--[\s\S]*?(-->|$)/g, '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{2,6}\s/.test(line)) return '';
    if (!line.trim() || /^#\s/.test(line) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { i++; continue; }
    if (FENCE.test(line)) { i = skipFence(lines, i); continue; }
    if (/^\s*<\/?[a-zA-Z!]/.test(line) || /^\s*([-*+]|\d+[.)])\s/.test(line) || line.includes('|')) { i = skipToBlank(lines, i); continue; }
    const paragraph = readParagraph(lines, i);
    if (paragraph.text) return paragraph.text.length > MAX ? `${paragraph.text.slice(0, MAX)}…` : paragraph.text;
    i = Math.max(paragraph.next, i + 1);
  }
  return '';
}

module.exports = { readmeIntro };
