// ============================================================================
// 套組（pack）— kit 上面那一層：做一件事要用的幾個 kit、接線順序、合在一起的打法。
// 定義在 packs.json；這裡是 CLI 與介紹站共用的純邏輯。
// ============================================================================
const fs = require('fs');
const path = require('path');

const DEFAULT_SKILLS_DIR = path.join('.claude', 'skills');
const INSTALLABLE = new Set(['kit', 'component']);
const REASON_TEXT = { unknown: '不在 registry', private: '未公開', 'no-skill': '還沒有打法' };

function loadPacks(packsPath) {
  const p = packsPath || path.join(__dirname, 'packs.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).packs;
}

function findPack(packs, query) {
  const q = String(query || '').trim().toLowerCase();
  return packs.find((p) => p.id.toLowerCase() === q || p.name.toLowerCase() === q) || null;
}

// registry 的旗標 → 每個 kit 是否公開、是否有 SKILL.md
function registryKitInfo(reg) {
  return Object.fromEntries(reg.kits.map((k) => [k.name, { public: !k.private, skill: !!k.skill }]));
}

function memberProblem(info) {
  if (!info) return 'unknown';
  if (!info.public) return 'private';
  if (!info.skill) return 'no-skill';
  return null;
}

// 可用 = 成員全部公開，且每個都有 SKILL.md
function packStatus(pack, kitInfo) {
  const missing = pack.kits
    .map((m) => ({ name: m.name, reason: memberProblem(kitInfo[m.name]) }))
    .filter((m) => m.reason);
  return { ready: missing.length === 0, missing };
}

function describeMissing(missing) {
  return missing.map((m) => `${m.name}（${REASON_TEXT[m.reason]}）`).join('、');
}

function skillName(pack) { return `${pack.id}-pack`; }

function skillRelPath(pack, skillsDir = DEFAULT_SKILLS_DIR) {
  return path.join(skillsDir, skillName(pack), 'SKILL.md');
}

function installCommand(pack, kits, owner) {
  const byName = new Map(kits.map((k) => [k.name, k]));
  const deps = pack.kits
    .map((m) => byName.get(m.name))
    .filter((k) => k && INSTALLABLE.has(k.type || 'kit'))
    .map((k) => `github:${owner}/${k.name}`);
  return deps.length ? `npm i ${deps.join(' ')}` : null;
}

function addCommand(pack, owner) {
  return `npx github:${owner}/kit-kit add ${pack.id}`;
}

function numbered(steps, indent = '') {
  return steps.map((s, i) => `${indent}${i + 1}. ${s}`).join('\n');
}

// 貼給 AI 助手的那段話
function aiPrompt(pack, owner) {
  const names = pack.kits.map((m) => m.name).join('、');
  return [
    `在這個專案接上「${pack.name}」套組（${names}）。`,
    `1. 執行：${addCommand(pack, owner)}`,
    `2. 讀 ${skillRelPath(pack).split(path.sep).join('/')}，裡面有每個 kit 的打法與地雷。`,
    '3. 照這個順序接線：',
    numbered(pack.steps, '   '),
    '接完跑一次專案的測試，再告訴我還需要我提供哪些環境變數或金鑰。',
  ].join('\n');
}

function stripFrontmatter(md) {
  return String(md).replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

// 把成員的 SKILL.md 合成一份。缺任何一個就不寫，避免半套打法。
function composePackSkill(pack, skills, owner) {
  const absent = pack.kits.filter((m) => !skills[m.name]).map((m) => m.name);
  if (absent.length) throw new Error(`「${pack.name}」套組缺打法：${absent.join('、')}`);
  const names = pack.kits.map((m) => m.name).join('、');
  const head = [
    '---',
    `name: ${skillName(pack)}`,
    `description: ${pack.name}套組（${names}）。${pack.solves}做這類功能時先讀。`,
    '---',
    '',
    `# ${pack.name}套組`,
    '',
    pack.solves,
    '',
    '## 接線順序',
    '',
    numbered(pack.steps),
    '',
    '## 成員',
    '',
    pack.kits.map((m) => `- \`${m.name}\`（https://github.com/${owner}/${m.name}）— ${m.role}`).join('\n'),
  ].join('\n');
  const bodies = pack.kits.map((m) => `---\n\n<!-- ${m.name} 的打法 -->\n\n${stripFrontmatter(skills[m.name])}`);
  return [head, ...bodies].join('\n\n') + '\n';
}

module.exports = {
  loadPacks, findPack, registryKitInfo, packStatus, describeMissing,
  installCommand, addCommand, aiPrompt, composePackSkill,
  skillName, skillRelPath,
};
