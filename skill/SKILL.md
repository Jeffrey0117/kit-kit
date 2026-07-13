---
name: kit-kit
description: Use when you notice a reusable, cross-cutting piece of logic (auth, payments, analytics, rate-limiting, access control, uploads, caching, notifications, scheduling…) that more than one project would want. Checks Jeff's kit ecosystem and either reuses/strengthens an existing kit or extracts a new one. Also use when explicitly asked to "抽 kit" / manage/update a kit.
---

# kit-kit 🍫 — 抽 kit 的 kit（kit²）

Jeff 維護一套零依賴可複用 kit（funnel-kit / media-gate / auth-kit / ratelimit-kit …）。目標：每個專案都拿到最強、最完整版；**改一次 kit，全體專案升級**（複利）。這個 skill 讓那件事自動發生。

## 何時觸發
做功能／review 時聞到「這塊別的專案也會用」的味道：驗證/登入、金流、分析/埋點、限流、存取防護、上傳、快取、通知、排程… 任何跨專案的橫切關注點。或使用者明講「抽 kit」「更新某個 kit」。

## 流程（硬性順序）
1. **先查現有 kit**：`npx github:Jeffrey0117/kit-kit check "<這塊在幹嘛 關鍵字>"`（或 `list`）。
2. **查到 kit 先讀打法**：`npx github:Jeffrey0117/kit-kit skill <name>` — kit 是能力（code），SKILL.md 是判斷（何時用/怎麼接/文案模式怎麼寫），**先讀再動手**。沒有 SKILL.md 就順手補一個（`update` 拉下來寫完 push，registry 該 kit 加 `"skill": true`）。
3. **有 kit 涵蓋 → 不要重造**，三選一：
   - **整合**：讓本專案改用該 kit（內嵌 copy 或 `npm i github:Jeffrey0117/<kit>`）。
   - **強化**：本專案這版更強（多了 timing-safe、修了 bug、加了功能）→ 上游回去：`npx github:Jeffrey0117/kit-kit update <kit>` → 改 → `git commit` + `git push`。
   - **補充**：該 kit 缺一塊、屬於它範疇 → 加進那個 kit。
4. **沒有 kit 涵蓋 → 抽新的**：`npx github:Jeffrey0117/kit-kit new <name> --desc "…" --repo`，然後填 `index.js`（app-specific 用 opts 注入）、README（真實 wiring）、`example.js`（能 `node example.js` 跑）、**`SKILL.md`（打法：何時觸發/接線/模式與文案/地雷）**。

## 鐵則
- **kit ↔ skill 高度綁定**：每個 kit repo 自帶 SKILL.md，code 與打法同版本演化 — 改 kit 順手改 SKILL.md。抽出「銷售頁元件＋文案寫法」這種東西時，元件進 kit、寫法進 SKILL.md，下次直接套。
- 一個 kit 一個單一職責（高內聚）。付費牆＋訂閱＋金流那種綁死 app 的，做成「模板 repo」而不是通用 kit。
- 零依賴優先（node 內建）；要第三方就在 README 講清楚。
- secret / 金鑰一律**注入**，kit 內不 fallback 到公開或預設值。
- 抽出來的東西要**比原本更強**（順手加 timing-safe、錯誤處理、參數化）——kit 是「最強版」所在。
- 抽完先不急著回套所有舊專案；正本放 repo，未來要組合時再套回去。

完整協定：https://github.com/Jeffrey0117/kit-kit/blob/master/AGENTS.md
