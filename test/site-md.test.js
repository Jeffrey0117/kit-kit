const test = require('node:test');
const assert = require('node:assert');
const { renderMarkdown, escapeHtml } = require('../site/md');

const CTX = { repoUrl: 'https://github.com/o/r/blob/master', rawUrl: 'https://raw.githubusercontent.com/o/r/master' };
const md = (s) => renderMarkdown(s, CTX);

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.strictEqual(escapeHtml(`<a href="x">'&</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;');
});

test('raw HTML blocks are dropped, not passed through', () => {
  const out = md('<p align="center">\n  <img src="logo.svg" width="96">\n</p>\n\n# 標題\n\n<script>alert(1)</script>\n\n內文');
  assert.ok(!out.includes('<script'));
  assert.ok(!out.includes('align='));
  assert.ok(!out.includes('alert(1)'));
  assert.ok(out.includes('<h1>標題</h1>'));
  assert.ok(out.includes('<p>內文</p>'));
});

test('inline HTML inside a paragraph is escaped', () => {
  assert.ok(md('這是 <b>粗</b> 字').includes('&lt;b&gt;粗&lt;/b&gt;'));
});

test('javascript: links get no href', () => {
  const out = md('[點我](javascript:alert(1))');
  assert.ok(!/href="javascript/i.test(out));
  assert.ok(!out.includes('<a '), 'a link with a non-http scheme must not become a link at all');
  assert.ok(out.includes('點我'));
  assert.ok(!md('[x](data:text/html,hi)').includes('<a '));
  assert.ok(!md('[x](//evil.example/a)').includes('<a '));
});

test('http links keep their href and relative links point at the repo', () => {
  assert.ok(md('[x](https://a.b/c)').includes('<a href="https://a.b/c">x</a>'));
  assert.ok(md('[x](docs/a.md)').includes('<a href="https://github.com/o/r/blob/master/docs/a.md">x</a>'));
  assert.ok(md('[x](#api)').includes('<a href="#api">x</a>'));
});

test('relative images resolve against the raw URL', () => {
  assert.ok(md('![圖](shots/a.png)').includes('<img src="https://raw.githubusercontent.com/o/r/master/shots/a.png" alt="圖"'));
});

test('fenced code is escaped and not formatted', () => {
  const out = md('```js\nconst a = "<b>"; // **不是粗體**\n```');
  assert.ok(out.includes('<pre><code>const a = &quot;&lt;b&gt;&quot;; // **不是粗體**</code></pre>'));
});

test('inline code and bold are converted', () => {
  const out = md('用 `check(key)` 做 **限流**');
  assert.ok(out.includes('<code>check(key)</code>'));
  assert.ok(out.includes('<strong>限流</strong>'));
});

test('inline code content is not treated as markup', () => {
  assert.ok(md('`**a** <i>`').includes('<code>**a** &lt;i&gt;</code>'));
});

test('tables render with header and body cells', () => {
  const out = md('| 方法 | 說明 |\n|---|---|\n| `a()` | 甲 |\n| `b()` | 乙 |');
  assert.strictEqual(out.match(/<th>/g).length, 2);
  assert.strictEqual(out.match(/<td>/g).length, 4);
  assert.ok(out.includes('<td><code>a()</code></td>'));
});

test('unordered and ordered lists render items with inline formatting', () => {
  const ul = md('- 甲 `x`\n- 乙');
  assert.ok(ul.includes('<ul>') && ul.includes('<li>甲 <code>x</code></li>') && ul.includes('<li>乙</li>'));
  const ol = md('1. 一\n2. 二');
  assert.ok(ol.includes('<ol>') && ol.includes('<li>一</li>'));
});

test('a list item continues over indented lines', () => {
  const out = md('- 第一行\n  接續\n- 第二項');
  assert.strictEqual(out.match(/<li>/g).length, 2);
  assert.ok(out.includes('第一行 接續'));
});

test('blockquotes and rules render', () => {
  assert.ok(md('> 引用 **重點**').includes('<blockquote><p>引用 <strong>重點</strong></p></blockquote>'));
  assert.ok(md('上\n\n---\n\n下').includes('<hr>'));
});

test('headings are capped to h2–h5 when a base level is given', () => {
  const out = renderMarkdown('# 一\n\n## 二', { ...CTX, headingOffset: 1 });
  assert.ok(out.includes('<h2>一</h2>') && out.includes('<h3>二</h3>'));
});

test('empty or missing input renders nothing', () => {
  assert.strictEqual(md(''), '');
  assert.strictEqual(renderMarkdown(undefined, CTX), '');
});
