# kit-kit 🍫

**抽 kit 的 kit（kit²）。** 維護一套個人 kit 生態系 —— 別的專案跑它，它**熟知現有有哪些 kit**：
有涵蓋的就去**強化/補充/整合**，沒有的才**抽一個新 kit**。統一 scaffold + 一鍵建 GitHub repo。

> 遞迴的一環：funnel-kit / media-gate / auth-kit / ratelimit-kit 是「零件」，kit-kit 是「工廠 + 大腦」。
> 目標：每個專案都拿到最強、最完整版；改一次 kit，全體升級（複利）。

## 用法

```bash
npx github:Jeffrey0117/kit-kit list                    # 現有有哪些 kit
npx github:Jeffrey0117/kit-kit check "使用者登入 密碼"  # 有現成的嗎？→ 有就用/強化，沒有才抽
npx github:Jeffrey0117/kit-kit new my-kit --desc "…" --repo   # 抽新 kit + 建 repo
npx github:Jeffrey0117/kit-kit update <kit>              # 補/更新現有 kit（clone→改→push）
npx github:Jeffrey0117/kit-kit init my-app               # 勾選 kit → 產一個已組好的專案
```

`check` 範例輸出：

```
🔎 查詢：使用者登入 密碼
✅ 已有 kit 涵蓋 → 去「強化/補充/整合」，別重造：
   → auth-kit  (無函式庫驗證原語：PBKDF2 + JWT)
   → https://github.com/Jeffrey0117/auth-kit
```

## 三個指令

| 指令 | 幹嘛 |
|---|---|
| `list` | 列出 registry 裡的 kit（+ 選用 `gh` 即時撈 GitHub 上還沒登錄的）。 |
| `check "<描述/關鍵字>"` | 比對現有 kit 的涵蓋度 → **reuse**（去強化）或 **extract**（該抽新的）。 |
| `new <name> [--desc] [--dir] [--repo] [--force]` | scaffold 標準骨架；`--repo` 連 GitHub public repo 一起建並加進 registry。 |

## 給 agent 跑

`AGENTS.md` 是**協定**：在任何專案裡工作的 agent（Claude 等）聞到「這塊跨專案通用」時，照它的決策流程 —— 先 `check`，有就強化/整合、沒有才 `new`。把它放進專案讓 agent 讀，就能自動維護生態系。

## 當 lib 用

```js
const forge = require('kit-kit');
const reg = forge.loadRegistry();
forge.recommend('限流 防濫用', reg.kits);  // { action:'reuse'|'extract', kit, ranked }
forge.scaffold('my-kit', './my-kit', { description: '…' });
```

## 慣例

單檔 `index.js`（factory）+ README(含真實 wiring) + example.js + package.json + LICENSE(MIT) + .gitignore。零依賴優先、secret 一律注入、一個 kit 一個職責。

## License

MIT © Jeffrey0117
