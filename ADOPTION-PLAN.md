# 套爆炸計畫 — 全專案 kit 回套 roadmap

37 個 workhub 專案掃描結果。標記：`[copy]`=已內嵌自寫版(正式化/同步最省)、`[cap]`=有此能力可換 kit、`[+]`=沒有但該加。風險=回套工程/破壞 live 服務的風險。

> **誠實前提**：這些多是 **live CloudPipe 服務**，而且內嵌 copy 常已**跟 kit 的 API 分歧**（例如 lurlhub auth 用 `generateJWT`/字串比對，auth-kit 是 `signJWT`/timingSafeEqual）。所以「正式化」不是 sed 一次換掉 —— 要**逐個對齊 API + 本地測 + 部署驗**。分波做，別一次改爆。

## 🌊 Wave 1 — 低風險「已內嵌 copy 正式化/同步」（先打這批，`kit-kit map` 從 0 爆起來）
| 專案 | kit | 備註 |
|---|---|---|
| **lurlhub** ⭐旗艦 | funnel-kit[copy]、video-core-kit[copy]、auth-kit[copy]、ratelimit-kit[copy]、media-gate[copy] | 我最熟、可完整本地測。funnel-kit 已確認 API 對得上(topMeta 都有) |
| **upimg** ⭐ | media-gate[copy]、payuni-embed-kit[copy] | 功能最豐(auth/payments/media/ratelimit)，低風險 |
| **dropkit** | ratelimit-kit[copy] | server.js inline 限流，小而獨立，最好換 |
| **flowlab-form** | ratelimit-kit[copy] | 用 dropkit 實例，同上 |
| **adman** | funnel-kit[copy] | 自寫事件追蹤 |
| **seedblog** | seo-schema-kit[copy] | 自寫 JSON-LD |
| **rawtxt** | ratelimit-kit[copy] | @fastify/rate-limit |
| plottr/pokkit/quickky | ratelimit-kit[copy] | 有 @fastify/rate-limit（quickky 整體高風險，限流本身低） |

## 🌊 Wave 2 — has-capability（有能力，接 kit 標準化；中低風險）
- **auth-kit**：autocard、plottr、pokkit、reelscript、sidegig、survey、upimg（各有自寫 JWT）
- **video-core-kit**：meetube(Shaka)、pokkit
- **audio-dsp-kit / bilingual-subtitle-kit**：meetube（就是這兩個 kit 的 Vue 源頭）
- **ai-content-kit**：autocard(Gemini)、plottr、coursebloom(Deepseek)
- **seo-schema-kit**：coursebloom
- **retry-kit**：workr
- **storyboard-kit**：reelmaker
- **onboarding-kit**：coursebloom(租戶 onboarding)

## 🌊 Wave 3 — would-benefit（新增能力，價值高工程大）
- **seo-schema-kit**：launchkit、myspeedtest、readdy、refile、rawtxt、upimg
- **onboarding-kit**：launchkit、letmeuse、myspeedtest、survey、refile、repic、quickky
- **funnel-kit**：letmeuse、paygate、solohq、survey、quickky
- **ratelimit-kit**：gitloop、mailer、notebody、myspeedtest、readdy、selfize
- **media-gate**：text2img、workr、reelmaker、reelscript、repic、plottr、pokkit
- **video-core-kit**：reelmaker、reelscript、repic
- **storyboard-kit**：plottr、repic、reelmaker
- **payuni-embed-kit**：paygate、sidegig、quickky
- **bilingual-subtitle-kit**：plottr

## ⚠️ 高風險/大工程（單獨排，別碰）
- **checkcut**：Vue Shaka 播放器 → video-core（綁死 Vue，同 meetube 要做殼）
- **autoreel**：字幕系統跟 Remotion 影片綁太緊
- **coursebloom**：payuni 是 business-critical，別亂動

## 🚫 沒 kit 可套
areyoubot(PoW bot detection)、blobstore(內容定址儲存)、canweback(算命)、selfbase(infra)

---

## 潛在總量
~50+ 次 kit 採用、橫跨 ~30 個專案 = 這就是「爆炸」。**執行順序：Wave 1 逐個(對齊 API→本地測→部署驗)→ Wave 2 → Wave 3。** 每波用 `kit-kit map` 追進度。
