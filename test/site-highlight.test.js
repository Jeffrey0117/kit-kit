const test = require('node:test');
const assert = require('node:assert');
const { highlight } = require('../site/highlight');

const strip = (html) => html.replace(/<[^>]+>/g, '');

test('highlight marks comments, strings and keywords in JavaScript', () => {
  const out = highlight("const a = 'x'; // 註解", 'js');
  assert.ok(out.includes('<span class="tk-k">const</span>'));
  assert.ok(out.includes('<span class="tk-s">&#39;x&#39;</span>'));
  assert.ok(out.includes('<span class="tk-c">// 註解</span>'));
});

test('highlight never changes the text, only wraps it', () => {
  const code = 'if (a < b && c > "d") { return `t${x}`; } /* <b> */';
  assert.strictEqual(strip(highlight(code, 'ts')), strip(highlight(code, 'nope')));
  assert.ok(!highlight(code, 'js').includes('<b>'));
});

test('highlight leaves a keyword inside a string or a comment alone', () => {
  const out = highlight('"return" // const', 'js');
  assert.ok(!out.includes('tk-k'));
});

test('highlight does not treat a property name as a keyword', () => {
  assert.ok(!highlight('obj.default', 'js').includes('tk-k'));
});

test('highlight marks shell comments and variables but not a # inside a word', () => {
  const out = highlight('npm i a#b # 裝起來\necho $HOME', 'bash');
  assert.ok(out.includes('<span class="tk-c"># 裝起來</span>'));
  assert.ok(out.includes('a#b'));
  assert.ok(out.includes('<span class="tk-v">$HOME</span>'));
});

test('highlight keeps an IP address in one piece so the leak scan can still see it', () => {
  for (const lang of ['js', 'bash', 'python', 'json']) {
    assert.ok(highlight('host = 10.1.2.3', lang).includes('10.1.2.3'), lang);
  }
});

test('highlight escapes code in a language it does not know', () => {
  assert.strictEqual(highlight('<a href="x">', 'html'), '&lt;a href=&quot;x&quot;&gt;');
  assert.strictEqual(highlight('a < b', ''), 'a &lt; b');
});
