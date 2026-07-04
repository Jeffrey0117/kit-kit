# video-core-kit 設計（headless 影片核心，功能聯集）

**目標**：把 lurlhub / meetube / coursebloom 三個專案各自的播放器，收斂成**一顆香草、零依賴、框架無關的邏輯核心**。三個專案各套一層很薄的 UI 殼（香草 / Vue / React），共享同一顆核心 → 影片功能收斂到**聯集**、改一次全體升級。

## 為什麼是 headless
播放器 = 邏輯（選源/串流/畫質/狀態/事件）+ UI（控制列）。**邏輯框架無關、UI 綁框架**。所以核心只做邏輯、吃一個既有 `<video>`、發事件；UI 由各專案的薄殼渲染並呼叫核心。這樣才可能跨 stack 回套。

## 功能聯集（從三個實作抽）
| 來源 | 帶來的功能 |
|---|---|
| **lurlhub**（Plyr+hls.js） | 短片直接 MP4；**預覽片段秒開 → 無縫切 HLS**；native HLS(Safari)；MP4 fallback；HLS 畫質選單；poster=縮圖 |
| **meetube**（Shaka） | DASH+HLS 統一；畫質；PiP/劇院；鍵盤快捷；stats |
| **coursebloom**（YouTube iframe） | 自訂控制；±10s；**500ms 進度回呼**；健康檢查→fallback 源 |

## API（草案，香草）
```js
const core = createVideoCore(videoEl, {
  sources: [{ type: 'hls'|'dash'|'mp4'|'youtube', src, quality }],  // 依序挑最佳可播
  poster, autoplay, startTime,
  preview: { src },                       // 秒開片段 → 無縫切正片（lurlhub pattern）
  engine: { Hls, shaka },                 // 注入串流庫（不 bundle → 核心零依賴）
  healthCheck: (src) => Promise<boolean>, // 源健康檢查 → 不通就 fallback（coursebloom）
});
core.on('progress'|'ready'|'qualitychange'|'statechange'|'error', cb);
core.play(); core.pause(); core.seek(t); core.setRate(r); core.setVolume(v);
core.setQuality(level); core.getQualities(); core.destroy();
```

## 設計鐵則
- **核心零依賴**；hls.js / Shaka 由 consumer **注入**（`engine`），不 bundle。
- 只吃 `<video>`（youtube 型吃 iframe adapter）；**不含任何 UI**。
- 全部走**事件**（progress/quality/state/error）→ UI 殼訂閱後自己畫。
- **秒開預覽→無縫切正片**當一等公民（lurlhub 的體驗）。
- **可組合**：URL 帶 `media-gate` token；音效接 `audio-dsp-kit`（EQ node 掛在同一個 media element）；字幕接 `bilingual-subtitle-kit`。

## 交付
1. `video-core-kit`（核心，香草零依賴）。
2. 薄殼（各自 repo 或 examples/）：`video-core-react`、`video-core-vue`、`video-core-vanilla`。
3. 回套：lurlhub 香草殼、meetube Vue 殼、coursebloom React 殼 → 三站影片統一。

> 這比硬抽 meetube 的 Shaka+Vue（綁 49 個 Vuex getter）對——先立核心，殼是小事。
