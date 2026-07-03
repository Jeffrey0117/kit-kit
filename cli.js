#!/usr/bin/env node
// kit-kit CLI —  list / check / new
//   kit-kit list                          列出現有 kit（registry + 選用 gh 即時撈）
//   kit-kit check "使用者登入 密碼"        查有沒有現成 kit 能用（有→強化，沒有→抽）
//   kit-kit new <name> [--desc "..."] [--repo]   抽新 kit（scaffold；--repo 連 GitHub 一起建）
const path = require('path');
const forge = require('./index');

const [, , cmd, ...rest] = process.argv;
const flag = (n) => { const i = rest.indexOf('--' + n); return i >= 0 ? (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true) : undefined; };

function main() {
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
        forge.addToRegistry(null, { name, covers: desc || '', repo: `https://github.com/${reg.owner}/${name}`, install: `npm i github:${reg.owner}/${name}`, keywords: [] });
        console.log(`   ✅ https://github.com/${reg.owner}/${name}（已加進 registry）`);
      } catch (e) { console.error('   ✗ publish 失敗：', e.message); }
    } else {
      console.log('   （加 --repo 可連 GitHub 一起建）');
    }
    console.log('   下一步：填 index.js 實作 + README wiring + example.js\n');
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
  kit-kit new <name> [--desc] [--repo]  抽新 kit（scaffold；--repo 一起建 GitHub）
  kit-kit update <kit> [--dir path]     補/更新現有 kit（clone 下來改 → commit+push）
`);
}

main();
