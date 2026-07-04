# 抽取待辦（從現有專案挖出來的可複用件）

survey 來源：meetube（Vue3/Shaka）、coursebloom（Next16/TS/Supabase）。持續更新；抽一個就標 ✅，用 `kit-kit new` / 對應 agent 幹。

## ✅ 已抽
- **retry-kit** — 指數退避重試（meetube `helpers/retry.js`）→ https://github.com/Jeffrey0117/retry-kit
- **seo-schema-kit** — schema.org/JSON-LD 產生器（coursebloom `lib/seo/schema-org.ts`）→ https://github.com/Jeffrey0117/seo-schema-kit
- 🔄 **audio-dsp-kit** — Web Audio EQ+音效+增益（meetube `helpers/{equalizer,audio-effects,audio-gain}.js`）

## 🟢 高價值、乾淨（下一批）
- **ai-content-kit** — LLM 內容產生器（文章/銷售頁/DALL-E 封面），coursebloom `lib/ai/{article-generator,deepseek,image-generator}.ts`。低耦合（只抽 generator，Supabase/credit 留在 action 層）。provider 可做成可換（走 AI gateway/Claude）。
- **bilingual-subtitle-kit** — VTT 漸進翻譯 + IDB 快取（meetube `helpers/{bilingual-subtitle,subtitle-cache}.js` + `/api/translate/batch`）。原創功能，配 player 用。

## 🧩 React/shadcn 元件（clean、data-driven，可做成 component kit 或 `coursebloom-ui` 一組）
- **sales-page-builder** — 拖拉式分段落地頁編輯器（9 種區塊），coursebloom `components/sales-page/*`（@hello-pangea/dnd + rhf）。配 ai-content-kit 的銷售頁 generator。
- **bio-kit** — link-in-bio 頁（carousel/可展開/產品/評論/影片卡），coursebloom `components/bio/*`。本身就能當獨立產品。
- **youtube-player-kit** — 自訂控制 YouTube 播放器（±10s、進度回呼、健康檢查 fallback），coursebloom `components/course/CustomYouTubePlayer.tsx`。注意：HLS/自架影片走 **media-gate**，這個是 YouTube 內嵌。
- **chat-ui-kit** — 純呈現聊天 UI（泡泡/輸入/對話列表），coursebloom `components/messaging/*`。
- 榮譽榜：mission-card（遊戲化）、weekly-calendar（預約時段）、price-tiers（分級定價）、sortable-list（@dnd-kit）。

## 🔧 強化現有（別重抽）
- **payuni-embed-kit ← 併入 coursebloom `packages/payuni-sdk/`**：完整 PAYUNi SDK（AES/簽章驗證 + 一次性**與訂閱** webhook + 定價計算 + Next/Express adapter）。補上 embed kit 缺的訂閱 webhook。**這塊已經是抽好的 workspace package，folding 成本最低。**
- **auth-kit ← 遷 meetube/其他專案的登入過去**（meetube 是 session+bcrypt，可換成 auth-kit 的 PBKDF2+JWT）。

## 👑 皇冠（大工程，單獨排）
- **shaka-player-vue** — meetube 的 Shaka+Vue 播放器（VR/劇院/PiP/EQ/字幕/快捷鍵，FreeTube 血統）。價值最高但跟 meetube 綁死（~49 個 Vuex getter、SponsorBlock、i18n）。**先做去耦重構**（getter 牆→props/inject、SponsorBlock 選配），或先摘 `player-components/` 的 11 個 Shaka UI 按鈕 + `helpers/player/utils.js` 當低風險第一刀。

## 🚫 留在 template repo（太 app-coupled，不進 kit 生態系）
- coursebloom **分潤/推薦系統**（cookie last-click、per-tenant、佣金 hold-days、撥款流程）—— 設計好但每個 query 綁 Supabase+tenant。只有 `types/affiliate.ts` 和佣金計算 math 可抽。
- coursebloom **多租戶路由**（middleware/TenantContext，Supabase RLS）、**付款/授權 webhook**（tenant 綁死）。
- coursebloom **Supabase Auth** → 跳過（跟 auth-kit 衝突，非互補）。
- meetube **YouTube proxy**（`server/routes/proxy.js`，寫死 ytimg/googlevideo）→ 留原地；通用的只有「keep-alive + Range 轉發」小 pattern。
