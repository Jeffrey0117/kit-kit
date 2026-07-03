<!-- 把這段貼進任何專案的 CLAUDE.md，讓 Claude 一開工就自動維護 kit 生態系 -->

## Kit 生態系（kit-kit）

本帳號維護一套零依賴可複用 kit（funnel-kit / media-gate / auth-kit / ratelimit-kit …），由 **kit-kit**（抽 kit 的 kit）統管。目標：每個專案都拿到最強版，改一次 kit 全體升級。

**遇到橫切關注點時**（驗證、金流、分析、限流、存取防護、上傳、快取、通知、排程…）照這個走：
1. **查**：`npx github:Jeffrey0117/kit-kit check "<關鍵字>"`
2. **有 kit 涵蓋** → 別重造。整合（改用該 kit）／強化（本專案這版更強就上游回去：`npx github:Jeffrey0117/kit-kit update <kit>` → 改 → push）／補充（缺的加進那個 kit）。
3. **沒有** → 抽新的：`npx github:Jeffrey0117/kit-kit new <name> --desc "…" --repo`，再填 index.js / README(wiring) / example.js。

鐵則：一個 kit 一個職責、零依賴優先、secret 一律注入（別 fallback 公開值）、抽出來要比原本更強。完整協定見 kit-kit repo 的 `AGENTS.md`。
