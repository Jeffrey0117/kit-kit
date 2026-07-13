#!/usr/bin/env node
// kit-kit CLI —  list / check / new
//   kit-kit list                          列出現有 kit（registry + 選用 gh 即時撈）
//   kit-kit check "使用者登入 密碼"        查有沒有現成 kit 能用（有→強化，沒有→抽）
//   kit-kit new <name> [--desc "..."] [--repo]   抽新 kit（scaffold；--repo 連 GitHub 一起建）
const path = require('path');
const forge = require('./index');

const [, , cmd, ...rest] = process.argv;
const flag = (n) => { const i = rest.indexOf('--' + n); return i >= 0 ? (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true) : undefined; };

// 互動勾選：印編號清單，讓使用者輸入要勾的（"1 3 5"）
function interactivePick(kits) {
  return new Promise((resolve) => {
    const readline = require('readline');
    console.log('\n勾選要組進來的 kit（輸入編號、空白分隔，例如「1 3 5」；Enter 跳過）：\n');
    kits.forEach((k, i) => console.log(`  ${String(i + 1).padStart(2)}. ${k.name.padEnd(18)} ${(k.type || 'kit').padEnd(9)} ${k.covers}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n> ', (ans) => {
      rl.close();
      const idx = String(ans).split(/\s+/).map((s) => parseInt(s, 10) - 1).filter((i) => i >= 0 && i < kits.length);
      resolve(idx.map((i) => kits[i].name));
    });
  });
}

async function main() {
  const reg = forge.loadRegistry();

  if (cmd === 'list') {
    console.log(`\n📦 現有 kit（owner: ${reg.owner}）\n`);
    for (const k of reg.kits) console.log(`  • ${k.name.padEnd(16)} ${k.covers}\n    ${k.repo}`);
    const live = forge.syncFromGitHub(reg.owner);
    if (live) {
      const known = new Set(reg.kits.map((k) => k.name));
      const extra = live.filter((r) => !known.has(r.name));
      if (extra.length) { console.log('\n  （GitHub 上還有、registry 沒登錄的）'); extra.forEach((r) => console.log(`  • ${r.name} — ${r.description || ''}`)); }
    }
    console.log('');
    return;
  }

  if (cmd === 'check') {
    const q = rest.filter((a) => !a.startsWith('--')).join(' ');
    if (!q) return console.error('用法: kit-kit check "描述或關鍵字"');
    const r = forge.recommend(q, reg.kits);
    console.log(`\n🔎 查詢：${q}\n`);
    if (r.action === 'reuse') {
      console.log(`✅ 已有 kit 涵蓋 → 去「強化/補充/整合」，別重造：`);
      console.log(`   → ${r.kit.name}  (${r.kit.covers})`);
      console.log(`   → ${r.kit.repo}   [${r.kit.install}]`);
      console.log(`   命中：${r.why.join(', ')}`);
      if (r.kit.skill) console.log(`   📖 這顆有打法 → 先讀再接線：kit-kit skill ${r.kit.name}`);
    } else {
      console.log(`🆕 沒有現成 kit 涵蓋 → 建議「抽一個新 kit」：`);
      console.log(`   kit-kit new <name> --desc "..." --repo`);
    }
    const others = r.ranked.filter((x) => x.score > 0 && x.kit !== r.kit).slice(0, 3);
    if (others.length) { console.log('\n   相關：'); others.forEach((x) => console.log(`   - ${x.kit.name} (score ${x.score})`)); }
    console.log('');
    return;
  }

  if (cmd === 'new') {
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) return console.error('用法: kit-kit new <name> [--desc "..."] [--dir path] [--repo]');
    const desc = typeof flag('desc') === 'string' ? flag('desc') : undefined;
    // 先擋一下：跟現有 kit 是否重疊
    const r = forge.recommend(name + ' ' + (desc || ''), reg.kits);
    if (r.action === 'reuse') {
      console.log(`\n⚠️  可能已有 kit 涵蓋：${r.kit.name} (${r.kit.repo})`);
      console.log(`   若只是強化它就別開新 repo。要照樣建就加 --force。\n`);
      if (!flag('force')) return;
    }
    const dir = typeof flag('dir') === 'string' ? path.resolve(flag('dir'), name) : undefined;
    const out = forge.scaffold(name, dir, { description: desc, force: !!flag('force') });
    console.log(`\n🆕 scaffold ${name} → ${out.dir}`);
    console.log(`   寫入：${out.written.join(', ')}`);
    if (flag('repo')) {
      console.log('   建立 GitHub repo…');
      try {
        forge.publish(out.dir, name, desc || '');
        const entry = { name, covers: desc || '', repo: `https://github.com/${reg.owner}/${name}`, install: `npm i github:${reg.owner}/${name}`, keywords: [], skill: true };
        // npx 跑的時候 __dirname 是快取、寫了會蒸發 → 拉真的 kit-kit repo 登錄再 push 回去
        try {
          const os = require('os');
          const cp = require('child_process');
          const kkDir = forge.pullKit('kit-kit', path.join(os.homedir(), '.kit-kit', 'kit-kit'), reg.owner);
          forge.addToRegistry(path.join(kkDir, 'registry.json'), entry);
          cp.execSync(`git commit -aqm "registry: + ${name}" && git push -q`, { cwd: kkDir, shell: true });
          console.log(`   ✅ https://github.com/${reg.owner}/${name}（registry 已登錄並 push）`);
        } catch (e2) {
          forge.addToRegistry(null, entry);
          console.log(`   ⚠️ registry push 失敗（${e2.message.split('\n')[0]}）— 只寫到本地副本，記得去 kit-kit repo 補登錄`);
        }
      } catch (e) { console.error('   ✗ publish 失敗：', e.message); }
    } else {
      console.log('   （加 --repo 可連 GitHub 一起建）');
    }
    console.log('   下一步：填 index.js 實作 + README wiring + example.js + SKILL.md（打法/文案/模式）\n');
    return;
  }

  if (cmd === 'skill') {
    // kit ↔ skill 綁定：kit 是能力（code），SKILL.md 是打法（何時用/怎麼接/文案怎麼寫）
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) return console.error('用法: kit-kit skill <kit>');
    const md = forge.fetchSkill(name, reg.owner);
    if (!md) {
      console.log(`\n（${name} 還沒有 SKILL.md — 幫它補：kit-kit update ${name} → 寫 SKILL.md → push，registry 該 kit 加 "skill": true）\n`);
      return;
    }
    console.log('\n' + md.trim() + '\n');
    return;
  }

  if (cmd === 'map') {
    const base = rest.find((a) => !a.startsWith('--')) || require('path').resolve(__dirname, '..');
    const kitSet = new Set(reg.kits.map((k) => k.name.toLowerCase()));
    const dirs = forge.listProjectDirs(base).filter((d) => !kitSet.has(require('path').basename(d).toLowerCase()));
    const rows = forge.scanAdoption(dirs, reg.kits, reg.owner);
    const adopted = rows.filter((r) => r.used.length);
    console.log(`\n📊 kit 採用地圖　（掃 ${dirs.length} 個專案 @ ${base}）\n`);
    if (!adopted.length) console.log('  還沒有專案採用任何 kit。');
    adopted.forEach((r) => {
      const parts = [];
      if (r.dep.length) parts.push('dep: ' + r.dep.join(', '));
      if (r.embedded.length) parts.push('內嵌: ' + r.embedded.join(', '));
      console.log(`  ${r.project.padEnd(20)} ${parts.join('  |  ')}`);
    });
    const counts = {};
    rows.forEach((r) => r.used.forEach((n) => { counts[n] = (counts[n] || 0) + 1; }));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked.length) {
      console.log('\n  每個 kit 被幾個專案採用（dep+內嵌）：');
      ranked.forEach(([n, c]) => console.log(`    ${n.padEnd(22)} ${c}`));
    }
    const zero = reg.kits.map((k) => k.name).filter((n) => !counts[n]);
    if (zero.length) console.log(`\n  ⚠️ 還沒被採用（回套機會）：${zero.join(', ')}`);
    console.log(`\n  總採用數：${Object.values(counts).reduce((a, b) => a + b, 0)}（dep + 內嵌 copy）\n`);
    return;
  }

  if (cmd === 'init') {
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) return console.error('用法: kit-kit init <project> [--with a,b,c] [--dir path]');
    const withFlag = flag('with');
    let selected;
    if (typeof withFlag === 'string') selected = withFlag.split(',').map((s) => s.trim()).filter(Boolean);
    else selected = await interactivePick(reg.kits);
    if (!selected.length) return console.log('沒選任何 kit，取消。');
    const unknown = selected.filter((n) => !reg.kits.find((k) => k.name === n));
    if (unknown.length) console.log(`⚠️  registry 沒有：${unknown.join(', ')}（略過）`);
    const dir = typeof flag('dir') === 'string' ? require('path').resolve(flag('dir'), name) : undefined;
    const out = forge.initProject(name, dir, selected, reg.kits, reg.owner);
    console.log(`\n🚀 ${name} 起手完成 → ${out.dir}`);
    console.log(`   組進：${out.picked.join(', ')}`);
    console.log(`   deps：${Object.keys(out.deps).join(', ') || '(所選為 service/template，見 KITS.md)'}`);
    console.log(`   下一步：cd ${name} && npm i，再看 KITS.md 接線\n`);
    return;
  }

  if (cmd === 'update') {
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) return console.error('用法: kit-kit update <kit> [--dir path]');
    const known = reg.kits.find((k) => k.name === name);
    if (!known) console.log(`\n⚠️  「${name}」不在 registry；還是照 GitHub 上的 ${reg.owner}/${name} 抓抓看…`);
    const dir = typeof flag('dir') === 'string' ? require('path').resolve(flag('dir'), name) : undefined;
    try {
      const out = forge.pullKit(name, dir, reg.owner);
      console.log(`\n🔧 ${name} 已拉到 → ${out}`);
      console.log(`   補強/修/加功能後：cd 進去 → git commit -am "..." → git push`);
      if (known) console.log(`   （${known.covers}）`);
      console.log('');
    } catch (e) { console.error('   ✗ 拉取失敗：', e.message); }
    return;
  }

  console.log(`kit-kit 🍫 — 抽 kit 的 kit（kit²）
  kit-kit list                          列出現有 kit
  kit-kit check "描述/關鍵字"           有現成的就強化、沒有才抽
  kit-kit skill <kit>                   讀該 kit 的打法（SKILL.md：何時用/怎麼接/文案）
  kit-kit new <name> [--desc] [--repo]  抽新 kit（scaffold 含 SKILL.md；--repo 一起建 GitHub）
  kit-kit update <kit> [--dir path]     補/更新現有 kit（clone 下來改 → commit+push）
  kit-kit init <project> [--with a,b,c] 勾選 kit → 產一個已組好的專案骨架
  kit-kit map [baseDir]                 採用地圖：哪個專案用了哪些 kit + 誰還沒回套
`);
}

main();
