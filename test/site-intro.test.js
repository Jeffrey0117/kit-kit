const test = require('node:test');
const assert = require('node:assert');
const { readmeIntro } = require('../site/intro');

test('readmeIntro takes the first paragraph under the title as plain text', () => {
  const md = '# a-kit\n\n**一份設定**，用 `create()` 接上 [文件](https://a.b/c)。\n第二行。\n\n下一段不要。\n\n## 安裝';
  assert.strictEqual(readmeIntro(md), '一份設定，用 create() 接上 文件。 第二行。');
});

test('readmeIntro skips badges, raw HTML, images and rules before the first real sentence', () => {
  const md = '<p align="center">\n<img src="logo.svg">\n</p>\n\n# kit\n\n![badge](https://img.example/x.svg)\n\n---\n\n> 一句話說完它在做什麼。\n\n## 用法';
  assert.strictEqual(readmeIntro(md), '一句話說完它在做什麼。');
});

test('readmeIntro stops at the first section and never reads code', () => {
  assert.strictEqual(readmeIntro('# kit\n\n## 安裝\n\n這是安裝段落'), '');
  assert.strictEqual(readmeIntro('# kit\n\n```js\nconst a = 1\n```\n\n真正的介紹'), '真正的介紹');
});

test('readmeIntro shortens a long paragraph and marks that it was cut', () => {
  const out = readmeIntro(`# kit\n\n${'很長的介紹'.repeat(80)}`);
  assert.ok(out.length <= 181 && out.endsWith('…'));
});

test('readmeIntro of an empty or missing README is empty', () => {
  assert.strictEqual(readmeIntro(''), '');
  assert.strictEqual(readmeIntro(undefined), '');
});
