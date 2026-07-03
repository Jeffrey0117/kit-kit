# kit-kit 協定（給在任何專案裡跑的 agent）

你在某個專案工作、發現一塊「不只這個專案會用到」的通用邏輯時，**照這個流程走**，維護 Jeff 的 kit 生態系（每個專案都拿到最強、最完整版；改一次 kit 全體升級）。

## 觸發時機
做功能／review 時，聞到「這塊別的專案也會用」的味道：驗證/登入、金流、分析、限流、存取防護、上傳、快取、通知、排程… 任何跨專案的橫切關注點。

## 決策流程（硬性順序）

1. **先查現有 kit**：`npx kit-kit check "這塊在幹嘛 關鍵字"`（或讀 `registry.json`）。
2. **有 kit 涵蓋** → **不要重造**。三選一：
   - **整合**：讓這個專案改用該 kit（內嵌 copy 或 `npm i github:...`）。
   - **強化**：如果本專案這版更強（多了 timing-safe、修了 bug、多了功能）→ 把改進**上游回該 kit repo**，再讓大家升級。
   - **補充**：該 kit 缺一塊、但屬於它的範疇 → 加進那個 kit，別開新 repo。
3. **沒有 kit 涵蓋** → **抽新的**：`npx kit-kit new <name> --desc "..." --repo`，然後：
   - 把通用核心填進 `index.js`（app-specific 的東西用 `opts` 注入）。
   - README 寫**真實 wiring 範例**（別人照著就能接）。
   - `example.js` 要能 `node example.js` 跑起來。
   - 加關鍵字進 registry（`--repo` 會自動加）。

## 鐵則
- **一個 kit 一個單一職責**（高內聚）。付費牆＋訂閱＋金流那種綁死 app 的別硬抽成通用 kit — 那種做成「模板 repo」。
- **零依賴優先**（node 內建）。要第三方就在 README 講清楚。
- **secret / 金鑰一律注入**，kit 內不 fallback 到公開或預設值。
- **抽完先不急著回套所有舊專案**；正本放 repo，未來要組合時再套回去。
- 抽出來的東西要**比原本更強**（順手加 timing-safe、錯誤處理、參數化）——kit 是「最強版」的所在。

## 慣例（scaffold 已幫你生好）
單檔 `index.js`（factory：`module.exports = function create(opts){...}`）+ `README.md`(含 wiring) + `example.js` + `package.json` + `LICENSE`(MIT) + `.gitignore`。
