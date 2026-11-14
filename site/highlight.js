// 程式碼 → 已跳脫、帶上色標記的 HTML。產生站的時候做，瀏覽器不用再載東西。
// 只認註解、字串、關鍵字、shell 變數；不認得的語言照原樣輸出。
// 刻意不上色數字：把 10.1.2.3 切成幾段標籤，洩漏檢查就看不到它了。
const { escapeHtml } = require('./escape');

const JS_WORDS = 'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static switch this throw true try typeof undefined var void while yield'.split(' ');
const PY_WORDS = 'and as class def elif else except False finally for from if import in is lambda None not or pass raise return True try while with yield'.split(' ');

const QUOTED = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/;
const HASH_COMMENT = /(?<![^\s])#[^\n]*/;
const NEVER = /(?!)/;

const GRAMMARS = {
  c: { comment: /\/\/[^\n]*|\/\*[\s\S]*?\*\//, string: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/, variable: NEVER, words: JS_WORDS },
  css: { comment: /\/\*[\s\S]*?\*\//, string: QUOTED, variable: NEVER, words: [] },
  sh: { comment: HASH_COMMENT, string: QUOTED, variable: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/, words: [] },
  py: { comment: HASH_COMMENT, string: QUOTED, variable: NEVER, words: PY_WORDS },
  conf: { comment: HASH_COMMENT, string: QUOTED, variable: NEVER, words: [] },
};

const LANGS = {
  js: 'c', javascript: 'c', jsx: 'c', mjs: 'c', cjs: 'c', ts: 'c', typescript: 'c', tsx: 'c', json: 'c', jsonc: 'c',
  css: 'css', scss: 'css',
  sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', powershell: 'sh', ps1: 'sh',
  py: 'py', python: 'py',
  yaml: 'conf', yml: 'conf', toml: 'conf', ini: 'conf', env: 'conf', dotenv: 'conf',
};

const CLASSES = ['tk-c', 'tk-s', 'tk-v', 'tk-k'];

function tokenPattern(grammar) {
  const words = grammar.words.length ? `(?<![.\\w$])\\b(?:${grammar.words.join('|')})\\b(?![\\w$])` : NEVER.source;
  return new RegExp([grammar.comment.source, grammar.string.source, grammar.variable.source, words]
    .map((source) => `(${source})`).join('|'), 'g');
}

const PATTERNS = Object.fromEntries(Object.entries(GRAMMARS).map(([name, grammar]) => [name, tokenPattern(grammar)]));

function highlight(code, lang) {
  const text = String(code);
  const family = LANGS[String(lang || '').toLowerCase()];
  if (!family) return escapeHtml(text);
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PATTERNS[family])) {
    const kind = CLASSES[m.slice(1).findIndex((group) => group !== undefined)];
    parts.push(escapeHtml(text.slice(last, m.index)), `<span class="${kind}">${escapeHtml(m[0])}</span>`);
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join('');
}

module.exports = { highlight };
